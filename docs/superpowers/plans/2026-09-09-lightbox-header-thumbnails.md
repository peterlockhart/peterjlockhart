# Lightbox Header & Thumbnail Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fullscreen lightbox's centered-box layout (overlaid caption + dot indicators) with a full-viewport layout: a 60px header (title + close button), an image stage filling the remaining space, and a 90px thumbnail strip across the bottom that takes over slide navigation in fullscreen.

**Architecture:** This is a restructuring of existing, already-working code — no new files. `index.html`'s `#lightbox` markup gets new header/stage/thumbs regions; `styles.css` gets new layout rules for those regions (replacing the old centered-box/caption/dots rules); `script.js`'s `openLightbox`/`closeLightbox`/`showLightboxSlide` get retargeted from building dots+caption to building thumbnails+header title, reusing the existing lazy-load (`resolveSlideSrc`) and fade (`setFadeOpacity`) helpers as-is.

**Tech Stack:** Plain HTML/CSS/JS, no build step, no framework. Verification uses Playwright (installed on demand — this repo has no `package.json`) driving a local `python3 -m http.server` instance, following the same pattern used for this codebase's existing carousel/lightbox verification.

**Spec:** `docs/superpowers/specs/2026-09-09-lightbox-header-thumbnails-design.md`

## Global Constraints

- Header height: exactly 60px.
- Thumbnail bar height: exactly 90px; thumbnail image height 64px inside it.
- Thumbnail opacity: `0.55` at rest, `1` on hover/focus/active (`[aria-current="true"]`).
- "Hands on strip" quiet window: 5000ms (`THUMB_QUIET_MS`) — an autoplay-driven slide change must not auto-scroll the thumbnail strip if the visitor interacted with the strip (`wheel`/`touchmove`/`pointerdown`) within the last 5s.
- Reuse existing constants as-is: `TRANSITION_MS = 500` (image FLIP animation), `CAPTION_FADE_OUT_MS = 100`, `CAPTION_FADE_IN_DELAY_MS = 100`, `CAPTION_FADE_IN_MS = 250` (fade choreography, now targeting the header title and thumbnail strip instead of the old caption/dots).
- Fullscreen header shows the title only — no description. The box carousel's caption (title + description) and dots (`.carousel-caption`, `.carousel-dots`) are completely unaffected by this work.
- No separate low-res thumbnail image variant — thumbnails reuse each slide's existing `data-src`/`src` lazy-loading scheme (`resolveSlideSrc`).
- `prefers-reduced-motion` must continue to skip all fades/animations and show final state directly, exactly as it does today.

## Verification Setup (do this once, reuse across all tasks)

```bash
mkdir -p /tmp/lightbox-verify && cd /tmp/lightbox-verify
npm init -y >/dev/null 2>&1
npm install playwright >/dev/null 2>&1
npx playwright install chromium --with-deps >/dev/null 2>&1
```

For each task's verification, start the site's static server from the repo root in the background, run the task's `verify.js` from `/tmp/lightbox-verify`, then stop the server:

```bash
cd /Users/peterlockhart/projects/peterjlockhart
(python3 -m http.server 8934 >/tmp/lightbox-verify/server.log 2>&1 &)
sleep 1
node /tmp/lightbox-verify/verify.js
lsof -ti:8934 -sTCP:LISTEN | xargs -r kill
```

---

## Task 1: Restructure lightbox layout (header + stage + empty thumb bar)

