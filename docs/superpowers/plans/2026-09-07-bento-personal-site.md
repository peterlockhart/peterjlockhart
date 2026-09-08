# Bento Personal Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, responsive bento-box personal site at the repo root (`index.html`, `styles.css`, `script.js`, `CNAME`) ready for GitHub Pages, replacing the linktr.ee redirect at peterjlockhart.com.

**Architecture:** Single static HTML page with a CSS Grid "bento" layout. Ten boxes (About, Social, Family, Sparrow Sleeps, Foxio, Illustration, Branding, Woodworking, Welding, Home Renovations) are laid out with `grid-auto-flow: dense`, size variants via modifier classes, and breakpoints that collapse to a single column on phones. Colors are CSS custom properties swapped automatically via `prefers-color-scheme`. No build step, no JS framework, no backend.

**Tech Stack:** Plain HTML5, CSS3 (Grid, custom properties, media queries). No dependencies, no CDN, no build tooling.

**Spec:** `docs/superpowers/specs/2026-09-07-bento-personal-site-design.md`

## Global Constraints

- No build step, no external dependencies (no CDN links, no icon libraries) — everything inline or local.
- All 10 boxes: About me, Social links, Family, Sparrow Sleeps, Foxio, Illustration, Branding, Woodworking, Welding, Home Renovations. Spokenote is explicitly excluded from this pass.
- Colors must be defined as CSS custom properties on `:root`; dark mode is driven only by `prefers-color-scheme` (no manual toggle).
- Icons are hand-rolled inline SVG using `stroke="currentColor"` (no `fill` colors baked in) so they follow the theme.
- Social URLs (use exactly): Instagram `https://instagram.com/peterlockhart`, Facebook `https://facebook.com/peterlockhart`, GitHub `https://github.com/peterlockhart`, Dribbble `https://dribbble.com/peterlockhart`.
- Company URLs: Sparrow Sleeps `https://sparrowsleeps.com`, Foxio `https://fox.io`.
- Single column, full-width stacked boxes below 600px viewport width; no horizontal overflow at any width.

---

### Task 1: Project scaffold

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `script.js`
- Create: `CNAME`
- Create: `assets/.gitkeep`

**Interfaces:**
- Produces: `index.html` linking `styles.css` (`<link rel="stylesheet" href="styles.css">`) and `script.js` (`<script src="script.js" defer></script>`), with a `<main class="bento">` element that later tasks populate with `<section class="box ...">` children.

- [ ] **Step 1: Create `index.html` with the page skeleton**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Peter Lockhart</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="bento">
  </main>
  <script src="script.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: Create empty `styles.css` and `script.js`**

`styles.css`:
```css
/* Bento personal site styles */
```

`script.js`:
```js
// No interactivity needed for this pass.
```

- [ ] **Step 3: Create `CNAME` for the custom domain**

```
peterjlockhart.com
```

(No trailing newline requirements — a single line with just the domain.)

- [ ] **Step 4: Create `assets/` directory placeholder**

Create `assets/.gitkeep` (empty file) so the directory is tracked in git for future images.

- [ ] **Step 5: Verify the scaffold**

Run:
```bash
test -f index.html && test -f styles.css && test -f script.js && test -f CNAME && test -f assets/.gitkeep && echo OK
grep -q '<main class="bento">' index.html && echo "grid container present"
cat CNAME
```
Expected: `OK`, `grid container present`, and `CNAME` prints `peterjlockhart.com`.

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css script.js CNAME assets/.gitkeep
git commit -m "Scaffold static site files for GitHub Pages"
```

---

### Task 2: Design tokens and base styles

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: CSS custom properties `--bg`, `--surface`, `--text`, `--text-muted`, `--border`, `--shadow`, `--accent`, `--radius`, `--gap`, `--font` on `:root`, redefined inside `@media (prefers-color-scheme: dark)`. Later tasks (grid, boxes, icons) rely on these exact variable names.

- [ ] **Step 1: Add design tokens and base reset to `styles.css`**

Replace the file's contents with:

```css
/* Bento personal site styles */

