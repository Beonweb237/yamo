-- Store delivery recipient details separately from the authenticated customer.
-- This supports orders placed for a parent, colleague, child, office team, etc.

alter table orders add column if not exists contact_phone text;
alter table orders add column if not exists ordered_for_someone_else boolean not null default false;
alter table orders add column if not exists recipient_name text;
alter table orders add column if not exists recipient_phone text;
alter table orders add column if not exists recipient_contact_instructions text;

create index if not exists orders_recipient_phone_idx on orders (recipient_phone);

comment on column orders.contact_phone is 'Phone number of the customer who placed the order.';
comment on column orders.ordered_for_someone_else is 'True when the authenticated customer ordered for a different recipient.';
comment on column orders.recipient_name is 'Name of the person receiving the delivery when different from the customer.';
comment on column orders.recipient_phone is 'Phone number the driver should call for delivery when different from the customer.';
comment on column orders.recipient_contact_instructions is 'Optional contact instruction for the recipient, for example call only on arrival.';
