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

  var TRANSITION_MS = 1000;

  var lightbox = document.getElementById('lightbox');
  lightbox.style.transition = prefersReducedMotion ? 'none' : 'background-color ' + TRANSITION_MS + 'ms ease';
  var lightboxSlides = document.getElementById('lightbox-slides');
  var lightboxDots = document.getElementById('lightbox-dots');
  var lightboxCaption = document.getElementById('lightbox-caption');
  var lightboxClose = document.getElementById('lightbox-close');
  var lightboxPrev = document.getElementById('lightbox-prev');
  var lightboxNext = document.getElementById('lightbox-next');
  var lightboxInner = document.getElementById('lightbox-inner');
  var lightboxTimer = null;
  var lastTrigger = null;
  var activeCarouselRoot = null;
  var pendingTransitionTimeout = null;
  var closingLightbox = false;

  var RECT_TRANSITION_PROPS = ['width', 'height', 'top', 'left'];

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

  function clearRect(el) {
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
  }

  // Purely a DOM-sync helper: renders the given (already-resolved) index into
  // the lightbox's slides/dots. The box carousel itself is the single source
  // of truth for "which slide is current" — see initCarousel's show().
  function showLightboxSlide(index) {
    var slides = lightboxSlides.querySelectorAll('img');
    var dots = lightboxDots.querySelectorAll('button');
    if (!slides.length) {
      return;
    }
    var resolved = (index + slides.length) % slides.length;
    slides.forEach(function (slide, n) {
      slide.classList.toggle('is-active', n === resolved);
    });
    dots.forEach(function (dot, n) {
      dot.classList.toggle('is-active', n === resolved);
    });
  }

  // Navigating in the lightbox always goes through the underlying box's own
  // show(), so the box (hidden behind the overlay) stays on the exact same
  // slide — closing the lightbox then always animates the matching image.
  function goToLightboxSlide(index) {
    if (activeCarouselRoot && activeCarouselRoot._carouselShow) {
      activeCarouselRoot._carouselShow(index);
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
        goToLightboxSlide(activeCarouselRoot._carouselIndex() + 1);
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
    if (activeCarouselRoot && activeCarouselRoot !== root) {
      // A previous carousel's close sequence never got to finish (interrupted
      // by opening a different one) — don't leave its autoplay paused forever.
      resumeBoxAutoplay(activeCarouselRoot);
    }
    closingLightbox = false;

    var boxSlides = root.querySelectorAll('.carousel-slide');
    var sourceImg = boxSlides[startIndex];
    var startRect = sourceImg ? sourceImg.getBoundingClientRect() : null;
    var title = root.querySelector('h2');
    var description = root.querySelector('p');

    lightboxSlides.innerHTML = '';
    lightboxDots.innerHTML = '';

    boxSlides.forEach(function (slide, n) {
      var img = document.createElement('img');
      img.className = 'lightbox-slide';
      img.src = slide.src;
      img.alt = slide.alt;
      lightboxSlides.appendChild(img);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'lightbox-dot';
      dot.setAttribute('aria-label', 'Slide ' + (n + 1));
      dot.addEventListener('click', function (event) {
        event.stopPropagation();
        goToLightboxSlide(n);
        startLightboxAutoplay();
      });
      lightboxDots.appendChild(dot);
    });

    lightboxPrev.hidden = boxSlides.length < 2;
    lightboxNext.hidden = boxSlides.length < 2;

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

    activeCarouselRoot = root;
    pauseBoxAutoplay(root);
    lastTrigger = root.querySelector('.carousel-trigger');
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
    } else if (targetImg) {
      targetImg.style.transition = '';
    }

    // Force one reflow so the pre-animation state (snapped image position, transparent
    // overlay) is committed before switching to the end state — otherwise the browser can
    // collapse both style changes into one frame and skip the transition entirely.
    void lightbox.offsetWidth;

    lightbox.classList.add('is-visible');
    if (shouldAnimate) {
      targetImg.style.transition = RECT_TRANSITION_PROPS.map(function (prop) {
        return prop + ' ' + TRANSITION_MS + 'ms ease';
      }).join(', ');
      clearRect(targetImg);
    }

    if (prefersReducedMotion) {
      startLightboxAutoplay();
    } else {
      pendingTransitionTimeout = window.setTimeout(function () {
        if (targetImg) {
          targetImg.style.transition = '';
        }
        pendingTransitionTimeout = null;
        startLightboxAutoplay();
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

    lightbox.classList.remove('is-visible');

    var activeImg = lightboxSlides.querySelector('.lightbox-slide.is-active');
    var targetImg = activeCarouselRoot ? activeCarouselRoot.querySelector('.carousel-slide.is-active') : null;
    var endRect = targetImg ? targetImg.getBoundingClientRect() : null;

    if (activeImg && endRect && endRect.width && endRect.height && !prefersReducedMotion) {
      activeImg.style.transition = RECT_TRANSITION_PROPS.map(function (prop) {
        return prop + ' ' + TRANSITION_MS + 'ms ease';
      }).join(', ');
      applyRect(activeImg, rectRelativeTo(endRect, lightboxInner));
    }

    if (prefersReducedMotion) {
      finishClose();
    } else {
      closingLightbox = true;
      pendingTransitionTimeout = window.setTimeout(finishClose, TRANSITION_MS);
    }
  }

  lightboxClose.addEventListener('click', closeLightbox);

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

    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, n) {
        slide.classList.toggle('is-active', n === index);
      });
      dots.forEach(function (dot, n) {
        dot.classList.toggle('is-active', n === index);
      });
      // Mirror into the lightbox whenever this box's fullscreen view is open,
      // so the two never drift — closing always animates the slide the
      // visitor was just looking at.
      if (activeCarouselRoot === root) {
        showLightboxSlide(index);
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
  }

  document.querySelectorAll('[data-carousel]').forEach(initCarousel);
  startStagger();
})();
