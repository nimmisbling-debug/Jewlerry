"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImageOff, Minus, Plus, X } from "lucide-react";
import { checkoutDeliverySchema, type CheckoutDeliveryInput } from "@/lib/validations/orders";
import { getCartDetailsAction, createOrderAction } from "@/lib/orders/actions";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";
import { formatCurrency } from "@/lib/utils";
import { TextField, TextareaField } from "@/components/forms/text-field";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CartSuggestions } from "@/components/storefront/cart-suggestions";
import type { CartLineDetail } from "@/lib/orders/queries";

export function CheckoutClient({
  shippingCost,
  currencyCode,
  isGuest,
  defaultValues,
}: {
  shippingCost: number;
  currencyCode: string;
  /** Not signed in: checks out as a guest and gets a private order link. */
  isGuest: boolean;
  defaultValues: { customerName: string; customerPhone: string; customerEmail: string };
}) {
  const router = useRouter();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clear);

  const [details, setDetails] = React.useState<CartLineDetail[] | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Live-synced with the cart store, so quantity edits, removals and items
  // added from the suggestions below all update the order review + totals.
  // Previous details stay on screen while re-fetching (no skeleton flash,
  // and the delivery form below never unmounts and loses what was typed).
  const itemsKey = items.map((i) => `${i.productId}:${i.quantity}`).join(",");
  React.useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    void (async () => {
      const current = useCartStore.getState().items;
      if (current.length === 0) {
        if (!cancelled) setDetails([]);
        return;
      }
      const result = await getCartDetailsAction(current);
      if (!cancelled && result.success) setDetails(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, itemsKey]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutDeliveryInput>({
    resolver: zodResolver(checkoutDeliverySchema),
    defaultValues: {
      customerName: defaultValues.customerName,
      customerPhone: defaultValues.customerPhone,
      customerEmail: defaultValues.customerEmail,
      shippingAddress: "",
      shippingCity: "",
      shippingNotes: "",
    },
  });

  const validLines = (details ?? []).filter((d) => d.exists && d.isActive && d.availableStock >= d.requestedQuantity);
  const hasIssues = (details ?? []).some(
    (d) => !d.exists || !d.isActive || d.availableStock < d.requestedQuantity,
  );
  const subtotal = validLines.reduce((sum, l) => sum + l.unitPrice * l.requestedQuantity, 0);
  const total = subtotal + shippingCost;

  function onSubmit(values: CheckoutDeliveryInput) {
    if (hasIssues || validLines.length === 0) {
      toast.error("Please fix the issues in your cart before checking out.");
      return;
    }

    startTransition(async () => {
      const result = await createOrderAction({
        ...values,
        items: validLines.map((l) => ({ productId: l.productId, quantity: l.requestedQuantity })),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      clearCart();
      toast.success("Order placed successfully.");
      router.push(result.data.orderPath as Route);
    });
  }

  if (!mounted || details === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (details.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Your cart is empty. Add something before checking out.</p>
        <Button asChild>
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold">Delivery details</h2>
          {isGuest && (
            <p className="mb-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              No account needed — just fill in your details. Already have an account?{" "}
              <Link href="/sign-in?returnTo=/checkout" className="font-medium text-foreground underline">
                Sign in
              </Link>
            </p>
          )}
          <FieldGroup>
            <TextField label="Full name" register={register("customerName")} error={errors.customerName} />
            <TextField label="Phone number" type="tel" register={register("customerPhone")} error={errors.customerPhone} />
            <TextField label="Email" type="email" register={register("customerEmail")} error={errors.customerEmail} />
            <TextField label="Delivery address" register={register("shippingAddress")} error={errors.shippingAddress} />
            <TextField label="City" register={register("shippingCity")} error={errors.shippingCity} />
            <TextareaField
              label="Delivery notes (optional)"
              register={register("shippingNotes")}
              error={errors.shippingNotes}
              rows={3}
            />
          </FieldGroup>
        </div>

        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold">Order review</h2>
          <div className="space-y-3">
            {details.map((line) => {
              const available = line.exists && line.isActive && line.availableStock > 0;
              const lineOk = available && line.availableStock >= line.requestedQuantity;
              return (
                <div key={line.productId} className="flex gap-3 rounded-lg border border-border/70 p-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {line.imageUrl ? (
                      <Image src={line.imageUrl} alt={line.name} fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageOff className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{line.name}</p>
                        {!lineOk && (
                          <p className="text-xs text-destructive">
                            {!available
                              ? "No longer available — please remove"
                              : `Only ${line.availableStock} in stock — please lower the quantity`}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => removeItem(line.productId)}
                        aria-label={`Remove ${line.name}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      {available ? (
                        <div className="flex items-center rounded-md border border-input">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={line.requestedQuantity <= 1}
                            onClick={() => setQuantity(line.productId, line.requestedQuantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <span className="w-8 text-center text-sm" aria-live="polite">
                            {line.requestedQuantity}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={line.requestedQuantity >= line.availableStock}
                            onClick={() => setQuantity(line.productId, line.requestedQuantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span />
                      )}
                      {lineOk && (
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(line.unitPrice * line.requestedQuantity, currencyCode)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <CartSuggestions currencyCode={currencyCode} />
      </div>

      <div className="h-fit space-y-4 rounded-lg border border-border/70 p-4 lg:sticky lg:top-20">
        <h2 className="font-heading text-lg font-semibold">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal, currencyCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>{formatCurrency(shippingCost, currencyCode)}</span>
          </div>
          <div className="flex justify-between border-t border-border/70 pt-2 font-medium">
            <span>Total</span>
            <span>{formatCurrency(total, currencyCode)}</span>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={pending || hasIssues || validLines.length === 0}>
          {pending ? "Placing order..." : "Place order"}
        </Button>
        <p className="text-xs text-muted-foreground">
          You&apos;ll choose a payment method and upload proof of payment on the next screen.
        </p>
      </div>
    </form>
  );
}
