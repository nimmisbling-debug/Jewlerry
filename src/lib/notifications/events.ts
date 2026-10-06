import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendEmail } from "@/lib/email/send";
import {
  orderConfirmationEmail,
  orderStatusChangedEmail,
  paymentSubmittedEmail,
  paymentApprovedEmail,
  paymentRejectedEmail,
  newOrderAdminAlertEmail,
  newPaymentAdminAlertEmail,
  newContactMessageAdminAlertEmail,
  returnRequestedEmail,
  returnApprovedEmail,
  returnRejectedEmail,
  newReturnRequestAdminAlertEmail,
  accountBlockedEmail,
} from "@/lib/email/templates";
import { createNotification, createNotificationsForUsers, getAdminRecipients } from "@/lib/notifications/mutations";
import { getAdminSettingsWith } from "@/lib/settings/queries";

/**
 * The single integration point between the order/payment business logic
 * (lib/orders, lib/payments) and the two customer-facing side effects every
 * status change needs: an in-app notification row + an email. Kept
 * separate from the RPC-wrapper mutations so those stay focused on the one
 * business operation; every function here is fire-and-forget from the
 * caller's perspective (never throws — a notification/email failure must
 * never fail the order/payment action that triggered it).
 *
 * All independent notification/email dispatches within one event run
 * concurrently (Promise.all) rather than sequentially — a real SMTP send
 * takes real network time (seconds, not milliseconds), and this is already
 * on the critical path of the order/payment Server Action that awaits it.
 */

export async function notifyOrderCreated(
  supabase: SupabaseClient<Database>,
  params: {
    orderId: number;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    total: number;
    currencyCode: string;
  },
): Promise<void> {
  const { subject, html } = orderConfirmationEmail(params);
  const adminSettings = await getAdminSettingsWith(supabase);
  const admins = adminSettings?.notify_admin_on_new_order !== false ? await getAdminRecipients(supabase) : [];
  const adminEmail = newOrderAdminAlertEmail(params);

  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Order placed",
      message: `Your order ${params.orderNumber} has been placed and is awaiting payment.`,
      type: "order",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
    createNotificationsForUsers(
      supabase,
      admins.map((a) => a.id),
      { title: "New order", message: `${params.customerName} placed order ${params.orderNumber}.`, type: "order" },
    ),
    ...admins.map((a) => sendEmail({ to: a.email, subject: adminEmail.subject, html: adminEmail.html })),
  ]);
}

export async function notifyOrderStatusChanged(
  supabase: SupabaseClient<Database>,
  params: {
    orderId: number;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    statusLabel: string;
  },
): Promise<void> {
  const { subject, html } = orderStatusChangedEmail(params);
  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Order update",
      message: `Order ${params.orderNumber} is now ${params.statusLabel}.`,
      type: "order",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
  ]);
}

export async function notifyPaymentSubmitted(
  supabase: SupabaseClient<Database>,
  params: {
    paymentId: number;
    orderId: number;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    amount: number;
    currencyCode: string;
  },
): Promise<void> {
  const { subject, html } = paymentSubmittedEmail(params);
  const adminSettings = await getAdminSettingsWith(supabase);
  const admins = adminSettings?.notify_admin_on_payment_submitted !== false ? await getAdminRecipients(supabase) : [];
  const adminEmail = newPaymentAdminAlertEmail(params);

  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Payment submitted",
      message: `Your payment for order ${params.orderNumber} is awaiting review.`,
      type: "payment",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
    createNotificationsForUsers(
      supabase,
      admins.map((a) => a.id),
      {
        title: "Payment awaiting review",
        message: `${params.customerName} submitted a payment for order ${params.orderNumber}.`,
        type: "payment",
      },
    ),
    ...admins.map((a) => sendEmail({ to: a.email, subject: adminEmail.subject, html: adminEmail.html })),
  ]);
}

export async function notifyPaymentApproved(
  supabase: SupabaseClient<Database>,
  params: {
    orderId: number;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    amount: number;
    currencyCode: string;
    dueOnDelivery?: number;
  },
): Promise<void> {
  const { subject, html } = paymentApprovedEmail(params);
  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Payment confirmed",
      message: `Your payment for order ${params.orderNumber} has been confirmed.`,
      type: "payment",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
  ]);
}

export async function notifyCustomerBlocked(
  supabase: SupabaseClient<Database>,
  params: { customerId: string; customerEmail: string; reason: string },
): Promise<void> {
  const { subject, html } = accountBlockedEmail(params);
  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Account suspended",
      message: `Your account has been suspended: ${params.reason}.`,
      type: "system",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
  ]);
}

export async function notifyContactMessageReceived(
  supabase: SupabaseClient<Database>,
  params: { name: string; email: string; subject: string | null; message: string },
): Promise<void> {
  const admins = await getAdminRecipients(supabase);
  const adminEmail = newContactMessageAdminAlertEmail(params);

  await Promise.all([
    createNotificationsForUsers(
      supabase,
      admins.map((a) => a.id),
      {
        title: "New contact message",
        message: `${params.name} sent a message${params.subject ? `: "${params.subject}"` : ""}.`,
        type: "system",
      },
    ),
    ...admins.map((a) => sendEmail({ to: a.email, subject: adminEmail.subject, html: adminEmail.html })),
  ]);
}

export async function notifyReturnRequested(
  supabase: SupabaseClient<Database>,
  params: {
    returnRequestId: number;
    orderId: number;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    title: string;
  },
): Promise<void> {
  const { subject, html } = returnRequestedEmail(params);
  const admins = await getAdminRecipients(supabase);
  const adminEmail = newReturnRequestAdminAlertEmail(params);

  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Return request submitted",
      message: `Your return request for order ${params.orderNumber} is awaiting review.`,
      type: "order",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
    createNotificationsForUsers(
      supabase,
      admins.map((a) => a.id),
      {
        title: "New return request",
        message: `${params.customerName} requested a return for order ${params.orderNumber}: "${params.title}".`,
        type: "order",
      },
    ),
    ...admins.map((a) => sendEmail({ to: a.email, subject: adminEmail.subject, html: adminEmail.html })),
  ]);
}

export async function notifyReturnApproved(
  supabase: SupabaseClient<Database>,
  params: { orderId: number; orderNumber: string; customerId: string; customerName: string; customerEmail: string },
): Promise<void> {
  const { subject, html } = returnApprovedEmail(params);
  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Return approved",
      message: `Your return request for order ${params.orderNumber} was approved. Please ship the item(s) back.`,
      type: "order",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
  ]);
}

export async function notifyReturnRejected(
  supabase: SupabaseClient<Database>,
  params: {
    orderId: number;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    reason: string;
  },
): Promise<void> {
  const { subject, html } = returnRejectedEmail(params);
  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Return request declined",
      message: `Your return request for order ${params.orderNumber} was declined: ${params.reason}.`,
      type: "order",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
  ]);
}

export async function notifyPaymentRejected(
  supabase: SupabaseClient<Database>,
  params: {
    orderId: number;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    reason: string;
    note?: string | null;
  },
): Promise<void> {
  const { subject, html } = paymentRejectedEmail(params);
  await Promise.all([
    createNotification(supabase, {
      userId: params.customerId,
      title: "Payment could not be confirmed",
      message: `Your payment for order ${params.orderNumber} was rejected: ${params.reason}.`,
      type: "payment",
    }),
    sendEmail({ to: params.customerEmail, subject, html }),
  ]);
}
