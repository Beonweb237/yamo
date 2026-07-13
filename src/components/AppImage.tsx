import { useState, type ImgHTMLAttributes, type ReactEventHandler } from 'react';
import { placeholderFor } from '../lib/imageFallback';

interface AppImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackLabel?: string;
}

export default function AppImage({ src, alt, fallbackLabel, onError, ...props }: AppImageProps) {
  const [resolved, setResolved] = useState(src ?? '');

  const handleError: ReactEventHandler<HTMLImageElement> = (e) => {
    if (resolved !== placeholderFor(fallbackLabel ?? alt ?? 'Yamo')) {
      setResolved(placeholderFor(fallbackLabel ?? alt ?? 'Yamo'));
    }
    onError?.(e);
  };

  return <img {...props} src={resolved || placeholderFor('Yamo')} alt={alt} onError={handleError} />;
}