**Files:**
- Modify: `index.html:253-270` (the `#lightbox` block)
- Modify: `styles.css:265-320` (`.carousel-caption`/`.carousel-dots` block — **do not touch**, these are box-side and stay; read only to confirm you're not duplicating class names)
- Modify: `styles.css:334-508` (`.lightbox` through the `:where(...)` focus-visible rule)
- Modify: `script.js:80-94` (lightbox element variable declarations)
- Modify: `script.js:152-170` (`showLightboxSlide`)
- Modify: `script.js:223-362` (`openLightbox`)
- Modify: `script.js:379-430` (`closeLightbox`)

**Interfaces:**
- Produces: `lightboxTitle` (replaces `lightboxCaption`), `lightboxThumbsTrack` (replaces `lightboxDots`) — both `var`s at the top of the IIFE, used by every later task.
- Consumes: existing `resolveSlideSrc(img)`, `setFadeOpacity(el, opacity, ms)`, `applyRect`/`clearRect`/`rectRelativeTo`, `CAPTION_FADE_OUT_MS`/`CAPTION_FADE_IN_DELAY_MS`/`CAPTION_FADE_IN_MS`/`TRANSITION_MS` — unchanged.

- [ ] **Step 1: Replace the `#lightbox` markup in `index.html`**

Replace lines 253-270 (the whole `<div class="lightbox" ...>...</div>` block) with:

```html
  <div class="lightbox" id="lightbox" hidden>
    <div class="lightbox-header">
      <h2 class="lightbox-title" id="lightbox-title"></h2>
      <button type="button" class="lightbox-close" id="lightbox-close" aria-label="Close fullscreen gallery">&times;</button>
    </div>
    <div class="lightbox-stage" id="lightbox-inner">
      <div class="lightbox-slides" id="lightbox-slides"></div>
      <button type="button" class="lightbox-nav lightbox-nav--prev" id="lightbox-prev" aria-label="Previous slide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button type="button" class="lightbox-nav lightbox-nav--next" id="lightbox-next" aria-label="Next slide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
    <div class="lightbox-thumbs">
      <ul class="lightbox-thumbs-track" id="lightbox-thumbs" aria-label="Choose a photo"></ul>
    </div>
  </div>
```

Note `id="lightbox-inner"` is kept on the stage `<div>` (only its class changes) so no JS variable rename is needed for the FLIP animation target.

- [ ] **Step 2: Replace the lightbox CSS block in `styles.css`**

Replace lines 334-503 (from `.lightbox {` through the closing `}` of `.lightbox-nav[hidden]`) with:

```css
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0);
  pointer-events: none;
}

.lightbox.is-visible {
  background: rgba(0, 0, 0, 0.92);
  pointer-events: auto;
}

.lightbox[hidden] {
  display: none;
}

body.lightbox-open {
  overflow: hidden;
}

.lightbox-header {
  flex: 0 0 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1.5rem;
}

.lightbox-title {
  margin: 0;
  color: #fff;
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.lightbox-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 1.75rem;
  line-height: 1;
  cursor: pointer;
}

.lightbox-close:hover {
  color: rgba(255, 255, 255, 0.7);
}

.lightbox-stage {
  position: relative;
  flex: 1;
  min-height: 0;
}

.lightbox-slides {
  position: absolute;
  inset: 0;
}

.lightbox-slide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius);
  opacity: 0;
  transition: opacity 0.6s ease;
}

.lightbox-slide.is-active {
  opacity: 1;
  z-index: 1;
}

.lightbox-nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  transform: translateY(-50%);
}

.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.24);
}

.lightbox-nav svg {
  width: 24px;
  height: 24px;
}

.lightbox-nav--prev {
  left: 1rem;
}

.lightbox-nav--next {
  right: 1rem;
}

.lightbox-nav[hidden] {
  display: none;
}

.lightbox-thumbs {
  flex: 0 0 90px;
  height: 90px;
}

.lightbox-thumbs-track {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  margin: 0;
  padding: 0 1rem;
  list-style: none;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.lightbox-thumb {
  flex: none;
  scroll-snap-align: center;
}

.lightbox-thumb button {
  display: block;
  height: 64px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  opacity: 0.55;
  cursor: pointer;
  transition: opacity 220ms ease, box-shadow 220ms ease;
}

.lightbox-thumb button:hover,
.lightbox-thumb button:focus-visible {
  opacity: 1;
}

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

Then find the `:where(...)` focus-visible rule (was at line ~505, now shifted) and replace `.lightbox-dot` with `.lightbox-thumb button` in its selector list:

```css
:where(.carousel-trigger, .carousel-dot, .lightbox-close, .lightbox-thumb button, .lightbox-nav, .theme-toggle):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Update the lightbox element variable declarations in `script.js`**

Replace lines 82-88:

```js
  var lightboxSlides = document.getElementById('lightbox-slides');
  var lightboxDots = document.getElementById('lightbox-dots');
  var lightboxCaption = document.getElementById('lightbox-caption');
  var lightboxClose = document.getElementById('lightbox-close');
  var lightboxPrev = document.getElementById('lightbox-prev');
  var lightboxNext = document.getElementById('lightbox-next');
  var lightboxInner = document.getElementById('lightbox-inner');
```

with:

```js
  var lightboxSlides = document.getElementById('lightbox-slides');
  var lightboxThumbsTrack = document.getElementById('lightbox-thumbs');
  var lightboxTitle = document.getElementById('lightbox-title');
  var lightboxClose = document.getElementById('lightbox-close');
  var lightboxPrev = document.getElementById('lightbox-prev');
  var lightboxNext = document.getElementById('lightbox-next');
  var lightboxInner = document.getElementById('lightbox-inner');
```

- [ ] **Step 4: Update `showLightboxSlide` to drop dots (thumbnails come in Task 2)**

Replace the whole function (lines 152-170):

```js
  function showLightboxSlide(index) {
    var slides = lightboxSlides.querySelectorAll('img');
    if (!slides.length) {
      return;
    }
    var resolved = (index + slides.length) % slides.length;
    slides.forEach(function (slide, n) {
      slide.classList.toggle('is-active', n === resolved);
    });
    resolveSlideSrc(slides[resolved]);
    if (slides.length > 1) {
      // Load one slide ahead so the next nav/autoplay tick never shows a blank frame.
      resolveSlideSrc(slides[(resolved + 1) % slides.length]);
    }
  }
```

(Task 2 adds the thumbnail active-state/resolve/scroll logic back in here.)

- [ ] **Step 5: Update `openLightbox` — drop dot-building, add header title**

In the interrupted-carousel cleanup block (was lines 232-241), no change needed — it still references `.carousel-caption`/`.carousel-dots` on the **box**, which are untouched.

Replace the dot-building loop inside the `boxSlides.forEach` (lines 260-283) — remove the dot-creation block, keep only slide creation:

```js
    boxSlides.forEach(function (slide, n) {
      var img = document.createElement('img');
      img.className = 'lightbox-slide';
      img.alt = slide.alt;
      // Only the slide being opened into fetches immediately — the rest carry
      // data-src and resolve lazily via showLightboxSlide as they're navigated to.
      if (n === startIndex) {
        img.src = slide.dataset.src;
      } else {
        img.dataset.src = slide.dataset.src;
      }
      lightboxSlides.appendChild(img);
    });
```

Replace `lightboxSlides.innerHTML = ''; lightboxDots.innerHTML = '';` (line 257-258) with just:

```js
    lightboxSlides.innerHTML = '';
```

Replace the caption-building block (lines 288-303):

```js
    lightboxCaption.innerHTML = '';
    if (title) {
      var h2 = document.createElement('h2');
      h2.textContent = title.textContent;
      lightboxCaption.appendChild(h2);
    }
    if (description) {
      var p = document.createElement('p');
      p.textContent = description.textContent;
      lightboxCaption.appendChild(p);
    }
    // Stay invisible until the image finishes scaling up to fullscreen (see
    // the fade-in scheduled below) — otherwise they pop in at full size while
    // the image is still small, looking like unrelated things loading in.
    setFadeOpacity(lightboxCaption, 0, 0);
    setFadeOpacity(lightboxDots, 0, 0);
```

with:

```js
    lightboxTitle.textContent = title ? title.textContent : '';
    // Stay invisible until the image finishes scaling up to fullscreen (see
    // the fade-in scheduled below) — otherwise it pops in at full size while
    // the image is still small, looking like an unrelated thing loading in.
    setFadeOpacity(lightboxTitle, 0, 0);
    setFadeOpacity(lightboxThumbsTrack, 0, 0);
```

`description` is no longer read for the header (title only, per spec) but the `var description = root.querySelector('p');` declaration (line 248) can stay — it's unused now and should be deleted:

Delete line 248 (`var description = root.querySelector('p');`).

Update the two `setFadeOpacity(lightboxCaption/lightboxDots, ...)` calls in the `prefersReducedMotion`/timeout block (lines 342-358):

```js
    if (prefersReducedMotion) {
      startLightboxAutoplay();
      setFadeOpacity(lightboxTitle, 1, 0);
      setFadeOpacity(lightboxThumbsTrack, 1, 0);
    } else {
      pendingTransitionTimeout = window.setTimeout(function () {
        if (targetImg) {
          targetImg.style.transition = '';
        }
        pendingTransitionTimeout = null;
        startLightboxAutoplay();
        pendingCaptionTimeout = window.setTimeout(function () {
          setFadeOpacity(lightboxTitle, 1, CAPTION_FADE_IN_MS);
          setFadeOpacity(lightboxThumbsTrack, 1, CAPTION_FADE_IN_MS);
          pendingCaptionTimeout = null;
        }, CAPTION_FADE_IN_DELAY_MS);
      }, TRANSITION_MS);
    }
```

- [ ] **Step 6: Update `closeLightbox` — rename fade targets**

Replace the two `setFadeOpacity(lightboxCaption/lightboxDots, 0, ...)` lines (lines 395-396):

```js
    setFadeOpacity(lightboxTitle, 0, prefersReducedMotion ? 0 : CAPTION_FADE_OUT_MS);
    setFadeOpacity(lightboxThumbsTrack, 0, prefersReducedMotion ? 0 : CAPTION_FADE_OUT_MS);
```

No other changes needed in `closeLightbox` — the box-side `boxCaption`/`boxDots` fade logic (lines 401-406, 415-428) is untouched.

- [ ] **Step 7: Write and run the verification script**

Create `/tmp/lightbox-verify/verify.js`:

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:8934/index.html');
  await page.waitForTimeout(1200);

  await page.click('section[data-name="illustration"] .carousel-trigger');
  await page.waitForTimeout(700);

  const layout = await page.evaluate(() => {
    const header = document.querySelector('.lightbox-header');
    const stage = document.querySelector('.lightbox-stage');
    const thumbs = document.querySelector('.lightbox-thumbs');
    const title = document.getElementById('lightbox-title');
    return {
      headerHeight: header.getBoundingClientRect().height,
      thumbsHeight: thumbs.getBoundingClientRect().height,
      stageWidth: stage.getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
      titleText: title.textContent,
      titleOpacity: getComputedStyle(title).opacity,
    };
  });
  console.log('Layout after open (700ms):', layout);

  await page.waitForTimeout(500); // let title fade-in (starts at 600ms, 250ms duration) finish
  const titleOpacityAfter = await page.evaluate(
    () => getComputedStyle(document.getElementById('lightbox-title')).opacity
  );
  console.log('Title opacity at 1200ms:', titleOpacityAfter);

  await page.screenshot({ path: '/tmp/lightbox-verify/task1.png' });
  console.log('Console/page errors:', errors);
  await browser.close();
})();
```

Run it per the Verification Setup section above.

Expected output:
- `headerHeight: 60`
- `thumbsHeight: 90`
- `stageWidth` equal to `viewportWidth` (full-width stage — 1400 in this viewport)
- `titleText: 'Illustration'`
- `titleOpacity` at 700ms is less than 1 (still fading in or not yet started — fade-in begins at 600ms post-open)
- `titleOpacityAfter` (at 1200ms) is `'1'`
- `errors` is `[]`

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css script.js
git commit -m "$(cat <<'EOF'
Restructure lightbox into header/stage/thumb-bar layout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Build thumbnail content, click-to-navigate, active highlighting

**Files:**
- Modify: `script.js` — `openLightbox` (thumbnail-building loop) and `showLightboxSlide` (active-state + lazy resolve)

**Interfaces:**
- Consumes: `lightboxThumbsTrack` (from Task 1), `resolveSlideSrc(img)`, `goToLightboxSlide(index)`, `startLightboxAutoplay()`.
- Produces: `.lightbox-thumb` `<li>` elements each containing a `<button aria-label="Photo N of M"><img></button>`, with `aria-current="true"` on the currently active one — consumed by Task 3 (autoscroll) and Task 4 (visual QA).

- [ ] **Step 1: Add thumbnail-building to `openLightbox`**

In the `boxSlides.forEach` loop from Task 1 Step 5, add thumbnail creation alongside the slide creation:

```js
    boxSlides.forEach(function (slide, n) {
      var img = document.createElement('img');
      img.className = 'lightbox-slide';
      img.alt = slide.alt;
      if (n === startIndex) {
        img.src = slide.dataset.src;
      } else {
        img.dataset.src = slide.dataset.src;
      }
      lightboxSlides.appendChild(img);

      var thumbImg = document.createElement('img');
      thumbImg.alt = '';
      thumbImg.loading = 'lazy';
      thumbImg.decoding = 'async';
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
      lightboxThumbsTrack.appendChild(thumbItem);
    });
