import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, History, Store, MapPin, UtensilsCrossed, Package } from 'lucide-react';
import { toast } from 'sonner';
import { listTrash, restoreFromTrash, permanentlyDelete, trashTimeLeft, purgeExpiredTrash, type TrashEntry } from '../../lib/trash';

const TYPE_ICONS: Record<string, typeof Trash2> = {
  menu_item: UtensilsCrossed,
  address: MapPin,
  food_request: Package,
  order: Package,
};

const TYPE_LABELS: Record<string, string> = {
  menu_item: 'Plat',
  address: 'Adresse',
  food_request: 'Demande de plat',
  order: 'Commande',
};

export default function AdminTrash() {
  const [entries, setEntries] = useState<TrashEntry[]>([]);

  const load = () => {
    purgeExpiredTrash();
    setEntries(listTrash());
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  const handleRestore = (entry: TrashEntry) => {
    const restored = restoreFromTrash(entry.id, entry.type);
    if (restored) {
      toast.success(`${TYPE_LABELS[entry.type] ?? 'Élément'} restauré`);
      load();
    }
  };

  const handleDelete = (entry: TrashEntry) => {
    permanentlyDelete(entry.id, entry.type);
    toast.success('Supprimé définitivement');
    load();
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2">
          <Trash2 className="w-6 h-6 text-error" />
          Corbeille ({entries.length})
        </h1>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-text-secondary font-inter text-sm hover:text-text-primary transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
          <Trash2 className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-30" />
          <p className="text-text-secondary font-inter font-medium">Corbeille vide</p>
          <p className="text-text-muted text-sm font-inter mt-1">
            Les éléments supprimés apparaîtront ici pendant 7 jours avant suppression définitive.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border-custom overflow-hidden">
          <div className="divide-y divide-border-light">
            {entries.map((entry) => {
              const Icon = TYPE_ICONS[entry.type] ?? Trash2;
              const data = entry.data as Record<string, unknown> | undefined;
              return (
                <div key={`${entry.type}-${entry.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-error" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-inter font-medium bg-bg-secondary text-text-secondary">
                          {TYPE_LABELS[entry.type] ?? entry.type}
                        </span>
                        <span className="text-amber-600 text-[11px] font-inter flex items-center gap-1">
                          <History className="w-3 h-3" />
                          {trashTimeLeft(entry.trashedAt)}
                        </span>
                      </div>
                      <p className="font-inter font-semibold text-text-primary text-sm mt-1 truncate">
                        {data?.name as string || data?.label as string || data?.fullText as string || entry.id.slice(0, 12)}
                      </p>
                      {entry.trashedBy && (
                        <p className="text-text-muted text-[11px] font-inter mt-0.5">Supprimé par {entry.trashedBy}</p>
                      )}
                      <p className="text-text-muted text-[11px] font-inter">{formatDate(entry.trashedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRestore(entry)}
                      className="flex items-center gap-1 px-3 h-8 rounded-lg bg-green-light text-green-primary text-xs font-inter font-medium hover:bg-green-primary hover:text-white transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Restaurer
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="flex items-center gap-1 px-3 h-8 rounded-lg bg-error/10 text-error text-xs font-inter font-medium hover:bg-error hover:text-white transition-colors"
                    >
                      Supprimer déf.
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
