import { useEffect } from 'react';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { applyBrandColors } from '../lib/siteConfig';

// Applique les couleurs de marque configurées (admin /apparence) à chaque changement.
// L'application synchrone au démarrage se fait dans main.tsx (évite le flash) ;
// ce composant assure la réactivité si l'admin change les couleurs en direct.
export default function BrandTheme() {
  const { brandColors } = useSiteConfig();
  useEffect(() => {
    applyBrandColors(brandColors);
  }, [brandColors]);
  return null;
}
