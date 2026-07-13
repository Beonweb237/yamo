const cache = new Map<string, string>();

/** Génère une image SVG inline (data URI) pour les assets manquants. */
export function placeholderFor(label: string, color = '#2d6a4f'): string {
  const key = `${label}-${color}`;
  if (cache.has(key)) return cache.get(key)!;

  const text = label.slice(0, 24).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${color}"/>
    <text x="200" y="150" font-family="Arial,sans-serif" font-size="18" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${text}</text>
  </svg>`;
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(key, uri);
  return uri;
}
