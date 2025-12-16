'use server';

import { getClient } from '@/backend/dbConnect';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import logger from '@/utils/logger';
import { trackDatabase, trackDatabaseError } from '@/utils/monitoring';

/**
 * Validation des filtres
 */
function validateAndSanitizeFilters(filters = {}) {
  const validatedFilters = {};
  const allowedFields = ['order_client', 'order_payment_status'];
  const maxStringLength = 100;
  const maxArrayLength = 10;

  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFields.includes(key)) {
      logger.warn('Tentative de filtrage avec champ non autorisé', {
        field: key,
        security_event: true,
      });
      continue;
    }

    switch (key) {
      case 'order_client':
        if (typeof value === 'string' && value.trim()) {
          const cleanValue = value.trim().substring(0, maxStringLength);
          const sanitizedValue = cleanValue.replace(/[<>"'%;()&+]/g, '');
          if (sanitizedValue.length >= 2) {
            validatedFilters[key] = sanitizedValue;
          }
        }
        break;

      case 'order_payment_status':
        if (Array.isArray(value)) {
          const allowedStatuses = ['paid', 'unpaid', 'refunded', 'failed'];
          const validValues = value
            .filter((v) => typeof v === 'string' && v.trim())
            .map((v) => v.trim())
            .slice(0, maxArrayLength);
          validatedFilters[key] = validValues.filter((v) =>
            allowedStatuses.includes(v),
          );
        }
        break;
    }
  }

  return validatedFilters;
}

/**
 * Construction sécurisée de la clause WHERE
 */
function buildSecureWhereClause(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 1;

  // Recherche par client
  if (filters.order_client) {
    conditions.push(`array_to_string(order_client, ' ') ILIKE $${paramCount}`);
    values.push(`%${filters.order_client}%`);
    paramCount++;
  }

  // Filtre par statut
  if (filters.order_payment_status && filters.order_payment_status.length > 0) {
    const statusPlaceholders = filters.order_payment_status
      .map(() => `$${paramCount++}`)
      .join(', ');
    conditions.push(`order_payment_status IN (${statusPlaceholders})`);
    values.push(...filters.order_payment_status);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, values };
}

/**
 * Authentification pour Server Actions
 */
async function authenticateServerAction() {
  const requestId = crypto.randomUUID();

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      logger.warn("Tentative d'accès non authentifiée", {
        requestId,
      });

      throw new Error('Authentication required for this action');
    }

    if (!session.user.id || !session.user.email) {
      logger.error('Session utilisateur incomplète', {
        requestId,
        hasUserId: !!session.user.id,
        hasUserEmail: !!session.user.email,
      });

      throw new Error('Invalid user session');
    }

    return { session, requestId };
  } catch (error) {
    logger.error("Erreur lors de la vérification d'authentification", {
      error: error.message,
      requestId,
    });

    throw error;
  }
}

/**
 * Server Action pour mettre à jour le statut de paiement d'une commande
 */
