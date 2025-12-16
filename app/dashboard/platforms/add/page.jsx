// app/dashboard/platforms/add/page.jsx
import AddPlatform from '@/ui/pages/platforms/AddPlatform';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import logger from '@/utils/logger';
import { trackAuth } from '@/utils/monitoring';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function AddPlatformPage() {
  try {
    // Vérification session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_add_platform_access', {}, 'warning');
      redirect('/login');
    }

    logger.info('Add platform page rendered', {
      userId: session.user.id,
    });

    return <AddPlatform />;
  } catch (error) {
    logger.error('Add platform page error', {
      error: error.message,
    });

    redirect('/login');
  }
}

export const metadata = {
  title: 'Add Platform | Benew Admin',
  robots: 'noindex, nofollow',
};
