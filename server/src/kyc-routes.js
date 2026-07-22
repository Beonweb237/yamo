// ============================================================
// Gestion KYC (série KYC) — dossiers de vérification profils
// ============================================================
// Le « dossier KYC » = la ligne `applications` (elle existe déjà pour chaque
// profil resto/livreur, relie au user et au restaurant). On y ajoute un statut
// KYC, et une table `kyc_documents` où CHAQUE pièce porte son URL ET son verdict
// (validation pièce par pièce demandée).
//
// Documents stockés via /api/media (URL /uploads/…), jamais en base64.

const DOC_KEYS = {
  restaurant: ['id_document', 'business_reg', 'restaurant_photo', 'profile_photo'],
  livreur: ['id_document', 'license_document', 'insurance_document', 'profile_photo', 'vehicle_photo'],
};
const ALL_DOC_KEYS = new Set([...DOC_KEYS.restaurant, ...DOC_KEYS.livreur]);
const DOC_STATUSES = new Set(['pending', 'approved', 'rejected']);
const DOSSIER_STATUSES = new Set(['incomplet', 'a_verifier', 'verifie', 'rejete']);

// Statut effectif d'un dossier : explicite s'il est posé, sinon dérivé du nombre
// de pièces (aucune = incomplet, au moins une = à vérifier).
function effectiveStatus(explicit, docsTotal) {
  if (explicit) return explicit;
  return docsTotal > 0 ? 'a_verifier' : 'incomplet';
}

