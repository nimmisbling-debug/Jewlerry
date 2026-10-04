import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentProfile } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrderById } from "@/lib/orders/queries";
import { InvoiceDocument } from "@/lib/invoices/invoice-document";
import { getStoreName } from "@/lib/settings/queries";

/**
 * Streams a freshly-generated invoice PDF for one order. Server-rendered
 * from data re-read from the database (never trusting anything the client
 * could have cached/tampered with), gated to the order's own customer or
 * an admin — same access rule as `getOrderById`'s callers elsewhere.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId: orderIdParam } = await params;
  const orderId = Number(orderIdParam);
  if (!Number.isInteger(orderId)) {
    return new Response("Not found", { status: 404 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const order = await getOrderById(supabase, orderId);
  if (!order) {
    return new Response("Not found", { status: 404 });
  }
  if (order.customerId !== profile.id && profile.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const storeName = await getStoreName();
  const buffer = await renderToBuffer(InvoiceDocument({ order, storeName }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
