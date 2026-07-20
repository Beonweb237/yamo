import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, UtensilsCrossed, Star, ArrowRight, Heart } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from './ui/command';
import { useRestaurants } from '../hooks/useCatalog';
import { menuItems as mockMenuItems } from '../data/mockData';
import { buildEnrichedItems, groupDishes, dishSlug, type DishGroup } from '../lib/dishes';

// Recherche globale live (palette ⌘K). Filtrage 100 % en mémoire — les données
// sont déjà côté client (comme la vue « Tous les plats », CONF-33) : aucun appel
// réseau, résultats instantanés même en 3G. Réutilise buildEnrichedItems /
// groupDishes / dishSlug et pointe vers les routes existantes /restaurant/:id et
// /plat/:slug ; le « voir tout » retombe sur /restaurants?q= (contrat LOT-13).

const MAX_RESULTS = 6;

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { restaurants } = useRestaurants();
  const [query, setQuery] = useState('');

  const dishGroups = useMemo<DishGroup[]>(
    () => groupDishes(buildEnrichedItems(mockMenuItems, restaurants)),
    [restaurants]
  );

  const trimmed = query.trim();
  const q = normalize(trimmed);

  const restaurantMatches = useMemo(() => {
    const scored = restaurants.filter((r) => {
      if (!q) return true;
      const text = normalize(`${r.name} ${r.category} ${(r.tags ?? []).join(' ')} ${r.city ?? ''} ${r.neighborhood ?? ''}`);
      return text.includes(q);
    });
    // Requête vide → suggestions : les mieux notés en tête.
    const sorted = q
      ? scored
      : [...scored].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return sorted.slice(0, MAX_RESULTS);
  }, [restaurants, q]);

  const dishMatches = useMemo(() => {
    const scored = dishGroups.filter((g) => {
      if (!q) return true;
      const text = normalize(`${g.displayName} ${g.tags.join(' ')}`);
      return text.includes(q);
    });
    const sorted = q
      ? scored
      : [...scored].sort((a, b) => b.totalRestaurants - a.totalRestaurants);
    return sorted.slice(0, MAX_RESULTS);
  }, [dishGroups, q]);

  const hasResults = restaurantMatches.length > 0 || dishMatches.length > 0;

  // Reset de la requête à la fermeture → la réouverture repart des suggestions
  // (sans setState dans un effet).
  const setOpen = (next: boolean) => {
    if (!next) setQuery('');
    onOpenChange(next);
  };
  const close = () => setOpen(false);

  const goRestaurant = (id: string) => {
    close();
    navigate(`/restaurant/${id}`);
  };
  const goDish = (group: DishGroup) => {
    close();
    navigate(`/plat/${dishSlug(group.displayName)}`);
  };
  const goAll = () => {
    close();
    const params = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
    navigate(`/restaurants${params}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogHeader className="sr-only">
        <DialogTitle>Rechercher</DialogTitle>
        <DialogDescription>Trouvez un plat ou un restaurant</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 top-[15%] translate-y-0 sm:max-w-[560px]">
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:text-text-muted"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Rechercher un plat, un restaurant…"
          />
          <CommandList className="max-h-[min(60vh,420px)]">
            {!hasResults && (
              <div className="py-10 px-4 text-center">
                <p className="text-sm text-text-secondary font-inter">
                  Aucun résultat pour « {trimmed} »
                </p>
                <button
                  type="button"
                  onClick={goAll}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-primary hover:underline"
                >
                  Voir tous les résultats
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {restaurantMatches.length > 0 && (
              <CommandGroup heading="Restaurants">
                {restaurantMatches.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`resto-${r.id}`}
                    onSelect={() => goRestaurant(r.id)}
                    className="gap-3 py-2.5"
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-green-light flex items-center justify-center shrink-0">
                      <Store className="w-[18px] h-[18px] text-green-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-inter truncate">{r.name}</p>
                      <p className="text-xs text-text-secondary font-inter truncate">
                        {[r.neighborhood, r.city].filter(Boolean).join(', ') || r.category}
                        {r.category && (r.neighborhood || r.city) ? ` · ${r.category}` : ''}
                      </p>
                    </div>
                    {typeof r.rating === 'number' && r.rating > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gold-accent shrink-0">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {r.rating.toFixed(1)}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {dishMatches.length > 0 && (
              <CommandGroup heading="Plats">
                {dishMatches.map((g) => (
                  <CommandItem
                    key={g.key}
                    value={`dish-${g.key}`}
                    onSelect={() => goDish(g)}
                    className="gap-3 py-2.5"
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-gold-light flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-[18px] h-[18px] text-gold-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-inter truncate">{g.displayName}</p>
                      <p className="text-xs text-text-secondary font-inter truncate">
                        dès {g.minPrice.toLocaleString()} FCFA · {g.totalRestaurants} resto{g.totalRestaurants > 1 ? 's' : ''}
                      </p>
                    </div>
                    <Heart className="w-4 h-4 text-text-muted shrink-0" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          <div className="flex items-center justify-between px-3 py-2.5 border-t border-border-custom bg-bg-secondary">
            <div className="hidden sm:flex items-center gap-3 text-xs text-text-muted font-inter">
              <span>↑↓ naviguer</span>
              <span>↵ ouvrir</span>
              <span>esc fermer</span>
            </div>
            {hasResults && (
              <button
                type="button"
                onClick={goAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-green-primary hover:underline ml-auto"
              >
                Voir tous les résultats
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
