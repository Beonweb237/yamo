import { useState, type ImgHTMLAttributes, type ReactEventHandler } from 'react';
import { placeholderFor } from '../lib/imageFallback';

interface AppImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackLabel?: string;
}

export default function AppImage({ src, alt, fallbackLabel, onError, loading = 'lazy', decoding = 'async', ...props }: AppImageProps) {
  const [resolved, setResolved] = useState(src ?? '');
  // Resynchronise quand `src` change après le montage (données async, ou passage
  // mock → réel). Sans ça, l'image restait figée sur la 1re valeur (souvent vide
  // ou une image de repli) même après l'arrivée de la vraie URL. Pattern « reset
  // au rendu » recommandé par React (pas d'effet → pas de flash ni de setState-in-effect).
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setResolved(src ?? '');
  }

  const handleError: ReactEventHandler<HTMLImageElement> = (e) => {
    if (resolved !== placeholderFor(fallbackLabel ?? alt ?? 'MiamExpress')) {
      setResolved(placeholderFor(fallbackLabel ?? alt ?? 'MiamExpress'));
    }
    onError?.(e);
  };

  // Chargement différé par défaut (CONF-30, réseaux 3G) — un appelant peut
  // toujours passer loading="eager" pour une image critique (hero, LCP).
  return <img {...props} loading={loading} decoding={decoding} src={resolved || placeholderFor('MiamExpress')} alt={alt} onError={handleError} />;
}
