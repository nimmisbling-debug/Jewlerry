import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata, Route } from "next";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getOrderByGuestToken } from "@/lib/orders/queries";
import { getPaymentMethods } from "@/lib/payments/queries";
import { PaymentSubmitForm } from "@/components/storefront/payment-submit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Submit Payment", robots: { index: false, follow: false } };

/** Guest version of /account/orders/[id]/pay — access is the token in the URL. */
export default async function GuestSubmitPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminSupabaseClient();
  const order = await getOrderByGuestToken(admin, token);
  if (!order) notFound();
  if (!["unconfirmed", "payment_pending"].includes(order.status)) {
    redirect(`/order/${token}` as Route);
  }

  const methods = await getPaymentMethods(admin, { activeOnly: true });

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <Link href={`/order/${token}` as Route} className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to order
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Submit payment for {order.orderNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentSubmitForm
            orderId={order.id}
            total={order.total}
            deliveryFee={order.shippingCost}
            currencyCode={order.currencyCode}
            methods={methods}
            guestToken={token}
            returnPath={`/order/${token}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
