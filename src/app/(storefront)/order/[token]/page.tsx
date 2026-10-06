import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata, Route } from "next";
import { ImageOff, FileDown } from "lucide-react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getOrderByGuestToken } from "@/lib/orders/queries";
import { getPaymentsForOrder } from "@/lib/payments/queries";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { OrderTimeline } from "@/components/storefront/order-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_TYPE_LABELS } from "@/constants";

// Private per-order link: keep it out of search engines.
export const metadata: Metadata = { title: "Your Order", robots: { index: false, follow: false } };

/**
 * Guest order page, reached via the secret link shown after checkout and in
 * every order email. The token in the URL is the only credential, so the
 * order is read with the service-role client after matching it.
 */
export default async function GuestOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminSupabaseClient();
  const order = await getOrderByGuestToken(admin, token);
  if (!order) notFound();

  const payments = await getPaymentsForOrder(admin, order.id);
  const latestPayment = payments[0] ?? null;
  const canSubmitPayment =
    ["unconfirmed", "payment_pending"].includes(order.status) &&
    (!latestPayment || latestPayment.status === "rejected");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-foreground">Save this page&apos;s link to check your order later.</p>
        <p className="text-muted-foreground">
          We&apos;ve also emailed it to {order.customerEmail}. Anyone with this link can see this order.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Button asChild variant="outline" size="sm">
            <a href={`/order/${token}/invoice`}>
              <FileDown className="size-4" /> Invoice
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestPayment ? (
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-foreground">
                      {formatCurrency(latestPayment.amount, order.currencyCode)} via {latestPayment.methodName ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{PAYMENT_TYPE_LABELS[latestPayment.paymentType]}</p>
                    <p className="text-xs text-muted-foreground">Submitted {formatDate(latestPayment.createdAt)}</p>
                    {latestPayment.status === "rejected" && latestPayment.rejectionReason && (
                      <p className="mt-1 text-xs text-destructive">Rejected: {latestPayment.rejectionReason}</p>
                    )}
                  </div>
                  <PaymentStatusBadge status={latestPayment.status} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No payment submitted yet.</p>
              )}
              {canSubmitPayment && (
                <Button asChild size="sm">
                  <Link href={`/order/${token}/pay` as Route}>
                    {latestPayment ? "Submit a new payment" : "Proceed to payment"}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name} fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageOff className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.unitPrice, order.currencyCode)} &times; {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {formatCurrency(item.lineTotal, order.currencyCode)}
                  </p>
                </div>
              ))}
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal, order.currencyCode)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>{formatCurrency(order.shippingCost, order.currencyCode)}</span>
                </div>
                <div className="flex justify-between font-medium text-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(order.total, order.currencyCode)}</span>
                </div>
                {order.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Paid</span>
                      <span>{formatCurrency(order.amountPaid, order.currencyCode)}</span>
                    </div>
                    {order.balanceDue > 0 && (
                      <div className="flex justify-between font-medium text-foreground">
                        <span>{order.paymentType === "delivery_fee" ? "Due on delivery (cash)" : "Balance due"}</span>
                        <span>{formatCurrency(order.balanceDue, order.currencyCode)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p className="text-foreground">{order.customerName}</p>
              <p>{order.customerPhone}</p>
              <p>{order.customerEmail}</p>
              <p>
                {order.shippingAddress}
                {order.shippingCity ? `, ${order.shippingCity}` : ""}
              </p>
              {order.shippingNotes && <p>Note: {order.shippingNotes}</p>}
            </CardContent>
          </Card>

          {order.cancelledReason && (
            <Card>
              <CardHeader>
                <CardTitle>Cancellation details</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{order.cancelledReason}</CardContent>
            </Card>
          )}

          <p className="text-sm text-muted-foreground">
            Need to cancel or return this order?{" "}
            <Link href="/contact" className="font-medium text-foreground underline">
              Contact us
            </Link>{" "}
            with your order number.
          </p>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Order status</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderTimeline events={order.statusHistory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
