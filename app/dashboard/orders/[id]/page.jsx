// app/dashboard/orders/[id]/page.jsx
import EditOrder from '@/ui/pages/orders/EditOrder';
import { redirect, notFound } from 'next/navigation';
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

function validateOrderId(orderId) {
  if (!orderId || typeof orderId !== 'string') return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(orderId);
}

function cleanOrderUUID(orderId) {
  if (!orderId || typeof orderId !== 'string') return null;
  const cleaned = orderId.trim().toLowerCase();
  return validateOrderId(cleaned) ? cleaned : null;
}

async function getOrderFromDatabase(orderId) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    if (!orderId) return null;

    const cleanedOrderId = cleanOrderUUID(orderId);
    if (!cleanedOrderId) return null;

    client = await getClient();

    // admin.orders ne contient PAS platform_name / platform_account_name / platform_account_number
    // Ces colonnes vivent dans admin.platforms — on les récupère via JOIN
    const orderQuery = `
      SELECT
        -- Commande
        o.order_id,
        o.order_client_name,
        o.order_client_email,
        o.order_client_phone,
        o.order_platform_id,
        o.order_application_id,
        o.order_payment_name,
        o.order_payment_number,
        o.order_price,
        o.order_rent,
        o.order_payment_status,
        o.order_cancel_reason,
        o.order_cancelled_at,
        o.order_paid_at,
        o.order_created,
        o.order_updated,

        -- Application
        a.application_name,
        a.application_category,
        a.application_images,
        a.application_description,
        a.application_fee,
        a.application_rent,
        a.application_link,
        a.application_level,

        -- Plateforme (toutes les infos viennent d'ici)
        p.platform_name,
        p.account_name   AS platform_account_name,
        p.account_number AS platform_account_number,
        p.is_cash_payment,
        p.description    AS platform_description

      FROM admin.orders o
      JOIN catalog.applications a ON o.order_application_id = a.application_id
      JOIN admin.platforms p       ON o.order_platform_id   = p.platform_id
      WHERE o.order_id = $1
    `;

    const orderResult = await client.query(orderQuery, [cleanedOrderId]);

    if (orderResult.rows.length === 0) {
      await client.cleanup();
      return null;
    }

    const row = orderResult.rows[0];

    // ✅ PARSING CORRIGÉ selon le schéma réel :
    // order_client VARCHAR(255)[] avec CHECK (array_length = 3)
    // COMMENT: 'Informations client: [nom_complet, email, telephone]'
    // → index [0] = nom_complet, [1] = email, [2] = telephone
    // L'ancien code déstructurait en [lastName, firstName, email, phone]
    // ce qui était faux et collait email+téléphone dans le nom affiché
    const clientInfo = {
      fullName: row.order_client_name || 'N/A',
      email: row.order_client_email || 'N/A',
      phone: row.order_client_phone || 'N/A',
    };

    const sanitizedOrder = {
      order_id: row.order_id,
      order_payment_status: row.order_payment_status,
      order_cancel_reason: row.order_cancel_reason || null,
      order_cancelled_at: row.order_cancelled_at,
      order_paid_at: row.order_paid_at,
      order_created: row.order_created,
      order_updated: row.order_updated,
      order_price: parseFloat(row.order_price) || 0,
      order_rent: parseFloat(row.order_rent) || 0,

      client: clientInfo,

      // Informations de paiement fournies par le client lors de la commande
      payment: {
        platform_name: row.platform_name,
        platform_account_name: row.order_payment_name || null,
        platform_account_number: row.order_payment_number,
        platform_id: row.order_platform_id,
      },

      // Informations de la plateforme enregistrée dans admin.platforms
      platform: {
        id: row.order_platform_id,
        name: row.platform_name || '[No Name]',
        is_cash_payment: Boolean(row.is_cash_payment),
        description: row.platform_description || null,
        registered_account_name: row.platform_account_name || null,
        registered_account_number: row.platform_account_number,
      },

      application: {
        id: row.order_application_id,
        name: row.application_name || '[No Name]',
        category: row.application_category,
        images: row.application_images || [],
        description: row.application_description || null,
        fee: parseFloat(row.application_fee) || 0,
        rent: parseFloat(row.application_rent) || 0,
        link: row.application_link || null,
        level: row.application_level || 1,
      },
    };

    const responseTime = Date.now() - startTime;

    logger.info('Order fetch by ID successful', {
      orderId: cleanedOrderId.substring(0, 8),
      paymentStatus: sanitizedOrder.order_payment_status,
      durationMs: responseTime,
      requestId,
    });

    trackDatabase('order_by_id_fetched', {
      orderId: cleanedOrderId.substring(0, 8),
      paymentStatus: sanitizedOrder.order_payment_status,
      durationMs: responseTime,
    });

    await client.cleanup();
    return sanitizedOrder;
  } catch (error) {
    logger.error('Global Order By ID Error', {
      error: error.message,
      requestId,
      orderId: orderId ? orderId.substring(0, 8) : 'unknown',
    });

    trackDatabaseError(error, 'order_by_id_global', {
      requestId,
      critical: 'true',
    });

    if (client) await client.cleanup();
    return null;
  }
}

export default async function EditOrderPage({ params }) {
  try {
    const { id } = await params;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      trackAuth('unauthenticated_order_edit_access', {}, 'warning');
      redirect('/login');
    }

    const order = await getOrderFromDatabase(id);
    if (!order) notFound();

    logger.info('Order edit page rendered', {
      orderId: order.order_id.substring(0, 8),
      paymentStatus: order.order_payment_status,
      userId: session.user.id,
    });

    return <EditOrder order={order} />;
  } catch (error) {
    logger.error('Order edit page error', { error: error.message });
    trackDatabaseError(error, 'order_edit_page_render', { critical: 'true' });
    notFound();
  }
}

export const metadata = {
  title: 'Order Details | Benew Admin',
  robots: 'noindex, nofollow',
};
