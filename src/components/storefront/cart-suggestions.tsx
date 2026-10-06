"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { ImageOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { getSuggestedProductsAction, type SuggestedProduct } from "@/lib/orders/actions";

/**
 * Cart add-ons: in-stock products tagged "box" that aren't in the cart yet,
 * each addable in one tap without leaving the cart/checkout page, plus an
 * always-visible "Continue browsing" link. The parent re-fetches its own
 * cart details when the store changes, so totals update.
 */
export function CartSuggestions({ currencyCode }: { currencyCode: string }) {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const [products, setProducts] = React.useState<SuggestedProduct[]>([]);

  // Fetch once; hide whatever gets added afterwards locally.
  React.useEffect(() => {
    void (async () => {
      const result = await getSuggestedProductsAction(useCartStore.getState().items.map((i) => i.productId));
      if (result.success) setProducts(result.data);
    })();
  }, []);

  const inCart = new Set(items.map((i) => i.productId));
  const visible = products.filter((p) => !inCart.has(p.id));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">
          {visible.length > 0 ? "Add a box to your order" : "Want something else?"}
        </h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/products">Continue browsing</Link>
        </Button>
      </div>
      {visible.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visible.map((product) => (
            <div key={product.id} className="flex flex-col overflow-hidden rounded-lg border border-border/70">
              <Link href={`/products/${product.slug}`} className="relative block aspect-square bg-muted">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill sizes="160px" className="object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageOff className="size-5" />
                  </div>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-2">
                <p className="line-clamp-2 text-xs font-medium text-foreground">{product.name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(product.price, currencyCode)}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-auto w-full"
                  onClick={() => {
                    addItem(product.id, 1);
                    toast.success(`${product.name} added`);
                  }}
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
