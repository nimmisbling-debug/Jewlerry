import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ImageOff, FileDown } from "lucide-react";
import { requireUser } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrderById } from "@/lib/orders/queries";
import { getPaymentsForOrder } from "@/lib/payments/queries";
import { getReturnRequestsForOrder } from "@/lib/returns/queries";
import { getReviewForOrderItem } from "@/lib/reviews/queries";
import { canCustomerTransition } from "@/lib/orders/transitions";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { ReturnRequestStatusBadge } from "@/components/shared/return-request-status-badge";
import { OrderTimeline } from "@/components/storefront/order-timeline";
import { CancelOrderButton, RequestReturnButton } from "@/components/storefront/order-actions";
import { ReviewFormDialog } from "@/components/storefront/review-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_TYPE_LABELS } from "@/constants";

export const metadata: Metadata = { title: "Order Details" };

export default async function AccountOrderDetailPage({
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

  const canCancel = canCustomerTransition(order.status, "cancelled");
  const canReturn = canCustomerTransition(order.status, "return_initiated");

  const canReview = ["delivered", "partial_completed", "completed"].includes(order.status);
  const itemReviews = canReview
    ? await Promise.all(
        order.items.map((item) =>
          item.productId
            ? getReviewForOrderItem(supabase, profile.id, order.id, item.productId)
            : Promise.resolve(null),
        ),
      )
    : [];

  const payments = await getPaymentsForOrder(supabase, order.id);
  const returnRequests = await getReturnRequestsForOrder(supabase, order.id);
  const latestReturnRequest = returnRequests[0] ?? null;
  const latestPayment = payments[0] ?? null;
  const canSubmitPayment =
    ["unconfirmed", "payment_pending"].includes(order.status) &&
    (!latestPayment || latestPayment.status === "rejected");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link href="/account/orders" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to orders
      </Link>

      <div className="mt-3 mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Button asChild variant="outline" size="sm">
            <a href={`/api/invoices/${order.id}`}>
              <FileDown className="size-4" /> Invoice
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item, index) => {
                const existingReview = itemReviews[index];
                return (
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
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between">
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
                      {canReview && item.productId && (
                        <div>
                          {existingReview ? (
                            <ReviewFormDialog
                              mode="edit"
                              reviewId={existingReview.id}
                              defaultValues={{
                                rating: existingReview.rating,
                                title: existingReview.title,
                                comment: existingReview.comment,
                              }}
                            />
                          ) : (
                            <ReviewFormDialog mode="create" productId={item.productId} orderId={order.id} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestPayment ? (
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-foreground">
                      {formatCurrency(latestPayment.amount, order.currencyCode)} via{" "}
                      {latestPayment.methodName ?? "—"}
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
                  <Link href={`/account/orders/${order.id}/pay`}>
                    {latestPayment ? "Submit a new payment" : "Proceed to payment"}
                  </Link>
                </Button>
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

          {latestReturnRequest && (
            <Card>
              <CardHeader>
                <CardTitle>Return request</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{latestReturnRequest.title}</p>
                  <ReturnRequestStatusBadge status={latestReturnRequest.status} />
                </div>
                <p className="text-muted-foreground">{latestReturnRequest.reason}</p>
                {latestReturnRequest.status === "rejected" && latestReturnRequest.adminDecisionReason && (
                  <p className="text-destructive">Rejected: {latestReturnRequest.adminDecisionReason}</p>
                )}
                {latestReturnRequest.status === "approved" && !latestReturnRequest.receivedAt && (
                  <p className="text-muted-foreground">
                    Approved — please ship the item(s) back to us. We&apos;ll update your order once received.
                  </p>
                )}
                {latestReturnRequest.receivedAt && (
                  <p className="text-muted-foreground">We&apos;ve received the returned item(s).</p>
                )}
              </CardContent>
            </Card>
          )}

          {(canCancel || canReturn) && (
            <div className="flex gap-3">
              {canCancel && <CancelOrderButton orderId={order.id} />}
              {canReturn && <RequestReturnButton orderId={order.id} />}
            </div>
          )}
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
