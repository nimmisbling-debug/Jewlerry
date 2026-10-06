-- =============================================================================
-- Guest checkout: customers can place an order without an account.
--
-- A guest order has customer_id = null and a random guest_access_token. The
-- token is the guest's only credential: the app's /order/{token} page (and
-- the links in their emails) use it to show the order, accept payment proof
-- and serve the invoice — always server-side with the service-role client,
-- never through RLS (orders RLS still only exposes rows to their signed-in
-- owner or an admin; anon gets nothing).
-- =============================================================================

alter table public.orders alter column customer_id drop not null;

alter table public.orders add column guest_access_token uuid;
create unique index orders_guest_access_token_idx on public.orders (guest_access_token)
  where guest_access_token is not null;

-- Every order belongs to exactly one of: an account, or a guest token.
alter table public.orders add constraint orders_owner_check
  check ((customer_id is null) <> (guest_access_token is null));

-- ---------------------------------------------------------------------------
-- create_order: p_customer_id may now be null (guest). Body unchanged apart
-- from minting guest_access_token for guest orders.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_customer_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_shipping_address text,
  p_shipping_city text default null,
  p_shipping_notes text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_shipping numeric(12, 2);
  v_currency text;
  v_order public.orders;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_EMPTY' using errcode = '22023';
  end if;

  select shipping_cost, currency_code into v_shipping, v_currency
    from public.site_settings where id = 1;

  -- Pass 1: lock + validate every product, in a stable order, accumulate subtotal.
  for v_item in
    select (elem ->> 'product_id')::bigint as product_id, (elem ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as elem
    order by (elem ->> 'product_id')::bigint
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'ORDER_INVALID_ITEM' using errcode = '22023';
    end if;

    select * into v_product from public.products
      where id = v_item.product_id and is_active = true
      for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_item.product_id using errcode = 'P0002';
    end if;

    if v_product.quantity_in_stock < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK:%:%:%', v_product.id, v_product.name, v_product.quantity_in_stock
        using errcode = '22023';
    end if;

    v_subtotal := v_subtotal + (v_product.price_after_discount * v_item.quantity);
  end loop;

  insert into public.orders (
    customer_id, guest_access_token, status, subtotal, shipping_cost, total, currency_code,
    customer_name, customer_phone, customer_email, shipping_address, shipping_city, shipping_notes
  ) values (
    p_customer_id,
    case when p_customer_id is null then gen_random_uuid() end,
    'unconfirmed', v_subtotal, v_shipping, v_subtotal + v_shipping,
    coalesce(v_currency, 'PKR'), p_customer_name, p_customer_phone, p_customer_email,
    p_shipping_address, p_shipping_city, p_shipping_notes
  ) returning * into v_order;

  -- Pass 2: decrement stock + write frozen line-item snapshots.
  for v_item in
    select (elem ->> 'product_id')::bigint as product_id, (elem ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as elem
  loop
    select * into v_product from public.products where id = v_item.product_id;

    update public.products
      set quantity_in_stock = quantity_in_stock - v_item.quantity
      where id = v_item.product_id;

    insert into public.order_items (
      order_id, product_id, product_name_snapshot, product_image_snapshot_url,
      unit_price_snapshot, quantity
    ) values (
      v_order.id, v_product.id, v_product.name,
      (select url from public.product_images where product_id = v_product.id order by display_order limit 1),
      v_product.price_after_discount, v_item.quantity
    );
  end loop;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by, reason)
  values (v_order.id, null, 'unconfirmed', p_customer_id, 'Order created');

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_payment: a guest order is matched by its token instead of
-- customer_id. Exactly one of p_customer_id / p_guest_access_token is given.
-- ---------------------------------------------------------------------------
drop function public.submit_payment(bigint, uuid, bigint, text, text, text, text);

create or replace function public.submit_payment(
  p_order_id bigint,
  p_customer_id uuid,
  p_payment_method_id bigint,
  p_payment_type text,
  p_transaction_reference text,
  p_screenshot_path text,
  p_note text default null,
  p_guest_access_token uuid default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_amount numeric(12, 2);
begin
  if p_payment_type not in ('full', 'delivery_fee') then
    raise exception 'INVALID_PAYMENT_TYPE' using errcode = '22023';
  end if;

  if (p_customer_id is null) = (p_guest_access_token is null) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders
    where id = p_order_id
      and (
        (p_customer_id is not null and customer_id = p_customer_id)
        or (p_guest_access_token is not null and guest_access_token = p_guest_access_token)
      )
    for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_order.status not in ('unconfirmed', 'payment_pending') then
    raise exception 'ORDER_NOT_PAYABLE:%', v_order.status using errcode = '22023';
  end if;

  if p_payment_type = 'delivery_fee' then
    if v_order.shipping_cost <= 0 then
      raise exception 'DELIVERY_FEE_NOT_AVAILABLE' using errcode = '22023';
    end if;
    v_amount := v_order.shipping_cost;
  else
    v_amount := v_order.total;
  end if;

  insert into public.payments (
    order_id, payment_method_id, payment_type, amount, transaction_reference, screenshot_path, note, status
  ) values (
    p_order_id, p_payment_method_id, p_payment_type, v_amount, p_transaction_reference, p_screenshot_path, p_note, 'pending'
  ) returning * into v_payment;

  if v_order.status = 'unconfirmed' then
    perform public.change_order_status(p_order_id, 'payment_pending', p_customer_id, 'Payment proof submitted');
  end if;

  return v_payment;
end;
$$;

revoke all on function public.submit_payment(bigint, uuid, bigint, text, text, text, text, uuid) from public;
grant execute on function public.submit_payment(bigint, uuid, bigint, text, text, text, text, uuid) to service_role;
