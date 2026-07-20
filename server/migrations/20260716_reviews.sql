-- MiamExpress / Yamo - Reviews and ratings
-- Target: VPS PostgreSQL database. Supabase is not part of this project.
--
-- IDs are stored as text because the current app has legacy/mock IDs while
-- the VPS may expose UUID primary keys. The validation trigger compares with
-- orders.id::text, orders.customer_id::text and orders.restaurant_id::text.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  customer_id text NOT NULL,
  restaurant_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('restaurant', 'driver', 'dish')),
  target_id text NOT NULL,
  driver_id text NULL,
  dish_id text NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NULL CHECK (comment IS NULL OR char_length(comment) <= 500),
  tags text[] NOT NULL DEFAULT '{}',
  author_name text NULL,
  is_verified_order boolean NOT NULL DEFAULT true,
  is_test boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending', 'hidden')),
  moderation_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_target_per_order_idx
  ON reviews (order_id, target_type, target_id, coalesce(dish_id, ''));

CREATE INDEX IF NOT EXISTS reviews_restaurant_status_created_idx
  ON reviews (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_target_status_created_idx
  ON reviews (target_type, target_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_customer_created_idx
  ON reviews (customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION reviews_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_touch_updated_at_trigger ON reviews;
CREATE TRIGGER reviews_touch_updated_at_trigger
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION reviews_touch_updated_at();

CREATE OR REPLACE FUNCTION reviews_validate_order()
RETURNS trigger AS $$
DECLARE
  order_customer_id text;
  order_restaurant_id text;
  order_status text;
BEGIN
  SELECT o.customer_id::text, o.restaurant_id::text, o.status::text
    INTO order_customer_id, order_restaurant_id, order_status
  FROM orders o
  WHERE o.id::text = NEW.order_id;

  IF order_customer_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF order_status <> 'delivered' THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERED';
  END IF;

  IF NEW.customer_id IS NULL OR NEW.customer_id = '' THEN
    NEW.customer_id := order_customer_id;
  END IF;

  IF NEW.customer_id <> order_customer_id THEN
    RAISE EXCEPTION 'REVIEW_CUSTOMER_MISMATCH';
  END IF;

  NEW.restaurant_id := order_restaurant_id;

  IF NEW.target_type = 'restaurant' THEN
    NEW.target_id := order_restaurant_id;
  END IF;

  IF NEW.target_type = 'dish' AND (NEW.dish_id IS NULL OR NEW.dish_id = '') THEN
    NEW.dish_id := NEW.target_id;
  END IF;

  NEW.comment := nullif(trim(coalesce(NEW.comment, '')), '');
  NEW.author_name := nullif(trim(coalesce(NEW.author_name, '')), '');
  NEW.tags := coalesce(NEW.tags, '{}');
  NEW.is_verified_order := true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_validate_order_trigger ON reviews;
CREATE TRIGGER reviews_validate_order_trigger
BEFORE INSERT OR UPDATE OF order_id, customer_id, target_type, target_id, dish_id, comment, author_name, tags
ON reviews
FOR EACH ROW
EXECUTE FUNCTION reviews_validate_order();

CREATE OR REPLACE VIEW review_summaries AS
SELECT
  target_type,
  target_id,
  count(*)::int AS review_count,
  count(*) FILTER (WHERE is_verified_order)::int AS verified_count,
  round(avg(rating)::numeric, 1)::float AS rating_avg,
  round((((avg(rating) * count(*)) + (4.2 * 8)) / (count(*) + 8))::numeric, 1)::float AS rating_weighted,
  jsonb_build_object(
    '1', count(*) FILTER (WHERE rating = 1),
    '2', count(*) FILTER (WHERE rating = 2),
    '3', count(*) FILTER (WHERE rating = 3),
    '4', count(*) FILTER (WHERE rating = 4),
    '5', count(*) FILTER (WHERE rating = 5)
  ) AS breakdown,
  max(updated_at) AS updated_at
FROM reviews
WHERE status = 'published'
GROUP BY target_type, target_id;

COMMIT;
