"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Minus, Plus, X, ImageOff, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";
import { getCartDetailsAction } from "@/lib/orders/actions";
import { CartSuggestions } from "@/components/storefront/cart-suggestions";
import type { CartLineDetail } from "@/lib/orders/queries";

export function CartClient({
  shippingCost,
  currencyCode,
}: {
  shippingCost: number;
  currencyCode: string;
}) {
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const [details, setDetails] = React.useState<CartLineDetail[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (items.length === 0) {
      setDetails([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await getCartDetailsAction(items);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setDetails(result.data);

    // Rule 8: never trust the stored quantity — clip anything that now
    // exceeds fresh server stock, and flag it so the customer knows why.
    let adjustedAny = false;
    for (const line of result.data) {
      if (!line.exists || !line.isActive) continue;
      if (line.requestedQuantity > line.availableStock) {
        setQuantity(line.productId, Math.max(0, line.availableStock));
        adjustedAny = true;
      }
    }
    if (adjustedAny) {
      toast.info("We adjusted some quantities to match current stock.");
    }
  }, [items, setQuantity]);

  // Re-fetch whenever the cart's item set changes (add/remove/qty edits
  // elsewhere), not just on first mount.
  const itemsKey = items.map((i) => `${i.productId}:${i.quantity}`).join(",");
  React.useEffect(() => {
    if (!mounted) return;
    // refresh() only sets state once, after its network round-trip
    // resolves — not synchronously during this render, so it can't
    // cascade. This is the standard "fetch on mount/dep-change" pattern;
    // the lint rule can't tell the setState is behind an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on itemsKey, not `items` (new array identity every render) or `refresh`
  }, [mounted, itemsKey]);

  if (!mounted || (loading && details === null)) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!details || details.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <ShoppingBag className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Button asChild>
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  const validLines = details.filter((d) => d.exists && d.isActive && d.availableStock > 0);
  const hasIssues = details.some((d) => !d.exists || !d.isActive || d.availableStock === 0);
  const subtotal = validLines.reduce(
    (sum, line) => sum + line.unitPrice * Math.min(line.requestedQuantity, line.availableStock),
    0,
  );
  const total = subtotal + shippingCost;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {details.map((line) => (
          <div
            key={line.productId}
            className="flex gap-4 rounded-lg border border-border/70 p-3"
          >
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {line.imageUrl ? (
                <Image src={line.imageUrl} alt={line.name} fill sizes="80px" className="object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-5" />
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {line.exists ? (
                    <Link
                      href={`/products/${line.slug}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {line.name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-destructive">{line.name}</p>
                  )}
                  {(!line.exists || !line.isActive) && (
                    <p className="text-xs text-destructive">No longer available — please remove.</p>
                  )}
                  {line.exists && line.isActive && line.availableStock === 0 && (
                    <p className="text-xs text-destructive">Out of stock — please remove.</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(line.productId)}
                  aria-label={`Remove ${line.name}`}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                {line.exists && line.isActive && line.availableStock > 0 ? (
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
                {line.exists && line.isActive && (
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(
                      line.unitPrice * Math.min(line.requestedQuantity, line.availableStock),
                      currencyCode,
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="pt-4">
          <CartSuggestions currencyCode={currencyCode} />
        </div>
      </div>

      <div className="h-fit space-y-4 rounded-lg border border-border/70 p-4">
        <h2 className="font-heading text-lg font-semibold">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">{formatCurrency(subtotal, currencyCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span className="text-foreground">{formatCurrency(shippingCost, currencyCode)}</span>
          </div>
          <div className="flex justify-between border-t border-border/70 pt-2 font-medium">
            <span>Total</span>
            <span>{formatCurrency(total, currencyCode)}</span>
          </div>
        </div>
        {hasIssues && (
          <p className="text-xs text-destructive">
            Remove unavailable items above before checking out.
          </p>
        )}
        {hasIssues || validLines.length === 0 ? (
          <Button className="w-full" disabled>
            Proceed to checkout
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href="/checkout">Proceed to checkout</Link>
          </Button>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/products">Continue browsing</Link>
        </Button>
      </div>
    </div>
  );
}
