# peterjlockhart

Source for [peterjlockhart.com](https://peterjlockhart.com), Peter Lockhart's personal site.

## Overview

A single-page static site: a "bento box" grid of cards (`.box` elements in
[index.html](index.html)) covering an About Me intro, family, pets, side
projects, and photo/illustration carousels. Highlights:

- **Carousels with a fullscreen lightbox.** Boxes with `.box--carousel` cycle
  through slides automatically and can be opened fullscreen. Opening/closing
  uses a FLIP animation (see `openLightbox`/`closeLightbox` in
  [script.js](script.js)) so the clicked photo appears to scale smoothly from
  its position in the grid to fullscreen and back, crop included.
- **Dark/light mode toggle**, defaulting to the visitor's OS preference and
  persisted after that.
- **No build step.** Plain HTML/CSS/JS — no bundler, framework, or package
  manifest.

## Project structure

```
index.html         Markup for all boxes/sections
styles.css          All styling
script.js           Carousel, lightbox, and theme-toggle behavior
assets/             Images
  carousels/<name>/   One folder per carousel box, matching its
                       data-name attribute (e.g. assets/carousels/branding/)
CNAME               GitHub Pages custom domain (peterjlockhart.com)
_config.yml         Jekyll config (excludes README.md/docs from the Pages build)
robots.txt          Blocks TODO.md from being indexed
TODO.md             Working task list (not published)
```

## Local development

There's nothing to install or build. Serve the directory with any static
file server and open it in a browser, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/index.html`.

## Adding a carousel

Each carousel box (`.box--carousel`) is a `data-carousel` element containing
a `.carousel-slides` list of `<img class="carousel-slide">` (only the first
needs a real `src`; the rest use `data-src` and lazy-load), a matching
`.carousel-dots` button per slide, and a `.carousel-trigger` button that
opens the lightbox. Drop the source images in
`assets/carousels/<box-name>/` and write descriptive `alt` text for
accessibility (the visible caption comes from the box's own `<h2>`, shared
by every slide).

## Deployment

Hosted on GitHub Pages with a custom domain (see [CNAME](CNAME)); pushing to
the default branch publishes the site directly, no build step required.
