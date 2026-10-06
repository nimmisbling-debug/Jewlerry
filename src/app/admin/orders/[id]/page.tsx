import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ImageOff, FileDown } from "lucide-react";
import { requireAdmin } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrderById } from "@/lib/orders/queries";
import { getPaymentsForOrder } from "@/lib/payments/queries";
import { getReturnRequestsForOrder } from "@/lib/returns/queries";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { OrderTimeline } from "@/components/storefront/order-timeline";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { ReturnRequestStatusBadge } from "@/components/shared/return-request-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_TYPE_LABELS } from "@/constants";

export const metadata: Metadata = { title: "Order Details" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const supabase = await createServerSupabaseClient();
  const order = await getOrderById(supabase, orderId);
  if (!order) notFound();
  const payments = await getPaymentsForOrder(supabase, order.id);
  const returnRequests = await getReturnRequestsForOrder(supabase, order.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to orders
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {order.invoiceNumber} &middot; Placed {formatDate(order.createdAt)}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/invoices/${order.id}`}>
              <FileDown className="size-4" /> Invoice
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusControl orderId={order.id} currentStatus={order.status} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageOff className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.unitPrice, order.currencyCode)} &times; {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(item.lineTotal, order.currencyCode)}
                    </p>
                  </div>
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
              <CardTitle>Customer & delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p className="text-foreground">{order.customerName}</p>
              {!order.customerId && <p className="text-xs font-medium text-primary">Guest checkout (no account)</p>}
              <p>{order.customerPhone}</p>
              <p>{order.customerEmail}</p>
              <p>
                {order.shippingAddress}
                {order.shippingCity ? `, ${order.shippingCity}` : ""}
              </p>
              {order.shippingNotes && <p>Note: {order.shippingNotes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment submitted yet.</p>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-foreground">
                        {formatCurrency(payment.amount, order.currencyCode)} via {payment.methodName ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{PAYMENT_TYPE_LABELS[payment.paymentType]}</p>
                      <p className="text-xs text-muted-foreground">Submitted {formatDate(payment.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PaymentStatusBadge status={payment.status} />
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/payments/${payment.id}`}>Review</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {order.cancelledReason && (
            <Card>
              <CardHeader>
                <CardTitle>Cancellation details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{order.cancelledReason}</p>
              </CardContent>
            </Card>
          )}

          {returnRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Return requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {returnRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-foreground">{request.title}</p>
                      <p className="text-xs text-muted-foreground">Requested {formatDate(request.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ReturnRequestStatusBadge status={request.status} />
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/returns/${request.id}`}>Review</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Status history</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderTimeline events={order.statusHistory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
