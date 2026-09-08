# Personal Bento Site — Design Spec

Date: 2026-09-07

## Purpose

Replace the current linktr.ee redirect at peterjlockhart.com with a static
personal site hosted on GitHub Pages, using a responsive bento-box layout.
First pass ships placeholder copy; content gets refined later.

## Stack & Hosting

- Plain HTML/CSS/JS at the repo root — no build step, no dependencies.
- Files: `index.html`, `styles.css`, `script.js` (optional interactivity,
  can stay minimal/empty for this pass), `assets/` (for future images).
- `CNAME` file at repo root containing `peterjlockhart.com`.
- GitHub Pages configured to serve from `main` branch, root directory.

## Layout

- CSS Grid bento layout, `grid-auto-flow: dense`, each box declares a
  column/row span via a modifier class (e.g. `.box--large`).
- Responsive breakpoints collapse column count as viewport shrinks, down to
  a single column on phones (all boxes full-width, stacked).
- Adding a future box means adding another `.box` element — no structural
  rework required.

### Boxes (first pass)

| Box | Size | Content |
|---|---|---|
| About me | Large (2×2 desktop) | Placeholder bio copy, name |
| Social links | Small (1×1) | Icon row: Instagram, Facebook, GitHub, Dribbble — inline SVG icons, real profile URLs |
| Family | Medium (1×2) | Mentions Consuelo + "our four pets" (generic, no names yet) |
| Sparrow Sleeps | Medium (1×1) | One-line placeholder description, links to sparrowsleeps.com |
| Foxio | Medium (1×1) | One-line placeholder description, links to fox.io |
| Illustration | Medium (1×1) | One-line placeholder description |
| Branding | Medium (1×1) | One-line placeholder description |
| Woodworking | Medium (1×1) | One-line placeholder description |
| Welding | Medium (1×1) | One-line placeholder description |
| Home Renovations | Medium (1×1) | One-line placeholder description |

Social profile URLs:
- Instagram: https://instagram.com/peterlockhart
- Facebook: https://facebook.com/peterlockhart
- GitHub: https://github.com/peterlockhart
- Dribbble: https://dribbble.com/peterlockhart

## Visual Style

- Clean & minimal: neutral background, subtle border/shadow per box, one
  accent color for links/hover states, system sans-serif font stack,
  generous padding.
- All colors defined as CSS custom properties on `:root` so light/dark is a
  token swap, not duplicated rules.
- `prefers-color-scheme` media query drives automatic light/dark mode —
  no manual toggle for this pass.
- Icons: hand-rolled inline SVGs (no external icon library/CDN dependency),
  recolored via `currentColor` so they adapt to theme automatically.

## Out of Scope (this pass)

- Real photos/avatars.
- Real pet names for the Family box.
- Additional boxes beyond the ten listed.
- Any backend, analytics, or build tooling.
- Manual light/dark toggle UI.

## Testing / Verification

- Open `index.html` directly in a browser at a few widths (mobile, tablet,
  desktop) to confirm the grid reflows correctly and no box overflows.
- Toggle OS light/dark mode to confirm both themes render legibly.
- Verify all outbound links (social + company) point to the correct
  domains and open correctly.
