/**
 * Hand-authored to match supabase/migrations/*.sql exactly. Once the
 * project is connected to a live Supabase instance, regenerate/verify with:
 *   npx supabase gen types typescript --local > src/types/database.ts
 * (then re-apply the doc comments this file adds on top of the generated
 * shape, or diff before overwriting).
 *
 * ID types: every table's primary key is `bigint generated always as
 * identity` (returned by PostgREST as a plain JS number) EXCEPT
 * `profiles.id`, which is fixed to Supabase Auth's UUID user id — and
 * therefore every foreign key that points at profiles (customer_id,
 * actor_id, user_id, changed_by, reviewed_by, ...) stays `string` (uuid)
 * too. Everything else is `number`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatusValue =
  | "unconfirmed"
  | "payment_pending"
  | "confirmed"
  | "in_process"
  | "delivered"
  | "partial_completed"
  | "completed"
  | "return_initiated"
  | "return_processing"
  | "returned"
  | "cancelled";

export type PaymentStatusValue = "pending" | "approved" | "rejected";
export type PaymentTypeValue = "full" | "delivery_fee";
export type ReturnRequestStatusValue = "pending" | "approved" | "rejected";
export type PaymentMethodType = "mobile_wallet" | "bank_transfer" | "other";
export type NotificationTypeValue =
  | "order"
  | "payment"
  | "announcement"
  | "promotion"
  | "system";
export type ThemePreference = "light" | "dark" | "system";
export type RoleValue = "admin" | "customer";

/** Row shape returned by the search_products() RPC (see migration 0013). */
export interface SearchProductsRow {
  id: number;
  category_id: number | null;
  name: string;
  slug: string;
  description: string;
  price_before_discount: number;
  price_after_discount: number;
  quantity_in_stock: number;
  is_active: boolean;
  average_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
  primary_image_url: string | null;
  restock_count: number;
  last_restocked_at: string | null;
  total_count: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          username: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: RoleValue;
          theme_preference: ThemePreference;
          must_change_password: boolean;
          blocked_at: string | null;
          blocked_reason: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          email: string;
          username: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
          entity_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
      site_settings: {
        Row: {
          id: number;
          store_name: string;
          store_email: string | null;
          store_phone: string | null;
          whatsapp_number: string | null;
          address: string | null;
          business_hours: string | null;
          social_links: Json;
          low_stock_threshold: number;
          shipping_cost: number;
          currency_code: string;
          dark_mode_enabled: boolean;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["site_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["site_settings"]["Row"]>;
        Relationships: [];
      };
      admin_settings: {
        Row: {
          id: number;
          invoice_prefix: string;
          order_auto_cancel_unconfirmed_hours: number;
          notify_admin_on_new_order: boolean;
          notify_admin_on_payment_submitted: boolean;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["admin_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["admin_settings"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: number;
          name: string;
          slug: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: number;
          category_id: number | null;
          name: string;
          slug: string;
          description: string;
          price_before_discount: number;
          price_after_discount: number;
          quantity_in_stock: number;
          is_active: boolean;
          average_rating: number;
          review_count: number;
          created_at: string;
          updated_at: string;
          restock_count: number;
          last_restocked_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          name: string;
          slug: string;
          price_before_discount: number;
          price_after_discount: number;
        };
        // restock_count/last_restocked_at are trigger-owned (see migration
        // 0018) — excluded here so application code can't even express an
        // update that tries to set them; the trigger would silently
        // override it anyway, but this keeps the type honest about it.
        Update: Partial<Omit<Database["public"]["Tables"]["products"]["Row"], "restock_count" | "last_restocked_at">>;
        Relationships: [];
      };
      product_images: {
        Row: {
          id: number;
          product_id: number;
          url: string;
          storage_path: string;
          alt_text: string;
          display_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_images"]["Row"]> & {
          product_id: number;
          url: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_images"]["Row"]>;
        Relationships: [];
      };
      tags: {
        Row: {
          id: number;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tags"]["Row"]> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["tags"]["Row"]>;
        Relationships: [];
      };
      product_tags: {
        Row: { product_id: number; tag_id: number };
        Insert: { product_id: number; tag_id: number };
        Update: Partial<{ product_id: number; tag_id: number }>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: number;
          order_number: string;
          invoice_number: string;
          /** Null for guest orders, which are identified by guest_access_token instead. */
          customer_id: string | null;
          guest_access_token: string | null;
          status: OrderStatusValue;
          subtotal: number;
          shipping_cost: number;
          total: number;
          currency_code: string;
          customer_name: string;
          customer_phone: string;
          customer_email: string;
          shipping_address: string;
          shipping_city: string | null;
          shipping_notes: string | null;
          return_reason: string | null;
          return_notes: string | null;
          returned_at: string | null;
          cancelled_reason: string | null;
          // Snapshot of the status this order was in right before entering
          // return_initiated — set by request_return, read by
          // review_return_request to restore it precisely on rejection.
          pre_return_status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // orders are only ever created via the create_order RPC
        // `status` itself only ever changes via the change_order_status RPC
        // (which the DB trigger enforces regardless) — but these snapshot/
        // reason fields are plain columns the service-role client sets
        // directly alongside a status-changing RPC call, e.g. recording
        // *why* an order was cancelled/returned.
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["orders"]["Row"],
            "cancelled_reason" | "return_reason" | "return_notes" | "returned_at"
          >
        >;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: number;
          order_id: number;
          product_id: number | null;
          product_name_snapshot: string;
          product_image_snapshot_url: string | null;
          unit_price_snapshot: number;
          quantity: number;
          line_total: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      order_status_history: {
        Row: {
          id: number;
          order_id: number;
          old_status: OrderStatusValue | null;
          new_status: OrderStatusValue;
          changed_by: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: number;
          product_id: number;
          customer_id: string;
          order_id: number;
          rating: number;
          title: string;
          comment: string;
          is_hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reviews"]["Row"]> & {
          product_id: number;
          customer_id: string;
          order_id: number;
          rating: number;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Row"]>;
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: number;
          type: PaymentMethodType;
          name: string;
          account_holder_name: string | null;
          account_number: string | null;
          iban: string | null;
          bank_name: string | null;
          instructions: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]> & {
          type: PaymentMethodType;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]>;
        Relationships: [];
      };
      payment_method_details: {
        Row: {
          payment_method_id: number;
          swift_code: string | null;
          branch_code: string | null;
          qr_code_url: string | null;
          extra: Json;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payment_method_details"]["Row"]> & {
          payment_method_id: number;
        };
        Update: Partial<Database["public"]["Tables"]["payment_method_details"]["Row"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: number;
          order_id: number;
          payment_method_id: number | null;
          payment_type: PaymentTypeValue;
          amount: number;
          transaction_reference: string | null;
          screenshot_path: string;
          note: string | null;
          status: PaymentStatusValue;
          rejection_reason: string | null;
          rejection_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // only via submit_payment RPC
        Update: never; // only via review_payment RPC
        Relationships: [];
      };
      return_requests: {
        Row: {
          id: number;
          order_id: number;
          customer_id: string;
          title: string;
          reason: string;
          image_paths: string[];
          status: ReturnRequestStatusValue;
          admin_decision_reason: string | null;
          decided_by: string | null;
          decided_at: string | null;
          received_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // only via request_return RPC
        Update: never; // only via review_return_request / mark_return_received RPCs
        Relationships: [];
      };
      notifications: {
        Row: {
          id: number;
          user_id: string;
          title: string;
          message: string;
          type: NotificationTypeValue;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          title: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      banners: {
        Row: {
          id: number;
          title: string;
          description: string | null;
          image_url: string;
          storage_path: string;
          button_text: string | null;
          button_url: string | null;
          is_active: boolean;
          start_date: string | null;
          end_date: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["banners"]["Row"]> & {
          title: string;
          image_url: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["banners"]["Row"]>;
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: number;
          name: string;
          email: string;
          subject: string | null;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contact_messages"]["Row"]> & {
          name: string;
          email: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["contact_messages"]["Row"]>;
        Relationships: [];
      };
      faqs: {
        Row: {
          id: number;
          question: string;
          answer: string;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["faqs"]["Row"]> & {
          question: string;
          answer: string;
        };
        Update: Partial<Database["public"]["Tables"]["faqs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_role_is_admin: { Args: Record<string, never>; Returns: boolean };
      check_rate_limit: {
        Args: { p_bucket: string; p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      lookup_email_for_login: { Args: { p_identifier: string }; Returns: string | null };
      create_order: {
        Args: {
          p_customer_id: string | null;
          p_items: Json;
          p_customer_name: string;
          p_customer_phone: string;
          p_customer_email: string;
          p_shipping_address: string;
          p_shipping_city?: string | null;
          p_shipping_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      change_order_status: {
        Args: {
          p_order_id: number;
          p_new_status: OrderStatusValue;
          p_changed_by: string | null;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      submit_payment: {
        Args: {
          p_order_id: number;
          p_customer_id: string | null;
          p_payment_method_id: number;
          p_payment_type: PaymentTypeValue;
          p_transaction_reference: string | null;
          p_screenshot_path: string;
          p_note?: string | null;
          p_guest_access_token?: string | null;
        };
        Returns: Database["public"]["Tables"]["payments"]["Row"];
      };
      review_payment: {
        Args: {
          p_payment_id: number;
          p_new_status: "approved" | "rejected";
          p_reviewer_id: string;
          p_rejection_reason?: string | null;
          p_rejection_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["payments"]["Row"];
      };
      request_return: {
        Args: {
          p_order_id: number;
          p_customer_id: string;
          p_title: string;
          p_reason: string;
          p_image_paths: string[];
        };
        Returns: Database["public"]["Tables"]["return_requests"]["Row"];
      };
      review_return_request: {
        Args: {
          p_request_id: number;
          p_new_status: "approved" | "rejected";
          p_reviewer_id: string;
          p_admin_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["return_requests"]["Row"];
      };
      mark_return_received: {
        Args: { p_order_id: number; p_admin_id: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      anonymize_profile: {
        Args: { p_profile_id: string };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      search_products: {
        Args: {
          p_query?: string | null;
          p_tag_slug?: string | null;
          p_category_slug?: string | null;
          p_min_price?: number | null;
          p_max_price?: number | null;
          p_min_rating?: number | null;
          p_in_stock_only?: boolean;
          p_new_within_days?: number | null;
          p_sort?: string;
          p_page?: number;
          p_page_size?: number;
          p_include_inactive?: boolean;
        };
        Returns: SearchProductsRow[];
      };
      get_product_reviews: {
        Args: { p_product_id: number; p_limit?: number };
        Returns: {
          id: number;
          rating: number;
          title: string;
          comment: string;
          created_at: string;
          customer_display_name: string;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
