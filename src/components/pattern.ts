import type { StoreTheme } from "@/lib/types";

// Generates a tiling SVG background for a store theme. Houndstooth = 2-colour check where the mixed
// quadrants carry diagonal bands, which is how the woven pattern's "teeth" emerge when tiled.
export function patternCss(theme: StoreTheme, size = 22): string {
  const fg = theme.primary, bg = theme.background;
  let body = "";
  switch (theme.pattern) {
    case "houndstooth":
      body =
        `<rect width="4" height="4" fill="${bg}"/>` +
        `<g fill="${fg}"><rect width="2" height="2"/>` +
        `<polygon points="2,0 3,0 2,1"/><polygon points="4,0 4,1 3,2 2,2"/>` +
        `<polygon points="0,2 1,2 0,3"/><polygon points="2,2 2,3 1,4 0,4"/></g>`;
      break;
    case "stripes":
      body = `<rect width="4" height="4" fill="${bg}"/><rect width="1.4" height="4" fill="${fg}"/>`;
      break;
    case "dots":
      body = `<rect width="4" height="4" fill="${bg}"/><circle cx="2" cy="2" r="0.7" fill="${fg}"/>`;
      break;
    case "grid":
      body = `<rect width="4" height="4" fill="${bg}"/><path d="M0 0H4M0 0V4" stroke="${fg}" stroke-width="0.3"/>`;
      break;
    default:
      return bg;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 4 4" shape-rendering="crispEdges">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