:root {
  --bg: #f7f6f3;
  --surface: #ffffff;
  --text: #1a1a1a;
  --text-muted: #5a5a5a;
  --border: #e2e0da;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  --accent: #2f6fed;
  --radius: 14px;
  --gap: 1rem;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a;
    --surface: #1d2025;
    --text: #f2f1ee;
    --text-muted: #a8a8a8;
    --border: #2c2f36;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    --accent: #6d9dff;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  padding: clamp(1rem, 4vw, 2.5rem);
}
```

- [ ] **Step 2: Verify the tokens are present**

Run:
```bash
grep -c -- '--bg:' styles.css
grep -q 'prefers-color-scheme: dark' styles.css && echo "dark mode block present"
```
Expected: `2` (one in `:root`, one in the dark media block) and `dark mode block present`.

- [ ] **Step 3: Manual visual check**

Open `index.html` directly in a browser (`open index.html` on macOS). Confirm the background is the light off-white tone. In the browser devtools, toggle "Emulate CSS prefers-color-scheme: dark" (Chrome/Firefox devtools rendering panel) and confirm the background switches to the dark tone.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Add design tokens and base reset styles"
```

---

### Task 3: Bento grid system and responsive breakpoints

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `--gap`, `--surface`, `--border`, `--radius`, `--shadow`, `--text`, `--text-muted` custom properties from Task 2.
- Produces: `.bento` grid container, `.box` base card class, size modifiers `.box--about` (2 cols × 2 rows) and `.box--family` (1 col × 2 rows). Later tasks add content inside `<section class="box ...">` elements; they must reuse these exact class names.

- [ ] **Step 1: Add ten empty placeholder boxes inside `<main class="bento">` in `index.html`**

```html
  <main class="bento">
    <section class="box box--about" data-name="about"></section>
    <section class="box box--social" data-name="social"></section>
    <section class="box box--family" data-name="family"></section>
    <section class="box" data-name="sparrow-sleeps"></section>
    <section class="box" data-name="foxio"></section>
    <section class="box" data-name="illustration"></section>
    <section class="box" data-name="branding"></section>
    <section class="box" data-name="woodworking"></section>
    <section class="box" data-name="welding"></section>
    <section class="box" data-name="home-renovations"></section>
  </main>
```

- [ ] **Step 2: Add grid CSS to `styles.css`**

Append:

```css
.bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(140px, auto);
  grid-auto-flow: dense;
  gap: var(--gap);
  max-width: 1100px;
  margin: 0 auto;
}

.box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.box--about {
  grid-column: span 2;
  grid-row: span 2;
}

.box--family {
  grid-row: span 2;
}

@media (max-width: 899px) {
  .bento {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 599px) {
  .bento {
    grid-template-columns: 1fr;
  }

  .box,
  .box--about,
  .box--family {
    grid-column: span 1;
    grid-row: span 1;
  }
}
```

- [ ] **Step 3: Verify structure**

Run:
```bash
grep -c 'class="box' index.html
```
Expected: `10`.

- [ ] **Step 4: Manual responsive check**

Open `index.html` in a browser and use devtools responsive mode at three widths:
- **1200px** — expect 4 columns; the about box visibly spans 2 columns and 2 rows; the family box spans 2 rows.
- **700px** — expect 2 columns.
- **375px** — expect a single column, every box full-width, no horizontal scrollbar.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css
git commit -m "Add bento grid container and responsive breakpoints"
```

---

### Task 4: About me and Family content

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `.box--about`, `.box--family` from Task 3; `--text-muted` from Task 2.
- Produces: `.box h1`, `.box h2`, `.box p` text styles reused by every later content task.

- [ ] **Step 1: Fill in the About and Family boxes in `index.html`**

```html
    <section class="box box--about" data-name="about">
      <h1>Peter Lockhart</h1>
      <p>
        Hi, I'm Peter — this is placeholder bio copy. Swap this out for a
        couple of sentences about what you do, what you're into, and what
        you want a first-time visitor to know about you.
      </p>
    </section>
    <section class="box box--social" data-name="social"></section>
    <section class="box box--family" data-name="family">
      <h2>Family</h2>
      <p>
        Consuelo and our four pets keep life interesting. More about this
        crew — names, photos, stories — coming soon.
      </p>
    </section>