```

And clear the track alongside the slides at the top of `openLightbox` (where `lightboxSlides.innerHTML = '';` was set in Task 1 Step 5):

```js
    lightboxSlides.innerHTML = '';
    lightboxThumbsTrack.innerHTML = '';
```

- [ ] **Step 2: Add active-state + lazy resolve to `showLightboxSlide`**

Replace the Task-1 version of `showLightboxSlide` with:

```js
  function showLightboxSlide(index) {
    var slides = lightboxSlides.querySelectorAll('img');
    var thumbs = lightboxThumbsTrack.querySelectorAll('button');
    if (!slides.length) {
      return;
    }
    var resolved = (index + slides.length) % slides.length;
    slides.forEach(function (slide, n) {
      slide.classList.toggle('is-active', n === resolved);
    });
    resolveSlideSrc(slides[resolved]);
    if (slides.length > 1) {
      // Load one slide ahead so the next nav/autoplay tick never shows a blank frame.
      resolveSlideSrc(slides[(resolved + 1) % slides.length]);
    }
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
  }
```

- [ ] **Step 3: Write and run the verification script**

Create `/tmp/lightbox-verify/verify.js` (overwrite):

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:8934/index.html');
  await page.waitForTimeout(1200);

  await page.click('section[data-name="illustration"] .carousel-trigger');
  await page.waitForTimeout(700);

  const thumbCount = await page.locator('.lightbox-thumb').count();
  console.log('Thumbnail count (expect 5):', thumbCount);

  const activeBefore = await page.evaluate(
    () => document.querySelector('.lightbox-thumb button[aria-current="true"]').getAttribute('aria-label')
  );
  console.log('Active thumb before click:', activeBefore);

  // Click the 3rd thumbnail.
  await page.locator('.lightbox-thumb button').nth(2).click();
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => {
    const activeThumb = document.querySelector('.lightbox-thumb button[aria-current="true"]');
    const activeSlide = document.querySelector('.lightbox-slide.is-active');
    const thumbImgs = Array.from(document.querySelectorAll('.lightbox-thumb img')).map((img) => ({
      hasSrc: !!img.getAttribute('src'),
    }));
    return {
      activeThumbLabel: activeThumb.getAttribute('aria-label'),
      activeSlideSrc: activeSlide.getAttribute('src'),
      thumbImgs,
    };
  });
  console.log('After clicking 3rd thumbnail:', state);
  console.log('Console/page errors:', errors);
  await browser.close();
})();
```

