import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getServerEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getStoreNameWith } from "@/lib/settings/queries";
import { STORE_NAME_TOKEN, escapeHtml } from "@/lib/email/templates";

let cachedTransporter: Transporter | null | undefined;

/**
 * Lazily built + cached at module scope (one connection pool per server
 * process, not per call). Returns null when SMTP isn't configured, so
 * callers fall back to the console/log dev transport instead of throwing.
 */
function getTransporter(): Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;

  const env = getServerEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return cachedTransporter;
}

/**
 * Sends one email, or logs it to the server console when SMTP isn't
 * configured (local dev default — never silently swallowed, never throws
 * and breaks the business action it's attached to). Failures are caught
 * and logged the same way: a notification email failing to send should
 * never fail the order/payment action that triggered it.
 */
/**
 * Sender display name always follows the admin's store name; only the
 * address part of EMAIL_FROM is used ("Any Name <a@b.com>" or "a@b.com").
 */
function fromHeader(emailFrom: string, storeName: string): string {
  const address = emailFrom.match(/<([^>]+)>/)?.[1] ?? emailFrom.trim();
  return `"${storeName.replace(/["\\]/g, "")}" <${address}>`;
}

export async function sendEmail(params: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  const transporter = getTransporter();
  const env = getServerEnv();

  // Service-role client: this also runs from cron routes with no user session.
  const storeName = await getStoreNameWith(createAdminSupabaseClient());
  params = {
    ...params,
    subject: params.subject.replaceAll(STORE_NAME_TOKEN, storeName),
    html: params.html.replaceAll(STORE_NAME_TOKEN, escapeHtml(storeName)),
    text: params.text?.replaceAll(STORE_NAME_TOKEN, storeName),
  };

  if (!transporter) {
    console.log(`[email:dev] To: ${params.to}\nSubject: ${params.subject}\n${params.text ?? params.html}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: fromHeader(env.EMAIL_FROM, storeName),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  } catch (error) {
    console.error("[email] send failed:", params.subject, "->", params.to, error);
  }
}