```

- [ ] **Step 2: Add text styles to `styles.css`**

Append:

```css
.box h1 {
  margin: 0;
  font-size: 1.6rem;
}

.box h2 {
  margin: 0;
  font-size: 1.05rem;
}

.box p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}
```

- [ ] **Step 3: Verify content is present**

Run:
```bash
grep -q '<h1>Peter Lockhart</h1>' index.html && echo "about heading present"
grep -q 'Consuelo and our four pets' index.html && echo "family copy present"
```
Expected: both lines print.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "Add About me and Family box content"
```

---

### Task 5: Social links box with inline SVG icons

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `.box--social` from Task 3; `--text`, `--accent` from Task 2.
- Produces: `.social-icons` class used only by this box.

- [ ] **Step 1: Fill in the Social box in `index.html`**

```html
    <section class="box box--social" data-name="social">
      <h2>Elsewhere</h2>
      <div class="social-icons">
        <a href="https://instagram.com/peterlockhart" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        </a>
        <a href="https://facebook.com/peterlockhart" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
          </svg>
        </a>
        <a href="https://github.com/peterlockhart" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
          </svg>
        </a>
        <a href="https://dribbble.com/peterlockhart" target="_blank" rel="noopener noreferrer" aria-label="Dribbble">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M5.5 8.5c3.5 1.4 11 1.4 14.5 0"></path>
            <path d="M4.2 15c4-1.4 8-1.2 11 .5 1.6.9 2.8 2.1 3.6 3.3"></path>
            <path d="M9.5 3.2c2.4 3.2 4 7.4 4.3 12 .2 2.3 0 4.2-.4 5.6"></path>
          </svg>
        </a>
      </div>
    </section>
```

- [ ] **Step 2: Add social icon styles to `styles.css`**

Append:

```css
.social-icons {
  display: flex;
  gap: 0.9rem;
  align-items: center;
}

.social-icons a {
  color: var(--text);
  display: inline-flex;
}

.social-icons a:hover {
  color: var(--accent);
}

.social-icons svg {
  width: 26px;
  height: 26px;
}
```

- [ ] **Step 3: Verify links and icon count**

Run:
```bash
grep -c '<svg' index.html
grep -q 'href="https://instagram.com/peterlockhart"' index.html && echo "instagram ok"
grep -q 'href="https://facebook.com/peterlockhart"' index.html && echo "facebook ok"
grep -q 'href="https://github.com/peterlockhart"' index.html && echo "github ok"
grep -q 'href="https://dribbble.com/peterlockhart"' index.html && echo "dribbble ok"
```
Expected: `4` and all four `ok` lines print.

- [ ] **Step 4: Manual check**

Open `index.html` in a browser, confirm four icons render in a row (not broken/empty shapes) and hovering each changes its color to the accent color.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css
git commit -m "Add social links box with inline SVG icons"
```

---

### Task 6: Company and hobby boxes

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `.box`, `.box h2`, `.box p` from Tasks 3–4; `--accent` from Task 2.
- Produces: `.box-link` class used for the two boxes that link out (Sparrow Sleeps, Foxio).

- [ ] **Step 1: Fill in the remaining seven boxes in `index.html`**

```html
    <section class="box" data-name="sparrow-sleeps">
      <h2>Sparrow Sleeps</h2>
      <p>Placeholder description of Sparrow Sleeps goes here.</p>
      <a class="box-link" href="https://sparrowsleeps.com" target="_blank" rel="noopener noreferrer">sparrowsleeps.com</a>
    </section>
    <section class="box" data-name="foxio">
      <h2>Foxio</h2>
      <p>Placeholder description of Foxio goes here.</p>
      <a class="box-link" href="https://fox.io" target="_blank" rel="noopener noreferrer">fox.io</a>
    </section>
    <section class="box" data-name="illustration">
      <h2>Illustration</h2>
      <p>Placeholder description of illustration work goes here.</p>
    </section>
    <section class="box" data-name="branding">
      <h2>Branding</h2>
      <p>Placeholder description of branding work goes here.</p>
    </section>
    <section class="box" data-name="woodworking">
      <h2>Woodworking</h2>
      <p>Placeholder description of woodworking projects goes here.</p>
    </section>
    <section class="box" data-name="welding">
      <h2>Welding</h2>
      <p>Placeholder description of welding projects goes here.</p>
    </section>
    <section class="box" data-name="home-renovations">
      <h2>Home Renovations</h2>
      <p>Placeholder description of home renovation projects goes here.</p>
    </section>
