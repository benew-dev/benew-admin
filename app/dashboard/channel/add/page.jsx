// app/dashboard/channel/add/page.jsx
import AddVideo from '@/ui/pages/channel/AddVideo';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import logger from '@/utils/logger';
import { trackAuth, trackDatabaseError } from '@/utils/monitoring';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

/**
 * Server Component - Page Add Video
 */
export default async function AddVideoPage() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      trackAuth('unauthenticated_add_video_access', {}, 'warning');
      redirect('/login');
    }

    logger.info('Add video page rendered', { userId: session.user.id });

    return <AddVideo />;
  } catch (error) {
    logger.error('Add video page error', { error: error.message });
    trackDatabaseError(error, 'add_video_page_render');
    return <AddVideo />;
  }
}

export const metadata = {
  title: 'Add Video | Benew Admin',
  robots: 'noindex, nofollow',
};
