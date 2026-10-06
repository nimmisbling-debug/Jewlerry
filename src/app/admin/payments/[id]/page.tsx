import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPaymentById } from "@/lib/payments/queries";
import { PaymentReviewPanel } from "@/components/admin/payment-review-panel";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_TYPE_LABELS } from "@/constants";

export const metadata: Metadata = { title: "Review Payment" };

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId)) notFound();

  const supabase = await createServerSupabaseClient();
  const payment = await getPaymentById(supabase, paymentId);
  if (!payment) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/payments" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to payments
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold">Payment for {payment.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">Submitted {formatDate(payment.createdAt)}</p>
          </div>
          <PaymentStatusBadge status={payment.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Screenshot</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentReviewPanel payment={payment} />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order</span>
              <Link href={`/admin/orders/${payment.orderId}`} className="font-medium text-foreground hover:underline">
                {payment.orderNumber}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="text-foreground">{payment.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="text-foreground">{payment.methodName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment option</span>
              <span className="text-foreground">{PAYMENT_TYPE_LABELS[payment.paymentType]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium text-foreground">{formatCurrency(payment.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="text-foreground">{payment.transactionReference ?? "—"}</span>
            </div>
            {payment.note && (
              <div className="space-y-1">
                <span className="text-muted-foreground">Customer note</span>
                <p className="text-foreground">{payment.note}</p>
              </div>
            )}
            {payment.reviewedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reviewed</span>
                <span className="text-foreground">{formatDate(payment.reviewedAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