```

- [ ] **Step 2: Add link styles to `styles.css`**

Append:

```css
.box-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
  margin-top: auto;
}

.box-link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: Verify all ten boxes and both company links are present**

Run:
```bash
grep -c 'class="box' index.html
grep -q 'href="https://sparrowsleeps.com"' index.html && echo "sparrow sleeps ok"
grep -q 'href="https://fox.io"' index.html && echo "foxio ok"
grep -c '<h2>' index.html
```
Expected: `10` boxes total, both link lines print, and `9` `<h2>` headings (Social, Family, Sparrow Sleeps, Foxio, Illustration, Branding, Woodworking, Welding, Home Renovations — the About box uses `<h1>` instead, so it's not counted here).

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "Add Sparrow Sleeps, Foxio, and hobby boxes"
```

---

### Task 7: Full-page verification pass

**Files:**
- None (verification only; fix forward in `index.html`/`styles.css` if any check fails).

**Interfaces:**
- Consumes: the completed page from Tasks 1–6.
- Produces: nothing new — this task is a checklist confirming the spec's Testing/Verification section is satisfied.

- [ ] **Step 1: Structural check**

Run:
```bash
grep -c 'class="box' index.html          # expect 10
grep -c '<svg' index.html                # expect 4
grep -c -- '--bg:' styles.css            # expect 2
python3 -c "import html.parser,sys; p=html.parser.HTMLParser(); p.feed(open('index.html').read()); print('parses OK')"
```
Expected: `10`, `4`, `2`, `parses OK` (the last confirms the HTML has no unclosed-tag parse errors).

- [ ] **Step 2: Responsive check in a real browser**

Open `index.html` and check devtools responsive mode at 375px, 700px, and 1200px widths per Task 3 Step 4. Confirm no box overflows its column and there is no horizontal scrollbar at any width.

- [ ] **Step 3: Light/dark check**

Toggle devtools `prefers-color-scheme` emulation between light and dark. Confirm background, card surfaces, text, borders, and the accent/hover color on links and social icons all change together with no illegible (low-contrast) text in either mode.

- [ ] **Step 4: Link check**

Click (or command-click to open in a new tab) each of the 6 outbound links — 4 social icons, Sparrow Sleeps, Foxio — and confirm each opens the correct domain in a new tab.

- [ ] **Step 5: Commit** (only if Step 1–4 required fixes)

If any fix was needed:
```bash
git add index.html styles.css
git commit -m "Fix issues found in verification pass"
```
If no fixes were needed, skip this step — nothing to commit.

---

## Deployment (manual, outside this plan's code changes)

These are GitHub/DNS settings, not files in this repo, so they have no test cycle — do them once after Task 7 passes:

1. Push `main` to GitHub.
2. In the repo's Settings → Pages, set source to "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Confirm the custom domain field picks up `peterjlockhart.com` from the `CNAME` file (GitHub Pages reads it automatically); enable "Enforce HTTPS" once the certificate is issued.
4. Update the domain's DNS (wherever `peterjlockhart.com` is currently configured to redirect to linktr.ee) to point at GitHub Pages instead, per [GitHub's custom domain DNS instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
