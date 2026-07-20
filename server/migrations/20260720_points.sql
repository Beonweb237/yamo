-- ============================================================
-- Série PTS — Système de points restaurant + garantie client
-- Migration : à exécuter UNE FOIS sur le VPS (psql), voir la
-- procédure de déploiement dans app/docs/points-system-tracking.md.
-- ============================================================

-- Ledger IMMUABLE : append-only. Aucune route applicative ne fait
-- d'UPDATE/DELETE sur cette table ; toute correction est une écriture
-- inverse (admin_adjustment). L'idempotence est portée par la contrainte
-- UNIQUE (kind, reference).
CREATE TABLE IF NOT EXISTS points_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN (
                  'recharge', 'welcome_bonus', 'hold', 'consume',
                  'release', 'penalty', 'convert_refund', 'admin_adjustment',
                  'promo_grant')),
  points        INTEGER NOT NULL,
  reference     TEXT NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT NOT NULL DEFAULT 'system',
  CONSTRAINT points_ledger_idempotence UNIQUE (kind, reference)
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_resto_date
  ON points_ledger (restaurant_id, created_at DESC);

-- Demandes de recharge (phase 1 : validation manuelle par l'admin).
CREATE TABLE IF NOT EXISTS point_recharges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL,
  points           INTEGER NOT NULL CHECK (points > 0),
  amount_fcfa      INTEGER NOT NULL CHECK (amount_fcfa > 0),
  method           TEXT NOT NULL CHECK (method IN ('momo', 'cash_partner')),
  payment_ref      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'validated', 'rejected')),
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at       TIMESTAMPTZ,
  decided_by       TEXT,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_point_recharges_status
  ON point_recharges (status, requested_at DESC);

-- Garantie client : sous-état de la commande (pas de nouveau statut global).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guarantee_status TEXT
  CHECK (guarantee_status IN ('awaiting_payment', 'declared', 'confirmed', 'forfeited', 'refunded'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guarantee_amount_fcfa INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guarantee_proof_note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guarantee_declared_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guarantee_confirmed_at TIMESTAMPTZ;

-- Données marchandes du restaurant (parcours garantie).
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS merchant_code TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS assistance_whatsapp TEXT;

-- Strikes client (rejets abusifs) — la suspension reste is_suspended (existant).
ALTER TABLE users ADD COLUMN IF NOT EXISTS abusive_rejections INTEGER NOT NULL DEFAULT 0;