Expected output:
- `thumbCount: 5`
- `activeBefore: 'Photo 1 of 5'`
- `activeThumbLabel: 'Photo 3 of 5'`
- `activeSlideSrc` ends in `id=3` (matches the box's slide 3 URL)
- `thumbImgs`: indices 0, 1 (prefetched before the click), 2 (clicked), and 3 (prefetched-next after the click) have `hasSrc: true`; index 4 has `hasSrc: false` (never visited or prefetched)
- `errors` is `[]`

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "$(cat <<'EOF'
Build lightbox thumbnails with click-to-navigate and active highlighting

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Thumbnail autoscroll with "hands on strip" quiet window

**Files:**
- Modify: `script.js` — add quiet-window tracking, thread an `isAutoplayDriven` flag from autoplay through to `showLightboxSlide`.

**Interfaces:**
- Consumes: `lightboxThumbsTrack`, `prefersReducedMotion`.
- Produces: `maybeScrollThumbIntoView(thumbButton, isAutoplayDriven)` (module-scope function); `goToLightboxSlide(index, isAutoplayDriven)` and `initCarousel`'s internal `show(next, isAutoplayDriven)` gain a second parameter (backward-compatible — existing single-argument call sites are unaffected since the parameter is optional/falsy by default).

- [ ] **Step 1: Add quiet-window state and the scroll helper**

Add near the top of the IIFE, after the `CAPTION_FADE_IN_MS` constant (script.js line 78):

```js
  var THUMB_QUIET_MS = 5000;
  var lastThumbInteraction = 0;
```

Add a new function right after `resolveSlideSrc` (script.js, after line 147):

```js
  function markThumbInteraction() {
    lastThumbInteraction = Date.now();
  }

  // Keeps the active thumbnail visible as slides change. Autoplay-driven
  // changes skip the auto-scroll if the visitor touched the strip in the
  // last THUMB_QUIET_MS, so it doesn't get yanked out from under them while
  // they're browsing thumbnails by hand.
  function maybeScrollThumbIntoView(thumbButton, isAutoplayDriven) {
    if (!thumbButton) {
      return;
    }
    if (isAutoplayDriven && Date.now() - lastThumbInteraction < THUMB_QUIET_MS) {
      return;
    }
    thumbButton.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest'
    });
  }
```

- [ ] **Step 2: Wire up interaction tracking on the thumbnail track**

Add right after the `var lightboxThumbsTrack = document.getElementById('lightbox-thumbs');` declaration:

```js
  lightboxThumbsTrack.addEventListener('wheel', markThumbInteraction);
  lightboxThumbsTrack.addEventListener('touchmove', markThumbInteraction);
  lightboxThumbsTrack.addEventListener('pointerdown', markThumbInteraction);
```

(Deliberately not `scroll` — `scrollIntoView` itself fires a `scroll` event, which would make the strip think it was touched every time it auto-centers.)

- [ ] **Step 3: Thread `isAutoplayDriven` through the navigation call chain**

Update `goToLightboxSlide` (script.js lines 175-179):

```js
  function goToLightboxSlide(index, isAutoplayDriven) {
    if (activeCarouselRoot && activeCarouselRoot._carouselShow) {
      activeCarouselRoot._carouselShow(index, isAutoplayDriven);
    }
  }
```

Update `startLightboxAutoplay`'s interval callback (script.js lines 193-197) to mark this call as autoplay-driven:

```js
    lightboxTimer = window.setInterval(function () {
      if (activeCarouselRoot && activeCarouselRoot._carouselIndex) {
        goToLightboxSlide(activeCarouselRoot._carouselIndex() + 1, true);
      }
    }, AUTOPLAY_MS);
```

Update `initCarousel`'s `show` and `advance` (script.js lines 516-539):

```js
    function show(next, isAutoplayDriven) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, n) {
        slide.classList.toggle('is-active', n === index);
      });
      resolveSlideSrc(slides[index]);
      if (slides.length > 1) {
        // Load one slide ahead so the next nav/autoplay tick never shows a blank frame.
        resolveSlideSrc(slides[(index + 1) % slides.length]);
      }
      dots.forEach(function (dot, n) {
        dot.classList.toggle('is-active', n === index);
      });
      // Mirror into the lightbox whenever this box's fullscreen view is open,
      // so the two never drift — closing always animates the slide the
      // visitor was just looking at.
      if (activeCarouselRoot === root) {
        showLightboxSlide(index, isAutoplayDriven);
      }
    }

    var advance = function () {
      show(index + 1);
    };
```

(`advance` stays single-argument — it's used by the global box-rotation stagger, which never runs against the currently-open lightbox's carousel since `pauseBoxAutoplay` removes it from rotation while open.)

- [ ] **Step 4: Use the flag in `showLightboxSlide`**

Update the signature and add the autoscroll call (script.js, the function from Task 2 Step 2):

```js
  function showLightboxSlide(index, isAutoplayDriven) {
    var slides = lightboxSlides.querySelectorAll('img');
    var thumbs = lightboxThumbsTrack.querySelectorAll('button');
    if (!slides.length) {
      return;
    }
    var resolved = (index + slides.length) % slides.length;
    slides.forEach(function (slide, n) {
      slide.classList.toggle('is-active', n === resolved);
    });
    resolveSlideSrc(slides[resolved]);
    if (slides.length > 1) {
      resolveSlideSrc(slides[(resolved + 1) % slides.length]);
    }
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
    maybeScrollThumbIntoView(thumbs[resolved], isAutoplayDriven);
  }
```

- [ ] **Step 5: Write and run the verification script**

Create `/tmp/lightbox-verify/verify.js` (overwrite):

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 500, height: 900 } }); // narrow, so the 5-thumb strip actually overflows and can scroll
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:8934/index.html');
  await page.waitForTimeout(1200);

  // Count scrollIntoView calls on thumbnail buttons.
  await page.exposeFunction('recordScrollIntoView', () => {});
  await page.evaluate(() => {
    window.__scrollCalls = 0;
    const orig = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (...args) {
      if (this.closest('.lightbox-thumb')) {
        window.__scrollCalls++;
      }
      return orig.apply(this, args);
    };
  });

  await page.click('section[data-name="illustration"] .carousel-trigger');
  await page.waitForTimeout(700);

  const afterOpen = await page.evaluate(() => window.__scrollCalls);
  console.log('scrollIntoView calls right after open (expect >= 1, for the opened slide):', afterOpen);

  // Simulate "hands on strip": dispatch pointerdown on the track.
  await page.evaluate(() => {
    document.getElementById('lightbox-thumbs').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });

  // User-driven navigation (thumb click) should still scroll even right after touching the strip.
  await page.locator('.lightbox-thumb button').nth(3).click();
  await page.waitForTimeout(200);
  const afterUserClick = await page.evaluate(() => window.__scrollCalls);
  console.log('scrollIntoView calls after user thumb click post-interaction (expect increase):', afterUserClick);

  // Now simulate an autoplay-driven advance within the 5s quiet window — should NOT scroll.
  const beforeAutoplaySim = await page.evaluate(() => window.__scrollCalls);
  await page.evaluate(() => {
    // Call the same code path startLightboxAutoplay's interval uses, without waiting 4s for the real timer.
    window.__testGoToLightboxSlideAutoplay = true;
  });
  // We can't call internal closures directly, so instead verify via the real autoplay timer:
  // wait for one AUTOPLAY_MS tick (4000ms) and confirm no new scrollIntoView call fired.
  await page.waitForTimeout(4300);
  const afterAutoplayTick = await page.evaluate(() => window.__scrollCalls);
  console.log('scrollIntoView calls before/after one autoplay tick inside quiet window:', beforeAutoplaySim, afterAutoplayTick, '(expect equal — suppressed)');

  console.log('Console/page errors:', errors);
  await browser.close();
})();
```

Expected output:
- `afterOpen >= 1` (opening scrolls the first thumbnail into view — it's not autoplay-driven, so it's never suppressed).
- `afterUserClick` is greater than `afterOpen` (a direct thumb click always scrolls, even though the strip was just "touched").
- `beforeAutoplaySim` equals `afterAutoplayTick` (the autoplay tick that lands ~4s after the `pointerdown` is still inside the 5s quiet window, so it's suppressed).
- `errors` is `[]`

Note: if this run happens to land the autoplay tick just outside the 5s window due to timing slack, re-run — the 300ms margin in `waitForTimeout(4300)` should keep it comfortably inside, but this is real-clock timing, not mocked.

- [ ] **Step 6: Commit**

```bash
git add script.js
git commit -m "$(cat <<'EOF'
Add thumbnail autoscroll with hands-on-strip quiet window

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Cross-check regressions and finalize

