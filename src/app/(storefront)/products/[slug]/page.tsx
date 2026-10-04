import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/permissions";
import { getProductBySlug } from "@/lib/products/queries";
import { getProductReviews, getMyReviewForProduct, getEligibleReviewOrderId } from "@/lib/reviews/queries";
import { getSiteSettings, getStoreName } from "@/lib/settings/queries";
import { ReviewFormDialog } from "@/components/storefront/review-form-dialog";
import { DeleteReviewButton } from "@/components/storefront/delete-review-button";
import { computeDiscount } from "@/lib/products/pricing";
import { getStockStatus, STOCK_STATUS } from "@/constants";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProductImageGallery } from "@/components/storefront/product-image-gallery";
import { ProductDetailAddToCart } from "@/components/storefront/product-detail-add-to-cart";
import { ReviewSummary, ReviewList } from "@/components/storefront/review-list";
import { StockBadge } from "@/components/shared/stock-badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const product = await getProductBySlug(supabase, slug);
  if (!product) return { title: "Product not found" };

  const description =
    product.description.slice(0, 160) || `Shop ${product.name} at ${await getStoreName()}.`;
  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const product = await getProductBySlug(supabase, slug);
  if (!product || !product.isActive) notFound();

  const profile = await getCurrentProfile();
  const [reviews, settings, myReview] = await Promise.all([
    getProductReviews(supabase, product.id),
    getSiteSettings(),
    profile ? getMyReviewForProduct(supabase, profile.id, product.id) : Promise.resolve(null),
  ]);
  const eligibleOrderId =
    profile && !myReview ? await getEligibleReviewOrderId(supabase, profile.id, product.id) : null;

  const { amount, percentage } = computeDiscount(
    product.priceBeforeDiscount,
    product.priceAfterDiscount,
  );
  const stockStatus = getStockStatus(product.quantityInStock, settings?.low_stock_threshold);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          All Products
        </Link>
        {product.categoryName && (
          <>
            <span className="mx-1.5">/</span>
            <span>{product.categoryName}</span>
          </>
        )}
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductImageGallery images={product.images} productName={product.name} />

        <div>
          {product.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          <h1 className="font-heading text-3xl font-semibold text-foreground">{product.name}</h1>

          <div className="mt-3">
            <ReviewSummary averageRating={product.averageRating} reviewCount={product.reviewCount} />
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-sans text-2xl font-semibold text-foreground">
              {formatCurrency(product.priceAfterDiscount)}
            </span>
            {percentage > 0 && (
              <>
                <span className="text-lg text-muted-foreground line-through">
                  {formatCurrency(product.priceBeforeDiscount)}
                </span>
                <Badge variant="destructive">
                  Save {formatCurrency(amount)} ({percentage}%)
                </Badge>
              </>
            )}
          </div>

          <div className="mt-3">
            <StockBadge quantity={product.quantityInStock} threshold={settings?.low_stock_threshold} />
          </div>

          {product.description && (
            <p className="mt-5 leading-relaxed text-muted-foreground">{product.description}</p>
          )}

          <div className="mt-6">
            <ProductDetailAddToCart
              productId={product.id}
              availableStock={product.quantityInStock}
            />
            {stockStatus === STOCK_STATUS.LOW_STOCK && (
              <p className="mt-2 text-sm text-warning">
                Only {product.quantityInStock} left — order soon.
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-12" />

      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-semibold">Reviews</h2>
          {myReview ? (
            <div className="flex gap-2">
              <ReviewFormDialog
                mode="edit"
                reviewId={myReview.id}
                defaultValues={{ rating: myReview.rating, title: myReview.title, comment: myReview.comment }}
              />
              <DeleteReviewButton reviewId={myReview.id} />
            </div>
          ) : (
            eligibleOrderId && <ReviewFormDialog mode="create" productId={product.id} orderId={eligibleOrderId} />
          )}
        </div>
        <div className="mt-2 mb-6">
          <ReviewSummary averageRating={product.averageRating} reviewCount={product.reviewCount} />
        </div>
        <ReviewList reviews={reviews} />
      </div>
    </div>
  );
}
