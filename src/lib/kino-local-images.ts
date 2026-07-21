import kinoImageMap from '../generated/kino-image-map.json';

export function toLocalKinoImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return '';

  try {
    const url = new URL(imageUrl);
    
    // local paths return as-is
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return imageUrl;
    }

    // cast to any to bypass TS complaints if typing is strict
    const map = kinoImageMap as Record<string, string>;
    if (map[imageUrl]) {
      return map[imageUrl];
    }

    // fallback to original if not found
    if (process.env.NODE_ENV === 'development' || typeof window === 'undefined') {
      console.warn(`[toLocalKinoImageUrl] Image not found in local map: ${imageUrl}`);
    }
    
    return imageUrl;
  } catch (error) {
    // Relative paths like /images/... or invalid URL
    if (imageUrl.startsWith('/')) {
      return imageUrl;
    }
    return imageUrl || '';
  }
}
