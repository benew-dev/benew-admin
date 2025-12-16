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

/**
 * Valide un UUID pour les commandes
 */
function validateOrderId(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(orderId);
}

/**
 * Nettoie et valide un UUID
 */
function cleanOrderUUID(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    return null;
  }

  const cleaned = orderId.trim().toLowerCase();

  if (validateOrderId(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Récupérer une commande spécifique depuis la base de données
 * ✅ ADAPTÉ: Utilise les nouvelles colonnes de admin.orders
 */
async function getOrderFromDatabase(orderId) {
  let client;
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  logger.info('Order by ID fetch process started', {
    requestId,
    orderId: orderId || 'missing',
  });

  try {
    // ===== VALIDATION DE L'ID =====
    if (!orderId) {
      logger.warn('Order ID parameter missing', { requestId });
      return null;
    }

    const cleanedOrderId = cleanOrderUUID(orderId);
    if (!cleanedOrderId) {
      logger.warn('Order ID format invalid', {
        requestId,
        providedId: orderId.substring(0, 10),
      });
      return null;
    }

    // ===== CONNEXION BASE DE DONNÉES =====
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('Database Connection Error during order fetch by ID', {
        error: dbConnectionError.message,
        requestId,
        orderId: cleanedOrderId.substring(0, 8),
      });

      trackDatabaseError(dbConnectionError, 'order_by_id_db_connection', {
        requestId,
        orderId: cleanedOrderId.substring(0, 8),
      });

      return null;
    }

    // ===== EXÉCUTION DE LA REQUÊTE =====
    let orderResult;
    try {
      // ✅ MODIFIÉ: Requête avec les nouvelles colonnes
      const orderQuery = `
        SELECT 
          -- Données de la commande
          o.order_id,
          o.order_client,
          o.order_platform_id,
          o.order_application_id,
          
          -- ✅ NOUVEAU: Informations plateforme de paiement
          o.platform_name,
          o.platform_account_name,
          o.platform_account_number,
          
          -- ✅ NOUVEAU: Prix d'acquisition ET abonnement mensuel
          o.order_price,
          o.order_rent,
          
          o.order_payment_status,
          o.order_cancel_reason,
          o.order_cancelled_at,
          o.order_paid_at,
          o.order_created,
          o.order_updated,
          
          -- Données de l'application
          a.application_name,
          a.application_category,
          a.application_images,
          a.application_description,
          a.application_fee,
          a.application_rent,
          a.application_link,
          a.application_level,
          
          -- Données de la plateforme (depuis admin.platforms)
          p.platform_name as platform_full_name,
          p.account_name as platform_registered_account_name,
          p.account_number as platform_registered_account_number,
          p.is_cash_payment,
          p.description as platform_description
          
        FROM admin.orders o
        JOIN catalog.applications a ON o.order_application_id = a.application_id
        JOIN admin.platforms p ON o.order_platform_id = p.platform_id
        WHERE o.order_id = $1
      `;

      orderResult = await client.query(orderQuery, [cleanedOrderId]);
    } catch (queryError) {
      logger.error('Order Fetch By ID Query Error', {
        error: queryError.message,
        code: queryError.code,
        orderId: cleanedOrderId.substring(0, 8),
        requestId,
      });

      trackDatabaseError(queryError, 'order_by_id_query', {
        requestId,
        orderId: cleanedOrderId.substring(0, 8),
        table: 'admin.orders',
      });

      if (client) await client.cleanup();
      return null;
    }

    // ===== VÉRIFICATION EXISTENCE =====
    if (orderResult.rows.length === 0) {
      logger.warn('Order not found', {
        requestId,
        orderId: cleanedOrderId.substring(0, 8),
      });

      if (client) await client.cleanup();
      return null;
    }

    // ===== FORMATAGE ET SANITISATION =====
    const orderData = orderResult.rows[0];

    // Parser les données client
    let clientInfo = null;
    try {
      if (orderData.order_client && Array.isArray(orderData.order_client)) {
        const [lastName, firstName, email, phone] = orderData.order_client;
        clientInfo = {
          lastName: lastName || '',
          firstName: firstName || '',
          email: email || '',
          phone: phone || '',
          fullName: `${firstName || ''} ${lastName || ''}`.trim() || 'N/A',
        };
      }
    } catch (clientParseError) {
      logger.warn('Failed to parse client data', {
        requestId,
        error: clientParseError.message,
        orderId: cleanedOrderId.substring(0, 8),
      });

      clientInfo = {
        lastName: 'N/A',
        firstName: 'N/A',
        email: 'N/A',
        phone: 'N/A',
        fullName: 'N/A',
      };
    }

    // ✅ MODIFIÉ: Sanitiser avec les nouvelles colonnes
    const sanitizedOrder = {
      // Informations de base
      order_id: orderData.order_id,
      order_payment_status: orderData.order_payment_status,
      order_cancel_reason: orderData.order_cancel_reason || null,
      order_cancelled_at: orderData.order_cancelled_at,
      order_paid_at: orderData.order_paid_at,
      order_created: orderData.order_created,
      order_updated: orderData.order_updated,

      // ✅ NOUVEAU: Prix ET abonnement
      order_price: parseFloat(orderData.order_price) || 0,
      order_rent: parseFloat(orderData.order_rent) || 0,

      // Informations client
      client: clientInfo,

      // ✅ NOUVEAU: Informations de paiement depuis admin.orders
      payment: {
        // Données enregistrées dans la commande
        platform_name: orderData.platform_name,
        platform_account_name: orderData.platform_account_name || null,
        // Masquer partiellement le numéro de compte
        platform_account_number: orderData.platform_account_number
          ? `${orderData.platform_account_number.slice(0, 3)}***${orderData.platform_account_number.slice(-2)}`
          : null,
        platform_id: orderData.order_platform_id,
      },

      // Informations de l'application
      application: {
        id: orderData.order_application_id,
        name: orderData.application_name || '[No Name]',
        category: orderData.application_category,
        images: orderData.application_images,
        description: orderData.application_description,
        fee: parseFloat(orderData.application_fee) || 0,
        rent: parseFloat(orderData.application_rent) || 0,
        link: orderData.application_link,
        level: orderData.application_level,
      },

      // ✅ NOUVEAU: Informations de la plateforme (depuis admin.platforms)
      platform: {
        id: orderData.order_platform_id,
        name: orderData.platform_full_name || '[No Name]',
        is_cash_payment: orderData.is_cash_payment || false,
        description: orderData.platform_description || null,
        // Comptes enregistrés dans admin.platforms (pour comparaison/affichage)
        registered_account_name:
          orderData.platform_registered_account_name || null,
        registered_account_number: orderData.platform_registered_account_number
          ? `${orderData.platform_registered_account_number.slice(0, 3)}***${orderData.platform_registered_account_number.slice(-2)}`
          : null,
      },
    };

    const responseTime = Date.now() - startTime;

    logger.info('Order fetch by ID successful', {
      orderId: cleanedOrderId.substring(0, 8),
      paymentStatus: sanitizedOrder.order_payment_status,
      orderPrice: sanitizedOrder.order_price,
      orderRent: sanitizedOrder.order_rent,
      platformName: sanitizedOrder.payment.platform_name,
      isCashPayment: sanitizedOrder.platform.is_cash_payment,
      durationMs: responseTime,
      requestId,
    });

    trackDatabase('order_by_id_fetched', {
      orderId: cleanedOrderId.substring(0, 8),
      paymentStatus: sanitizedOrder.order_payment_status,
      durationMs: responseTime,
    });

    if (client) await client.cleanup();

    return sanitizedOrder;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Global Order By ID Error', {
      error: error.message,
      durationMs: responseTime,
      requestId,
      orderId: orderId ? orderId.substring(0, 8) : 'unknown',
    });

    trackDatabaseError(error, 'order_by_id_global', {
      requestId,
      orderId: orderId ? orderId.substring(0, 8) : 'unknown',
      critical: 'true',
    });

    if (client) await client.cleanup();
    return null;
  }
}

/**
 * Server Component principal pour la page d'édition d'une commande
 */
export default async function EditOrderPage({ params }) {
  try {
    const { id } = await params;

    // ===== VÉRIFICATION AUTHENTIFICATION =====
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      trackAuth('unauthenticated_order_edit_access', {}, 'warning');
      redirect('/login');
    }

    // ===== RÉCUPÉRATION DE LA COMMANDE =====
    const order = await getOrderFromDatabase(id);

    // ===== VÉRIFICATION EXISTENCE =====
    if (!order) {
      notFound();
    }

    // ===== RENDU DE LA PAGE =====
    logger.info('Order edit page rendered', {
      orderId: order.order_id.substring(0, 8),
      paymentStatus: order.order_payment_status,
      orderPrice: order.order_price,
      orderRent: order.order_rent,
      userId: session.user.id,
    });

    return <EditOrder order={order} />;
  } catch (error) {
    logger.error('Order edit page error', {
      error: error.message,
    });

    trackDatabaseError(error, 'order_edit_page_render', {
      critical: 'true',
    });

    notFound();
  }
}

export const metadata = {
  title: 'Order Details | Benew Admin',
  robots: 'noindex, nofollow',
};
