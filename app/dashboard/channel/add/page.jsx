// app/dashboard/channel/add/page.jsx
import AddVideo from '@/ui/pages/channel/AddVideo';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { query } from '@/backend/dbConnect';
import logger from '@/utils/logger';
import {
  trackAuth,
  trackDatabase,
  trackDatabaseError,
} from '@/utils/monitoring';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

async function getExistingCategories() {
  try {
    const result = await query(`
      SELECT DISTINCT video_category
      FROM catalog.channel_videos
      WHERE video_category IS NOT NULL
        AND video_category != ''
      ORDER BY video_category ASC
    `);

    const categories = result.rows
      .map((row) => row.video_category)
      .filter(Boolean);

    trackDatabase('existing_categories_fetched_add', {
      count: categories.length,
    });

    return categories;
  } catch (error) {
    logger.error('Error fetching existing categories for add', {
      error: error.message,
    });
    trackDatabaseError(error, 'existing_categories_fetch_add');
    return [];
  }
}

export default async function AddVideoPage() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_add_video_access', {}, 'warning');
      redirect('/login');
    }

    const existingCategories = await getExistingCategories();

    logger.info('Add video page rendered', {
      userId: session.user.id,
      existingCategoriesCount: existingCategories.length,
    });

    return <AddVideo existingCategories={existingCategories} />;
  } catch (error) {
    logger.error('Add video page error', { error: error.message });
    trackDatabaseError(error, 'add_video_page_render');
    return <AddVideo existingCategories={[]} />;
  }
}

export const metadata = {
  title: 'Add Video | Benew Admin',
  robots: 'noindex, nofollow',
};
