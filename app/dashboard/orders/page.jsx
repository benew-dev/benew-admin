// app/dashboard/orders/page.jsx
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

async function getOrdersFromDatabase() {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Orders fetch process started', { requestId });

  try {
    client = await getClient();

    // ✅ CORRIGÉ : platform_name vient de admin.platforms via JOIN
    // admin.orders ne contient PAS de colonne platform_name
    const mainQuery = `
      SELECT
        o.order_id,
        o.order_client_name,
        o.order_client_email,
        o.order_client_phone,
        o.order_payment_status,
        o.order_created,
        o.order_price,
        o.order_rent,
        o.order_application_id,
        o.order_platform_ids,

        a.application_name,
        a.application_category,
        a.application_images

      FROM admin.orders o
      JOIN catalog.applications a ON o.order_application_id = a.application_id
      ORDER BY o.order_created DESC
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM admin.orders o
      JOIN catalog.applications a ON o.order_application_id = a.application_id
    `;

    const [ordersResult, countResult] = await Promise.all([
      client.query(mainQuery),
      client.query(countQuery),
    ]);

    if (!ordersResult || !Array.isArray(ordersResult.rows)) {
      logger.warn('Orders query returned invalid data structure', {
        requestId,
      });
      await client.cleanup();
      return { orders: [], totalOrders: 0 };
    }

    const total = parseInt(countResult.rows[0].total);

    const sanitizedOrders = ordersResult.rows.map((order) => ({
      order_id: order.order_id,
      order_payment_status: order.order_payment_status,
      order_created: order.order_created,
      order_application_id: order.order_application_id,
      order_client_name: order.order_client_name || '',
      order_client_email: order.order_client_email || '',
      order_client_phone: order.order_client_phone || '',
      order_price: parseFloat(order.order_price) || 0,
      order_rent: parseFloat(order.order_rent) || 0,
      order_platform_ids: Array.isArray(order.order_platform_ids)
        ? order.order_platform_ids
        : [],
      application_name: order.application_name || '[No Name]',
      application_category: order.application_category,
      application_images: Array.isArray(order.application_images)
        ? order.application_images
        : [],
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

    await client.cleanup();
    return { orders: sanitizedOrders, totalOrders: total };
  } catch (error) {
    logger.error('Global Orders Error', {
      error: error.message,
      durationMs: Date.now() - startTime,
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

export default async function OrdersPage() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      trackAuth('unauthenticated_orders_access', {}, 'warning');
      redirect('/login');
    }

    const { orders, totalOrders } = await getOrdersFromDatabase();

    logger.info('Orders page rendered', {
      orderCount: orders.length,
      totalCount: totalOrders,
      userId: session.user.id,
    });

    return <OrdersList data={orders} totalOrders={totalOrders} />;
  } catch (error) {
    logger.error('Orders page error', { error: error.message });
    trackDatabaseError(error, 'orders_page_render', { critical: 'true' });
    return <OrdersList data={[]} totalOrders={0} />;
  }
}

export const metadata = {
  title: 'Orders | Benew Admin',
  robots: 'noindex, nofollow',
};
