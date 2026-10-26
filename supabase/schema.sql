-- Sharp Deals shared shopping list.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists list_items (
  household text not null check (length(household) >= 12),
  item_key  text not null,
  product   jsonb not null,
  added_at  timestamptz not null default now(),
  primary key (household, item_key)
);

-- Row level security on with no policies: the app's public key cannot read or write
-- the table directly. It can only call the three functions below, and each one needs
-- the household code, so nobody can list other households.
alter table list_items enable row level security;

create or replace function get_list(h text)
returns table (item_key text, product jsonb, added_at timestamptz)
language sql security definer set search_path = public as $$
  select item_key, product, added_at
  from list_items
  where household = h and length(h) >= 12
  order by added_at desc;
$$;

create or replace function put_item(h text, k text, p jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into list_items (household, item_key, product)
  values (h, k, p)
  on conflict (household, item_key) do update set product = excluded.product;
$$;

create or replace function del_item(h text, k text)
returns void
language sql security definer set search_path = public as $$
  delete from list_items where household = h and item_key = k;
$$;

grant execute on function get_list(text), put_item(text, text, jsonb), del_item(text, text) to anon;
