# Lightbox Header & Thumbnail Strip — Design Spec

Date: 2026-09-09

## Purpose

Replace the fullscreen lightbox's centered-box layout (image + overlaid
caption + dot indicators) with a full-viewport "app chrome" layout: a 60px
header bar, an image stage that fills the remaining space, and a 90px
thumbnail strip across the bottom. The thumbnail strip takes over slide
navigation in fullscreen, so the dot indicators are removed from the
lightbox entirely — they remain exactly as they are today on the box
carousel.

The thumbnail strip's markup, styling approach, and interaction logic are
ported from `/Users/peterlockhart/projects/peterandconsuelo`
(`index.html`, `assets/js/carousel.js`, `assets/css/styles.css`), which
already solves this exact pattern for a gallery with far more images.

## Current State (for reference)

`index.html`'s `#lightbox` today:

```html
<div class="lightbox" id="lightbox" hidden>
  <button class="lightbox-close" id="lightbox-close">&times;</button>
  <button class="lightbox-nav lightbox-nav--prev" id="lightbox-prev">…</button>
  <button class="lightbox-nav lightbox-nav--next" id="lightbox-next">…</button>
  <div class="lightbox-inner" id="lightbox-inner">
    <div class="lightbox-slides" id="lightbox-slides"></div>
    <div class="lightbox-caption" id="lightbox-caption"></div>
    <div class="lightbox-dots" id="lightbox-dots"></div>
  </div>
</div>
```

`.lightbox-inner` is a centered box (max 1100×800px) that both the image
and the overlaid caption/dots live inside. `.lightbox-close` and
`.lightbox-nav` are `position: fixed` relative to the whole viewport, not
`.lightbox-inner`. `script.js` currently builds `.lightbox-slide` and
`.lightbox-dot` elements per photo in `openLightbox()`, resolves each
slide's image lazily (`resolveSlideSrc`), and fades the caption/dots in and
out around the image's FLIP grow/shrink animation (`setFadeOpacity`,
`CAPTION_FADE_OUT_MS` / `CAPTION_FADE_IN_DELAY_MS` / `CAPTION_FADE_IN_MS`).
None of that fade/lazy-load machinery changes in spirit — it gets retargeted
at the new header title and thumbnail strip instead of the caption and dots.

## New Layout

```
.lightbox (fixed, inset:0, flex column)
├── .lightbox-header    (60px, flex row: title left, close icon right)
├── .lightbox-stage      (flex:1, min-height:0, position:relative)
│     ├── .lightbox-slides   (position:absolute, inset:0 — same FLIP target as today, retargeted from .lightbox-inner to .lightbox-stage)
│     ├── .lightbox-nav--prev / --next  (position:absolute, centered on the stage, not the viewport)
└── .lightbox-thumbs    (90px, full width, horizontal scroll strip)
      └── .lightbox-thumbs__track (flex row of thumbnail buttons)
```

`.lightbox-inner`, `.lightbox-caption`, and `.lightbox-dots` are removed.
The header and thumb strip share the lightbox's existing dark background
(`rgba(0, 0, 0, 0.92)` once `.is-visible`) so they read as one continuous
panel rather than separate bars.

New `#lightbox` markup (ids match the current naming convention —
`lightbox-dots` is replaced by `lightbox-thumbs`/`lightbox-thumbs-track`,
`lightbox-caption` is replaced by `lightbox-title`):

```html
<div class="lightbox" id="lightbox" hidden>
  <div class="lightbox-header">
    <h2 class="lightbox-title" id="lightbox-title"></h2>
    <button type="button" class="lightbox-close" id="lightbox-close" aria-label="Close fullscreen gallery">&times;</button>
  </div>
  <div class="lightbox-stage" id="lightbox-inner">
    <div class="lightbox-slides" id="lightbox-slides"></div>
    <button type="button" class="lightbox-nav lightbox-nav--prev" id="lightbox-prev" aria-label="Previous slide">…</button>
    <button type="button" class="lightbox-nav lightbox-nav--next" id="lightbox-next" aria-label="Next slide">…</button>
  </div>
  <div class="lightbox-thumbs">
    <ul class="lightbox-thumbs-track" id="lightbox-thumbs" aria-label="Choose a photo"></ul>
  </div>
</div>
```

