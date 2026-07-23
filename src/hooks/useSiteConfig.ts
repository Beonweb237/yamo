import { useEffect, useState } from 'react';
import { getSiteConfig, readSiteConfigSync, SITE_CONFIG_EVENT, type SiteConfig } from '../lib/siteConfig';

// Config d'apparence du site (template Home, etc.). Lecture synchrone du cache
// au 1er rendu (pas de flash), puis rafraîchissement depuis la source (VPS/mock)
// et écoute des changements (même onglet via CustomEvent, autres onglets via storage).
export function useSiteConfig(): SiteConfig {
  const [config, setConfig] = useState<SiteConfig>(readSiteConfigSync);

  useEffect(() => {
    let alive = true;
    const refresh = () => { getSiteConfig().then((c) => { if (alive) setConfig(c); }); };
    refresh();
    const onLocal = () => { if (alive) setConfig(readSiteConfigSync()); };
    window.addEventListener(SITE_CONFIG_EVENT, onLocal);
    window.addEventListener('storage', onLocal);
    return () => {
      alive = false;
      window.removeEventListener(SITE_CONFIG_EVENT, onLocal);
      window.removeEventListener('storage', onLocal);
    };
  }, []);

  return config;
}
