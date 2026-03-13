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
 * Validation des filtres vidéo
 */
function validateFilters(filters = {}) {
  const validated = {};
  const allowedFields = ['video_title', 'category', 'level', 'status'];

  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFields.includes(key)) continue;

    switch (key) {
      case 'video_title':
        if (typeof value === 'string' && value.trim().length >= 2) {
          validated[key] = value.trim().substring(0, 100);
        }
        break;

      case 'category':
        if (Array.isArray(value)) {
          const allowedCategories = [
            'tutorial',
            'overview',
            'demo',
            'setup',
            'tips',
          ];
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
 * Construction de la clause WHERE pour les vidéos
 */
function buildWhereClause(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 1;

  if (filters.video_title) {
    conditions.push(`video_title ILIKE $${paramCount}`);
    values.push(`%${filters.video_title}%`);
    paramCount++;
  }

  if (filters.category?.length > 0) {
    const placeholders = filters.category
      .map(() => `$${paramCount++}`)
      .join(', ');
    conditions.push(`video_category IN (${placeholders})`);
    values.push(...filters.category);
  }

  if (filters.level?.length > 0) {
    const placeholders = filters.level.map(() => `$${paramCount++}`).join(', ');
    conditions.push(`video_level IN (${placeholders})`);
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
 * Server Action - Filtrer les vidéos
 */
export async function getFilteredVideos(filters = {}) {
  let client;
  const startTime = Date.now();

  try {
    // Authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_filter_videos_attempt', {}, 'warning');
      throw new Error('Authentication required');
    }

    // Rate limiting basé sur userId
    const rateLimitKey = `filter_videos:${session.user.id}`;
    const isRateLimited = await checkServerActionRateLimit(rateLimitKey, {
      windowMs: 2 * 60 * 1000,
      max: 30,
    });

    if (isRateLimited) {
      logger.warn('Filter videos rate limit exceeded', {
        userId: session.user.id,
      });
      throw new Error('Too many requests. Please try again later.');
    }

    // Validation des filtres
    const validatedFilters = validateFilters(filters);

    logger.info('Filtering videos', {
      userId: session.user.id,
      filtersCount: Object.keys(validatedFilters).length,
    });

    // Connexion DB
    client = await getClient();

    // Construction requête
    const { whereClause, values } = buildWhereClause(validatedFilters);

    const query = `
      SELECT
        video_id,
        video_title,
        video_description,
        video_cloudinary_id,
        video_thumbnail_id,
        video_category,
        video_level,
        video_tags,
        video_duration_seconds,
        views_count,
        series_name,
        series_order,
        related_application_id,
        related_template_id,
        is_active,
        created_at,
        updated_at
      FROM catalog.channel_videos
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    const result = await client.query(query, values);

    if (!result || !Array.isArray(result.rows)) {
      await client.cleanup();
      return [];
    }

    const videos = result.rows.map((video) => ({
      video_id: video.video_id,
      video_title: video.video_title || '[No Title]',
      video_description: video.video_description || null,
      video_cloudinary_id: video.video_cloudinary_id,
      video_thumbnail_id: video.video_thumbnail_id || null,
      video_category: video.video_category || 'tutorial',
      video_level: video.video_level || 1,
      video_tags: video.video_tags || [],
      video_duration_seconds: video.video_duration_seconds
        ? parseInt(video.video_duration_seconds)
        : null,
      views_count: parseInt(video.views_count) || 0,
      series_name: video.series_name || null,
      series_order: video.series_order ? parseInt(video.series_order) : null,
      related_application_id: video.related_application_id || null,
      related_template_id: video.related_template_id || null,
      is_active: Boolean(video.is_active),
      created_at: video.created_at,
      updated_at: video.updated_at,
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Videos filtered successfully', {
      count: videos.length,
      durationMs: responseTime,
      userId: session.user.id,
    });

    trackDatabase('videos_filtered', {
      count: videos.length,
      durationMs: responseTime,
      userId: session.user.id,
    });

    await client.cleanup();
    return videos;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error filtering videos', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'videos_filter', {
      durationMs: responseTime,
      filters,
    });

    if (client) await client.cleanup();

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'An error occurred while filtering videos. Please try again.',
      );
    } else {
      throw error;
    }
  }
}