`id="lightbox-inner"` is kept (renamed class only) so the `lightboxInner`
JS variable and its role as the FLIP animation's `rectRelativeTo`
container need no rename — only its CSS changes.

### Header (60px)

- `display: flex; align-items: center; justify-content: space-between;`
  fixed `height: 60px`, horizontal padding matching the site's existing
  spacing scale (`1.5rem`, consistent with `.box` padding).
- Left: `<h2>` title only — no description in fullscreen (description
  stays box-only). Truncate with `text-overflow: ellipsis` on a single
  line if it's ever too long for the available width once the close button
  is accounted for.
- Right: `.lightbox-close` becomes a bare `×` icon (no circular
  background), sized to sit comfortably in the 60px row, same `#fff` color
  and `:focus-visible` outline treatment as today.

### Stage (flex: 1)

- `position: relative; min-height: 0;` so it can shrink and still clip its
  absolutely-positioned children correctly.
- `.lightbox-slides` / `.lightbox-slide` keep their current CSS
  (`position: absolute; inset: 0; object-fit: cover; border-radius: var(--radius);`)
  — only the containing box changes, from the old centered
  `.lightbox-inner` (max 1100×800) to this full-width stage. This means
  images render larger on wide viewports than they do today; that's an
  accepted consequence of going full-width per the approved design.
- `.lightbox-nav--prev` / `--next`: switch from `position: fixed` (centered
  on the whole viewport) to `position: absolute; top: 50%; transform:
  translateY(-50%);` relative to `.lightbox-stage`, so they stay centered
  on the image area specifically once the header/footer bars are in play.

### Thumbnail strip (90px)

Ported from peterandconsuelo's `.thumbs` / `.thumbs__track` / `.thumb`
pattern:

```css
.lightbox-thumbs {
  height: 90px;
  flex-shrink: 0;
}

.lightbox-thumbs__track {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 1rem;
  list-style: none;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.lightbox-thumb { flex: none; scroll-snap-align: center; }

.lightbox-thumb button {
  display: block;
  height: 64px; /* fits the 90px bar with vertical breathing room */
  padding: 0;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  opacity: 0.55;
  cursor: pointer;
  transition: opacity 220ms ease, box-shadow 220ms ease;
}

.lightbox-thumb button:hover,
.lightbox-thumb button:focus-visible { opacity: 1; }

.lightbox-thumb button[aria-current="true"] {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--accent);
}

.lightbox-thumb img {
  display: block;
  height: 100%;
  width: auto;
  object-fit: cover;
}
```

Thumbnail width is not fixed — height is fixed and width follows each
image's natural aspect ratio (matches the source pattern; since this
site's placeholder images are uniformly 4:3, thumbnails will end up a
uniform width in practice, but the approach generalizes if that changes).

## Behavior (script.js)

### Thumbnail build

Inside `openLightbox()`, alongside the existing per-slide loop that builds
`.lightbox-slide` elements, build one thumbnail per slide instead of one
dot:

```js
var thumbImg = document.createElement('img');
thumbImg.loading = 'lazy';
thumbImg.decoding = 'async';
thumbImg.alt = '';
if (n === startIndex) {
  thumbImg.src = slide.dataset.src;
} else {
  thumbImg.dataset.src = slide.dataset.src;
}

var thumbButton = document.createElement('button');
thumbButton.type = 'button';
thumbButton.setAttribute('aria-label', 'Photo ' + (n + 1) + ' of ' + boxSlides.length);
thumbButton.appendChild(thumbImg);
thumbButton.addEventListener('click', function (event) {
  event.stopPropagation();
  goToLightboxSlide(n);
  startLightboxAutoplay();
});

var thumbItem = document.createElement('li');
thumbItem.className = 'lightbox-thumb';
thumbItem.appendChild(thumbButton);
lightboxThumbs.appendChild(thumbItem);
```

