import { useState } from 'react';
import { Store } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { updateRestaurantOpenStatus } from '../../lib/catalog';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';

export default function AdminRestaurants() {
  const { restaurants } = useRestaurants();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const handleToggle = async (id: string, currentlyOpen: boolean) => {
    setTogglingId(id);
    try {
      await updateRestaurantOpenStatus(id, !currentlyOpen);
      setOverrides((p) => ({ ...p, [id]: !currentlyOpen }));
      toast.success(currentlyOpen ? 'Restaurant fermé' : 'Restaurant rouvert');
    } catch { toast.error('Erreur'); }
    finally { setTogglingId(null); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="font-poppins font-bold text-text-primary text-2xl mb-6 flex items-center gap-2"><Store className="w-6 h-6 text-green-primary" />Restaurants ({restaurants.length})</h1>
      <div className="bg-white rounded-xl border border-border-custom divide-y divide-border-light">
        {restaurants.map((r) => {
          const isOpen = overrides[r.id] ?? r.isOpen;
          return (
            <div key={r.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-inter font-medium text-text-primary text-sm">{r.name}</p>
                <p className="text-text-muted text-xs">{r.category} · {r.address}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${isOpen ? 'text-green-primary' : 'text-text-muted'}`}>{isOpen ? 'Ouvert' : 'Fermé'}</span>
                <Switch checked={isOpen} onCheckedChange={() => handleToggle(r.id, isOpen)} disabled={togglingId === r.id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
