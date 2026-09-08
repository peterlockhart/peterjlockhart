(function () {
  'use strict';

  var AUTOPLAY_MS = 4000;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  var lightboxSlides = document.getElementById('lightbox-slides');
  var lightboxDots = document.getElementById('lightbox-dots');
  var lightboxCaption = document.getElementById('lightbox-caption');
  var lightboxClose = document.getElementById('lightbox-close');
  var lightboxTimer = null;
  var lightboxIndex = 0;
  var lastTrigger = null;
  var activeCarouselRoot = null;
  var pendingTransitionTimeout = null;
  var closingLightbox = false;

  // Returns the transform that, applied to an element naturally laid out at
  // naturalRect, makes it visually appear at desiredRect instead (FLIP invert step).
  function invertTransform(naturalRect, desiredRect) {
    var scaleX = desiredRect.width / naturalRect.width;
    var scaleY = desiredRect.height / naturalRect.height;
    var dx = (desiredRect.left + desiredRect.width / 2) - (naturalRect.left + naturalRect.width / 2);
    var dy = (desiredRect.top + desiredRect.height / 2) - (naturalRect.top + naturalRect.height / 2);
    return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scaleX + ', ' + scaleY + ')';
  }

  function showLightboxSlide(index) {
    var slides = lightboxSlides.querySelectorAll('img');
    var dots = lightboxDots.querySelectorAll('button');
    if (!slides.length) {
      return;
    }
    lightboxIndex = (index + slides.length) % slides.length;
    slides.forEach(function (slide, n) {
      slide.classList.toggle('is-active', n === lightboxIndex);
    });
    dots.forEach(function (dot, n) {
      dot.classList.toggle('is-active', n === lightboxIndex);
    });
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
      showLightboxSlide(lightboxIndex + 1);
    }, AUTOPLAY_MS);
  }

  function openLightbox(root, startIndex) {
    if (pendingTransitionTimeout) {
      window.clearTimeout(pendingTransitionTimeout);
      pendingTransitionTimeout = null;
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
        showLightboxSlide(n);
        startLightboxAutoplay();
      });
      lightboxDots.appendChild(dot);
    });

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
    lastTrigger = root.querySelector('.carousel-trigger');
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');

    var targetImg = lightboxSlides.querySelectorAll('img')[startIndex];
    if (targetImg) {
      // Suppress the opacity crossfade for this reveal — position/scale is what animates in.
      targetImg.style.transition = 'none';
    }
    showLightboxSlide(startIndex);

    var animated = false;
    if (targetImg && startRect && startRect.width && startRect.height && !prefersReducedMotion) {
      var naturalRect = targetImg.getBoundingClientRect();
      if (naturalRect.width && naturalRect.height) {
        animated = true;
        targetImg.style.transformOrigin = 'center center';
        targetImg.style.transform = invertTransform(naturalRect, startRect);
        // Force a reflow so the snapped-to-box position is committed before animating away from it.
        void targetImg.offsetWidth;
        targetImg.style.transition = 'transform ' + TRANSITION_MS + 'ms ease';
        targetImg.style.transform = 'none';
        pendingTransitionTimeout = window.setTimeout(function () {
          targetImg.style.transition = '';
          targetImg.style.transform = '';
          targetImg.style.transformOrigin = '';
          pendingTransitionTimeout = null;
          startLightboxAutoplay();
        }, TRANSITION_MS);
      }
    }
    if (targetImg && !animated) {
      targetImg.style.transition = '';
    }
    if (!animated) {
      startLightboxAutoplay();
    }

    lightboxClose.focus();
  }

  function finishClose() {
    closingLightbox = false;
    pendingTransitionTimeout = null;
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
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

    var activeImg = lightboxSlides.querySelector('.lightbox-slide.is-active');
    var targetImg = activeCarouselRoot ? activeCarouselRoot.querySelector('.carousel-slide.is-active') : null;
    var endRect = targetImg ? targetImg.getBoundingClientRect() : null;

    if (activeImg && endRect && endRect.width && endRect.height && !prefersReducedMotion) {
      closingLightbox = true;
      var startRect = activeImg.getBoundingClientRect();
      activeImg.style.transformOrigin = 'center center';
      activeImg.style.transition = 'transform ' + TRANSITION_MS + 'ms ease';
      activeImg.style.transform = invertTransform(startRect, endRect);
      pendingTransitionTimeout = window.setTimeout(finishClose, TRANSITION_MS);
    } else {
      finishClose();
    }
  }

  lightboxClose.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', function (event) {
    if (!lightbox.hidden && event.key === 'Escape') {
      closeLightbox();
    }
  });

  function initCarousel(root) {
    var slides = root.querySelectorAll('.carousel-slide');
    var dots = root.querySelectorAll('.carousel-dot');
    var trigger = root.querySelector('.carousel-trigger');
    var index = 0;
    var timer = null;

    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, n) {
        slide.classList.toggle('is-active', n === index);
      });
      dots.forEach(function (dot, n) {
        dot.classList.toggle('is-active', n === index);
      });
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();
      if (prefersReducedMotion || slides.length < 2) {
        return;
      }
      timer = window.setInterval(function () {
        show(index + 1);
      }, AUTOPLAY_MS);
    }

    dots.forEach(function (dot, n) {
      dot.addEventListener('click', function (event) {
        event.stopPropagation();
        show(n);
        start();
      });
    });

    trigger.addEventListener('click', function () {
      openLightbox(root, index);
    });

    start();
  }

  document.querySelectorAll('[data-carousel]').forEach(initCarousel);
})();
