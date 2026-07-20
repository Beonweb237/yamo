-- MiamExpress Reviews — VPS Migration (adapted for UUID)
BEGIN;

-- Backup (if any reviews exist)
CREATE TABLE IF NOT EXISTS reviews_backup_20260716 AS SELECT * FROM reviews;

-- Drop old table (basic schema without target_type, tags, etc.)
DROP TABLE IF EXISTS reviews CASCADE;

-- New full schema
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES users(id),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  target_type text NOT NULL CHECK (target_type IN ('restaurant', 'driver', 'dish')),
  target_id text NOT NULL,
  driver_id uuid NULL,
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

-- Unique constraint: one review per order + target
CREATE UNIQUE INDEX reviews_one_target_per_order_idx
  ON reviews (order_id, target_type, target_id, COALESCE(dish_id, ''));

-- Lookup indexes
CREATE INDEX reviews_restaurant_status_created_idx
  ON reviews (restaurant_id, status, created_at DESC);

CREATE INDEX reviews_target_status_created_idx
  ON reviews (target_type, target_id, status, created_at DESC);

-- Aggregated view (Bayesian weighted rating)
CREATE OR REPLACE VIEW review_summaries AS
SELECT
  target_type,
  target_id,
  restaurant_id,
  ROUND(AVG(rating)::numeric, 1) as rating_avg,
  ROUND(
    ((COUNT(*) * AVG(rating)) + (8 * 4.2)) / (GREATEST(COUNT(*), 1) + 8)::numeric,
    1
  ) as rating_weighted,
  COUNT(*) as review_count,
  COUNT(*) FILTER (WHERE status = 'published') as published_count,
  COUNT(*) FILTER (WHERE is_verified_order) as verified_count,
  jsonb_build_object(
    '1', COUNT(*) FILTER (WHERE rating = 1),
    '2', COUNT(*) FILTER (WHERE rating = 2),
    '3', COUNT(*) FILTER (WHERE rating = 3),
    '4', COUNT(*) FILTER (WHERE rating = 4),
    '5', COUNT(*) FILTER (WHERE rating = 5)
  ) as breakdown,
  MAX(updated_at) as updated_at
FROM reviews
WHERE is_test = false
GROUP BY target_type, target_id, restaurant_id;

COMMIT;
