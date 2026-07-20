import type { LucideIcon } from 'lucide-react';

interface AuthHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

// En-tête commun des cartes d'authentification (connexion, inscription,
// porte admin) : bandeau de marque + médaillon du rôle. La carte parente
// doit être en `p-0 overflow-hidden` pour que le bandeau soit bord à bord.
export default function AuthHeader({ icon: Icon, title, subtitle }: AuthHeaderProps) {
  return (
    <div>
      <div className="relative bg-gradient-to-br from-green-primary to-green-dark px-6 pt-5 pb-12 overflow-hidden">
        <div aria-hidden className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10" />
        <div aria-hidden className="absolute right-12 -bottom-10 w-20 h-20 rounded-full bg-gold-accent/30" />
        <div className="relative flex items-center justify-center gap-2.5">
          <img src="/logo-icon.png" alt="" className="w-9 h-9 object-contain" />
          <span className="font-poppins font-bold text-white text-lg">MiamExpress</span>
        </div>
      </div>
      {/* `relative` obligatoire : le bandeau au-dessus est positionné, sans
          ça le médaillon en marge négative serait peint derrière lui. */}
      <div className="relative -mt-7 mb-3 flex justify-center">
        <div className="w-14 h-14 rounded-2xl bg-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] flex items-center justify-center">
          <Icon className="w-6 h-6 text-green-primary" />
        </div>
      </div>
      <div className="px-6 text-center mb-6">
        <h1 className="font-poppins font-bold text-text-primary text-xl mb-1">{title}</h1>
        <p className="text-text-secondary font-inter text-sm">{subtitle}</p>
      </div>
    </div>
  );
}
