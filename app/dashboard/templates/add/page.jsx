// app/dashboard/templates/add/page.jsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import AddTemplateForm from '@/ui/pages/templates/AddTemplateForm';
import logger from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';

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

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Unauthenticated access to add template',
        level: 'warning',
      });

      return null;
    }

    return session;
  } catch (error) {
    logger.error('Auth check failed', { error: error.message });

    Sentry.captureException(error, {
      tags: { component: 'add_template_page', action: 'auth_check' },
    });

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

    Sentry.captureException(error, {
      tags: { component: 'add_template_page', critical: 'true' },
    });

    // Fallback: rediriger vers templates list
    redirect('/dashboard/templates');
  }
}
