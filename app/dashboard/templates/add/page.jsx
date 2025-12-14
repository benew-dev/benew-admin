// app/dashboard/templates/add/page.jsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import AddTemplateForm from '@/ui/pages/templates/AddTemplateForm';
import logger from '@/utils/logger';
import { trackAuth, trackDatabaseError } from '@/utils/monitoring';

// ===== CONFIGURATION =====
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Add Template | Benew Admin',
  description: 'Add a new template',
  robots: 'noindex, nofollow',
};

// ===== HELPER FUNCTIONS =====

/**
 * Vérifie l'authentification utilisateur
 */
async function checkAuth() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      logger.warn('Unauthenticated access to add template page');

      trackAuth(
        'unauthenticated_access',
        {
          page: 'add_template',
        },
        'warning',
      );

      return null;
    }

    return session;
  } catch (error) {
    logger.error('Auth check failed', { error: error.message });

    trackDatabaseError(error, 'auth_check');

    return null;
  }
}

// ===== MAIN PAGE =====

export default async function AddTemplatePage() {
  try {
    // Vérifier authentification
    const session = await checkAuth();

    if (!session) {
      redirect('/login');
    }

    logger.info('Add template page accessed', {
      userId: session.user.id,
    });

    // Render le formulaire (Client Component)
    return <AddTemplateForm />;
  } catch (error) {
    // Gestion redirect throws
    if (error.message?.includes('NEXT_REDIRECT')) {
      throw error;
    }

    logger.error('Add template page error', { error: error.message });

    trackDatabaseError(error, 'page_render', {
      critical: 'true',
    });

    // Fallback: rediriger vers templates list
    redirect('/dashboard/templates');
  }
}
