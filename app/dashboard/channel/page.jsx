// app/dashboard/channel/page.jsx
import VideosList from '@/ui/pages/channel/VideosList';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getClient } from '@/backend/dbConnect';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
} from '@/utils/monitoring';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

/**
 * Récupérer les vidéos depuis la base de données
 */
async function getVideosFromDatabase() {
  let client;
  const startTime = Date.now();

  try {
    client = await getClient();

    const videosQuery = `
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
      ORDER BY created_at DESC
    `;

    const result = await client.query(videosQuery);

    if (!result || !Array.isArray(result.rows)) {
      logger.warn('Invalid data structure from videos query');
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

    logger.info('Videos fetched successfully', {
      count: videos.length,
      durationMs: responseTime,
    });

    trackDatabase('videos_fetched', {
      count: videos.length,
      durationMs: responseTime,
    });

    await client.cleanup();
    return videos;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error fetching videos', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'videos_fetch', {
      durationMs: responseTime,
    });

    if (client) await client.cleanup();
    return [];
  }
}

/**
 * Server Component - Page Channel (Videos List)
 */
export default async function ChannelPage() {
  try {
    // Vérification session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_channel_access', {}, 'warning');
      redirect('/login');
    }

    // Récupération des vidéos
    const videos = await getVideosFromDatabase();

    logger.info('Channel page rendered', {
      count: videos.length,
      userId: session.user.id,
    });

    return <VideosList data={videos} />;
  } catch (error) {
    logger.error('Channel page error', {
      error: error.message,
    });

    trackDatabaseError(error, 'channel_page_render');

    // Fallback avec données vides
    return <VideosList data={[]} />;
  }
}

export const metadata = {
  title: 'Channel | Benew Admin',
  robots: 'noindex, nofollow',
};
