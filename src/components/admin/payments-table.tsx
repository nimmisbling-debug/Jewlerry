"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_TYPE_LABELS } from "@/constants";
import type { PaymentListItem } from "@/lib/payments/queries";

export function PaymentsTable({ payments }: { payments: PaymentListItem[] }) {
  const columns = useMemo<ColumnDef<PaymentListItem>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{row.original.customerName}</p>
          </div>
        ),
      },
      {
        id: "method",
        header: "Method",
        cell: ({ row }) => row.original.methodName ?? "—",
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div>
            <p>{formatCurrency(row.original.amount)}</p>
            <p className="text-xs text-muted-foreground">{PAYMENT_TYPE_LABELS[row.original.paymentType]}</p>
          </div>
        ),
      },
      {
        id: "reference",
        header: "Reference",
        cell: ({ row }) => row.original.transactionReference ?? "—",
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      },
      {
        id: "createdAt",
        header: "Submitted",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="icon" aria-label={`Review payment for ${row.original.orderNumber}`}>
            <Link href={`/admin/payments/${row.original.id}`}>
              <Eye className="size-4" />
            </Link>
          </Button>
        ),
      },
    ],
    [],
  );

  return <DataTable columns={columns} data={payments} emptyMessage="No payments found." />;
}
