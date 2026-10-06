import { formatCurrency } from "@/lib/utils";

/**
 * Placeholder for the admin-configured store name. Templates stay
 * synchronous and settings-agnostic; sendEmail() swaps this for the
 * current (HTML-escaped) site_settings.store_name right before sending.
 */
export const STORE_NAME_TOKEN = "{{STORE_NAME}}";
const BRAND = STORE_NAME_TOKEN;
const GOLD = "#a8823c";
const INK = "#2b2420";

/**
 * Every dynamic string below eventually flows into a raw HTML template
 * literal — several originate as free-text user input (checkout full
 * name, an admin's rejection note or composed notification body). None
 * of that is escaped by anything else on this path (unlike React, which
 * escapes by default), so an unescaped `<script>` or stray `<`/`&` in a
 * customer's name would corrupt the markup or execute in an HTML-
 * rendering email client. Escape every interpolated value here, even
 * ones that are currently system-generated (order numbers, status
 * labels) — cheap insurance against a future caller passing through
 * something less trusted.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared HTML shell (inline styles only — most email clients strip <style> tags). */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f3ec;font-family:Georgia,'Times New Roman',serif;color:${INK};">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${INK};padding:20px 28px;">
                <span style="color:${GOLD};font-size:20px;letter-spacing:0.05em;">${BRAND}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="font-size:18px;margin:0 0 16px;color:${INK};">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f2ece0;font-size:12px;color:#77695c;">
                This is an automated message from ${BRAND}. Please do not reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="background:${GOLD};color:#fff;text-decoration:none;padding:10px 20px;border-radius:4px;font-size:14px;display:inline-block;">${label}</a></p>`;
}

function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base}${path}`;
}

export function orderConfirmationEmail(params: {
  orderNumber: string;
  customerName: string;
  total: number;
  currencyCode: string;
  orderId: number;
}) {
  const subject = `Order confirmation — ${params.orderNumber}`;
  const html = layout(
    "Thank you for your order",
    `<p>Hi ${escapeHtml(params.customerName)},</p>
     <p>We've received your order <strong>${escapeHtml(params.orderNumber)}</strong> for
     <strong>${formatCurrency(params.total, params.currencyCode)}</strong>. We'll email you again once your
     payment is confirmed and your order is on its way.</p>
     ${button(siteUrl(`/account/orders/${params.orderId}`), "View your order")}`,
  );
  return { subject, html };
}

export function orderStatusChangedEmail(params: {
  orderNumber: string;
  customerName: string;
  statusLabel: string;
  orderId: number;
}) {
  const subject = `Order update — ${params.orderNumber} is now ${params.statusLabel}`;
  const html = layout(
    "Your order status has changed",
    `<p>Hi ${escapeHtml(params.customerName)},</p>
     <p>Your order <strong>${escapeHtml(params.orderNumber)}</strong> is now
     <strong>${escapeHtml(params.statusLabel)}</strong>.</p>
     ${button(siteUrl(`/account/orders/${params.orderId}`), "View your order")}`,
  );
  return { subject, html };
}

export function paymentSubmittedEmail(params: { orderNumber: string; customerName: string; orderId: number }) {
  const subject = `Payment received for review — ${params.orderNumber}`;
  const html = layout(
    "Payment submitted",
    `<p>Hi ${escapeHtml(params.customerName)},</p>
     <p>Thanks — we've received your payment proof for order <strong>${escapeHtml(params.orderNumber)}</strong>
     and it's now awaiting review. We'll email you as soon as it's confirmed.</p>
     ${button(siteUrl(`/account/orders/${params.orderId}`), "View your order")}`,
  );
  return { subject, html };
}

export function paymentApprovedEmail(params: {
  orderNumber: string;
  customerName: string;
  amount: number;
  currencyCode: string;
  orderId: number;
  /** Remaining amount to collect in cash on delivery (delivery-fee-only payments). */
  dueOnDelivery?: number;
}) {
  const subject = `Payment confirmed — ${params.orderNumber}`;
  const html = layout(
    "Payment confirmed",
    `<p>Hi ${escapeHtml(params.customerName)},</p>
     <p>Your payment of <strong>${formatCurrency(params.amount, params.currencyCode)}</strong> for order
     <strong>${escapeHtml(params.orderNumber)}</strong> has been confirmed. We're now preparing your order.</p>
     ${
       params.dueOnDelivery && params.dueOnDelivery > 0
         ? `<p>Please keep <strong>${formatCurrency(params.dueOnDelivery, params.currencyCode)}</strong> ready to pay in cash when your order is delivered.</p>`
         : ""
     }
     ${button(siteUrl(`/account/orders/${params.orderId}`), "View your order")}`,
  );
  return { subject, html };
}

export function paymentRejectedEmail(params: {
  orderNumber: string;
  customerName: string;
  reason: string;
  note?: string | null;
  orderId: number;
}) {
  const subject = `Payment could not be confirmed — ${params.orderNumber}`;
  const html = layout(
    "We couldn't confirm your payment",
    `<p>Hi ${escapeHtml(params.customerName)},</p>
     <p>We weren't able to confirm your payment for order <strong>${escapeHtml(params.orderNumber)}</strong>.</p>
     <p><strong>Reason:</strong> ${escapeHtml(params.reason)}${params.note ? `<br/>${escapeHtml(params.note)}` : ""}</p>
     <p>Please submit a new payment for this order, or contact us if you believe this is a mistake.</p>
     ${button(siteUrl(`/account/orders/${params.orderId}/pay`), "Submit payment again")}`,
  );
  return { subject, html };
}

