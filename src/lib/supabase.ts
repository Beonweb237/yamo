// ============================================================
// MiamExpress — Adaptateur API VPS (interface compatible Supabase)
// ============================================================
// Reprend l'« Adaptateur V3 » écrit côté VPS et l'améliore :
//
// - INTERRUPTEUR : activé uniquement si VITE_USE_VPS_API=true.
//   Sans le flag, isSupabaseConfigured=false et toutes les libs
//   retombent sur leur chemin mock/localStorage — zéro régression.
//
// - CASSE : l'API renvoie du camelCase (conversion fromSnake côté
//   serveur) alors que toutes les libs lisent du snake_case
//   (héritage Supabase). Les réponses sont reconverties ici, en
//   profondeur, pour que les libs restent inchangées. Les filtres,
//   tris et payloads partent déjà en snake_case — le serveur les
//   accepte tels quels (colonnes SQL snake_case, toSnake idempotent).
//
// - JOINTURES : l'API générique /api/:table ne fait pas de JOIN.
//   Les selects imbriqués Supabase (`order_items(*)`, `addresses(*)`…)
//   sont résolus ici par requêtes complémentaires batchées (in.),
//   selon le registre EMBED_RELATIONS.
//
// - SESSION : /api/auth/me est mis en cache 60 s — chaque opération
//   des libs appelle isSupabaseAuthenticated(), sans cache chaque
//   lecture coûterait une requête de plus (rédhibitoire en 3G).
// ============================================================

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';
const API_BASE: string = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'miamexpress_session';

// ─── Session & token ──────────────────────────────────────────
function getToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw)?.access_token || null : null;
  } catch { return null; }
}
function setSession(s: { access_token: string; user: unknown }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  meCache = null;
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  meCache = null;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

// ─── Conversion camelCase → snake_case (réponses) ─────────────
function keyToSnake(k: string): string {
  return k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
}
function rowToSnake<T>(value: T): T {
  if (Array.isArray(value)) return value.map(rowToSnake) as unknown as T;
  if (value && typeof value === 'object' && (value as object).constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[keyToSnake(k)] = rowToSnake(v);
    }
    return out as unknown as T;
  }
  return value;
}

// ─── Selects imbriqués ─────────────────────────────────────────
// L'API renvoie les lignes à plat ; on résout ici les relations
// utilisées par les libs (ORDER_SELECT / DRIVER_ORDER_SELECT).
// parent : la table de base porte la FK (orders.address_id → addresses)
// child  : la table liée porte la FK (order_items.order_id ← orders)
const EMBED_RELATIONS: Record<string, { type: 'parent' | 'child'; fk: string }> = {
  order_items: { type: 'child', fk: 'order_id' },
  deliveries: { type: 'child', fk: 'order_id' },
  addresses: { type: 'parent', fk: 'address_id' },
  restaurants: { type: 'parent', fk: 'restaurant_id' },
  orders: { type: 'parent', fk: 'order_id' },
};

interface EmbedSpec { table: string; inner: EmbedSpec[] }

/** Découpe `'*, order_items(*), orders(*, addresses(*))'` en colonnes plates + embeds (imbrication supportée). */
function parseSelect(select: string): { flat: string; embeds: EmbedSpec[] } {
  const embeds: EmbedSpec[] = [];
  const flatParts: string[] = [];
  let depth = 0, token = '';
  const tokens: string[] = [];
  for (const ch of select) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { tokens.push(token); token = ''; continue; }
    token += ch;
  }
  if (token.trim()) tokens.push(token);

  for (const t of tokens) {
    const trimmed = t.trim();
    const m = trimmed.match(/^([a-z_]+)\((.*)\)$/s);
    if (m && EMBED_RELATIONS[m[1]]) {
      embeds.push({ table: m[1], inner: parseSelect(m[2]).embeds });
    } else if (trimmed) {
      flatParts.push(trimmed);
    }
  }
  // On ne restreint pas les colonnes de base quand il y a des embeds :
  // les libs lisent souvent des champs hors de la liste (surcoût négligeable).
  const flat = embeds.length > 0 ? '*' : (flatParts.join(', ') || '*');
  return { flat, embeds };
}

