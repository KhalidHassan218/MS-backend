/**
 * Backend Audit Trail Service — Microsoft Supplier Platform
 *
 * Mirror of the frontend auditTrail.service.js adapted for Node.js.
 * Uses the supabaseAdmin (service-role) client so it bypasses RLS and can
 * log events on behalf of any user (payments, PDF generation, emails sent).
 *
 * Security notes:
 * - Never log full license keys — only the last 5 characters
 * - All logging failures are caught and printed; they never throw to callers
 * - actor_type is always set explicitly: 'user' | 'admin' | 'system'
 */

import { supabaseAdmin } from '../config/supabase.js';

// ---------------------------------------------------------------------------
// Core logger
// ---------------------------------------------------------------------------

/**
 * Insert one row into audit_events.
 *
 * @param {Object} event
 * @param {string}  event.action        - e.g. "order.paid"
 * @param {string}  event.entityType    - e.g. "order", "payment", "email"
 * @param {string}  [event.entityId]    - UUID / string ID of the entity
 * @param {string}  [event.customerId]  - the customer's auth user ID
 * @param {string}  [event.actorType]   - 'user' | 'admin' | 'system' (default 'system')
 * @param {string}  [event.actorUserId] - auth user ID of the actor
 * @param {string}  [event.orderId]
 * @param {string}  [event.orderNumber]
 * @param {string}  [event.licenseId]
 * @param {string}  [event.productId]
 * @param {string}  [event.productPn]
 * @param {string}  [event.licenseType]
 * @param {string}  [event.documentId]
 * @param {string}  [event.documentType]
 * @param {Object}  [event.details]     - arbitrary JSON payload
 */
async function logEvent(event) {
  try {
    const row = {
      timestamp_utc:  new Date().toISOString(),
      customer_id:    event.customerId    || null,
      actor_type:     event.actorType     || 'system',
      actor_user_id:  event.actorUserId   || null,
      actor_org_id:   event.actorOrgId    || event.customerId || null,
      action:         event.action,
      entity_type:    event.entityType,
      entity_id:      event.entityId      || null,
      order_id:       event.orderId       || null,
      order_number:   event.orderNumber   || null,
      license_id:     event.licenseId     || null,
      product_id:     event.productId     || null,
      product_pn:     event.productPn     || null,
      license_type:   event.licenseType   || null,
      document_id:    event.documentId    || null,
      document_type:  event.documentType  || null,
      ip_address:     null,   // backend has no client IP at this point
      user_agent:     'backend-server',
      details:        event.details       || {},
    };

    const { error } = await supabaseAdmin
      .from('audit_events')
      .insert([row]);

    if (error) {
      console.error('[AuditTrail] Insert failed:', error.message);
    }
  } catch (err) {
    // Audit logging must never crash the application
    console.error('[AuditTrail] logEvent error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Payment events
// ---------------------------------------------------------------------------

export const logPaymentEvent = {
  /**
   * Stripe checkout.session.completed webhook received and verified.
   * @param {string} sessionId   - Stripe session ID
   * @param {string} customerId  - Supabase user ID
   * @param {Object} details     - { amount, currency, orderNumber? }
   */
  webhookReceived: (sessionId, customerId, details = {}) =>
    logEvent({
      action:      'payment.webhook_received',
      entityType:  'payment',
      entityId:    sessionId,
      customerId,
      actorType:   'system',
      details: {
        amount:       details.amount,
        currency:     details.currency,
        order_number: details.orderNumber,
      },
    }),

  /**
   * Payment confirmed and order processing started.
   * @param {string} orderId
   * @param {string} orderNumber
   * @param {string} customerId
   * @param {Object} details  - { amount, currency, payment_method }
   */
  initiated: (orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:      'payment.initiated',
      entityType:  'payment',
      entityId:    details.paymentIntentId || orderId,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        amount:         details.amount,
        currency:       details.currency,
        payment_method: details.paymentMethod || 'stripe',
      },
    }),

  /**
   * Payment failed (webhook or processing error).
   * @param {string} orderId
   * @param {string} orderNumber
   * @param {string} customerId
   * @param {Object} details  - { amount, currency, failure_reason }
   */
  failed: (orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:      'payment.failed',
      entityType:  'payment',
      entityId:    details.paymentIntentId || orderId,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        amount:         details.amount,
        currency:       details.currency,
        failure_reason: details.failureReason,
        payment_method: details.paymentMethod || 'stripe',
      },
    }),

  /**
   * Refund issued by admin.
   * @param {string} orderId
   * @param {string} orderNumber
   * @param {string} customerId
   * @param {Object} details  - { refundAmount, refundReason, refundedBy, refundId }
   */
  refunded: (orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:      'payment.refunded',
      entityType:  'payment',
      entityId:    details.refundId || orderId,
      customerId,
      actorType:   'admin',
      orderId,
      orderNumber,
      details: {
        refund_amount: details.refundAmount,
        refund_reason: details.refundReason,
        refunded_by:   details.refundedBy,
        currency:      details.currency,
      },
    }),
};

