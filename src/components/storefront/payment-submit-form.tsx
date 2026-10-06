"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { submitPaymentAction } from "@/lib/payments/actions";
import { formatCurrency } from "@/lib/utils";
import type { PaymentMethodDetail } from "@/lib/payments/queries";
import type { PaymentTypeValue } from "@/types/database";

export function PaymentSubmitForm({
  orderId,
  total,
  deliveryFee,
  currencyCode,
  methods,
}: {
  orderId: number;
  total: number;
  /** The order's delivery fee (shipping cost from Settings at checkout); 0 hides the advance option. */
  deliveryFee: number;
  currencyCode: string;
  methods: PaymentMethodDetail[];
}) {
  const router = useRouter();
  const [paymentType, setPaymentType] = React.useState<PaymentTypeValue>("full");
  const amountDue = paymentType === "delivery_fee" ? deliveryFee : total;
  const [methodId, setMethodId] = React.useState<string>(methods[0] ? String(methods[0].id) : "");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [pending, startTransition] = React.useTransition();

  const selectedMethod = methods.find((m) => String(m.id) === methodId) ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!methodId) {
      toast.error("Select a payment method.");
      return;
    }
    if (!file) {
      toast.error("Attach a screenshot of your payment.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await submitPaymentAction(
        {
          orderId,
          paymentMethodId: Number(methodId),
          paymentType,
          transactionReference: reference || undefined,
          note: note || undefined,
        },
        formData,
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Payment submitted for review.");
      router.push(`/account/orders/${orderId}`);
      router.refresh();
    });
  }

  if (methods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No payment methods are currently available. Please contact us for help completing your order.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {deliveryFee > 0 && (
        <div className="space-y-2">
          <Label>How would you like to pay?</Label>
          <RadioGroup
            value={paymentType}
            onValueChange={(value) => setPaymentType(value as PaymentTypeValue)}
            className="gap-2"
          >
            <Label
              htmlFor="pay-full"
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 font-normal has-data-[state=checked]:border-primary"
            >
              <RadioGroupItem id="pay-full" value="full" className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block font-medium text-foreground">
                  Pay full amount — {formatCurrency(total, currencyCode)}
                </span>
                <span className="block text-xs text-muted-foreground">Nothing to pay on delivery.</span>
              </span>
            </Label>
            <Label
              htmlFor="pay-delivery-fee"
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 font-normal has-data-[state=checked]:border-primary"
            >
              <RadioGroupItem id="pay-delivery-fee" value="delivery_fee" className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block font-medium text-foreground">
                  Pay delivery fee only — {formatCurrency(deliveryFee, currencyCode)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Pay the remaining {formatCurrency(total - deliveryFee, currencyCode)} in cash on delivery.
                </span>
              </span>
            </Label>
          </RadioGroup>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Amount to pay now:{" "}
        <span className="font-medium text-foreground">{formatCurrency(amountDue, currencyCode)}</span>
      </p>

      <div className="space-y-2">
        <Label htmlFor="payment-method">Payment method</Label>
        <Select value={methodId} onValueChange={setMethodId}>
          <SelectTrigger id="payment-method" className="w-full">
            <SelectValue placeholder="Select a payment method" />
          </SelectTrigger>
          <SelectContent>
            {methods.map((method) => (
              <SelectItem key={method.id} value={String(method.id)}>
                {method.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedMethod && (
        <Card className="bg-muted/40">
          <CardContent className="space-y-1 text-sm">
            {selectedMethod.accountHolderName && (
              <p>
                <span className="text-muted-foreground">Account holder: </span>
                {selectedMethod.accountHolderName}
              </p>
            )}
            {selectedMethod.accountNumber && (
              <p>
                <span className="text-muted-foreground">Account / wallet number: </span>
                {selectedMethod.accountNumber}
              </p>
            )}
            {selectedMethod.bankName && (
              <p>
                <span className="text-muted-foreground">Bank: </span>
                {selectedMethod.bankName}
              </p>
            )}
            {selectedMethod.iban && (
              <p>
                <span className="text-muted-foreground">IBAN: </span>
                {selectedMethod.iban}
              </p>
            )}
            {selectedMethod.swiftCode && (
              <p>
                <span className="text-muted-foreground">SWIFT: </span>
                {selectedMethod.swiftCode}
              </p>
            )}
            {selectedMethod.branchCode && (
              <p>
                <span className="text-muted-foreground">Branch code: </span>
                {selectedMethod.branchCode}
              </p>
            )}
            {selectedMethod.instructions && (
              <p className="pt-1 whitespace-pre-line text-foreground">{selectedMethod.instructions}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="transaction-reference">Transaction reference (optional)</Label>
        <Input
          id="transaction-reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. transaction ID from your bank/wallet app"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment-note">Note (optional)</Label>
        <Textarea id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment-screenshot">Payment screenshot</Label>
        <Input
          id="payment-screenshot"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Max 5MB.</p>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Submitting...
          </>
        ) : (
          <>
            <Upload className="size-4" /> Submit payment for review
          </>
        )}
      </Button>
    </form>
  );
}
