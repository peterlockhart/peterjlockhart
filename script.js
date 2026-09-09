(function () {
  'use strict';

  var AUTOPLAY_MS = 4000;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var copyrightYear = document.getElementById('copyright-year');
  if (copyrightYear) {
    copyrightYear.textContent = new Date().getFullYear();
  }

  var THEME_KEY = 'theme';
  var darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var themeToggle = document.getElementById('theme-toggle');

  function getStoredTheme() {
    try {
      var stored = window.localStorage.getItem(THEME_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch (e) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // localStorage unavailable (private browsing, etc.) — the choice just won't persist.
    }
  }

  function effectiveTheme() {
    var stored = getStoredTheme();
    if (stored) {
      return stored;
    }
    return darkSchemeQuery.matches ? 'dark' : 'light';
  }

  function updateToggleLabel() {
    if (!themeToggle) {
      return;
    }
    var current = effectiveTheme();
    var target = current === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', 'Switch to ' + target + ' theme');
  }

  function applyTheme(theme) {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    updateToggleLabel();
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      storeTheme(next);
      applyTheme(next);
    });

    darkSchemeQuery.addEventListener('change', function () {
      if (!getStoredTheme()) {
        updateToggleLabel();
      }
    });

    updateToggleLabel();
  }

  var TRANSITION_MS = 500;
  var CAPTION_FADE_OUT_MS = 100;
  var CAPTION_FADE_IN_DELAY_MS = 100;
  var CAPTION_FADE_IN_MS = 250;
  var THUMB_QUIET_MS = 5000;
  var lastThumbInteraction = 0;

  var lightbox = document.getElementById('lightbox');
  lightbox.style.transition = prefersReducedMotion ? 'none' : 'opacity ' + TRANSITION_MS + 'ms ease';
  var lightboxSlides = document.getElementById('lightbox-slides');
  var lightboxThumbsTrack = document.getElementById('lightbox-thumbs');
  lightboxThumbsTrack.addEventListener('wheel', markThumbInteraction, { passive: true });
  lightboxThumbsTrack.addEventListener('touchmove', markThumbInteraction, { passive: true });
  lightboxThumbsTrack.addEventListener('pointerdown', markThumbInteraction, { passive: true });
  var lightboxTitle = document.getElementById('lightbox-title');
  var lightboxClose = document.getElementById('lightbox-close');
  var lightboxPrev = document.getElementById('lightbox-prev');
  var lightboxNext = document.getElementById('lightbox-next');
  var lightboxInner = document.getElementById('lightbox-inner');
  var lightboxTimer = null;
  var lastTrigger = null;
  var activeCarouselRoot = null;
  var pendingTransitionTimeout = null;
  var pendingCaptionTimeout = null;
  var closingLightbox = false;

  var SLIDE_TRANSITION_PROPS = ['width', 'height', 'top', 'left', 'border-radius'];

  // Converts a viewport rect (from getBoundingClientRect) into left/top/width/
  // height relative to `container`'s own box, suitable for inline styles on an
  // absolutely-positioned descendant of container. Animating real width/height
  // (rather than a transform: scale()) keeps border-radius constant throughout —
  // scaling via transform stretches border-radius along with everything else.
  function rectRelativeTo(viewportRect, container) {
    var containerRect = container.getBoundingClientRect();
    return {
      left: viewportRect.left - containerRect.left,
      top: viewportRect.top - containerRect.top,
      width: viewportRect.width,
      height: viewportRect.height
    };
  }

  function applyRect(el, rect) {
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
  }

  // Where object-fit: contain would render a photo of the given ratio inside
  // a box of containerSize, as a rect relative to that box's own top-left.
  // Sizing the slide's own box to exactly this (rather than letting it span
  // the full stage, with contain centering the photo inside the extra space)
  // is what makes border-radius visibly round the photo's real corners —
  // radius on a box bigger than its visible content only ever clips already-
  // transparent space near the box's corners, never the photo itself.
  function computeContentRect(containerSize, ratio) {
    if (!ratio || !isFinite(ratio)) {
      return { left: 0, top: 0, width: containerSize.width, height: containerSize.height };
    }
    var width, height;
    if (containerSize.width / containerSize.height > ratio) {
      height = containerSize.height;
      width = height * ratio;
    } else {
      width = containerSize.width;
      height = width / ratio;
    }
    return {
      left: (containerSize.width - width) / 2,
      top: (containerSize.height - height) / 2,
      width: width,
      height: height
    };
  }

  // Sizes a lightbox slide to exactly where its photo renders within the
  // stage (see computeContentRect) — the box-radius clamp in styles.css
  // depends on this to have a real effect. Safe to call any time the slide
  // is showing: same math whether or not the stage size just changed.
  function sizeSlideToContent(img) {
    if (!img) {
      return;
    }
    var ratio = parseFloat(img.style.getPropertyValue('--ratio'));
    var stageRect = lightboxInner.getBoundingClientRect();
    applyRect(img, computeContentRect({ width: stageRect.width, height: stageRect.height }, ratio));
  }

  // Used for the caption and dots on both the box and the lightbox. They never
  // crossfade against each other — one is always fully faded out before the
  // other starts fading in — so a plain opacity tween (no FLIP trick) is
  // enough. `ms` of 0/falsy snaps to the value instantly.
  function setFadeOpacity(el, opacity, ms) {
    if (!el) {
      return;
    }
    el.style.transition = ms ? 'opacity ' + ms + 'ms ease' : 'none';
    el.style.opacity = String(opacity);
  }

  // Carousel slides (both the box's and the lightbox's) start with only a
  // data-src so unvisited slides never fetch. This resolves one to its real
  // src the first time it's needed; already-resolved slides (including the
  // one slide per carousel that ships with a real src) are a no-op.
  function resolveSlideSrc(img) {
    if (img && !img.getAttribute('src') && img.dataset.src) {
      img.src = img.dataset.src;
    }
  }

  // Feeds the lightbox-slide's conditional border-radius (styles.css). Best
  // guess up front from the box's own (usually already-loaded) copy of this
  // photo, corrected once the lightbox's own copy actually loads — CSS
  // recomputes the clamp automatically the instant the custom property changes.
  function setSlideRatio(img, sourceImg) {
    var w = sourceImg && sourceImg.naturalWidth;
    var h = sourceImg && sourceImg.naturalHeight;
    if (w && h) {
      img.style.setProperty('--ratio', String(w / h));
    }
  }

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

  // Purely a DOM-sync helper: renders the given (already-resolved) index into
  // the lightbox's slides/dots. The box carousel itself is the single source
  // of truth for "which slide is current" — see initCarousel's show().
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
      // Load one slide ahead so the next nav/autoplay tick never shows a blank frame.
      resolveSlideSrc(slides[(resolved + 1) % slides.length]);
    }
    // Navigating while already open (no FLIP in progress) — each slide can
    // have a different photo ratio, so re-fit it to the stage every time it
    // becomes active.
    sizeSlideToContent(slides[resolved]);
    thumbs.forEach(function (thumb, n) {
      if (n === resolved) {
        thumb.setAttribute('aria-current', 'true');
      } else {
        thumb.removeAttribute('aria-current');
      }
    });
    maybeScrollThumbIntoView(thumbs[resolved], isAutoplayDriven);
  }

  // Navigating in the lightbox always goes through the underlying box's own
  // show(), so the box (hidden behind the overlay) stays on the exact same
  // slide — closing the lightbox then always animates the matching image.
  function goToLightboxSlide(index, isAutoplayDriven) {
    if (activeCarouselRoot && activeCarouselRoot._carouselShow) {
      activeCarouselRoot._carouselShow(index, isAutoplayDriven);
    }
  }

  function stopLightboxAutoplay() {
    if (lightboxTimer) {
      window.clearInterval(lightboxTimer);
      lightboxTimer = null;
    }
  }

  function startLightboxAutoplay() {
    stopLightboxAutoplay();
    if (prefersReducedMotion) {
      return;
    }
    lightboxTimer = window.setInterval(function () {
      if (activeCarouselRoot && activeCarouselRoot._carouselIndex) {
        goToLightboxSlide(activeCarouselRoot._carouselIndex() + 1, true);
      }
    }, AUTOPLAY_MS);
  }

  function pauseBoxAutoplay(root) {
    if (!root || !root._carouselAdvance) {
      return;
    }
    var queued = advanceQueue.indexOf(root._carouselAdvance);
    if (queued !== -1) {
      advanceQueue.splice(queued, 1);
    }
    var registered = advancers.indexOf(root._carouselAdvance);
    if (registered !== -1) {
      advancers.splice(registered, 1);
    }
  }

  function resumeBoxAutoplay(root) {
    if (!root || !root._carouselAdvance) {
      return;
    }
    if (advancers.indexOf(root._carouselAdvance) === -1) {
      advancers.push(root._carouselAdvance);
    }
  }

  function openLightbox(root, startIndex) {
    if (pendingTransitionTimeout) {
      window.clearTimeout(pendingTransitionTimeout);
      pendingTransitionTimeout = null;
    }
    if (pendingCaptionTimeout) {
      window.clearTimeout(pendingCaptionTimeout);
      pendingCaptionTimeout = null;
    }
    if (activeCarouselRoot && activeCarouselRoot !== root) {
      // A previous carousel's close sequence never got to finish (interrupted
      // by opening a different one) — don't leave its autoplay paused forever,
      // and let its own image, caption, and dots show again since it's no
      // longer behind the lightbox.
      resumeBoxAutoplay(activeCarouselRoot);
      activeCarouselRoot.classList.remove('is-lightbox-active');
      setFadeOpacity(activeCarouselRoot.querySelector('.carousel-caption'), 1, 0);
      setFadeOpacity(activeCarouselRoot.querySelector('.carousel-dots'), 1, 0);
    }
    closingLightbox = false;

    var boxSlides = root.querySelectorAll('.carousel-slide');
    var sourceImg = boxSlides[startIndex];
    var startRect = sourceImg ? sourceImg.getBoundingClientRect() : null;
    var title = root.querySelector('h2');
    var boxCaption = root.querySelector('.carousel-caption');
    var boxDots = root.querySelector('.carousel-dots');

    // The box's own caption and dots fade out immediately — independent of the
    // image's FLIP animation below — so they never appear frozen mid-transition.
    setFadeOpacity(boxCaption, 0, prefersReducedMotion ? 0 : CAPTION_FADE_OUT_MS);
    setFadeOpacity(boxDots, 0, prefersReducedMotion ? 0 : CAPTION_FADE_OUT_MS);

    lightboxSlides.innerHTML = '';
    lightboxThumbsTrack.innerHTML = '';

    boxSlides.forEach(function (slide, n) {
      var img = document.createElement('img');
      img.className = 'lightbox-slide';
      img.alt = slide.alt;
      setSlideRatio(img, slide);
      img.addEventListener('load', function () {
        setSlideRatio(img, img);
      });
      // Only the slide being opened into fetches immediately — the rest carry
      // data-src and resolve lazily via showLightboxSlide as they're navigated to.
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
      thumbImg.src = slide.dataset.src;

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

    lightboxPrev.hidden = boxSlides.length < 2;
    lightboxNext.hidden = boxSlides.length < 2;

    lightboxTitle.textContent = title ? title.textContent : '';
    // Stay invisible until the image finishes scaling up to fullscreen (see
    // the fade-in scheduled below) — otherwise it pops in at full size while
    // the image is still small, looking like an unrelated thing loading in.
    setFadeOpacity(lightboxTitle, 0, 0);
    setFadeOpacity(lightboxThumbsTrack, 0, 0);

    activeCarouselRoot = root;
    pauseBoxAutoplay(root);
    lastTrigger = root.querySelector('.carousel-trigger');
    // Hide the box's own carousel for the duration of the lightbox so only the
    // transitioning copy is ever visible — otherwise the two overlap while the
    // backdrop is still fading in/out, reading as two images instead of one.
    root.classList.add('is-lightbox-active');
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');

    var targetImg = lightboxSlides.querySelectorAll('img')[startIndex];
    if (targetImg) {
      // Suppress the opacity crossfade for this reveal — width/height/position is what animates in.
      targetImg.style.transition = 'none';
    }
    showLightboxSlide(startIndex);

    var shouldAnimate = Boolean(targetImg && startRect && startRect.width && startRect.height && !prefersReducedMotion);
    if (shouldAnimate) {
      applyRect(targetImg, rectRelativeTo(startRect, lightboxInner));
      // Start at the box's own radius, matching how it looked a moment ago —
      // clearing it below lets it animate to this photo's fullscreen radius
      // (0 if it'll span the stage's full width, var(--radius) otherwise).
      targetImg.style.borderRadius = 'var(--radius)';
    } else if (targetImg) {
      targetImg.style.transition = '';
    }

    // Force one reflow so the pre-animation state (snapped image position, transparent
    // overlay) is committed before switching to the end state — otherwise the browser can
    // collapse both style changes into one frame and skip the transition entirely.
    void lightbox.offsetWidth;

    lightbox.classList.add('is-visible');
    if (shouldAnimate) {
      targetImg.style.transition = SLIDE_TRANSITION_PROPS.map(function (prop) {
        return prop + ' ' + TRANSITION_MS + 'ms ease';
      }).join(', ');
      sizeSlideToContent(targetImg);
      targetImg.style.borderRadius = '';
    }

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

    lightboxClose.focus();
  }

  function finishClose() {
    closingLightbox = false;
    pendingTransitionTimeout = null;
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    resumeBoxAutoplay(activeCarouselRoot);
    if (activeCarouselRoot) {
      activeCarouselRoot.classList.remove('is-lightbox-active');
    }
    activeCarouselRoot = null;
    if (lastTrigger) {
      lastTrigger.focus();
    }
  }

  function closeLightbox() {
    if (lightbox.hidden || closingLightbox) {
      return;
    }
    stopLightboxAutoplay();
    if (pendingTransitionTimeout) {
      window.clearTimeout(pendingTransitionTimeout);
      pendingTransitionTimeout = null;
    }
    if (pendingCaptionTimeout) {
      window.clearTimeout(pendingCaptionTimeout);
      pendingCaptionTimeout = null;
    }

    lightbox.classList.remove('is-visible');
    // Fade out immediately, independent of the image's FLIP animation below.
    setFadeOpacity(lightboxTitle, 0, prefersReducedMotion ? 0 : CAPTION_FADE_OUT_MS);
    setFadeOpacity(lightboxThumbsTrack, 0, prefersReducedMotion ? 0 : CAPTION_FADE_OUT_MS);

    var activeImg = lightboxSlides.querySelector('.lightbox-slide.is-active');
    var targetImg = activeCarouselRoot ? activeCarouselRoot.querySelector('.carousel-slide.is-active') : null;
    var endRect = targetImg ? targetImg.getBoundingClientRect() : null;
    var boxCaption = activeCarouselRoot ? activeCarouselRoot.querySelector('.carousel-caption') : null;
    var boxDots = activeCarouselRoot ? activeCarouselRoot.querySelector('.carousel-dots') : null;
    // Already invisible (box is still hidden) — this just guarantees they start
    // from 0 once the box reappears, so the fade-in below has something to do.
    setFadeOpacity(boxCaption, 0, 0);
    setFadeOpacity(boxDots, 0, 0);

    if (activeImg && endRect && endRect.width && endRect.height && !prefersReducedMotion) {
      activeImg.style.transition = SLIDE_TRANSITION_PROPS.map(function (prop) {
        return prop + ' ' + TRANSITION_MS + 'ms ease';
      }).join(', ');
      applyRect(activeImg, rectRelativeTo(endRect, lightboxInner));
      // Animate from whatever this photo currently shows in fullscreen (0 or
      // var(--radius), per the clamp in styles.css) to the box's own radius.
      activeImg.style.borderRadius = 'var(--radius)';
    }

    if (prefersReducedMotion) {
      finishClose();
      setFadeOpacity(boxCaption, 1, 0);
      setFadeOpacity(boxDots, 1, 0);
    } else {
      closingLightbox = true;
      pendingTransitionTimeout = window.setTimeout(function () {
        finishClose();
        pendingCaptionTimeout = window.setTimeout(function () {
          setFadeOpacity(boxCaption, 1, CAPTION_FADE_IN_MS);
          setFadeOpacity(boxDots, 1, CAPTION_FADE_IN_MS);
          pendingCaptionTimeout = null;
        }, CAPTION_FADE_IN_DELAY_MS);
      }, TRANSITION_MS);
    }
  }

  lightboxClose.addEventListener('click', closeLightbox);

  // sizeSlideToContent snapshots a pixel rect rather than using a live
  // percentage, so — unlike the plain 100%/100% box it replaced — it needs
  // an explicit refresh if the viewport resizes while the lightbox is open.
  window.addEventListener('resize', function () {
    if (!lightbox.hidden) {
      sizeSlideToContent(lightboxSlides.querySelector('.lightbox-slide.is-active'));
    }
  });

  function currentLightboxIndex() {
    return activeCarouselRoot && activeCarouselRoot._carouselIndex ? activeCarouselRoot._carouselIndex() : 0;
  }

  lightboxPrev.addEventListener('click', function () {
    goToLightboxSlide(currentLightboxIndex() - 1);
    startLightboxAutoplay();
  });

  lightboxNext.addEventListener('click', function () {
    goToLightboxSlide(currentLightboxIndex() + 1);
    startLightboxAutoplay();
  });

  document.addEventListener('keydown', function (event) {
    if (lightbox.hidden) {
      return;
    }
    if (event.key === 'Escape') {
      closeLightbox();
    } else if (event.key === 'ArrowLeft' && !lightboxPrev.hidden) {
      goToLightboxSlide(currentLightboxIndex() - 1);
      startLightboxAutoplay();
    } else if (event.key === 'ArrowRight' && !lightboxNext.hidden) {
      goToLightboxSlide(currentLightboxIndex() + 1);
      startLightboxAutoplay();
    }
  });

  // Slide-box carousels share one global schedule so that only one box ever
  // transitions at a time, in a shuffled (non-sequential) order.
  var STAGGER_MS = 5000;
  var advancers = [];
  var advanceQueue = [];
  var lastAdvanced = null;
  var staggerTimer = null;

  function shuffled(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function refillAdvanceQueue() {
    advanceQueue = shuffled(advancers);
    if (advanceQueue.length > 1 && advanceQueue[0] === lastAdvanced) {
      var tmp = advanceQueue[0];
      advanceQueue[0] = advanceQueue[1];
      advanceQueue[1] = tmp;
    }
  }

  function runStagger() {
    if (advanceQueue.length === 0) {
      refillAdvanceQueue();
    }
    var next = advanceQueue.shift();
    if (next) {
      lastAdvanced = next;
      next();
    }
    staggerTimer = window.setTimeout(runStagger, STAGGER_MS);
  }

  function startStagger() {
    if (staggerTimer || prefersReducedMotion || advancers.length === 0) {
      return;
    }
    staggerTimer = window.setTimeout(runStagger, STAGGER_MS);
  }

  function initCarousel(root) {
    var slides = root.querySelectorAll('.carousel-slide');
    var dots = root.querySelectorAll('.carousel-dot');
    var trigger = root.querySelector('.carousel-trigger');
    var index = 0;

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

    root._carouselShow = show;
    root._carouselIndex = function () {
      return index;
    };
    root._carouselAdvance = advance;

    dots.forEach(function (dot, n) {
      dot.addEventListener('click', function (event) {
        event.stopPropagation();
        show(n);
        // Drop any queued auto-advance for this box so a manual pick doesn't
        // get immediately followed by an automatic one.
        var queued = advanceQueue.indexOf(advance);
        if (queued !== -1) {
          advanceQueue.splice(queued, 1);
        }
      });
    });

    trigger.addEventListener('click', function () {
      openLightbox(root, index);
    });

    if (slides.length > 1) {
      advancers.push(advance);
    }

    // Resolves the initially-active slide (a no-op, it already has a real
    // src) and prefetches the second slide so the first auto-advance/dot
    // click doesn't show a blank frame.
    show(0);
  }

  document.querySelectorAll('[data-carousel]').forEach(initCarousel);
  startStagger();
})();
