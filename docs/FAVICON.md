# Favicon (APR oval)

## Files that use the favicon

| File | Role |
|------|------|
| `src/app/layout.tsx` | Metadata `icons` + `<link rel="icon">` (PNG first, SVG alternate) |
| `src/app/icon.png` | Main tab icon (32×32, oval fits inside square) |
| `src/app/apple-icon.png` | Apple touch icon (180×180) |
| `src/app/icon.svg` | Alternate (Vercel-style black “D”) |
| `public/icon.png` | Copy for manifest / direct URL |
| `public/logo-oval-trimmed.png` | Source oval with white margin |
| `public/site.webmanifest` | PWA manifest, references `/icon.png` |
| `src/components/org-switcher.tsx` | Sidebar app icon uses `/icon.png` |

## APR favicon package (reference only)

`apr-favicon-package/` contains pre-made APR assets (favicon-16x16, 32x32, apple-touch-icon, android-chrome, favicon.ico). The app does **not** use these directly; it uses assets generated from the oval.

## How to get the APR oval to fit inside the tab square

1. **Source oval with margin** (if needed):
   ```bash
   node scripts/trim-oval-with-margin.mjs [source.png] public/logo-oval-trimmed.png [marginPx]
   ```

2. **Generate favicon assets** (oval scaled to fit inside square, no crop):
   ```bash
   node scripts/favicon-from-oval.mjs [source.png]
   ```
   Default source: `public/logo-oval-trimmed.png`.  
   Writes: `src/app/icon.png`, `src/app/apple-icon.png`, `public/icon.png`.

3. Layout already prefers `icon.png` (oval); no code change needed after running the script.
