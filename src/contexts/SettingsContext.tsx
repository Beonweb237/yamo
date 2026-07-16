import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';

// Préférences d'affichage (LOT-12 / CONF-30) — pour le contexte camerounais :
// forfaits data limités et téléphones d'entrée de gamme.
//
// « Économie de données » :
//  - désactive toutes les animations framer-motion (MotionConfig 'always') ;
//  - les images passent en chargement différé strict (voir AppImage).
// Sans le mode, les animations respectent quand même la préférence système
// `prefers-reduced-motion` (MotionConfig 'user').

const DATA_SAVER_KEY = 'yamo_data_saver';

interface SettingsContextType {
  dataSaver: boolean;
  setDataSaver: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [dataSaver, setDataSaverState] = useState(() => localStorage.getItem(DATA_SAVER_KEY) === 'true');

  const setDataSaver = useCallback((enabled: boolean) => {
    localStorage.setItem(DATA_SAVER_KEY, String(enabled));
    setDataSaverState(enabled);
  }, []);

  return (
    <SettingsContext.Provider value={{ dataSaver, setDataSaver }}>
      <MotionConfig reducedMotion={dataSaver ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
