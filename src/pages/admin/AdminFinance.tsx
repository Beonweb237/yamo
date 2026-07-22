import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, Coins, Bike, RefreshCw, Banknote, Store, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../../hooks/useSeo';
import {
  fetchFinanceSummary, fetchFinanceDrivers, fetchFinanceOrders, exportFinanceCsv,
  type FinanceSummary, type DriverReconciliation, type FinanceOrder,
} from '../../lib/finance';

const MODE_LABELS: Record<string, string> = {
  cod: 'À la livraison (cash)', prepaid_restaurant: 'Prépayé restaurant', prepaid_platform: 'Prépayé plateforme',
};
const PAY_LABELS: Record<string, string> = {
  cash: 'Espèces', mtn_momo: 'MTN MoMo', orange_money: 'Orange Money',
};
const fcfa = (n: number) => (n || 0).toLocaleString() + ' FCFA';

export default function AdminFinance() {
  const { t } = useTranslation();
  useSeo({ title: t('Centre Financier'), noindex: true });
  const [period, setPeriod] = useState(30);
  const [sum, setSum] = useState<FinanceSummary | null>(null);
  const [drivers, setDrivers] = useState<DriverReconciliation[]>([]);
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (days: number) => {
    setLoading(true);
    Promise.all([fetchFinanceSummary(days), fetchFinanceDrivers(days), fetchFinanceOrders(days)])
      .then(([s, d, o]) => { setSum(s); setDrivers(d.drivers); setOrders(o.orders); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(period); /* eslint-disable-next-line */ }, [period]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px]">
      <div className="flex items-start gap-3 mb-6 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-green-primary/10 grid place-items-center shrink-0">
          <Coins className="w-6 h-6 text-green-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl leading-tight">{t('Centre Financier')}</h1>
          <p className="text-text-muted text-xs sm:text-sm mt-0.5">{t('Revenus, réconciliation cash et règlements — adapté au mode de paiement de chaque commande.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}
            className="h-10 rounded-xl border border-border-custom bg-white px-3 text-sm outline-none">
            <option value={7}>{t('7 jours')}</option>
            <option value={30}>{t('30 jours')}</option>
            <option value={90}>{t('90 jours')}</option>
            <option value={365}>{t('1 an')}</option>
          </select>
          <button onClick={() => load(period)} disabled={loading} className="h-10 px-3 rounded-xl border border-border-custom bg-white text-text-secondary hover:bg-bg-secondary text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
          <p className="font-poppins font-semibold text-text-primary mb-1">{t('Impossible de charger les données')}</p>
          <p className="text-text-muted text-sm mb-4">{error}</p>
          <button onClick={() => load(period)} className="h-10 px-4 rounded-xl bg-green-primary text-white font-semibold text-sm">{t('Réessayer')}</button>
        </div>
      ) : loading && !sum ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-border-custom animate-pulse" />)}</div>
      ) : sum ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Kpi icon={TrendingUp} label={t('Volume (GMV)')} value={fcfa(sum.money.gmv)} sub={`${sum.money.orders} ${t('commandes livrées')}`} />
            <Kpi icon={Coins} label={t('Commission plateforme')} value={fcfa(sum.money.commission)} accent />
            <Kpi icon={Banknote} label={t('Cash en circulation')} value={fcfa(sum.cashInCirculation)} sub={t('à réconcilier (cod)')} />
            <Kpi icon={Bike} label={t('Dû aux livreurs')} value={fcfa(sum.driver.net)} sub={t('prépayé restaurant')} />
          </div>

          {/* Par mode + par moyen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <Card title={t('Par mode de paiement')}>
              {Object.keys(sum.byMode).length === 0 ? <Empty t={t} /> : Object.entries(sum.byMode).map(([m, v]) => (
                <Row key={m} label={t(MODE_LABELS[m] || m)} a={`${v.orders} ${t('cmd')}`} b={fcfa(v.gmv)} c={fcfa(v.commission)} />
              ))}
              <Head t={t} />
            </Card>
            <Card title={t('Par moyen de paiement')}>
              {Object.keys(sum.byPayment).length === 0 ? <Empty t={t} /> : Object.entries(sum.byPayment).map(([p, v]) => (
                <div key={p} className="flex items-center justify-between py-2 border-b border-border-light last:border-0 text-sm">
                  <span className="text-text-primary">{t(PAY_LABELS[p] || p)}</span>
                  <span className="text-text-muted">{v.orders} {t('cmd')}</span>
                  <span className="font-semibold text-text-primary">{fcfa(v.amount)}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-border-custom flex items-center gap-2 text-xs text-text-muted">
                <Store className="w-3.5 h-3.5" /> {t('Solde total wallets restaurants')} : <b className="text-text-primary">{fcfa(sum.restaurantWallets.totalAvailable)}</b>
              </div>
            </Card>
          </div>

          {/* Réconciliation livreurs */}
          <div className="bg-white rounded-2xl border border-border-custom p-4 sm:p-5">
            <h2 className="font-poppins font-semibold text-text-primary text-sm mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-green-primary" />{t('Réconciliation par livreur')}</h2>
            {drivers.length === 0 ? <Empty t={t} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-text-muted text-xs text-left border-b border-border-custom">
                      <th className="py-2 font-medium">{t('Livreur')}</th>
                      <th className="py-2 font-medium text-right">{t('Cmd')}</th>
                      <th className="py-2 font-medium text-right">{t('Cash encaissé')}</th>
                      <th className="py-2 font-medium text-right">{t('Dû plateforme')}</th>
                      <th className="py-2 font-medium text-right">{t('À payer (prépayé)')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.driverId} className="border-b border-border-light last:border-0">
                        <td className="py-2"><span className="font-medium text-text-primary">{d.name || t('Livreur')}</span>{d.phone && <span className="text-text-muted text-xs block">{d.phone}</span>}</td>
                        <td className="py-2 text-right text-text-muted">{d.orders}</td>
                        <td className="py-2 text-right font-semibold text-text-primary">{fcfa(d.cashCollected)}</td>
                        <td className="py-2 text-right text-amber-700">{fcfa(d.owedToPlatform)}</td>
                        <td className="py-2 text-right text-green-primary">{d.earningsToPay ? fcfa(d.earningsToPay) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Détail transactionnel + export CSV */}
          <div className="bg-white rounded-2xl border border-border-custom p-4 sm:p-5 mt-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h2 className="font-poppins font-semibold text-text-primary text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-green-primary" />{t('Détail des transactions')} <span className="text-text-muted font-normal">({orders.length})</span></h2>
              <button onClick={() => exportFinanceCsv(orders, period)} disabled={!orders.length}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-green-primary text-white text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-50">
                <Download className="w-4 h-4" />{t('Exporter CSV')}
              </button>
            </div>
            {orders.length === 0 ? <Empty t={t} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-text-muted text-xs text-left border-b border-border-custom">
                      <th className="py-2 font-medium">{t('Réf')}</th>
                      <th className="py-2 font-medium">{t('Date')}</th>
                      <th className="py-2 font-medium">{t('Statut')}</th>
                      <th className="py-2 font-medium">{t('Mode')}</th>
                      <th className="py-2 font-medium text-right">{t('Total')}</th>
                      <th className="py-2 font-medium text-right">{t('Commission')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 100).map((o) => (
                      <tr key={o.id} className="border-b border-border-light last:border-0">
                        <td className="py-2 font-medium text-text-primary">{o.ref}</td>
                        <td className="py-2 text-text-muted">{new Date(o.date).toLocaleDateString('fr-FR')}</td>
                        <td className="py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${o.status === 'delivered' ? 'bg-green-light text-green-primary' : 'bg-red-50 text-red-700'}`}>{t(o.status === 'delivered' ? 'Livrée' : 'Annulée')}</span></td>
                        <td className="py-2 text-text-muted text-xs">{t(MODE_LABELS[o.mode] || o.mode)}</td>
                        <td className="py-2 text-right font-semibold text-text-primary">{fcfa(o.total)}</td>
                        <td className="py-2 text-right text-green-primary">{o.commission ? fcfa(o.commission) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length > 100 && <p className="text-text-muted text-xs mt-2 text-center">{t('100 premières affichées — export CSV complet ci-dessus.')}</p>}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Coins; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border p-4 ${accent ? 'border-green-primary/40' : 'border-border-custom'}`}>
      <div className="flex items-center gap-2 text-text-muted text-xs mb-2"><Icon className="w-4 h-4" />{label}</div>
      <p className={`font-poppins font-bold text-lg ${accent ? 'text-green-primary' : 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-text-muted text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-border-custom p-4 sm:p-5"><h2 className="font-poppins font-semibold text-text-primary text-sm mb-3">{title}</h2>{children}</div>;
}
function Head({ t }: { t: (k: string) => string }) {
  return <div className="mt-2 pt-2 text-[11px] text-text-muted flex justify-between"><span>{t('cmd · volume · commission')}</span></div>;
}
function Row({ label, a, b, c }: { label: string; a: string; b: string; c: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-light last:border-0 text-sm gap-2">
      <span className="text-text-primary flex-1 min-w-0 truncate">{label}</span>
      <span className="text-text-muted text-xs shrink-0">{a}</span>
      <span className="text-text-muted text-xs shrink-0">{b}</span>
      <span className="font-semibold text-green-primary shrink-0">{c}</span>
    </div>
  );
}
function Empty({ t }: { t: (k: string) => string }) {
  return <p className="text-text-muted text-sm py-4 text-center">{t('Aucune donnée sur la période.')}</p>;
}