export function registerKycRoutes(app, { pool, authRequired, adminPermissionRequired, fromSnake }) {
  // Le statut du dossier vit dans une table dédiée (kyc_dossiers) plutôt que
  // dans applications : l'utilisateur DB ne possède pas la table applications
  // (ALTER refusé). Le dossier reste identifié par son application_id.
  pool.query(`
    CREATE TABLE IF NOT EXISTS kyc_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id text NOT NULL,
      doc_key text NOT NULL,
      url text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      note text,
      uploaded_at timestamptz NOT NULL DEFAULT now(),
      reviewed_by text,
      reviewed_at timestamptz,
      UNIQUE (application_id, doc_key)
    );
    CREATE INDEX IF NOT EXISTS kyc_documents_app_idx ON kyc_documents(application_id);

    CREATE TABLE IF NOT EXISTS kyc_dossiers (
      application_id text PRIMARY KEY,
      status text NOT NULL,
      reviewed_by text,
      reviewed_at timestamptz NOT NULL DEFAULT now()
    );
  `).catch((e) => console.error('kyc tables init:', e.message));

  const VIEW = 'kyc.view';
  const REVIEW = 'kyc.review';

  // ─── Attacher / remplacer une pièce (création + édition) ────
  app.post('/api/admin/kyc/:applicationId/documents', authRequired, adminPermissionRequired(REVIEW), async (req, res) => {
    const { docKey, url } = req.body || {};
    if (!docKey || !ALL_DOC_KEYS.has(docKey) || !url) {
      return res.status(400).json({ error: 'docKey (valide) et url requis.' });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO kyc_documents (application_id, doc_key, url, status, uploaded_at)
         VALUES ($1, $2, $3, 'pending', now())
         ON CONFLICT (application_id, doc_key) DO UPDATE SET url = EXCLUDED.url,
           status = 'pending', note = NULL, uploaded_at = now(), reviewed_by = NULL, reviewed_at = NULL
         RETURNING *`,
        [String(req.params.applicationId), docKey, String(url)]
      );
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('POST kyc/documents:', err.message);
      res.status(500).json({ error: 'Erreur serveur (pièce KYC).' });
    }
  });

  // ─── Supprimer une pièce ────────────────────────────────────
  app.delete('/api/admin/kyc/:applicationId/documents/:docKey', authRequired, adminPermissionRequired(REVIEW), async (req, res) => {
    try {
      await pool.query('DELETE FROM kyc_documents WHERE application_id = $1 AND doc_key = $2',
        [String(req.params.applicationId), String(req.params.docKey)]);
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE kyc/documents:', err.message);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  });

  // ─── Verdict d'une pièce (validé / refusé + motif) ──────────
  app.post('/api/admin/kyc/:applicationId/documents/:docKey/review', authRequired, adminPermissionRequired(REVIEW), async (req, res) => {
    const status = req.body?.status;
    if (!DOC_STATUSES.has(status)) return res.status(400).json({ error: 'status invalide.' });
    try {
      const note = (req.body?.note || '').toString().slice(0, 500) || null;
      const { rows } = await pool.query(
        `UPDATE kyc_documents SET status = $3, note = $4, reviewed_by = $5, reviewed_at = now()
         WHERE application_id = $1 AND doc_key = $2 RETURNING *`,
        [String(req.params.applicationId), String(req.params.docKey), status, note, String(req.user.sub)]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Pièce introuvable.' });
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('POST kyc review:', err.message);
      res.status(500).json({ error: 'Erreur serveur (verdict pièce).' });
    }
  });

  // ─── Statut du dossier (Marquer vérifié / rejeté / à vérifier) ──
  app.post('/api/admin/kyc/:applicationId/status', authRequired, adminPermissionRequired(REVIEW), async (req, res) => {
    const status = req.body?.status;
    if (!DOSSIER_STATUSES.has(status)) return res.status(400).json({ error: 'status invalide.' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO kyc_dossiers (application_id, status, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (application_id) DO UPDATE SET status = EXCLUDED.status,
           reviewed_by = EXCLUDED.reviewed_by, reviewed_at = now()
         RETURNING *`,
        [String(req.params.applicationId), status, String(req.user.sub)]
      );
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('POST kyc status:', err.message);
      res.status(500).json({ error: 'Erreur serveur (statut dossier).' });
    }
  });

  // ─── Liste des dossiers KYC ─────────────────────────────────
  app.get('/api/admin/kyc', authRequired, adminPermissionRequired(VIEW), async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT a.id, a.type, a.status AS app_status, kdo.status AS kyc_status, kdo.reviewed_at AS kyc_reviewed_at,
                a.restaurant_name, a.city, a.contact_phone, a.created_at, a.restaurant_id,
                u.id AS user_id, u.full_name, u.phone AS user_phone, u.photo_url,
                r.neighborhood AS r_neigh, r.name AS r_name,
                COALESCE(d.total,0)::int AS docs_total,
                COALESCE(d.approved,0)::int AS docs_approved,
                COALESCE(d.rejected,0)::int AS docs_rejected,
                COALESCE(d.pending,0)::int AS docs_pending
         FROM applications a
         LEFT JOIN users u ON u.id::text = a.applicant_id::text
         LEFT JOIN restaurants r ON r.id::text = a.restaurant_id::text
         LEFT JOIN kyc_dossiers kdo ON kdo.application_id = a.id::text
         LEFT JOIN LATERAL (
           SELECT count(*) total,
                  count(*) FILTER (WHERE status='approved') approved,
                  count(*) FILTER (WHERE status='rejected') rejected,
                  count(*) FILTER (WHERE status='pending') pending
           FROM kyc_documents kd WHERE kd.application_id = a.id::text
         ) d ON true
         ORDER BY a.created_at DESC LIMIT 500`
      );
      const dossiers = rows.map((r) => ({
        applicationId: String(r.id),
        type: r.type,
        appStatus: r.app_status,
        kycStatus: effectiveStatus(r.kyc_status, r.docs_total),
        kycReviewedAt: r.kyc_reviewed_at,
        userId: r.user_id ? String(r.user_id) : null,
        name: r.full_name || r.restaurant_name || null,
        restaurantName: r.r_name || r.restaurant_name || null,
        phone: r.user_phone || r.contact_phone || null,
        city: r.city || null,
        neighborhood: r.r_neigh || null,
        photoUrl: r.photo_url || null,
        restaurantId: r.restaurant_id ? String(r.restaurant_id) : null,
        docsTotal: r.docs_total, docsApproved: r.docs_approved,
        docsRejected: r.docs_rejected, docsPending: r.docs_pending,
        createdAt: r.created_at,
      }));
      const counts = { incomplet: 0, a_verifier: 0, verifie: 0, rejete: 0 };
      for (const d of dossiers) counts[d.kycStatus] = (counts[d.kycStatus] || 0) + 1;
      res.json({ counts, dossiers });
    } catch (err) {
      console.error('GET kyc:', err.message);
      res.status(500).json({ error: 'Erreur serveur (liste KYC).' });
    }
  });

  // ─── Fiche KYC d'un dossier ─────────────────────────────────
  app.get('/api/admin/kyc/:applicationId', authRequired, adminPermissionRequired(VIEW), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT a.*, kdo.status AS kyc_status, kdo.reviewed_at AS kyc_reviewed_at,
                u.full_name, u.phone AS user_phone, u.email AS user_email, u.city AS user_city,
                u.service_neighborhoods, u.photo_url, u.id AS user_id,
                r.name AS r_name, r.neighborhood AS r_neigh, r.address AS r_address, r.category AS r_category
         FROM applications a
         LEFT JOIN users u ON u.id::text = a.applicant_id::text
         LEFT JOIN restaurants r ON r.id::text = a.restaurant_id::text
         LEFT JOIN kyc_dossiers kdo ON kdo.application_id = a.id::text
         WHERE a.id::text = $1`,
        [String(req.params.applicationId)]
      );
      const a = rows[0];
      if (!a) return res.status(404).json({ error: 'Dossier introuvable.' });
      const { rows: docs } = await pool.query(
        'SELECT * FROM kyc_documents WHERE application_id = $1 ORDER BY uploaded_at',
        [String(req.params.applicationId)]
      );
      res.json({
        applicationId: String(a.id),
        type: a.type,
        appStatus: a.status,
        kycStatus: effectiveStatus(a.kyc_status, docs.length),
        kycReviewedAt: a.kyc_reviewed_at,
        expectedDocKeys: DOC_KEYS[a.type] || [],
        userId: a.user_id ? String(a.user_id) : null,
        restaurantId: a.restaurant_id ? String(a.restaurant_id) : null,
        name: a.full_name || a.restaurant_name || null,
        restaurantName: a.r_name || a.restaurant_name || null,
        phone: a.user_phone || a.contact_phone || null,
        email: a.user_email || null,
        city: a.city || a.user_city || null,
        neighborhood: a.r_neigh || null,
        address: a.address || a.r_address || null,
        category: a.r_category || null,
        serviceNeighborhoods: a.service_neighborhoods || null,
        photoUrl: a.photo_url || null,
        notes: a.notes || null,
        documents: docs.map(fromSnake),
      });
    } catch (err) {
      console.error('GET kyc/:id:', err.message);
      res.status(500).json({ error: 'Erreur serveur (fiche KYC).' });
    }
  });

  // ─── Édition profil livreur (nom, tel, ville, quartiers) ────
  // (l'édition resto passe par l'API restaurants existante côté client)
  app.patch('/api/admin/users/:id/profile', authRequired, adminPermissionRequired('admin.users.update'), async (req, res) => {
    const { fullName, phone, city, serviceNeighborhoods } = req.body || {};
    try {
      const sets = [], vals = [];
      let i = 1;
      if (fullName !== undefined) { sets.push(`full_name = $${i++}`); vals.push(String(fullName).slice(0, 120)); }
      if (phone !== undefined) { sets.push(`phone = $${i++}`); vals.push(String(phone).replace(/\D/g, '').slice(0, 15)); }
      if (city !== undefined) { sets.push(`city = $${i++}`); vals.push(city ? String(city).slice(0, 80) : null); }
      if (serviceNeighborhoods !== undefined) {
        sets.push(`service_neighborhoods = $${i++}`);
        vals.push(Array.isArray(serviceNeighborhoods) ? serviceNeighborhoods : null);
      }
      if (!sets.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
      sets.push('updated_at = now()');
      vals.push(String(req.params.id));
      const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id::text = $${i} RETURNING id, full_name, phone, city, service_neighborhoods`,
        vals
      );
      if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('PATCH users/profile:', err.message);
      res.status(500).json({ error: 'Erreur serveur (profil).' });
    }
  });
}