**Files:** none expected to change unless a check below surfaces a bug — this task is verification-only.

**Interfaces:** none new.

- [ ] **Step 1: Verify FLIP open/close animation still lands correctly on the new stage**

Reuse the pattern from this repo's existing open/close transition tests: write `/tmp/lightbox-verify/verify.js`:

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:8934/index.html');
  await page.waitForTimeout(1200);

  await page.click('section[data-name="illustration"] .carousel-trigger');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/lightbox-verify/task4_open.png' });

  await page.click('#lightbox-close');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/lightbox-verify/task4_closed.png' });

  const boxVisible = await page.evaluate(() => {
    const box = document.querySelector('section[data-name="illustration"] .carousel-slide.is-active');
    const rect = box.getBoundingClientRect();
    return rect.width > 0 && getComputedStyle(box.closest('.carousel')).visibility === 'visible';
  });
  console.log('Box carousel visible again after close:', boxVisible);
  console.log('Console/page errors:', errors);
  await browser.close();
})();
```

Read both screenshots (`task4_open.png`, `task4_closed.png`) with the Read tool and confirm: the open screenshot shows a full-bleed image with the 60px header (title + close) and 90px thumbnail strip, no leftover centered-box padding; the closed screenshot shows the normal grid with no stray lightbox artifacts. `boxVisible` must be `true`.

- [ ] **Step 2: Verify dark mode**

Write `/tmp/lightbox-verify/verify.js` (overwrite):

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: 'dark' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:8934/index.html');
  await page.waitForTimeout(1200);

  await page.click('section[data-name="illustration"] .carousel-trigger');
  await page.waitForTimeout(1300); // let the full open + fade-in sequence settle
  await page.screenshot({ path: '/tmp/lightbox-verify/task4_dark.png' });

  console.log('Console/page errors:', errors);
  await browser.close();
})();
```