export function returnRequestedEmail(params: { orderNumber: string; customerName: string; orderId: number }) {
  const subject = `Return request received — ${params.orderNumber}`;
  const html = layout(
    "Return request submitted",
    `<p>Hi ${escapeHtml(params.customerName)},</p>
     <p>We've received your return request for order <strong>${escapeHtml(params.orderNumber)}</strong>
     and it's now awaiting review. We'll email you as soon as it's been reviewed.</p>
     ${button(siteUrl(`/account/orders/${params.orderId}`), "View your order")}`,
  );
  return { subject, html };
}

export function returnApprovedEmail(params: { orderNumber: string; customerName: string; orderId: number }) {
  const subject = `Return approved — ${params.orderNumber}`;
  const html = layout(
    "Your return was approved",
    `<p>Hi ${escapeHtml(params.customerName)},</p>
     <p>Your return request for order <strong>${escapeHtml(params.orderNumber)}</strong> has been approved.
     Please ship the item(s) back to us — we'll update your order once we receive them.</p>
     ${button(siteUrl(`/account/orders/${params.orderId}`), "View your order")}`,
  );
  return { subject, html };
}

export function returnRejectedEmail(params: {
  orderNumber: string;
  customerName: string;
  reason: string;
  orderId: number;
}) {
  const subject = `Return request declined — ${params.orderNumber}`;
  const html = layout(
    "We couldn't approve your return request",
    `<p>Hi ${escapeHtml(params.customerName)},</p>
     <p>We weren't able to approve your return request for order <strong>${escapeHtml(params.orderNumber)}</strong>.</p>
     <p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
     <p>If you believe this is a mistake, please contact us for help.</p>
     ${button(siteUrl(`/account/orders/${params.orderId}`), "View your order")}`,
  );
  return { subject, html };
}

export function newReturnRequestAdminAlertEmail(params: {
  orderNumber: string;
  customerName: string;
  title: string;
  returnRequestId: number;
}) {
  const subject = `New return request — ${params.orderNumber}`;
  const html = layout(
    "New return request",
    `<p>${escapeHtml(params.customerName)} requested a return for order
     <strong>${escapeHtml(params.orderNumber)}</strong>: "${escapeHtml(params.title)}".</p>
     ${button(siteUrl(`/admin/returns/${params.returnRequestId}`), "Review return request")}`,
  );
  return { subject, html };
}

export function newOrderAdminAlertEmail(params: {
  orderNumber: string;
  customerName: string;
  total: number;
  currencyCode: string;
  orderId: number;
}) {
  const subject = `New order — ${params.orderNumber}`;
  const html = layout(
    "New order placed",
    `<p>${escapeHtml(params.customerName)} just placed order <strong>${escapeHtml(params.orderNumber)}</strong> for
     <strong>${formatCurrency(params.total, params.currencyCode)}</strong>.</p>
     ${button(siteUrl(`/admin/orders/${params.orderId}`), "View in admin")}`,
  );
  return { subject, html };
}

export function newPaymentAdminAlertEmail(params: {
  orderNumber: string;
  customerName: string;
  amount: number;
  currencyCode: string;
  paymentId: number;
}) {
  const subject = `Payment submitted for review — ${params.orderNumber}`;
  const html = layout(
    "Payment awaiting review",
    `<p>${escapeHtml(params.customerName)} submitted a payment of
     <strong>${formatCurrency(params.amount, params.currencyCode)}</strong> for order
     <strong>${escapeHtml(params.orderNumber)}</strong>.</p>
     ${button(siteUrl(`/admin/payments/${params.paymentId}`), "Review payment")}`,
  );
  return { subject, html };
}

export function newContactMessageAdminAlertEmail(params: {
  name: string;
  email: string;
  subject: string | null;
  message: string;
}) {
  const subject = `New contact message${params.subject ? ` — ${params.subject}` : ""}`;
  const html = layout(
    "New contact message",
    `<p><strong>${escapeHtml(params.name)}</strong> (${escapeHtml(params.email)}) sent a message${
      params.subject ? ` about "${escapeHtml(params.subject)}"` : ""
    }:</p>
     <p style="white-space:pre-wrap;background:#f2ece0;padding:12px 16px;border-radius:4px;">${escapeHtml(params.message)}</p>
     ${button(siteUrl("/admin/contact"), "View in admin")}`,
  );
  return { subject, html };
}

export function accountBlockedEmail(params: { reason: string }) {
  const subject = "Your account has been suspended";
  const html = layout(
    "Account suspended",
    `<p>Your ${BRAND} account has been suspended by an administrator.</p>
     <p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
     <p>If you believe this is a mistake, please contact us for help.</p>`,
  );
  return { subject, html };
}

export function genericNotificationEmail(params: { title: string; message: string; ctaUrl?: string; ctaLabel?: string }) {
  const html = layout(
    escapeHtml(params.title),
    `<p>${escapeHtml(params.message)}</p>${params.ctaUrl && params.ctaLabel ? button(siteUrl(params.ctaUrl), params.ctaLabel) : ""}`,
  );
  return { subject: params.title, html };
}