async function fetchRowsByFilter(table: string, column: string, values: string[]): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  // Batches de 40 pour garder des URLs raisonnables.
  for (let i = 0; i < values.length; i += 40) {
    const batch = values.slice(i, i + 40);
    const param = batch.length === 1
      ? `${column}=eq.${encodeURIComponent(batch[0])}`
      : `${column}=in.${batch.map(encodeURIComponent).join(',')}`;
    const res = await apiFetch(`/api/${table}?${param}&limit=100`);
    if (!res.ok) continue;
    const json = await res.json();
    rows.push(...(rowToSnake(json.data || []) as Record<string, unknown>[]));
  }
  return rows;
}

async function resolveEmbeds(baseRows: Record<string, unknown>[], embeds: EmbedSpec[]): Promise<void> {
  if (baseRows.length === 0) return;
  for (const embed of embeds) {
    const rel = EMBED_RELATIONS[embed.table];
    if (!rel) continue;

    if (rel.type === 'child') {
      const ids = [...new Set(baseRows.map((r) => r.id as string).filter(Boolean))];
      const children = ids.length ? await fetchRowsByFilter(embed.table, rel.fk, ids) : [];
      if (embed.inner.length) await resolveEmbeds(children, embed.inner);
      for (const row of baseRows) {
        row[embed.table] = children.filter((c) => c[rel.fk] === row.id);
      }
    } else {
      const fks = [...new Set(baseRows.map((r) => r[rel.fk] as string).filter(Boolean))];
      const parents = fks.length ? await fetchRowsByFilter(embed.table, 'id', fks) : [];
      if (embed.inner.length) await resolveEmbeds(parents, embed.inner);
      const byId = new Map(parents.map((p) => [p.id as string, p]));
      for (const row of baseRows) {
        row[embed.table] = byId.get(row[rel.fk] as string) ?? null;
      }
    }
  }
}

// ─── Builder chaînable (.from().select().eq()…, thenable) ─────
type FilterVal = string | number | boolean | null | string[];
type LazyOp =
  | { kind: 'select'; select: string }
  | { kind: 'update'; data: Record<string, unknown> }
  | { kind: 'delete' };

interface QueryResult { data: unknown; error: Error | null; count?: number }

interface LazyBuilder extends PromiseLike<QueryResult> {
  eq(col: string, val: FilterVal): LazyBuilder;
  neq(col: string, val: FilterVal): LazyBuilder;
  in(col: string, vals: FilterVal[]): LazyBuilder;
  gte(col: string, val: FilterVal): LazyBuilder;
  lte(col: string, val: FilterVal): LazyBuilder;
  is(col: string, val: null | boolean): LazyBuilder;
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean } | string): LazyBuilder;
  limit(n: number): LazyBuilder;
  maybeSingle(): LazyBuilder;
  single(): LazyBuilder;
  select(cols?: string): LazyBuilder;
}

