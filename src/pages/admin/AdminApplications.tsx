import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, UserCheck, Check, X } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllApplications, approveApplication, rejectApplication, type Application } from '../../lib/applications';
import { toast } from 'sonner';

export default function AdminApplications() {
  const { restaurants } = useRestaurants();
  const [applications, setApplications] = useState<Application[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedRestaurantByApp, setSelectedRestaurantByApp] = useState<Record<string, string>>({});

  const load = useCallback(async () => { setApplications(await fetchAllApplications()); }, []);
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  const pending = applications.filter((a) => a.status === 'pending');

  const handleApprove = async (app: Application) => {
    setReviewingId(app.id);
    try {
      await approveApplication(app.id, app.type === 'restaurant' ? selectedRestaurantByApp[app.id] : undefined);
      load(); toast.success(`Candidature ${app.type === 'restaurant' ? 'restaurant' : 'livreur'} approuvée`);
    } catch { toast.error('Erreur'); }
    finally { setReviewingId(null); }
  };
  const handleReject = async (app: Application) => {
    setReviewingId(app.id);
    try { await rejectApplication(app.id); load(); toast.success('Candidature rejetée'); }
    catch { toast.error('Erreur'); }
    finally { setReviewingId(null); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2"><UserCheck className="w-6 h-6 text-green-primary" />Candidatures</h1>
        <button onClick={load} className="flex items-center gap-1.5 text-text-secondary text-sm font-inter hover:text-text-primary"><RefreshCw className="w-4 h-4" />Actualiser</button>
      </div>
      <div className="bg-white rounded-xl border border-border-custom border-l-4 border-l-gold-accent p-5 mb-6">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">En attente ({pending.length})</h2>
        {pending.length === 0 ? <p className="text-text-secondary font-inter text-sm">Aucune candidature en attente.</p> : (
          <div className="space-y-3">
            {pending.map((app) => (
              <div key={app.id} className="border border-border-light rounded-lg p-4">
                <div className="mb-2">
                  <p className="font-inter font-semibold text-text-primary text-sm">
                    {app.type === 'restaurant' ? app.restaurantName || 'Restaurant sans nom' : 'Candidature livreur'}
                    <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-gold-light text-gold-accent">{app.type === 'restaurant' ? 'Restaurateur' : 'Livreur'}</span>
                  </p>
                  <p className="text-text-muted text-xs mt-0.5">{app.city} · {app.address} · {app.contactPhone}</p>
                  {app.notes && <p className="text-text-secondary text-xs mt-1">{app.notes}</p>}
                </div>
                {app.type === 'restaurant' && (
                  <div className="mb-2">
                    <label className="block text-text-muted text-xs mb-1">Lier à un restaurant existant (optionnel)</label>
                    <select value={selectedRestaurantByApp[app.id] ?? ''} onChange={(e) => setSelectedRestaurantByApp((p) => ({ ...p, [app.id]: e.target.value }))} className="w-full bg-bg-secondary rounded-lg px-3 h-10 text-text-primary text-sm outline-none">
                      <option value="">Créer un nouveau restaurant</option>
                      {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(app)} disabled={reviewingId === app.id} className="flex items-center gap-1.5 bg-green-primary text-white font-medium text-sm px-4 h-9 rounded-lg hover:bg-green-dark disabled:opacity-60"><Check className="w-3.5 h-3.5" />{app.type === 'restaurant' && !selectedRestaurantByApp[app.id] ? 'Approuver + créer' : 'Approuver'}</button>
                  <button onClick={() => handleReject(app)} disabled={reviewingId === app.id} className="flex items-center gap-1.5 border border-error text-error font-medium text-sm px-4 h-9 rounded-lg hover:bg-error/5 disabled:opacity-60"><X className="w-3.5 h-3.5" />Rejeter</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Approved list */}
      {applications.filter(a => a.status === 'approved').length > 0 && (
        <div className="bg-white rounded-xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">Approuvées</h2>
          <div className="divide-y divide-border-light">
            {applications.filter(a => a.status === 'approved').slice(0, 20).map((app) => (
              <div key={app.id} className="py-2 flex justify-between">
                <span className="text-sm text-text-secondary">{app.type === 'restaurant' ? app.restaurantName || 'Resto' : 'Livreur'} · {app.contactPhone}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-light text-green-primary">Approuvé</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