This replaces the `.lightbox-dot` creation block. Thumbnail images reuse
the same lazy-loading scheme as the main slides (`resolveSlideSrc`) rather
than a separate low-res variant — these are already small (600×450)
placeholders, so a dedicated thumb size isn't worth the added complexity
right now.

### Active state + autoscroll

`showLightboxSlide(index)` currently toggles `.is-active` on slides and
dots and calls `resolveSlideSrc` for the current + next slide. Replace the
dots half with:

```js
var thumbs = lightboxThumbs.querySelectorAll('button');
thumbs.forEach(function (thumb, n) {
  if (n === resolved) {
    thumb.setAttribute('aria-current', 'true');
  } else {
    thumb.removeAttribute('aria-current');
  }
});
resolveSlideSrc(thumbs[resolved] && thumbs[resolved].querySelector('img'));
if (thumbs.length > 1) {
  resolveSlideSrc(thumbs[(resolved + 1) % thumbs.length] && thumbs[(resolved + 1) % thumbs.length].querySelector('img'));
}
maybeScrollThumbIntoView(thumbs[resolved]);
```

`maybeScrollThumbIntoView` ports peterandconsuelo's "hands on the strip"
guard: track `wheel` / `touchmove` / `pointerdown` on
`.lightbox-thumbs__track` (not `scroll`, since `scrollIntoView` itself
fires `scroll` and would otherwise make the strip think it was touched
every time it auto-centers) and skip the auto-`scrollIntoView` call for
5 seconds after the visitor's last direct interaction with the strip, so
autoplay-driven advances don't yank it out from under someone browsing.
User-driven navigation (thumb click, arrow keys, swipe) still always
scrolls the active thumbnail into view immediately.

### Fade choreography

The existing `setFadeOpacity` calls that target `lightboxCaption` and
`lightboxDots` (in `openLightbox`, `closeLightbox`, and the two
`prefersReducedMotion` branches) get retargeted at the new header title
element and `.lightbox-thumbs` — same constants
(`CAPTION_FADE_OUT_MS`/`CAPTION_FADE_IN_DELAY_MS`/`CAPTION_FADE_IN_MS`),
same sequencing (fade out immediately, fade in 0.1s after the image
finishes its 0.5s scale animation, over 0.25s). This is a variable
rename/retarget, not new logic. The box-side caption/dots fade code
(triggered when the box itself is hidden/revealed behind the lightbox) is
untouched — box dots stay as they are.

### What doesn't change

- `resolveSlideSrc`, the FLIP rect animation (`applyRect`/`clearRect`/
  `rectRelativeTo`), `goToLightboxSlide`, `showLightboxSlide`'s slide
  resolution/prefetch logic, autoplay, and the `is-lightbox-active`
  box-hiding mechanism are all reused as-is — only their target container
  changes from `.lightbox-inner` to `.lightbox-stage`, and dots become
  thumbs.
- The **box** carousel (`.carousel-dots`, `.carousel-caption`) is
  unaffected. Description text remains visible there; it's only dropped
  from the fullscreen header.

## Accessibility

- `aria-label="Photo N of M"` per thumbnail button (adapted from the
  source's "Photograph N of M" — matches this site's more casual voice).
- `aria-current="true"` on the active thumbnail button.
- `aria-label` on the thumbnail track itself (e.g. "Choose a photo").
- Close button and thumbnail buttons keep the existing `:focus-visible`
  outline treatment already shared by `.carousel-trigger`, `.carousel-dot`,
  `.lightbox-nav`, etc.

## Testing

- Verify the FLIP open/close animation still lands correctly on the new
  `.lightbox-stage` box (no visual regression from the `.lightbox-inner`
  retarget).
- Verify header/thumb fade timing matches the existing caption/dot
  choreography (reuse the same Playwright opacity-timeline check used for
  that feature).
- Verify thumbnail click navigation, active-state highlighting, and
  autoscroll (including the "hands on strip" quiet window) work for a
  5-image carousel.
- Verify `prefers-reduced-motion` still skips fades/animations and shows
  final state directly.
- Verify keyboard (Escape / Arrow keys) and prev/next arrow navigation
  still work with arrows repositioned to the stage.
