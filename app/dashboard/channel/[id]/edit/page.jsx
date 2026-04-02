// app/dashboard/channel/[id]/edit/page.jsx
import EditVideo from '@/ui/pages/channel/EditVideo';
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient, query } from '@/backend/dbConnect';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';
import { videoIdSchema } from '@/utils/schemas/videoSchema';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

/**
 * Récupérer une vidéo pour édition
 */
async function getVideoForEditFromDatabase(videoId) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Fetching video for edit', { requestId, videoId });

  try {
    // ===== 1. VALIDATION ID =====
    try {
      await videoIdSchema.validate({ id: videoId }, { abortEarly: false });
    } catch (validationError) {
      logger.warn('Invalid video ID for edit', {
        requestId,
        videoId,
        errors: validationError.inner?.map((e) => e.path),
      });
      trackValidation('invalid_video_id_edit_page', { videoId }, 'warning');
      return null;
    }

    // ===== 2. NETTOYAGE UUID =====
    const cleanedVideoId = videoId?.toString().trim();
    if (!cleanedVideoId) {
      logger.warn('Video ID cleaning failed for edit', { requestId, videoId });
      return null;
    }

    // ===== 3. CONNEXION DB =====
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('DB connection failed during video fetch for edit', {
        error: dbConnectionError.message,
        requestId,
        videoId: cleanedVideoId,
      });
      trackDatabaseError(dbConnectionError, 'db_connection_edit_video_page', {
        requestId,
        videoId: cleanedVideoId,
      });
      throw dbConnectionError;
    }

    // ===== 4. QUERY VIDEO =====
    let result;
    try {
      const videoQuery = `
        SELECT
          video_id,
          video_title,
          video_description,
          video_cloudinary_id,
          video_thumbnail_id,
          video_category,
          video_tags,
          video_duration_seconds,
          views_count,
          is_active,
          created_at,
          updated_at
        FROM catalog.channel_videos
        WHERE video_id = $1
      `;

      result = await client.query(videoQuery, [cleanedVideoId]);
    } catch (queryError) {
      logger.error('Query error fetching video for edit', {
        error: queryError.message,
        requestId,
        videoId: cleanedVideoId,
      });
      trackDatabaseError(queryError, 'query_video_for_edit', {
        requestId,
        videoId: cleanedVideoId,
      });
      await client.cleanup();
      throw queryError;
    }

    // ===== 5. VÉRIFICATION RÉSULTAT =====
    if (result.rows.length === 0) {
      logger.warn('Video not found in database for edit', {
        requestId,
        videoId: cleanedVideoId,
      });
      trackDatabase(
        'video_not_found_edit_page',
        { videoId: cleanedVideoId },
        'warning',
      );
      await client.cleanup();
      return null;
    }

    // ===== 6. SANITIZATION =====
    const video = result.rows[0];
    const sanitizedVideo = {
      video_id: video.video_id,
      video_title: video.video_title || '',
      video_description: video.video_description || '',
      video_cloudinary_id: video.video_cloudinary_id,
      video_thumbnail_id: video.video_thumbnail_id || null,
      video_category: video.video_category || null,
      video_tags: video.video_tags || [],
      video_duration_seconds: video.video_duration_seconds
        ? parseInt(video.video_duration_seconds)
        : null,
      views_count: parseInt(video.views_count) || 0,
      is_active: Boolean(video.is_active),
      created_at: video.created_at,
      updated_at: video.updated_at,
    };

    const responseTime = Date.now() - startTime;

    logger.info('Video fetched for edit successfully', {
      videoId: cleanedVideoId,
      title: sanitizedVideo.video_title,
      durationMs: responseTime,
      requestId,
    });

    trackDatabase('video_fetched_for_edit', {
      videoId: cleanedVideoId,
      durationMs: responseTime,
    });

    await client.cleanup();
    return sanitizedVideo;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Global error fetching video for edit', {
      error: error.message,
      videoId,
      durationMs: responseTime,
      requestId,
    });

    trackDatabaseError(error, 'video_fetch_for_edit_global', {
      videoId,
      durationMs: responseTime,
      requestId,
      critical: 'true',
    });

    if (client) await client.cleanup();
    throw error;
  }
}

// Ajouter cette fonction (après getVideoForEditFromDatabase)
async function getExistingCategories() {
  try {
    const result = await query(`
      SELECT DISTINCT video_category
      FROM catalog.channel_videos
      WHERE video_category IS NOT NULL
        AND video_category != ''
      ORDER BY video_category ASC
    `);

    return result.rows.map((row) => row.video_category).filter(Boolean);
  } catch (error) {
    logger.error('Error fetching existing categories for edit', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Server Component - Page Edit Video
 */
export default async function EditVideoPage({ params }) {
  try {
    const { id } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      logger.warn('Unauthenticated access to edit video');
      trackAuth('unauthenticated_edit_video_access', {}, 'warning');
      redirect('/login');
    }

    // Récupérer la vidéo et les catégories existantes en parallèle
    const [video, existingCategories] = await Promise.all([
      getVideoForEditFromDatabase(id),
      getExistingCategories(),
    ]);

    if (!video) {
      logger.info('Video not found for edit, triggering notFound()', {
        videoId: id,
        userId: session.user.id,
      });
      notFound();
    }

    logger.info('Edit video page rendered', {
      videoId: video.video_id,
      videoTitle: video.video_title,
      userId: session.user.id,
      existingCategoriesCount: existingCategories.length,
    });

    return <EditVideo video={video} existingCategories={existingCategories} />;
  } catch (error) {
    if (
      error.message?.includes('NEXT_REDIRECT') ||
      error.message?.includes('NEXT_NOT_FOUND')
    ) {
      throw error;
    }

    logger.error('Edit video page error', {
      error: error.message,
      stack: error.stack,
    });

    trackDatabaseError(error, 'edit_video_page_render', { critical: 'true' });

    throw error;
  }
}

export const metadata = {
  title: 'Edit Video | Benew Admin',
  robots: 'noindex, nofollow',
};
