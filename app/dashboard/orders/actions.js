'use server';

import { getClient } from '@/backend/dbConnect';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import logger from '@/utils/logger';
import { trackDatabase, trackDatabaseError } from '@/utils/monitoring';

function validateAndSanitizeFilters(filters = {}) {
  const validatedFilters = {};
  const allowedFields = [
    'order_client_name',
    'order_client_email',
    'order_payment_status',
  ];
  const maxStringLength = 100;
  const maxArrayLength = 10;

  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFields.includes(key)) continue;

    switch (key) {
      case 'order_client_name':
      case 'order_client_email':
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
          validatedFilters[key] = value
            .filter((v) => typeof v === 'string' && v.trim())
            .map((v) => v.trim())
            .slice(0, maxArrayLength)
            .filter((v) => allowedStatuses.includes(v));
        }
        break;
    }
  }

  return validatedFilters;
}

function buildSecureWhereClause(filters) {
  const conditions = [];
  const values = [];
  let paramCount = 1;

  if (filters.order_client_name) {
    conditions.push(`o.order_client_name ILIKE $${paramCount}`);
    values.push(`%${filters.order_client_name}%`);
    paramCount++;
  }

  if (filters.order_client_email) {
    conditions.push(`o.order_client_email ILIKE $${paramCount}`);
    values.push(`%${filters.order_client_email}%`);
    paramCount++;
  }

  if (filters.order_payment_status?.length > 0) {
    const placeholders = filters.order_payment_status
      .map(() => `$${paramCount++}`)
      .join(', ');
    conditions.push(`o.order_payment_status IN (${placeholders})`);
    values.push(...filters.order_payment_status);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, values };
}

async function authenticateServerAction() {
  const requestId = crypto.randomUUID();

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id || !session?.user?.email) {
    logger.warn('Unauthenticated server action attempt', { requestId });
    throw new Error('Authentication required for this action');
  }

  return { session, requestId };
}

/**
 * Mettre à jour le statut de paiement d'une commande
 */
export async function updateOrderPaymentStatus(orderId, newStatus) {
  let client;
  const startTime = Date.now();
  let requestId;

  try {
    const { session, requestId: authRequestId } =
      await authenticateServerAction();
    requestId = authRequestId;

    if (!orderId || !newStatus) {
      throw new Error('Order ID and new status are required');
    }

    const allowedStatuses = ['paid', 'unpaid', 'refunded', 'failed'];
    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(`Invalid payment status: ${newStatus}`);
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      throw new Error(`Invalid order ID: ${orderId}`);
    }

    client = await getClient();

    // Vérifier existence
    const checkResult = await client.query(
      `SELECT order_id, order_payment_status FROM admin.orders WHERE order_id = $1`,
      [orderId],
    );

    if (checkResult.rows.length === 0) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const currentOrder = checkResult.rows[0];

    // Le trigger gère order_updated, order_paid_at, order_cancelled_at et sales_count
    const updateResult = await client.query(
      `UPDATE admin.orders
       SET order_payment_status = $1
       WHERE order_id = $2
       RETURNING order_id, order_payment_status, order_updated, order_paid_at, order_cancelled_at`,
      [newStatus, orderId],
    );

    const updatedOrder = updateResult.rows[0];

    logger.info('Order status updated', {
      requestId,
      userId: session.user.id,
      orderId,
      oldStatus: currentOrder.order_payment_status,
      newStatus: updatedOrder.order_payment_status,
      durationMs: Date.now() - startTime,
    });

    trackDatabase('order_status_updated', {
      orderId,
      oldStatus: currentOrder.order_payment_status,
      newStatus: updatedOrder.order_payment_status,
      durationMs: Date.now() - startTime,
    });

    await client.cleanup();

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
  } catch (error) {
    logger.error('Error updating order status', {
      error: error.message,
      requestId: requestId || 'unknown',
      orderId,
      newStatus,
      durationMs: Date.now() - startTime,
    });

    trackDatabaseError(error, 'update_order_status_global', {
      requestId: requestId || 'unknown',
      orderId,
      newStatus,
    });

    if (client) await client.cleanup();

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'An error occurred while updating the order status. Please try again.',
      );
    }
    throw error;
  }
}

/**
 * Récupérer les commandes filtrées
 */
export async function getFilteredOrders(filters = {}) {
  let client;
  const startTime = Date.now();
  let requestId;

  try {
    const { session, requestId: authRequestId } =
      await authenticateServerAction();
    requestId = authRequestId;

    const validatedFilters = validateAndSanitizeFilters(filters);
    const { whereClause, values } = buildSecureWhereClause(validatedFilters);

    client = await getClient();

    // ✅ REQUÊTE CORRIGÉE :
    // platform_name vient de admin.platforms via JOIN (pas de colonne directe dans orders)
    const mainQuery = `
      SELECT
        o.order_id,
        o.order_client_name,
        o.order_client_email,
        o.order_client_phone,
        o.order_payment_status,
        o.order_created,
        o.order_updated,
        o.order_application_id,
        o.order_price,
        o.order_rent,
        o.order_platform_ids,

        a.application_name,
        a.application_category,
        a.application_images

      FROM admin.orders o
      JOIN catalog.applications a ON o.order_application_id = a.application_id
      ${whereClause}
      ORDER BY o.order_created DESC
      LIMIT 1000
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM admin.orders o
      JOIN catalog.applications a ON o.order_application_id = a.application_id
      ${whereClause}
    `;

    const [ordersResult, countResult] = await Promise.all([
      client.query(mainQuery, values),
      client.query(countQuery, values),
    ]);

    if (!ordersResult || !Array.isArray(ordersResult.rows)) {
      await client.cleanup();
      throw new Error('Invalid data structure returned from database');
    }

    const total = parseInt(countResult.rows[0].total);

    const sanitizedOrders = ordersResult.rows.map((order) => ({
      order_id: order.order_id,
      order_payment_status: ['paid', 'unpaid', 'refunded', 'failed'].includes(
        order.order_payment_status,
      )
        ? order.order_payment_status
        : 'unpaid',
      order_created: order.order_created,
      order_updated: order.order_updated,
      order_application_id: order.order_application_id,
      order_client_name: order.order_client_name || '',
      order_client_email: order.order_client_email || '',
      order_client_phone: order.order_client_phone || '',
      order_price: Math.max(0, parseFloat(order.order_price) || 0),
      order_rent: Math.max(0, parseFloat(order.order_rent) || 0),
      order_platform_ids: Array.isArray(order.order_platform_ids)
        ? order.order_platform_ids
        : [],

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

    const responseTime = Date.now() - startTime;

    logger.info('Orders filtered successfully', {
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

    await client.cleanup();

    return { orders: sanitizedOrders, totalOrders: total };
  } catch (error) {
    logger.error('Error filtering orders', {
      error: error.message,
      requestId: requestId || 'unknown',
      durationMs: Date.now() - startTime,
    });

    trackDatabaseError(error, 'filter_orders_global', {
      requestId: requestId || 'unknown',
    });

    if (client) await client.cleanup();

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'An error occurred while filtering orders. Please try again.',
      );
    }
    throw error;
  }
}