Read `/tmp/lightbox-verify/task4_dark.png` with the Read tool and confirm the header and thumbnail bar backgrounds still read as one continuous dark panel with the image area (no visible seam or mismatched color), same as in light mode.

- [ ] **Step 3: Verify `prefers-reduced-motion`**

Write `/tmp/lightbox-verify/verify.js` (overwrite):

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:8934/index.html');
  await page.waitForTimeout(1200);

  await page.click('section[data-name="illustration"] .carousel-trigger');
  await page.waitForTimeout(100); // reduced motion should already be at final state well before TRANSITION_MS (500ms) would normally finish

  const state = await page.evaluate(() => {
    const title = document.getElementById('lightbox-title');
    const thumbs = document.querySelector('.lightbox-thumbs-track');
    const activeSlide = document.querySelector('.lightbox-slide.is-active');
    return {
      titleOpacity: getComputedStyle(title).opacity,
      thumbsOpacity: getComputedStyle(thumbs).opacity,
      slideTransition: activeSlide.style.transition,
    };
  });
  console.log('Reduced-motion state 100ms after open:', state);
  console.log('Console/page errors:', errors);
  await browser.close();
})();
```

Expected: `titleOpacity: '1'`, `thumbsOpacity: '1'`, `slideTransition: ''` (no transition applied — the FLIP animation is skipped entirely under reduced motion, matching today's behavior).

- [ ] **Step 4: Verify keyboard and prev/next navigation still work**

Write `/tmp/lightbox-verify/verify.js` (overwrite):

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:8934/index.html');
  await page.waitForTimeout(1200);

  await page.click('section[data-name="illustration"] .carousel-trigger');
  await page.waitForTimeout(700);

  async function activeState() {
    return page.evaluate(() => ({
      slideSrc: document.querySelector('.lightbox-slide.is-active').getAttribute('src'),
      thumbLabel: document.querySelector('.lightbox-thumb button[aria-current="true"]').getAttribute('aria-label'),
    }));
  }

  console.log('Initial:', await activeState());

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  console.log('After ArrowRight:', await activeState());

  await page.click('#lightbox-next');
  await page.waitForTimeout(200);
  console.log('After #lightbox-next click:', await activeState());

  await page.click('#lightbox-prev');
  await page.waitForTimeout(200);
  console.log('After #lightbox-prev click:', await activeState());

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);
  console.log('After ArrowLeft:', await activeState());

  console.log('Console/page errors:', errors);
  await browser.close();
})();
```

Expected: starting at "Photo 1 of 5", each step's `thumbLabel` matches the slide number implied by the sequence (2, 3, 2, 1), and `slideSrc`'s `id=N` query param always matches that same number — confirming the active slide and active thumbnail never drift apart under any navigation method.

- [ ] **Step 5: Check `TODO.md` for a matching line to check off**

```bash
grep -n -i "thumbnail\|fullscreen" /Users/peterlockhart/projects/peterjlockhart/TODO.md
```

If a line describing this work exists and the file's convention is to mark completed items (check existing checked/unchecked items in the file for the pattern), update it accordingly and include it in the final commit.

- [ ] **Step 6: Final commit (only if Step 5 changed anything)**

```bash
git add TODO.md
git commit -m "$(cat <<'EOF'
Check off completed TODO item for lightbox thumbnail redesign

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
