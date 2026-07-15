import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}

/**
 * En-tête de page standard — dégradé plein, icône intégrée sur le fond
 * (pas de carte flottante à cheval sur deux couleurs). Remplace l'ancien
 * pattern "bandeau + icône -mt-6" dupliqué sur plusieurs pages.
 */
export default function PageHeader({ icon: Icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-green-primary via-green-600 to-emerald-500 shadow-sm">
      <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute right-10 -bottom-10 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      <div className="relative flex items-center justify-between gap-4 flex-wrap px-5 sm:px-6 py-6 sm:py-7">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-poppins font-bold text-white text-xl sm:text-2xl leading-tight truncate">{title}</h1>
            {subtitle && (
              typeof subtitle === 'string'
                ? <p className="text-white/80 text-xs sm:text-sm font-inter mt-0.5">{subtitle}</p>
                : <div className="mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
