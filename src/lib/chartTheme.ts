// Couleurs partagées des graphiques Recharts, alignées sur les tokens du
// design system (tailwind.config.js). Recharts ne lit pas les classes
// Tailwind : les hex sont centralisés ici au lieu d'être dupliqués dans
// chaque <BarChart>. Voir docs/design-system.md §9.1.

/** Série principale (CA, totaux) — token `green-primary`. */
export const CHART_PRIMARY = '#157F3D';

/** Série secondaire (heures de pointe, volumes) — token `gold-accent`. */
export const CHART_ACCENT = '#D4A843';

/** Grille et bordure de tooltip — token `border-custom`. */
export const CHART_GRID = '#E5E7EB';

/** Libellés d'axes — token `text-secondary`. */
export const CHART_TICK = '#6B7280';

/** Style commun des tooltips Recharts. */
export const CHART_TOOLTIP_STYLE = { borderRadius: 8, border: `1px solid ${CHART_GRID}` } as const;
