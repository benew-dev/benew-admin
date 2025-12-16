import OrdersList from '@/ui/pages/orders/OrdersList';
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
 * Récupérer les commandes depuis la base de données
 * ✅ ADAPTÉ: Requête simplifiée avec order_price, order_rent, platform_name
 */
async function getOrdersFromDatabase() {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Orders fetch process started', { requestId });

  try {
    // ===== CONNEXION BASE DE DONNÉES =====
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('Database Connection Error during orders fetch', {
        error: dbConnectionError.message,
        requestId,
      });

      trackDatabaseError(dbConnectionError, 'orders_db_connection', {
        requestId,
      });

      return { orders: [], totalOrders: 0 };
    }

    // ===== EXÉCUTION DES REQUÊTES =====
    let ordersResult, countResult;
    try {
      // ✅ REQUÊTE SIMPLIFIÉE avec order_price, order_rent, platform_name
      const mainQuery = `
        SELECT 
          -- Données de la commande
          orders.order_id,
          orders.order_payment_status,
          orders.order_created,
          orders.order_price,
          orders.order_rent,
          orders.order_application_id,
          orders.platform_name,
          
          -- Données de l'application
          applications.application_name,
          applications.application_category,
          applications.application_images
          
        FROM admin.orders
        JOIN catalog.applications ON orders.order_application_id = applications.application_id
        ORDER BY orders.order_created DESC
      `;

      // Requête pour le total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM admin.orders
        JOIN catalog.applications ON orders.order_application_id = applications.application_id
      `;

      [ordersResult, countResult] = await Promise.all([
        client.query(mainQuery),
        client.query(countQuery),
      ]);
    } catch (queryError) {
      logger.error('Orders Query Error', {
        error: queryError.message,
        code: queryError.code,
        requestId,
      });

      trackDatabaseError(queryError, 'orders_query', {
        requestId,
        table: 'admin.orders',
      });

      if (client) await client.cleanup();
      return { orders: [], totalOrders: 0 };
    }

    // ===== VALIDATION DES DONNÉES =====
    if (!ordersResult || !Array.isArray(ordersResult.rows)) {
      logger.warn('Orders query returned invalid data structure', {
        requestId,
      });

      if (client) await client.cleanup();
      return { orders: [], totalOrders: 0 };
    }

    // ===== FORMATAGE ET SANITISATION DES DONNÉES =====
    const orders = ordersResult.rows;
    const total = parseInt(countResult.rows[0].total);

    const sanitizedOrders = orders.map((order) => ({
      order_id: order.order_id,
      order_payment_status: order.order_payment_status,
      order_created: order.order_created,
      order_application_id: order.order_application_id,

      // Prix et abonnement
      order_price: parseFloat(order.order_price) || 0,
      order_rent: parseFloat(order.order_rent) || 0,

      // Plateforme
      platform_name: order.platform_name || '[Unknown Platform]',

      // Application
      application_name: order.application_name || '[No Name]',
      application_category: order.application_category,
      application_images: order.application_images,
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Orders fetch successful', {
      orderCount: sanitizedOrders.length,
      totalCount: total,
      durationMs: responseTime,
      requestId,
    });

    trackDatabase('orders_fetched', {
      orderCount: sanitizedOrders.length,
      totalCount: total,
      durationMs: responseTime,
    });

    if (client) await client.cleanup();

    return {
      orders: sanitizedOrders,
      totalOrders: total,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Global Orders Error', {
      error: error.message,
      durationMs: responseTime,
      requestId,
    });

    trackDatabaseError(error, 'orders_fetch_global', {
      requestId,
      critical: 'true',
    });

    if (client) await client.cleanup();
    return { orders: [], totalOrders: 0 };
  }
}

/**
 * Server Component principal pour la page des commandes
 */
export default async function OrdersPage() {
  try {
    // ===== VÉRIFICATION AUTHENTIFICATION =====
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_orders_access', {}, 'warning');
      redirect('/login');
    }

    // ===== RÉCUPÉRATION DES COMMANDES =====
    const { orders, totalOrders } = await getOrdersFromDatabase();

    logger.info('Orders page rendered', {
      orderCount: orders.length,
      totalCount: totalOrders,
      userId: session.user.id,
    });

    return <OrdersList data={orders} totalOrders={totalOrders} />;
  } catch (error) {
    logger.error('Orders page error', {
      error: error.message,
    });

    trackDatabaseError(error, 'orders_page_render', {
      critical: 'true',
    });

    return <OrdersList data={[]} totalOrders={0} />;
  }
}

export const metadata = {
  title: 'Orders | Benew Admin',
  robots: 'noindex, nofollow',
};
