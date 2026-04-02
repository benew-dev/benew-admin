// app/dashboard/channel/[id]/page.jsx
import SingleVideo from '@/ui/pages/channel/SingleVideo';
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
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
 * Récupérer une vidéo spécifique depuis la base de données
 */
async function getVideoFromDatabase(videoId) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Fetching video by ID', { requestId, videoId });

  try {
    // ===== 1. VALIDATION ID =====
    try {
      await videoIdSchema.validate({ id: videoId }, { abortEarly: false });
    } catch (validationError) {
      logger.warn('Invalid video ID', {
        requestId,
        videoId,
        errors: validationError.inner?.map((e) => e.path),
      });
      trackValidation('invalid_video_id_single', { videoId }, 'warning');
      return null;
    }

    // ===== 2. NETTOYAGE UUID =====
    const cleanedVideoId = videoId?.toString().trim();
    if (!cleanedVideoId) {
      logger.warn('Video ID cleaning failed', { requestId, videoId });
      return null;
    }

    // ===== 3. CONNEXION DB =====
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('DB connection failed during video fetch', {
        error: dbConnectionError.message,
        requestId,
        videoId: cleanedVideoId,
      });
      trackDatabaseError(dbConnectionError, 'db_connection_single_video', {
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
      logger.error('Query error fetching video', {
        error: queryError.message,
        requestId,
        videoId: cleanedVideoId,
      });
      trackDatabaseError(queryError, 'query_single_video', {
        requestId,
        videoId: cleanedVideoId,
      });
      await client.cleanup();
      throw queryError;
    }

    // ===== 5. VÉRIFICATION RÉSULTAT =====
    if (result.rows.length === 0) {
      logger.warn('Video not found in database', {
        requestId,
        videoId: cleanedVideoId,
      });
      trackDatabase(
        'video_not_found_single',
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
      video_title: video.video_title || '[No Title]',
      video_description: video.video_description || null,
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

    logger.info('Video fetched successfully', {
      videoId: cleanedVideoId,
      title: sanitizedVideo.video_title,
      durationMs: responseTime,
      requestId,
    });

    trackDatabase('single_video_fetched', {
      videoId: cleanedVideoId,
      durationMs: responseTime,
    });

    await client.cleanup();
    return sanitizedVideo;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Global error fetching video', {
      error: error.message,
      videoId,
      durationMs: responseTime,
      requestId,
    });

    trackDatabaseError(error, 'single_video_fetch_global', {
      videoId,
      durationMs: responseTime,
      requestId,
      critical: 'true',
    });

    if (client) await client.cleanup();
    throw error;
  }
}

/**
 * Server Component - Page Single Video
 */
export default async function SingleVideoPage({ params }) {
  try {
    // ===== 1. RÉCUPÉRATION ID =====
    const { id } = await params;

    // ===== 2. VÉRIFICATION AUTH =====
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      logger.warn('Unauthenticated access to single video');
      trackAuth('unauthenticated_single_video_access', {}, 'warning');
      redirect('/login');
    }

    // ===== 3. RÉCUPÉRATION VIDÉO =====
    const video = await getVideoFromDatabase(id);

    // Si null → déclencher not-found.jsx
    if (!video) {
      logger.info('Video not found, triggering notFound()', {
        videoId: id,
        userId: session.user.id,
      });
      notFound();
    }

    // ===== 4. RENDER =====
    logger.info('Single video page rendered', {
      videoId: video.video_id,
      videoTitle: video.video_title,
      userId: session.user.id,
    });

    return <SingleVideo data={video} />;
  } catch (error) {
    if (
      error.message?.includes('NEXT_REDIRECT') ||
      error.message?.includes('NEXT_NOT_FOUND')
    ) {
      throw error;
    }

    logger.error('Single video page error', {
      error: error.message,
      stack: error.stack,
    });

    trackDatabaseError(error, 'single_video_page_render', {
      critical: 'true',
    });

    throw error;
  }
}

export const metadata = {
  title: 'Video Details | Benew Admin',
  robots: 'noindex, nofollow',
};