// ---------------------------------------------------------------------------
// Order events
// ---------------------------------------------------------------------------

export const logOrderEvent = {
  /**
   * New order created from a Stripe session or pay-by-invoice flow.
   */
  created: (orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:      'order.created',
      entityType:  'order',
      entityId:    orderId,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        total_amount:   details.totalAmount,
        currency:       details.currency,
        items_count:    details.itemsCount,
        payment_method: details.paymentMethod,
      },
    }),

  /**
   * Order marked as paid (Stripe webhook completed).
   */
  paid: (orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:      'order.paid',
      entityType:  'order',
      entityId:    orderId,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        amount:         details.amount,
        currency:       details.currency,
        payment_method: details.paymentMethod || 'stripe',
      },
    }),

  /**
   * Order fully processed (keys assigned, PDFs uploaded, emails sent).
   */
  completed: (orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:      'order.completed',
      entityType:  'order',
      entityId:    orderId,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details,
    }),

  /**
   * License keys assigned to the order.
   */
  keysAssigned: (orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:      'order.keys_assigned',
      entityType:  'order',
      entityId:    orderId,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        licenses_count: details.licensesCount,
        products_count: details.productsCount,
      },
    }),
};

// ---------------------------------------------------------------------------
// Document / PDF events
// ---------------------------------------------------------------------------

export const logDocumentEvent = {
  /**
   * A PDF was generated and uploaded to Supabase Storage.
   * @param {string} documentType  - 'invoice' | 'license' | 'proforma'
   * @param {string} orderId
   * @param {string} orderNumber
   * @param {string} customerId
   * @param {Object} details       - { file_name, storage_url }
   */
  generated: (documentType, orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:       'document.generated',
      entityType:   'document',
      entityId:     `${documentType}_${orderNumber}`,
      customerId,
      actorType:    'system',
      orderId,
      orderNumber,
      documentType,
      details: {
        file_name:    details.fileName,
        storage_url:  details.storageUrl,
      },
    }),

  /**
   * A PDF was uploaded to cloud storage.
   */
  uploaded: (documentType, orderId, orderNumber, customerId, details = {}) =>
    logEvent({
      action:       'document.uploaded',
      entityType:   'document',
      entityId:     `${documentType}_${orderNumber}`,
      customerId,
      actorType:    'system',
      orderId,
      orderNumber,
      documentType,
      details: {
        file_name:   details.fileName,
        storage_url: details.storageUrl,
      },
    }),
};

// ---------------------------------------------------------------------------
// Email events
// ---------------------------------------------------------------------------

