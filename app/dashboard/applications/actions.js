'use server';

import { getClient } from '@/backend/dbConnect';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { applyRateLimit } from '@/backend/rateLimiter';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
} from '@/utils/monitoring';

const filterRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 2 * 60 * 1000,
  max: 30,
  message:
    'Trop de tentatives de filtrage. Veuillez réessayer dans quelques minutes.',
  prefix: 'filter_applications',
});

/**
 * Validation des filtres
 */
function validateFilters(filters = {}) {
  const validated = {};
  const allowedFields = ['application_name', 'category', 'level', 'status'];

  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFields.includes(key)) continue;

    switch (key) {
      case 'application_name':
        if (typeof value === 'string' && value.trim().length >= 2) {
          validated[key] = value.trim().substring(0, 100);
        }
        break;

      case 'category':
        if (Array.isArray(value)) {
          const allowedCategories = ['mobile', 'web'];
          validated[key] = value.filter((v) => allowedCategories.includes(v));
        }
        break;

      case 'level':
        if (Array.isArray(value)) {
          const allowedLevels = ['1', '2', '3', '4', '5'];
          validated[key] = value.filter((v) => allowedLevels.includes(v));
        }
        break;

      case 'status':
        if (Array.isArray(value)) {
          const allowedStatuses = ['true', 'false'];
          validated[key] = value.filter((v) => allowedStatuses.includes(v));
        }
        break;
    }
  }

  return validated;
}

/**
 * Construction de la clause WHERE
 */
function buildWhereClause(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 1;

  if (filters.application_name) {
    conditions.push(`application_name ILIKE $${paramCount}`);
    values.push(`%${filters.application_name}%`);
    paramCount++;
  }

  if (filters.category?.length > 0) {
    const placeholders = filters.category
      .map(() => `$${paramCount++}`)
      .join(', ');
    conditions.push(`application_category IN (${placeholders})`);
    values.push(...filters.category);
  }

  if (filters.level?.length > 0) {
    const placeholders = filters.level.map(() => `$${paramCount++}`).join(', ');
    conditions.push(`application_level IN (${placeholders})`);
    values.push(...filters.level.map((l) => parseInt(l)));
  }

  if (filters.status?.length > 0) {
    const placeholders = filters.status
      .map(() => `$${paramCount++}`)
      .join(', ');
    conditions.push(`is_active IN (${placeholders})`);
    values.push(...filters.status.map((s) => s === 'true'));
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, values };
}

/**
 * Server Action - Filtrer les applications
 */
export async function getFilteredApplications(filters = {}) {
  let client;
  const startTime = Date.now();

  try {
    // Authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_filter_attempt', {}, 'warning');
      throw new Error('Authentication required');
    }

    // Rate limiting
    const rateLimitResponse = await filterRateLimit();
    if (rateLimitResponse) {
      logger.warn('Filter rate limit exceeded', { userId: session.user.id });
      throw new Error('Too many requests. Please try again later.');
    }

    // Validation des filtres
    const validatedFilters = validateFilters(filters);

    logger.info('Filtering applications', {
      userId: session.user.id,
      filtersCount: Object.keys(validatedFilters).length,
    });

    // Connexion DB
    client = await getClient();

    // Construction requête
    const { whereClause, values } = buildWhereClause(validatedFilters);

    const query = `
      SELECT 
        application_id, 
        application_name, 
        application_images,
        application_category, 
        application_fee, 
        application_rent, 
        application_link, 
        application_level,
        is_active,
        created_at,
        sales_count,
        updated_at
      FROM catalog.applications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    const result = await client.query(query, values);

    if (!result || !Array.isArray(result.rows)) {
      await client.cleanup();
      return [];
    }

    const applications = result.rows.map((app) => ({
      application_id: app.application_id,
      application_name: app.application_name || '[No Name]',
      application_images: app.application_images || [],
      application_category: app.application_category || 'web',
      application_fee: parseFloat(app.application_fee) || 0,
      application_rent: parseFloat(app.application_rent) || 0,
      application_link: app.application_link,
      application_level: app.application_level || 1,
      is_active: Boolean(app.is_active),
      sales_count: parseInt(app.sales_count) || 0,
      created_at: app.created_at,
      updated_at: app.updated_at,
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Applications filtered successfully', {
      count: applications.length,
      durationMs: responseTime,
      userId: session.user.id,
    });

    trackDatabase('applications_filtered', {
      count: applications.length,
      durationMs: responseTime,
      userId: session.user.id,
    });

    await client.cleanup();
    return applications;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error filtering applications', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'applications_filter', {
      durationMs: responseTime,
      filters,
    });

    if (client) await client.cleanup();

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'An error occurred while filtering applications. Please try again.',
      );
    } else {
      throw error;
    }
  }
}