export async function updateOrderPaymentStatus(orderId, newStatus) {
  let client;
  const startTime = Date.now();
  let requestId;

  try {
    // ===== AUTHENTIFICATION =====
    const { session, requestId: authRequestId } =
      await authenticateServerAction();
    requestId = authRequestId;

    logger.info('Mise à jour statut commande démarrée', {
      requestId,
      userId: session.user.id,
      orderId,
      newStatus,
    });

    // ===== VALIDATION DES PARAMÈTRES =====
    if (!orderId || !newStatus) {
      logger.warn('Paramètres manquants pour mise à jour commande', {
        requestId,
        userId: session.user.id,
        orderId: !!orderId,
        newStatus: !!newStatus,
      });

      throw new Error('Order ID and new status are required');
    }

    const allowedStatuses = ['paid', 'unpaid', 'refunded', 'failed'];
    if (!allowedStatuses.includes(newStatus)) {
      logger.warn('Statut de paiement invalide', {
        requestId,
        userId: session.user.id,
        orderId,
        invalidStatus: newStatus,
      });

      throw new Error(`Invalid payment status: ${newStatus}`);
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!orderId || typeof orderId !== 'string' || !uuidRegex.test(orderId)) {
      logger.warn('ID de commande invalide', {
        requestId,
        userId: session.user.id,
        orderId,
      });

      throw new Error(`Invalid order ID: ${orderId}`);
    }

    // ===== CONNEXION BASE DE DONNÉES =====
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('Erreur de connexion base de données', {
        error: dbConnectionError.message,
        requestId,
        userId: session.user.id,
      });

      trackDatabaseError(
        dbConnectionError,
        'update_order_status_db_connection',
        {
          requestId,
          userId: session.user.id,
          orderId,
        },
      );

      throw new Error('Database connection failed for update operation');
    }

    // ===== VÉRIFICATION EXISTENCE =====
    let currentOrder;
    try {
      const checkQuery = `
        SELECT order_id, order_payment_status, order_created, order_price, order_rent
        FROM admin.orders 
        WHERE order_id = $1
      `;

      const checkResult = await client.query(checkQuery, [orderId]);

      if (checkResult.rows.length === 0) {
        logger.warn('Commande non trouvée', {
          requestId,
          userId: session.user.id,
          orderId,
        });

        throw new Error(`Order #${orderId} not found`);
      }

      currentOrder = checkResult.rows[0];
    } catch (queryError) {
      logger.error('Erreur lors de la vérification de la commande', {
        error: queryError.message,
        code: queryError.code,
        requestId,
        userId: session.user.id,
        orderId,
      });

      trackDatabaseError(queryError, 'update_order_status_check', {
        requestId,
        userId: session.user.id,
        orderId,
      });

      if (client) await client.cleanup();
      throw new Error('Failed to verify order existence');
    }

    // ===== MISE À JOUR DU STATUT =====
    try {
      // ✅ Note: Le trigger update_order_status_and_timestamps() gère automatiquement:
      // - order_updated = CURRENT_TIMESTAMP
      // - order_paid_at si passage à 'paid'
      // - order_cancelled_at si passage à 'failed'
      // - Incrémentation/décrémentation des sales_count
      const updateQuery = `
        UPDATE admin.orders 
        SET order_payment_status = $1
        WHERE order_id = $2
        RETURNING order_id, order_payment_status, order_updated, order_paid_at, order_cancelled_at
      `;

      const updateResult = await client.query(updateQuery, [
        newStatus,
        orderId,
      ]);

      if (updateResult.rows.length === 0) {
        logger.error('Échec de la mise à jour de la commande', {
          requestId,
          userId: session.user.id,
          orderId,
          newStatus,
        });

        throw new Error('Failed to update order status');
      }

      const updatedOrder = updateResult.rows[0];

      logger.info('Statut commande mis à jour avec succès', {
        requestId,
        userId: session.user.id,
        orderId,
        oldStatus: currentOrder.order_payment_status,
        newStatus: updatedOrder.order_payment_status,
      });

      trackDatabase('order_status_updated', {
        orderId,
        oldStatus: currentOrder.order_payment_status,
        newStatus: updatedOrder.order_payment_status,
        durationMs: Date.now() - startTime,
      });

      if (client) await client.cleanup();

      return {
        success: true,
        order: {
          order_id: updatedOrder.order_id,
          order_payment_status: updatedOrder.order_payment_status,
          updated_at: updatedOrder.order_updated,
          paid_at: updatedOrder.order_paid_at,
          cancelled_at: updatedOrder.order_cancelled_at,
        },
        oldStatus: currentOrder.order_payment_status,
        newStatus: updatedOrder.order_payment_status,
      };
    } catch (updateError) {
      logger.error('Erreur lors de la mise à jour du statut', {
        error: updateError.message,
        code: updateError.code,
        requestId,
        userId: session.user.id,
        orderId,
        newStatus,
      });

      trackDatabaseError(updateError, 'update_order_status_query', {
        requestId,
        userId: session.user.id,
        orderId,
        newStatus,
      });

      if (client) await client.cleanup();
      throw new Error('Failed to update order payment status');
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error(
      'Erreur globale lors de la mise à jour du statut de commande',
      {
        error: error.message,
        durationMs: responseTime,
        requestId: requestId || 'unknown',
        orderId,
        newStatus,
      },
    );

    trackDatabaseError(error, 'update_order_status_global', {
      requestId: requestId || 'unknown',
      orderId,
      newStatus,
      critical: 'true',
    });

    if (client) await client.cleanup();

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'An error occurred while updating the order status. Please try again.',
      );
    } else {
      throw error;
    }
  }
}

/**
 * Server Action pour récupérer les commandes filtrées
 * ✅ ADAPTÉ: Utilise les nouvelles colonnes
 */
