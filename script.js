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

  var lightbox = document.getElementById('lightbox');
  var lightboxSlides = document.getElementById('lightbox-slides');
  var lightboxDots = document.getElementById('lightbox-dots');
  var lightboxCaption = document.getElementById('lightbox-caption');
  var lightboxClose = document.getElementById('lightbox-close');
  var lightboxTimer = null;
  var lightboxIndex = 0;
  var lastTrigger = null;

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
    var slides = root.querySelectorAll('.carousel-slide');
    var title = root.querySelector('h2');
    var description = root.querySelector('p');

    lightboxSlides.innerHTML = '';
    lightboxDots.innerHTML = '';

    slides.forEach(function (slide, n) {
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

    lastTrigger = root.querySelector('.carousel-trigger');
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
    showLightboxSlide(startIndex);
    startLightboxAutoplay();
    lightboxClose.focus();
  }

  function closeLightbox() {
    stopLightboxAutoplay();
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    if (lastTrigger) {
      lastTrigger.focus();
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
