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
 * Validation des filtres platforms
 */
function validateFilters(filters = {}) {
  const validated = {};
  const allowedFields = ['platform_name', 'payment_type', 'status'];

  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFields.includes(key)) continue;

    switch (key) {
      case 'platform_name':
        if (typeof value === 'string' && value.trim().length >= 2) {
          validated[key] = value.trim().substring(0, 100);
        }
        break;

      // payment_type = ['cash'] | ['electronic'] | ['cash', 'electronic']
      case 'payment_type':
        if (Array.isArray(value)) {
          const allowedTypes = ['cash', 'electronic'];
          validated[key] = value.filter((v) => allowedTypes.includes(v));
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
 * Construction de la clause WHERE pour les platforms
 */
function buildWhereClause(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 1;

  if (filters.platform_name) {
    conditions.push(`platform_name ILIKE $${paramCount}`);
    values.push(`%${filters.platform_name}%`);
    paramCount++;
  }

  // payment_type : is_cash_payment est un boolean en DB
  // ['cash']             → is_cash_payment = TRUE
  // ['electronic']       → is_cash_payment = FALSE
  // ['cash','electronic'] → pas de condition (les deux = tout)
  if (filters.payment_type?.length === 1) {
    const isCash = filters.payment_type[0] === 'cash';
    conditions.push(`is_cash_payment = $${paramCount}`);
    values.push(isCash);
    paramCount++;
  }
  // Si les deux sont sélectionnés ou aucun → aucune condition à ajouter

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
 * Server Action - Filtrer les platforms de paiement
 */
export async function getFilteredPlatforms(filters = {}) {
  let client;
  const startTime = Date.now();

  try {
    // Authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_filter_platforms_attempt', {}, 'warning');
      throw new Error('Authentication required');
    }

    // Rate limiting basé sur userId
    const rateLimitKey = `filter_platforms:${session.user.id}`;
    const isRateLimited = await checkServerActionRateLimit(rateLimitKey, {
      windowMs: 2 * 60 * 1000, // 2 minutes
      max: 30,
    });

    if (isRateLimited) {
      logger.warn('Filter platforms rate limit exceeded', {
        userId: session.user.id,
      });
      throw new Error('Too many requests. Please try again later.');
    }

    // Validation des filtres
    const validatedFilters = validateFilters(filters);

    logger.info('Filtering platforms', {
      userId: session.user.id,
      filtersCount: Object.keys(validatedFilters).length,
    });

    // Connexion DB
    client = await getClient();

    // Construction requête
    const { whereClause, values } = buildWhereClause(validatedFilters);

    const query = `
      SELECT
        platform_id,
        platform_name,
        account_name,
        account_number,
        is_cash_payment,
        description,
        created_at,
        updated_at,
        is_active
      FROM admin.platforms
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    const result = await client.query(query, values);

    if (!result || !Array.isArray(result.rows)) {
      await client.cleanup();
      return [];
    }

    // Même sanitization que dans platforms/page.jsx :
    // masquer partiellement les numéros de compte électroniques
    const platforms = result.rows.map((platform) => {
      const isCash = Boolean(platform.is_cash_payment);

      return {
        platform_id: platform.platform_id,
        platform_name: platform.platform_name || '[No Name]',
        is_cash_payment: isCash,
        description: platform.description || null,
        account_name: isCash
          ? null
          : platform.account_name || '[No Account Name]',
        account_number: isCash
          ? null
          : platform.account_number
            ? `${platform.account_number.slice(0, 3)}***${platform.account_number.slice(-2)}`
            : '[No Number]',
        created_at: platform.created_at,
        updated_at: platform.updated_at,
        is_active: Boolean(platform.is_active),
      };
    });

    const responseTime = Date.now() - startTime;

    logger.info('Platforms filtered successfully', {
      count: platforms.length,
      durationMs: responseTime,
      userId: session.user.id,
    });

    trackDatabase('platforms_filtered', {
      count: platforms.length,
      durationMs: responseTime,
      userId: session.user.id,
    });

    await client.cleanup();
    return platforms;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error filtering platforms', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'platforms_filter', {
      durationMs: responseTime,
      filters,
    });

    if (client) await client.cleanup();

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'An error occurred while filtering platforms. Please try again.',
      );
    } else {
      throw error;
    }
  }
}
