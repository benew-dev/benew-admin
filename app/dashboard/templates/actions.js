'use server';

import { getClient } from '@/backend/dbConnect';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { checkServerActionRateLimit } from '@/backend/rateLimiter';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
} from '@/utils/monitoring';

/**
 * Validation des filtres templates
 */
function validateFilters(filters = {}) {
  const validated = {};
  const allowedFields = ['template_name', 'platform', 'status'];

  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFields.includes(key)) continue;

    switch (key) {
      case 'template_name':
        if (typeof value === 'string' && value.trim().length >= 2) {
          validated[key] = value.trim().substring(0, 100);
        }
        break;

      // platform = web | mobile | both (filtre sur template_has_web / template_has_mobile)
      case 'platform':
        if (Array.isArray(value)) {
          const allowedPlatforms = ['web', 'mobile'];
          validated[key] = value.filter((v) => allowedPlatforms.includes(v));
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
 * Construction de la clause WHERE pour les templates
 */
function buildWhereClause(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 1;

  if (filters.template_name) {
    conditions.push(`template_name ILIKE $${paramCount}`);
    values.push(`%${filters.template_name}%`);
    paramCount++;
  }

  // Filtre plateforme : OR entre les valeurs sélectionnées
  // ex: ['web'] → template_has_web = true
  // ex: ['mobile'] → template_has_mobile = true
  // ex: ['web', 'mobile'] → template_has_web = true OR template_has_mobile = true
  if (filters.platform?.length > 0) {
    const platformConditions = [];
    if (filters.platform.includes('web')) {
      platformConditions.push('template_has_web = TRUE');
    }
    if (filters.platform.includes('mobile')) {
      platformConditions.push('template_has_mobile = TRUE');
    }
    if (platformConditions.length > 0) {
      conditions.push(`(${platformConditions.join(' OR ')})`);
    }
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
 * Server Action - Filtrer les templates
 */
export async function getFilteredTemplates(filters = {}) {
  let client;
  const startTime = Date.now();

  try {
    // Authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_filter_templates_attempt', {}, 'warning');
      throw new Error('Authentication required');
    }

    // Rate limiting basé sur userId
    const rateLimitKey = `filter_templates:${session.user.id}`;
    const isRateLimited = await checkServerActionRateLimit(rateLimitKey, {
      windowMs: 2 * 60 * 1000, // 2 minutes
      max: 30,
    });

    if (isRateLimited) {
      logger.warn('Filter templates rate limit exceeded', {
        userId: session.user.id,
      });
      throw new Error('Too many requests. Please try again later.');
    }

    // Validation des filtres
    const validatedFilters = validateFilters(filters);

    logger.info('Filtering templates', {
      userId: session.user.id,
      filtersCount: Object.keys(validatedFilters).length,
    });

    // Connexion DB
    client = await getClient();

    // Construction requête
    const { whereClause, values } = buildWhereClause(validatedFilters);

    const query = `
      SELECT
        template_id,
        template_name,
        template_images,
        template_has_web,
        template_has_mobile,
        template_added,
        sales_count,
        is_active,
        updated_at
      FROM catalog.templates
      ${whereClause}
      ORDER BY template_added DESC
      LIMIT 1000
    `;

    const result = await client.query(query, values);

    if (!result || !Array.isArray(result.rows)) {
      await client.cleanup();
      return [];
    }

    const templates = result.rows.map((template) => ({
      template_id: template.template_id,
      template_name: template.template_name || '[No Name]',
      template_images: template.template_images || [],
      template_has_web: Boolean(template.template_has_web),
      template_has_mobile: Boolean(template.template_has_mobile),
      template_added: template.template_added,
      sales_count: parseInt(template.sales_count, 10) || 0,
      is_active: Boolean(template.is_active),
      updated_at: template.updated_at,
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Templates filtered successfully', {
      count: templates.length,
      durationMs: responseTime,
      userId: session.user.id,
    });

    trackDatabase('templates_filtered', {
      count: templates.length,
      durationMs: responseTime,
      userId: session.user.id,
    });

    await client.cleanup();
    return templates;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error filtering templates', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'templates_filter', {
      durationMs: responseTime,
      filters,
    });

    if (client) await client.cleanup();

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'An error occurred while filtering templates. Please try again.',
      );
    } else {
      throw error;
    }
  }
}
