import { useSiteConfig } from '../hooks/useSiteConfig';
import HomeClassic from './HomeClassic';
import HomePremium from './HomePremium';

// Routeur de template de la page d'accueil. Le template actif est piloté en admin
// (/admin/apparence). Défaut = 'classic' → rendu identique à aujourd'hui.
// La config est lue synchroniquement (cache) au 1er rendu : pas de flash.
export default function Home() {
  const { homeTemplate } = useSiteConfig();
  return homeTemplate === 'premium' ? <HomePremium /> : <HomeClassic />;
}
