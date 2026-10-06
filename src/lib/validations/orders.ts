import { z } from "zod";
import { PAYMENT_REJECTION_REASONS, PAYMENT_TYPES, MAX_RETURN_PROOF_IMAGES } from "@/constants";

/** bigint identity PKs (everything except profile-linked uuid fields). */
const id = () => z.number().int().positive();

export const checkoutItemSchema = z.object({
  productId: id(),
  quantity: z.number().int().positive().max(999),
});

/** Just the form fields — items are computed from cart/stock state at submit time, never a tracked RHF field. */
export const checkoutDeliverySchema = z.object({
  customerName: z.string().trim().min(2, "Enter the recipient's name").max(200),
  customerPhone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  customerEmail: z.email("Enter a valid email address"),
  shippingAddress: z.string().trim().min(5, "Enter a delivery address").max(500),
  shippingCity: z.string().trim().min(2, "Enter a city").max(100),
  shippingNotes: z.string().trim().max(500).optional(),
});
export type CheckoutDeliveryInput = z.infer<typeof checkoutDeliverySchema>;

export const checkoutSchema = checkoutDeliverySchema.extend({
  items: z.array(checkoutItemSchema).min(1, "Your cart is empty"),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const submitPaymentSchema = z.object({
  orderId: id(),
  paymentMethodId: id(),
  paymentType: z.enum(PAYMENT_TYPES),
  transactionReference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
  // The screenshot itself is validated separately (file type/size) in
  // lib/validations/products.ts's image-upload pattern, reused there.
});
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;

export const reviewPaymentSchema = z
  .object({
    paymentId: id(),
    decision: z.enum(["approved", "rejected"]),
    rejectionReason: z.enum(PAYMENT_REJECTION_REASONS).optional(),
    rejectionNote: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.decision === "approved" || !!data.rejectionReason, {
    message: "Select a rejection reason",
    path: ["rejectionReason"],
  });
export type ReviewPaymentInput = z.infer<typeof reviewPaymentSchema>;

export const requestReturnSchema = z.object({
  orderId: id(),
  title: z.string().trim().min(3, "Give this return a short title").max(200),
  reason: z.string().trim().min(10, "Tell us why you'd like to return this order").max(1000),
  // Proof photos are validated separately (file type/size, one-per-file) in
  // lib/validations/products.ts's image-upload pattern, reused here — this
  // just bounds how many.
  imageCount: z
    .number()
    .int()
    .min(1, "Attach at least one photo as proof")
    .max(MAX_RETURN_PROOF_IMAGES, `You can attach up to ${MAX_RETURN_PROOF_IMAGES} photos`),
});
export type RequestReturnInput = z.infer<typeof requestReturnSchema>;

export const reviewReturnRequestSchema = z
  .object({
    requestId: id(),
    decision: z.enum(["approved", "rejected"]),
    adminReason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.decision === "approved" || !!data.adminReason, {
    message: "Give a reason for rejecting this return",
    path: ["adminReason"],
  });
export type ReviewReturnRequestInput = z.infer<typeof reviewReturnRequestSchema>;

export const updateOrderStatusSchema = z.object({
  orderId: id(),
  newStatus: z.enum([
    "unconfirmed",
    "payment_pending",
    "confirmed",
    "in_process",
    "delivered",
    "partial_completed",
    "completed",
    "return_initiated",
    "return_processing",
    "returned",
    "cancelled",
  ]),
  reason: z.string().trim().max(500).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
