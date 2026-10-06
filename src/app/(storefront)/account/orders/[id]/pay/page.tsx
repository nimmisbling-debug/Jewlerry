import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { requireUser } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrderById } from "@/lib/orders/queries";
import { getPaymentMethods } from "@/lib/payments/queries";
import { PaymentSubmitForm } from "@/components/storefront/payment-submit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Submit Payment" };

export default async function SubmitPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const supabase = await createServerSupabaseClient();
  const order = await getOrderById(supabase, orderId);
  if (!order) notFound();
  if (order.customerId !== profile.id) notFound();
  if (!["unconfirmed", "payment_pending"].includes(order.status)) {
    redirect(`/account/orders/${orderId}` as Route);
  }

  const methods = await getPaymentMethods(supabase, { activeOnly: true });

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <Link href={`/account/orders/${orderId}`} className="text-sm text-muted-foreground hover:text-foreground">
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
            returnPath={`/account/orders/${order.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
