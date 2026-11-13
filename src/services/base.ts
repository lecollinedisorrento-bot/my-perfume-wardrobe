// The app can be served from a sub-path (e.g. GitHub Pages: /my-perfume-wardrobe/).
// Vite sets BASE_URL from `base` at build time; it always ends with "/".
export const BASE_URL: string = import.meta.env.BASE_URL || '/';

/** Builds a same-origin URL under the app's base path. */
export function appUrl(path: string): string {
  return BASE_URL + path.replace(/^\//, '');
}
