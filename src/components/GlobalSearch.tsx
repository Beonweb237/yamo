import { useState, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, UtensilsCrossed, Star, ArrowRight, MapPin, Clock, Search } from 'lucide-react';
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
import AppImage from './AppImage';
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

// Surligne l'occurrence recherchée. La normalisation (minuscule + suppression
// des accents précomposés) conserve la longueur caractère par caractère, donc
// l'index normalisé s'applique tel quel sur la chaîne d'origine.
function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const idx = normalize(text).indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-gold-light text-gold-accent font-medium rounded-[3px] px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
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

  const groupHeading = (icon: ReactNode, label: string, count: number): ReactNode => (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {icon}
        {label}
      </span>
      <span className="text-[11px] font-medium text-text-muted tabular-nums">{count}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogHeader className="sr-only">
        <DialogTitle>Rechercher</DialogTitle>
        <DialogDescription>Trouvez un plat ou un restaurant</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 gap-0 top-[12%] translate-y-0 sm:max-w-[580px] rounded-2xl border-border-custom shadow-2xl">
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Rechercher un plat, un restaurant…"
            className="text-[15px]"
          />
          <CommandList className="max-h-[min(62vh,440px)] px-2 py-1">
            {!hasResults && (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-3">
                  <Search className="w-5 h-5 text-text-muted" />
                </div>
                <p className="text-sm text-text-secondary font-inter">
                  Aucun résultat pour <span className="font-medium text-text-primary">« {trimmed} »</span>
                </p>
                <button
                  type="button"
                  onClick={goAll}
                  className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-green-primary text-white text-sm font-medium hover:bg-green-dark transition-colors"
                >
                  Voir tous les résultats
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {restaurantMatches.length > 0 && (
              <CommandGroup heading={groupHeading(<Store className="w-3.5 h-3.5" />, q ? 'Restaurants' : 'Restaurants populaires', restaurantMatches.length)}>
                {restaurantMatches.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`resto-${r.id}`}
                    onSelect={() => goRestaurant(r.id)}
                    className="gap-3 px-2.5 py-2 rounded-xl data-[selected=true]:bg-green-light/70 group"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-border-custom bg-bg-secondary">
                      <AppImage
                        src={r.image}
                        alt={r.name}
                        fallbackLabel={r.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary font-inter truncate flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.isOpen ? 'bg-green-primary' : 'bg-text-muted'}`} aria-hidden="true" />
                        <span className="truncate">{highlight(r.name, q)}</span>
                      </p>
                      <p className="text-xs text-text-secondary font-inter truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0 text-text-muted" />
                        <span className="truncate">
                          {[r.neighborhood, r.city].filter(Boolean).join(', ') || r.category}
                          {r.category && (r.neighborhood || r.city) ? ` · ${r.category}` : ''}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {typeof r.rating === 'number' && r.rating > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-gold-accent bg-gold-light px-1.5 py-0.5 rounded-md">
                          <Star className="w-3 h-3 fill-current" />
                          {r.rating.toFixed(1)}
                        </span>
                      )}
                      {r.deliveryTime && (
                        <span className="hidden sm:flex items-center gap-1 text-[11px] text-text-muted">
                          <Clock className="w-3 h-3" />
                          {r.deliveryTime}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {dishMatches.length > 0 && (
              <CommandGroup heading={groupHeading(<UtensilsCrossed className="w-3.5 h-3.5" />, q ? 'Plats' : 'Plats les plus proposés', dishMatches.length)}>
                {dishMatches.map((g) => (
                  <CommandItem
                    key={g.key}
                    value={`dish-${g.key}`}
                    onSelect={() => goDish(g)}
                    className="gap-3 px-2.5 py-2 rounded-xl data-[selected=true]:bg-gold-light/60 group"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-border-custom bg-bg-secondary">
                      <AppImage
                        src={g.bestImage}
                        alt={g.displayName}
                        fallbackLabel={g.displayName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary font-inter truncate">{highlight(g.displayName, q)}</p>
                      <p className="text-xs text-text-secondary font-inter truncate flex items-center gap-1 mt-0.5">
                        <Store className="w-3 h-3 shrink-0 text-text-muted" />
                        {g.totalRestaurants} restaurant{g.totalRestaurants > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-green-primary bg-green-light px-2 py-1 rounded-md whitespace-nowrap">
                      dès {g.minPrice.toLocaleString()} F
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          <div className="flex items-center justify-between px-3 py-2.5 border-t border-border-custom bg-bg-secondary">
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-text-muted font-inter">
              <kbd className="px-1.5 py-0.5 rounded border border-border-custom bg-white font-sans">↑↓</kbd>
              naviguer
              <kbd className="px-1.5 py-0.5 rounded border border-border-custom bg-white font-sans ml-1">↵</kbd>
              ouvrir
              <kbd className="px-1.5 py-0.5 rounded border border-border-custom bg-white font-sans ml-1">esc</kbd>
              fermer
            </div>
            {hasResults && (
              <button
                type="button"
                onClick={goAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-green-primary hover:gap-1.5 transition-all ml-auto"
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
