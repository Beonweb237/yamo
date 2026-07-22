-- ============================================================================
-- MiamExpress — Migration DRV : Modernisation de la rémunération livreur
-- Version : 1.0 — 22/07/2026
-- Dépend : Aucune (migration autonome)
-- Compatible : PostgreSQL 14+
-- ============================================================================

-- ── 1. Ajout des colonnes DRV à la table orders ──

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tip_amount           INTEGER DEFAULT 0,       -- Pourboire client (FCFA), 100% au livreur
  ADD COLUMN IF NOT EXISTS surge_applied        BOOLEAN DEFAULT FALSE,    -- Bonus de pointe horaire actif
  ADD COLUMN IF NOT EXISTS fee_breakdown         JSONB DEFAULT '{}';       -- Décomposition rémunération : {basePickup, distancePay, waitPay, surgeBonus, guaranteedMinimum, final}

-- Index pour requêtes wallet livreur (gains + pourboires)
CREATE INDEX IF NOT EXISTS idx_orders_driver_tip
  ON orders (driver_id, tip_amount)
  WHERE driver_id IS NOT NULL AND tip_amount > 0;

-- ── 2. Ajout des colonnes DRV à la table payout_requests ──

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS gross_amount   INTEGER,            -- Montant brut (avant frais cashout)
  ADD COLUMN IF NOT EXISTS cashout_fee    INTEGER DEFAULT 0,  -- Frais de retrait instantané (FCFA)
  ADD COLUMN IF NOT EXISTS payout_type    VARCHAR(20) DEFAULT 'standard';  -- 'standard' ou 'instant'

COMMENT ON COLUMN payout_requests.payout_type IS 'standard = virement hebdo automatique, instant = retrait avec frais 2%';

-- ── 3. Nouvelle table : bonus de volume hebdomadaire ──

CREATE TABLE IF NOT EXISTS driver_volume_bonuses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,           -- Lundi de la semaine concernée
  deliveries      INTEGER NOT NULL,         -- Nombre de livraisons complétées cette semaine
  tier_label      VARCHAR(100),            -- "🥉 Bronze — 20+ courses", etc.
  bonus_fcfa      INTEGER NOT NULL,         -- Montant du bonus (FCFA)
  payout_id       UUID REFERENCES payout_requests(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_volume_bonuses_driver_week
  ON driver_volume_bonuses (driver_id, week_start DESC);

COMMENT ON TABLE driver_volume_bonuses IS 'Bonus de volume hebdomadaire livreur — paliers 20/40/70/100 courses (2000/5000/10000/20000 FCFA)';

-- ── 4. Vue wallet livreur (commodité) ──

CREATE OR REPLACE VIEW driver_wallet AS
SELECT
  d.id AS driver_id,
  d.full_name,
  d.phone,
  COUNT(o.id) FILTER (WHERE o.status IN ('delivered', 'picked_up')) AS total_deliveries,
  COALESCE(SUM(o.fee_breakdown->>'final')::INTEGER, SUM(o.delivery_fee)) AS total_earnings,
  COALESCE(SUM(o.tip_amount), 0) AS total_tips,
  COALESCE(SUM(o.fee_breakdown->>'surgeBonus')::INTEGER, 0) AS total_surge_bonus,
  COALESCE(SUM(vb.bonus_fcfa), 0) AS total_volume_bonus,
  COALESCE(SUM(o.fee_breakdown->>'final')::INTEGER, SUM(o.delivery_fee))
    + COALESCE(SUM(o.tip_amount), 0)
    + COALESCE(SUM(vb.bonus_fcfa), 0) AS gross_earnings,
  COALESCE(SUM(pr.amount) FILTER (WHERE pr.status = 'paid'), 0) AS paid_out,
  COUNT(o.id) FILTER (
    WHERE o.status IN ('delivered', 'picked_up')
    AND o.created_at >= date_trunc('week', now() AT TIME ZONE 'Africa/Douala')
  ) AS deliveries_this_week
FROM users d
LEFT JOIN orders o ON o.driver_id = d.id AND o.status IN ('delivered', 'picked_up')
LEFT JOIN driver_volume_bonuses vb ON vb.driver_id = d.id
LEFT JOIN payout_requests pr ON pr.driver_id = d.id
WHERE d.role = 'livreur'
GROUP BY d.id, d.full_name, d.phone;