export async function getFilteredOrders(filters = {}) {
  let client;
  const startTime = Date.now();
  let requestId;

  try {
    // ===== AUTHENTIFICATION =====
    const { session, requestId: authRequestId } =
      await authenticateServerAction();
    requestId = authRequestId;

    logger.info('Processus de filtrage des commandes démarré', {
      requestId,
      userId: session.user.id,
      filtersCount: Object.keys(filters).length,
    });

    // ===== VALIDATION DES FILTRES =====
    const validatedFilters = validateAndSanitizeFilters(filters);

    // ===== CONNEXION BASE DE DONNÉES =====
    try {
      client = await getClient();
    } catch (dbConnectionError) {
      logger.error('Erreur de connexion base de données', {
        error: dbConnectionError.message,
        requestId,
        userId: session.user.id,
      });

      trackDatabaseError(dbConnectionError, 'filter_orders_db_connection', {
        requestId,
        userId: session.user.id,
      });

      throw new Error('Database connection failed for filtering operation');
    }

    // ===== CONSTRUCTION DE LA REQUÊTE =====
    const { whereClause, values } = buildSecureWhereClause(validatedFilters);

    // ===== EXÉCUTION DE LA REQUÊTE =====
    let ordersResult, countResult;
    const queryStartTime = Date.now();

    try {
      // ✅ MODIFIÉ: Requête avec les nouvelles colonnes
      const mainQuery = `
        SELECT 
          -- Données de la commande
          orders.order_id,
          orders.order_payment_status,
          orders.order_created,
          orders.order_updated,
          orders.order_application_id,
          orders.order_client,
          
          -- ✅ NOUVEAU: Prix ET abonnement
          orders.order_price,
          orders.order_rent,
          
          -- ✅ NOUVEAU: Informations plateforme
          orders.platform_name,
          orders.platform_account_name,
          orders.platform_account_number,
          
          -- Données de l'application
          applications.application_name,
          applications.application_category,
          applications.application_images
          
        FROM admin.orders
        JOIN catalog.applications ON orders.order_application_id = applications.application_id
        ${whereClause}
        ORDER BY orders.order_created DESC
        LIMIT 1000
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM admin.orders
        JOIN catalog.applications ON orders.order_application_id = applications.application_id
        ${whereClause}
      `;

      const queryPromise = Promise.all([
        client.query(mainQuery, values),
        client.query(countQuery, values),
      ]);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000),
      );

      [ordersResult, countResult] = await Promise.race([
        queryPromise,
        timeoutPromise,
      ]);

      const queryTime = Date.now() - queryStartTime;

      if (queryTime > 2000) {
        logger.warn('Requête lente détectée', {
          requestId,
          queryTimeMs: queryTime,
          rowCount: ordersResult.rows.length,
        });
      }
    } catch (queryError) {
      logger.error("Erreur lors de l'exécution de la requête", {
        error: queryError.message,
        code: queryError.code,
        requestId,
        userId: session.user.id,
      });

      trackDatabaseError(queryError, 'filter_orders_query', {
        requestId,
        userId: session.user.id,
        table: 'admin.orders',
      });

      if (client) await client.cleanup();
      throw new Error('Database query failed for filtering operation');
    }

    // ===== VALIDATION DES DONNÉES =====
    if (!ordersResult || !Array.isArray(ordersResult.rows)) {
      logger.warn('Structure de données invalide retournée par la requête', {
        requestId,
        resultType: typeof ordersResult,
      });

      if (client) await client.cleanup();
      throw new Error('Invalid data structure returned from database');
    }

    // ===== NETTOYAGE ET FORMATAGE =====
    const orders = ordersResult.rows;
    const total = parseInt(countResult.rows[0].total);

    // ✅ MODIFIÉ: Sanitiser avec les nouvelles colonnes
    const sanitizedOrders = orders.map((order) => ({
      order_id: order.order_id,
      order_payment_status: ['paid', 'unpaid', 'refunded', 'failed'].includes(
        order.order_payment_status,
      )
        ? order.order_payment_status
        : 'unpaid',
      order_created: order.order_created,
      order_updated: order.order_updated,
      order_application_id: order.order_application_id,
      order_client: Array.isArray(order.order_client)
        ? order.order_client.slice(0, 4)
        : [],

      // ✅ NOUVEAU: Prix ET abonnement
      order_price: Math.max(0, parseFloat(order.order_price) || 0),
      order_rent: Math.max(0, parseFloat(order.order_rent) || 0),

      // ✅ NOUVEAU: Informations plateforme (masquer account_number)
      platform_name: order.platform_name || '[Unknown Platform]',
      platform_account_name: order.platform_account_name || null,
      platform_account_number: order.platform_account_number
        ? `${order.platform_account_number.slice(0, 3)}***${order.platform_account_number.slice(-2)}`
        : null,

      // Application
      application_name: (order.application_name || '[No Name]').substring(
        0,
        200,
      ),
      application_category: ['mobile', 'web'].includes(
        order.application_category,
      )
        ? order.application_category
        : 'web',
      application_images: Array.isArray(order.application_images)
        ? order.application_images.slice(0, 10)
        : [],
    }));

    const response = {
      orders: sanitizedOrders,
      totalOrders: total,
    };

    const responseTime = Date.now() - startTime;

    logger.info('Filtrage commandes terminé avec succès', {
      orderCount: sanitizedOrders.length,
      totalCount: total,
      durationMs: responseTime,
      requestId,
      userId: session.user.id,
    });

    trackDatabase('orders_filtered', {
      orderCount: sanitizedOrders.length,
      totalCount: total,
      durationMs: responseTime,
    });

    if (client) await client.cleanup();

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Erreur globale lors du filtrage des commandes', {
      error: error.message,
      durationMs: responseTime,
      requestId: requestId || 'unknown',
    });

    trackDatabaseError(error, 'filter_orders_global', {
      requestId: requestId || 'unknown',
      critical: 'true',
    });

    if (client) await client.cleanup();

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'An error occurred while filtering orders. Please try again.',
      );
    } else {
      throw error;
    }
  }
}
