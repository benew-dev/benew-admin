// app/dashboard/platforms/page.jsx
import PlatformsList from '@/ui/pages/platforms/PlatformsList';
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
 * Récupérer les plateformes de paiement depuis la base de données
 */
async function getPlatformsFromDatabase() {
  let client;
  const startTime = Date.now();

  try {
    // Connexion DB
    client = await getClient();

    const platformsQuery = `
      SELECT 
        platform_id, 
        platform_name,
        account_name,
        account_number, 
        created_at, 
        updated_at, 
        is_active
      FROM admin.platforms 
      ORDER BY created_at DESC
    `;

    const result = await client.query(platformsQuery);

    if (!result || !Array.isArray(result.rows)) {
      logger.warn('Platforms query returned invalid data structure');
      await client.cleanup();
      return [];
    }

    // Masquer partiellement les numéros de compte pour la sécurité
    const sanitizedPlatforms = result.rows.map((platform) => ({
      platform_id: platform.platform_id,
      platform_name: platform.platform_name || '[No Name]',
      account_name: platform.account_name || '[No Account Name]',
      account_number: platform.account_number
        ? `${platform.account_number.slice(0, 3)}***${platform.account_number.slice(-2)}`
        : '[No Number]',
      created_at: platform.created_at,
      updated_at: platform.updated_at,
      is_active: Boolean(platform.is_active),
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Platforms fetched successfully', {
      platformCount: sanitizedPlatforms.length,
      durationMs: responseTime,
    });

    trackDatabase('platforms_fetched', {
      platformCount: sanitizedPlatforms.length,
      durationMs: responseTime,
    });

    await client.cleanup();
    return sanitizedPlatforms;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Error fetching platforms', {
      error: error.message,
      durationMs: responseTime,
    });

    trackDatabaseError(error, 'platforms_fetch', {
      durationMs: responseTime,
    });

    if (client) await client.cleanup();
    return [];
  }
}

/**
 * Server Component - Page Platforms List
 */
export default async function PlatformsPage() {
  try {
    // Vérification session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_platforms_access', {}, 'warning');
      redirect('/login');
    }

    // Récupération des plateformes
    const platforms = await getPlatformsFromDatabase();

    logger.info('Platforms page rendered', {
      platformCount: platforms.length,
      userId: session.user.id,
    });

    return <PlatformsList data={platforms} />;
  } catch (error) {
    logger.error('Platforms page error', {
      error: error.message,
    });

    trackDatabaseError(error, 'platforms_page_render');

    // Afficher page vide en cas d'erreur
    return <PlatformsList data={[]} />;
  }
}

export const metadata = {
  title: 'Payment Platforms | Benew Admin',
  robots: 'noindex, nofollow',
};