function makeLazyBuilder(table: string, op: LazyOp): LazyBuilder {
  const filters: [string, string][] = [];
  let _order: string | null = null;
  let _orderDir: 'asc' | 'desc' = 'asc';
  let _limit = 100;
  let _single = false;

  const buildListUrl = (flatSelect: string): string => {
    const p = new URLSearchParams();
    if (flatSelect !== '*') p.set('select', flatSelect);
    for (const [k, v] of filters) p.set(k, v);
    if (_order) { p.set('sort', _order); p.set('sortDir', _orderDir); }
    p.set('limit', String(_limit));
    return `/api/${table}?${p.toString()}`;
  };

  const idFromFilters = (): string | null => {
    const f = filters.find(([k]) => k === 'id');
    return f ? decodeURIComponent(f[1].replace(/^eq\./, '')) : null;
  };

  const execute = async (): Promise<QueryResult> => {
    try {
      if (op.kind === 'update') {
        const id = idFromFilters() ?? (op.data.id as string | undefined);
        if (id) {
          const res = await apiFetch(`/api/${table}/${id}`, { method: 'PATCH', body: JSON.stringify(op.data) });
          const json = await res.json();
          if (!res.ok) return { data: null, error: new Error(json.error || 'Update failed') };
          return { data: [rowToSnake(json)], error: null, count: 1 };
        }
        // Update par filtres sans id : résoudre les ids d'abord (ex. claim
        // d'une livraison non assignée : .eq('order_id', x).is('driver_id', null)).
        const listRes = await apiFetch(buildListUrl('*'));
        const listJson = await listRes.json();
        if (!listRes.ok) return { data: null, error: new Error(listJson.error || 'API error') };
        const targets = (listJson.data || []) as Record<string, unknown>[];
        const updated: unknown[] = [];
        for (const t of targets) {
          const res = await apiFetch(`/api/${table}/${t.id}`, { method: 'PATCH', body: JSON.stringify(op.data) });
          const json = await res.json();
          if (res.ok) updated.push(rowToSnake(json));
        }
        return { data: updated, error: null, count: updated.length };
      }

      if (op.kind === 'delete') {
        const id = idFromFilters();
        if (!id) return { data: null, error: new Error('id requis pour delete') };
        const res = await apiFetch(`/api/${table}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          return { data: null, error: new Error((json as { error?: string }).error || 'Delete failed') };
        }
        return { data: [], error: null, count: 0 };
      }

      // select
      const { flat, embeds } = parseSelect(op.select);
      const res = await apiFetch(buildListUrl(flat));
      const json = await res.json();
      if (!res.ok) return { data: null, error: new Error(json.error || 'API error') };
      const rows = rowToSnake(json.data || []) as Record<string, unknown>[];
      if (embeds.length) await resolveEmbeds(rows, embeds);
      return { data: rows, error: null, count: json.count };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  };

  const builder: LazyBuilder = {
    eq(col, val) { filters.push([col, `eq.${encodeURIComponent(String(val))}`]); return builder; },
    neq(col, val) { filters.push([col, `neq.${encodeURIComponent(String(val))}`]); return builder; },
    in(col, vals) { filters.push([col, `in.${(Array.isArray(vals) ? vals : [vals]).map((v) => encodeURIComponent(String(v))).join(',')}`]); return builder; },
    gte(col, val) { filters.push([col, `gte.${encodeURIComponent(String(val))}`]); return builder; },
    lte(col, val) { filters.push([col, `lte.${encodeURIComponent(String(val))}`]); return builder; },
    is(col, val) { filters.push([col, `is.${val === null ? 'null' : String(val)}`]); return builder; },
    order(col, opts) {
      _order = col;
      if (typeof opts === 'string') _orderDir = opts === 'desc' ? 'desc' : 'asc';
      else _orderDir = opts?.ascending === false ? 'desc' : 'asc';
      return builder;
    },
    limit(n) { _limit = n; return builder; },
    maybeSingle() { _single = true; return builder; },
    single() { _single = true; return builder; },
    // .update(x).eq('id', y).select() — no-op : PATCH renvoie déjà la ligne.
    select() { return builder; },
    then(onfulfilled) {
      return execute().then((r) => {
        const shaped = _single
          ? { ...r, data: Array.isArray(r.data) && r.data.length > 0 ? r.data[0] : null }
          : r;
        return (onfulfilled ? onfulfilled(shaped) : shaped) as never;
      });
    },
  };
  return builder;
}

// ─── from() ────────────────────────────────────────────────────
function fromTable(table: string) {
  return {
    select(cols = '*') { return makeLazyBuilder(table, { kind: 'select', select: cols }); },
    update(data: Record<string, unknown>) { return makeLazyBuilder(table, { kind: 'update', data }); },
    delete() { return makeLazyBuilder(table, { kind: 'delete' }); },
    upsert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      // L'API n'a pas d'upsert générique ; POST suffit pour nos usages
      // (création de profil à l'inscription — géré par /api/auth/signup).
      return this.insert(rows);
    },
    async insert<T extends Record<string, unknown>>(rows: T | T[]) {
      const items = Array.isArray(rows) ? rows : [rows];
      const results: unknown[] = [];
      for (const item of items) {
        const res = await apiFetch(`/api/${table}`, { method: 'POST', body: JSON.stringify(item) });
        const json = await res.json();
        if (!res.ok) return { data: null, error: new Error(json.error || 'Insert failed'), select: passthroughSelect(null) };
        results.push(rowToSnake(json));
      }
      const data = Array.isArray(rows) ? results : results[0] ?? null;
      // Supporte `.insert(x).select().single()` (pattern courant des libs).
      return { data, error: null, select: passthroughSelect(data) };
    },
  };
}

// Rend chaînable le résultat d'un insert : .select() / .single() renvoient
// les données déjà retournées par le POST (RETURNING * côté serveur).
function passthroughSelect(data: unknown) {
  return () => ({
    single: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: data == null ? new Error('Insert failed') : null }),
    maybeSingle: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: null }),
    then: (resolve: (r: { data: unknown; error: null }) => void) => resolve({ data, error: null }),
  });
}

// ─── Auth ──────────────────────────────────────────────────────
// Cache du profil /api/auth/me (60 s) — invalidé à chaque set/clearSession.
let meCache: { user: Record<string, unknown>; ts: number } | null = null;
const ME_TTL_MS = 60_000;

const auth = {
  async getSession(): Promise<{ data: { session: { access_token: string; user: Record<string, unknown> } | null }; error: null }> {
    const token = getToken();
    if (!token) return { data: { session: null }, error: null };
    if (meCache && Date.now() - meCache.ts < ME_TTL_MS) {
      return { data: { session: { access_token: token, user: meCache.user } }, error: null };
    }
    try {
      const res = await apiFetch('/api/auth/me');
      if (!res.ok) { clearSession(); return { data: { session: null }, error: null }; }
      const user = (await res.json()) as Record<string, unknown>;
      meCache = { user, ts: Date.now() };
      return { data: { session: { access_token: token, user } }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  },

  /** Connexion par mot de passe — accepte {email} ou {phone} (l'API stocke l'identifiant dans users.phone). */
  async signInWithPassword({ email, phone, password }: { email?: string; phone?: string; password: string }) {
    const identifier = phone || email || '';
    const res = await apiFetch('/api/auth/signin', { method: 'POST', body: JSON.stringify({ phone: identifier, password }) });
    const json = await res.json();
    if (!res.ok) return { data: null, error: new Error(json.error || 'Identifiants invalides') };
    setSession({ access_token: json.token, user: json.user });
    return { data: { session: { access_token: json.token as string, user: json.user as Record<string, unknown> } }, error: null };
  },

  async signUp({ email, phone, password, name, role, options }: {
    email?: string; phone?: string; password?: string; name?: string; role?: string;
    options?: { data?: { phone?: string; full_name?: string } };
  }) {
    const actualPhone = phone || options?.data?.phone || email || '';
    const actualName = name || options?.data?.full_name || '';
    const res = await apiFetch('/api/auth/signup', { method: 'POST', body: JSON.stringify({ phone: actualPhone, password, name: actualName, role }) });
    const json = await res.json();
    if (!res.ok) return { data: null, error: new Error(json.error || 'Inscription échouée') };
    setSession({ access_token: json.token, user: json.user });
    return { data: { session: { access_token: json.token as string, user: json.user as Record<string, unknown> }, user: json.user as Record<string, unknown> }, error: null };
  },

  async signOut() { clearSession(); return { error: null }; },

  onAuthStateChange(cb: (event: string, session: unknown) => void) {
    const handler = () => {
      const token = getToken();
      cb(token ? 'SIGNED_IN' : 'SIGNED_OUT', token ? { access_token: token } : null);
    };
    window.addEventListener('storage', handler);
    setTimeout(handler, 0);
    return { data: { subscription: { unsubscribe: () => window.removeEventListener('storage', handler) } } };
  },

  // Méthodes propres à l'API VPS (pas dans l'interface Supabase d'origine).
  async sendOtp(phone: string) {
    const r = await apiFetch('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) });
    if (!r.ok) throw new Error("Envoi de l'OTP échoué");
    return r.json();
  },
  async verifyOtp(phone: string, code: string, requestedRole?: string) {
    const r = await apiFetch('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code, requestedRole }) });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || 'Code invalide');
    setSession({ access_token: json.token, user: json.user });
    return json as { user: Record<string, unknown>; token: string };
  },
};

// ─── Realtime (stub) ───────────────────────────────────────────
// Le backend émet déjà `realtime:<table>` en socket.io ; le branchement
// frontend viendra remplacer le polling (chantier séparé). Stub inerte
// pour compatibilité d'interface en attendant.
function channel(_name: string) {
  const chain = {
    on() { return chain; },
    subscribe() { return { unsubscribe() { /* no-op */ } }; },
  };
  return chain;
}
function removeChannel(_c: unknown) { /* no-op */ }

// ─── Export ────────────────────────────────────────────────────
/** true uniquement quand le build est configuré pour parler à l'API VPS. */
export const isSupabaseConfigured = USE_VPS;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = USE_VPS
  ? {
    from: fromTable,
    auth,
    channel,
    removeChannel,
    rpc: (fn: string, params?: Record<string, unknown>) =>
      apiFetch(`/api/rpc/${fn}`, { method: 'POST', body: JSON.stringify(params || {}) }).then((r) => r.json()),
  }
  : null;

export async function isSupabaseAuthenticated(): Promise<boolean> {
  if (!USE_VPS) return false;
  const { data } = await auth.getSession();
  return !!data.session;
}