export const logEmailEvent = {
  /**
   * Order confirmation email sent (with invoice / proforma attached).
   * @param {string} orderId
   * @param {string} orderNumber
   * @param {string} customerId
   * @param {string} recipientEmail
   * @param {string} emailType      - 'invoice' | 'proforma' | 'order_confirmation'
   */
  orderConfirmation: (orderId, orderNumber, customerId, recipientEmail, emailType = 'order_confirmation') =>
    logEvent({
      action:      'email.order_confirmation',
      entityType:  'email',
      entityId:    `email_${Date.now()}`,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        recipient:  recipientEmail,
        email_type: emailType,
      },
    }),

  /**
   * Invoice PDF emailed to customer / billing contact.
   */
  invoiceSent: (orderId, orderNumber, customerId, recipientEmail) =>
    logEvent({
      action:      'email.invoice_sent',
      entityType:  'email',
      entityId:    `email_${Date.now()}`,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        recipient:  recipientEmail,
        email_type: 'invoice',
      },
    }),

  /**
   * License delivery email sent.
   */
  licenseDelivered: (orderId, orderNumber, customerId, recipientEmail) =>
    logEvent({
      action:      'email.license_delivered',
      entityType:  'email',
      entityId:    `email_${Date.now()}`,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        recipient:  recipientEmail,
        email_type: 'license_delivery',
      },
    }),

  /**
   * Proforma invoice emailed (pay-by-invoice flow).
   */
  proformaSent: (orderId, orderNumber, customerId, recipientEmail) =>
    logEvent({
      action:      'email.invoice_sent',
      entityType:  'email',
      entityId:    `email_${Date.now()}`,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        recipient:  recipientEmail,
        email_type: 'proforma',
      },
    }),

  /**
   * Email sending failed.
   */
  sendFailed: (orderId, orderNumber, customerId, recipientEmail, details = {}) =>
    logEvent({
      action:      'email.send_failed',
      entityType:  'email',
      entityId:    `email_${Date.now()}`,
      customerId,
      actorType:   'system',
      orderId,
      orderNumber,
      details: {
        recipient:      recipientEmail,
        failure_reason: details.failureReason,
        email_type:     details.emailType,
      },
    }),
};

// ---------------------------------------------------------------------------
// User events  (triggered from backend registration/approval routes)
// ---------------------------------------------------------------------------

export const logUserEvent = {
  /**
   * Admin approved a pending registration.
   */
  approved: (userId, approvedBy) =>
    logEvent({
      action:      'user.approved',
      entityType:  'user',
      entityId:    userId,
      customerId:  userId,
      actorType:   'admin',
      details:     { approved_by: approvedBy },
    }),

  /**
   * Admin rejected a pending registration.
   */
  rejected: (userId, rejectedBy) =>
    logEvent({
      action:      'user.rejected',
      entityType:  'user',
      entityId:    userId,
      customerId:  userId,
      actorType:   'admin',
      details:     { rejected_by: rejectedBy },
    }),
};

// ---------------------------------------------------------------------------
// Invoice-terms events  (backend approval / rejection)
// ---------------------------------------------------------------------------

export const logInvoiceTermsEvent = {
  approved: (requestId, approvedBy, customerId) =>
    logEvent({
      action:     'invoice_terms.approved',
      entityType: 'invoice_terms',
      entityId:   requestId,
      customerId,
      actorType:  'admin',
      details:    { approved_by: approvedBy },
    }),

  rejected: (requestId, rejectedBy, customerId) =>
    logEvent({
      action:     'invoice_terms.rejected',
      entityType: 'invoice_terms',
      entityId:   requestId,
      customerId,
      actorType:  'admin',
      details:    { rejected_by: rejectedBy },
    }),
};

// ---------------------------------------------------------------------------
// Security events  (webhook signature failures, etc.)
// ---------------------------------------------------------------------------

export const logSecurityEvent = {
  webhookVerificationFailed: (details = {}) =>
    logEvent({
      action:     'security.webhook_verification_failed',
      entityType: 'security',
      entityId:   `sec_${Date.now()}`,
      actorType:  'system',
      details: {
        failure_reason: details.failureReason,
        source:         details.source || 'stripe_webhook',
      },
    }),

  suspiciousActivity: (details = {}) =>
    logEvent({
      action:     'security.suspicious_login',
      entityType: 'security',
      entityId:   `sec_${Date.now()}`,
      actorType:  'system',
      details,
    }),
};

// ---------------------------------------------------------------------------
// Bulk / admin operation events
// ---------------------------------------------------------------------------

export const logBulkEvent = {
  licenseUpload: (customerId, details = {}) =>
    logEvent({
      action:     'bulk.license_upload',
      entityType: 'bulk_operation',
      entityId:   `bulk_${Date.now()}`,
      customerId,
      actorType:  'admin',
      details: {
        file_name:      details.fileName,
        licenses_count: details.licensesCount,
        product_pn:     details.productPn,
      },
    }),

  priceUpdate: (customerId, details = {}) =>
    logEvent({
      action:     'bulk.price_update',
      entityType: 'bulk_operation',
      entityId:   `bulk_${Date.now()}`,
      customerId,
      actorType:  'admin',
      details: {
        products_affected: details.productsAffected,
        update_type:       details.updateType,
      },
    }),
};

// Export the raw logEvent for any one-off use
export { logEvent };
