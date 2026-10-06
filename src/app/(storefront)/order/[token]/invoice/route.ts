import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getOrderByGuestToken } from "@/lib/orders/queries";
import { InvoiceDocument } from "@/lib/invoices/invoice-document";
import { getStoreNameWith } from "@/lib/settings/queries";

/** Guest invoice download — same PDF as /api/invoices/[orderId], gated by the order's secret token. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminSupabaseClient();
  const order = await getOrderByGuestToken(admin, token);
  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  const storeName = await getStoreNameWith(admin);
  const buffer = await renderToBuffer(InvoiceDocument({ order, storeName }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
