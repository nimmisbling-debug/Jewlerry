-- =============================================================================
-- Payment options: the customer either pays the full order total up front,
-- or pays only the delivery fee in advance and the rest as cash on delivery.
-- The delivery fee is the order's own shipping_cost snapshot (taken from
-- site_settings.shipping_cost at checkout), so a later settings change never
-- alters what an existing order asks for.
-- =============================================================================

alter table public.payments
  add column payment_type text not null default 'full'
    check (payment_type in ('full', 'delivery_fee'));

-- Keep payment_type immutable for client roles, like amount/order_id.
create or replace function public.protect_payment_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.current_role_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.rejection_reason := null;
    new.rejection_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  new.status := old.status;
  new.rejection_reason := old.rejection_reason;
  new.rejection_note := old.rejection_note;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.order_id := old.order_id;
  new.amount := old.amount;
  new.payment_type := old.payment_type;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_payment now takes the payment type instead of an amount and derives
-- the amount from the locked order row itself — the caller can never choose
-- how much a payment is for.
-- ---------------------------------------------------------------------------
drop function public.submit_payment(bigint, uuid, bigint, numeric, text, text, text);

create or replace function public.submit_payment(
  p_order_id bigint,
  p_customer_id uuid,
  p_payment_method_id bigint,
  p_payment_type text,
  p_transaction_reference text,
  p_screenshot_path text,
  p_note text default null
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

  select * into v_order from public.orders
    where id = p_order_id and customer_id = p_customer_id
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

revoke all on function public.submit_payment(bigint, uuid, bigint, text, text, text, text) from public;
grant execute on function public.submit_payment(bigint, uuid, bigint, text, text, text, text) to service_role;
