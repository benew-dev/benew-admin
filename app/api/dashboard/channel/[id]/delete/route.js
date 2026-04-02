// app/api/dashboard/channel/[id]/delete/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import cloudinary from '@/backend/cloudinary';
import { getClient } from '@/backend/dbConnect';
import { applyRateLimit } from '@/backend/rateLimiter';
import { videoIdSchema } from '@/utils/schemas/videoSchema';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
  trackValidation,
} from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const deleteVideoRateLimit = applyRateLimit('CONTENT_API', {
  windowMs: 10 * 60 * 1000,
  max: 5,
  message:
    'Trop de tentatives de suppression de vidéos. Veuillez réessayer dans quelques minutes.',
  prefix: 'delete_video',
});

function createResponseHeaders(requestId, responseTime) {
  return {
    'X-Request-ID': requestId,
    'X-Response-Time': `${responseTime}ms`,
  };
}

export async function DELETE(request, { params }) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const { id } = await params;

  logger.info('Delete video API called', { requestId, videoId: id });

  try {
    // ===== 1. VALIDATION ID =====
    try {
      await videoIdSchema.validate({ id }, { abortEarly: false });
    } catch (idValidationError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Invalid video ID', {
        requestId,
        videoId: id,
        error: idValidationError.message,
      });

      trackValidation('invalid_video_id_delete', { videoId: id }, 'warning');

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid video ID format',
          message: 'This video does not exist',
        },
        { status: 400, headers: header },
      );
    }

    // ===== 2. NETTOYAGE UUID =====
    const cleanedVideoId = id?.toString().trim();
    if (!cleanedVideoId) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Video ID cleaning failed', { requestId, providedId: id });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid video ID format',
          message: 'This video does not exist',
        },
        { status: 400, headers: header },
      );
    }

    // ===== 3. RATE LIMITING =====
    const rateLimitResponse = await deleteVideoRateLimit(request);
    if (rateLimitResponse) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Delete video rate limit exceeded', {
        requestId,
        videoId: cleanedVideoId,
      });

      trackDatabase('delete_video_rate_limit_exceeded', {}, 'warning');

      const rateLimitBody = await rateLimitResponse.json();
      return NextResponse.json(rateLimitBody, {
        status: 429,
        headers: header,
      });
    }

    // ===== 4. AUTHENTIFICATION =====
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.warn('Unauthenticated delete video attempt', {
        requestId,
        videoId: cleanedVideoId,
      });

      trackAuth('unauthenticated_delete_video', {}, 'warning');

      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401, headers: header },
      );
    }

    // ===== 5. CONNEXION DB =====
    try {
      client = await getClient();
    } catch (dbError) {
      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Database connection failed', {
        error: dbError.message,
        requestId,
        videoId: cleanedVideoId,
      });

      trackDatabaseError(dbError, 'db_connection_delete_video', { requestId });

      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 503, headers: header },
      );
    }

    // ===== 6. VÉRIFICATION EXISTENCE ET ÉTAT =====
    let videoToDelete;
    try {
      const checkResult = await client.query(
        `SELECT
          video_id,
          video_title,
          video_cloudinary_id,
          video_thumbnail_id,
          is_active
        FROM catalog.channel_videos
        WHERE video_id = $1`,
        [cleanedVideoId],
      );

      if (checkResult.rows.length === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Video not found for deletion', {
          requestId,
          videoId: cleanedVideoId,
        });

        trackValidation('video_not_found_delete', {}, 'warning');

        return NextResponse.json(
          { success: false, message: 'This video does not exist' },
          { status: 404, headers: header },
        );
      }

      videoToDelete = checkResult.rows[0];

      // Bloquer la suppression si la vidéo est active
      if (videoToDelete.is_active === true) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.warn('Attempted to delete active video', {
          requestId,
          videoId: cleanedVideoId,
          title: videoToDelete.video_title,
        });

        trackValidation(
          'delete_active_video_blocked',
          { videoId: cleanedVideoId },
          'warning',
        );

        return NextResponse.json(
          {
            success: false,
            message:
              'Cannot delete active video. Please deactivate the video first.',
            error: 'Video is currently active',
          },
          { status: 400, headers: header },
        );
      }
    } catch (checkError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Video check error', {
        error: checkError.message,
        requestId,
        videoId: cleanedVideoId,
      });

      trackDatabaseError(checkError, 'video_check_delete', { requestId });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify video status',
          message: 'Something went wrong! Please try again',
        },
        { status: 500, headers: header },
      );
    }

    // ===== 8. SUPPRESSION EN BASE =====
    let deleteResult;
    try {
      deleteResult = await client.query(
        `DELETE FROM catalog.channel_videos
         WHERE video_id = $1
         AND is_active = false
         RETURNING video_title, video_cloudinary_id, video_thumbnail_id`,
        [cleanedVideoId],
      );

      if (deleteResult.rowCount === 0) {
        await client.cleanup();

        const responseTime = Date.now() - startTime;
        const header = createResponseHeaders(requestId, responseTime);

        logger.error('Deletion failed - no rows affected', {
          requestId,
          videoId: cleanedVideoId,
        });

        trackDatabaseError(
          new Error('No rows affected'),
          'video_deletion_failed',
          { requestId },
        );

        return NextResponse.json(
          {
            success: false,
            message:
              'Video could not be deleted. It may be active or already deleted.',
            error: 'Deletion conditions not met',
          },
          { status: 400, headers: header },
        );
      }
    } catch (deleteError) {
      await client.cleanup();

      const responseTime = Date.now() - startTime;
      const header = createResponseHeaders(requestId, responseTime);

      logger.error('Video deletion error', {
        error: deleteError.message,
        requestId,
        videoId: cleanedVideoId,
      });

      trackDatabaseError(deleteError, 'video_deletion', { requestId });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete video from database',
          message: 'Something went wrong! Please try again',
        },
        { status: 500, headers: header },
      );
    }

    // ===== 9. SUPPRESSION CLOUDINARY =====
    const deletedVideo = deleteResult.rows[0];
    let cloudinaryDeleted = 0;
    let cloudinaryFailed = 0;

    // Supprimer la vidéo principale
    if (videoToDelete.video_cloudinary_id) {
      try {
        await cloudinary.uploader.destroy(videoToDelete.video_cloudinary_id, {
          resource_type: 'video',
        });
        cloudinaryDeleted++;
      } catch (cloudError) {
        cloudinaryFailed++;
        logger.warn('Error deleting video from Cloudinary', {
          requestId,
          videoId: cleanedVideoId,
          publicId: videoToDelete.video_cloudinary_id,
          error: cloudError.message,
        });
      }
    }

    // Supprimer la thumbnail si elle existe
    if (videoToDelete.video_thumbnail_id) {
      try {
        await cloudinary.uploader.destroy(videoToDelete.video_thumbnail_id, {
          resource_type: 'image',
        });
        cloudinaryDeleted++;
      } catch (cloudError) {
        cloudinaryFailed++;
        logger.warn('Error deleting thumbnail from Cloudinary', {
          requestId,
          videoId: cleanedVideoId,
          publicId: videoToDelete.video_thumbnail_id,
          error: cloudError.message,
        });
      }
    }

    const responseTime = Date.now() - startTime;

    logger.info('Video deleted successfully', {
      videoId: cleanedVideoId,
      title: deletedVideo.video_title,
      cloudinaryDeleted,
      cloudinaryFailed,
      durationMs: responseTime,
      userId: session.user.id,
      requestId,
    });

    trackDatabase('video_deleted_successfully', {
      videoId: cleanedVideoId,
      title: deletedVideo.video_title,
      userId: session.user.id,
    });

    await client.cleanup();

    const header = createResponseHeaders(requestId, responseTime);

    return NextResponse.json(
      {
        success: true,
        message: 'Video and associated assets deleted successfully',
        video: {
          id: cleanedVideoId,
          title: deletedVideo.video_title,
        },
        cloudinary: {
          deleted: cloudinaryDeleted,
          failed: cloudinaryFailed,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200, headers: header },
    );
  } catch (error) {
    if (client) await client.cleanup();

    const responseTime = Date.now() - startTime;
    const header = createResponseHeaders(requestId, responseTime);

    logger.error('Global delete video error', {
      error: error.message,
      requestId,
      videoId: id,
    });

    trackDatabaseError(error, 'delete_video_global', {
      requestId,
      durationMs: responseTime,
      critical: 'true',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Something went wrong! Please try again',
        requestId,
      },
      { status: 500, headers: header },
    );
  }
}
