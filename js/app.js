/* ============================================================
   mojaGradinka — app.js
   All page behaviour, externalized from the HTML so browsers can
   cache it separately from markup. Loaded with `defer` at the end
   of <body>, so the DOM above it is already parsed.

   Contents:
     1. Demo-form submission (Formspree/Web3Forms-style POST)
     2. Feature-card tap-to-flip (touch/no-hover devices only)
     3. Entrance reveals (IntersectionObserver)
     4. Unified Lenis + rAF scroll-motion engine
     5. GSAP ScrollTrigger scene pin (Мобилна → Дојди → Веб апликација)
   ============================================================ */

// ------------------------------------------------------------
// 1. Demo-form submission
//
// [OWNER INPUT REQUIRED] The <form> element's `action` attribute in
// the HTML currently points at a placeholder Formspree endpoint
// (https://formspree.io/f/YOUR_FORM_ID). Replace YOUR_FORM_ID with a
// real Formspree form ID (or swap this handler for Web3Forms, which
// needs an access key instead of a form ID) before launch. Until
// then, submissions will correctly show the inline error state
// rather than silently pretending to succeed.
// ------------------------------------------------------------
(function () {
  var form = document.getElementById('demo-form');
  if (!form) return;

  var statusEl = form.querySelector('.mg-form__status');
  var submitBtn = form.querySelector('.mg-form__submit');
  var REQUEST_TIMEOUT_MS = 15000;
  var isSubmitting = false; // belt-and-braces: submitBtn.disabled already
  // blocks a second click, but this also catches a rapid Enter-key resubmit
  // or a second submit event firing before the disabled state paints

  function setStatus(kind, message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = false;
    statusEl.classList.remove('mg-form__status--ok', 'mg-form__status--error');
    statusEl.classList.add(kind === 'ok' ? 'mg-form__status--ok' : 'mg-form__status--error');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (isSubmitting) return;

    // honeypot: real visitors never see or fill this field. If it has a
    // value, silently pretend to succeed instead of telling a bot it guessed wrong.
    var honeypot = form.querySelector('[name="_gotcha"]');
    if (honeypot && honeypot.value) {
      setStatus('ok', 'Ви благодариме! Ќе ве контактираме наскоро.');
      form.reset();
      return;
    }

    // basic client-side validation on top of the browser's own `required`/
    // `type="email"` checks, so we can show one consistent inline message
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    isSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;
    setStatus('ok', 'Се испраќа...');

    // AbortController timeout so a hung/slow response can't leave the
    // submit button disabled indefinitely
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS) : null;

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (res.ok) {
          setStatus('ok', 'Ви благодариме! Ќе ве контактираме наскоро.');
          form.reset();
        } else {
          setStatus('error', 'Настана грешка при испраќање. Обидете се повторно или пишете ни директно на kontakt@mojagradinka.mk.');
        }
      })
      .catch(function () {
        setStatus('error', 'Настана грешка при испраќање. Обидете се повторно или пишете ни директно на kontakt@mojagradinka.mk.');
      })
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();

// ------------------------------------------------------------
// 2. Градинки / Родители slider (Сè section)
// Pill tabs + round prev/next buttons all drive one horizontal slide
// track. Left/Right arrow keys on a focused tab also step through it,
// matching the WAI-ARIA "Tabs" pattern the old click-only tabs used.
// ------------------------------------------------------------
(function () {
  var slider = document.querySelector('.mg-features__slider');
  if (!slider) return;

  // tabs now live in the head row (.mg-features__head-side), not inside
  // .mg-features__slider itself, so they're queried from the document
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.mg-features__tab'));
  var track = slider.querySelector('.mg-features__slider-track');
  var panels = track ? Array.prototype.slice.call(track.children) : [];
  var prevBtn = slider.querySelector('.mg-features__slider-nav--prev');
  var nextBtn = slider.querySelector('.mg-features__slider-nav--next');
  if (!track || !panels.length) return;

  var index = 0;

  function goTo(i, focusTab) {
    index = (i + panels.length) % panels.length;
    track.style.transform = 'translateX(-' + (index * 100) + '%)';
    tabs.forEach(function (tab, ti) {
      var active = ti === index;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && focusTab) tab.focus();
    });
    // the inactive panel only ever moves off-screen via transform — it
    // stays in normal flow (needed for the slide animation), so mark it
    // aria-hidden to keep screen-reader/keyboard nav from wandering into
    // content that isn't visually reachable
    panels.forEach(function (panel, pi) {
      panel.setAttribute('aria-hidden', pi === index ? 'false' : 'true');
    });
    // the panel that was off-screen never intersected the entrance-
    // reveal IntersectionObserver below — reveal its [data-anim] cards
    // directly the first time it slides into view
    panels[index].querySelectorAll('[data-anim]').forEach(function (el) {
      el.classList.add('in-view');
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { goTo(i); });
    tab.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(i + 1, true); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(i - 1, true); }
    });
  });
  if (prevBtn) prevBtn.addEventListener('click', function () { goTo(index - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { goTo(index + 1); });

  // Touch/pointer swipe — right-to-left opens the next panel, left-to-
  // right returns to the previous one. Only attached where touch input
  // is actually available (coarse pointer / touch points present) —
  // mouse-only desktops keep using tabs/arrows/keyboard exclusively, as
  // before. Calls the exact same goTo() the tabs/arrows use, so active
  // tab, aria-selected, aria-hidden and the slide transform all update
  // identically no matter which input triggered the change.
  var hasTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    'ontouchstart' in window || (navigator.maxTouchPoints > 0);

  if (hasTouch) {
    var SWIPE_MIN_DX = 40;   // px — ignore very short gestures (a tap, a small jiggle)
    var SWIPE_LOCK_DX = 10;  // px — how far before we commit to "this is horizontal"
    var SWIPE_MAX_DY = 60;   // px — ignore gestures that drift too far vertically
    var startX = 0, startY = 0, dragging = false, handled = false, axisLocked = false;

    function swipeStart(x, y) {
      startX = x; startY = y; dragging = true; handled = false; axisLocked = false;
    }
    function swipeMove(x, y, evt) {
      if (!dragging || handled) return;
      var dx = x - startX;
      var dy = y - startY;
      if (!axisLocked && Math.abs(dx) > SWIPE_LOCK_DX) {
        axisLocked = Math.abs(dx) > Math.abs(dy); // true = horizontal, false = let the page scroll
      }
      // only take over the gesture (stop native vertical scroll) once
      // we've confirmed it's a horizontal swipe — until then the page
      // scrolls exactly as it would without this handler at all
      if (axisLocked && evt && evt.cancelable) evt.preventDefault();
    }
    function swipeEnd(x, y) {
      if (!dragging) return;
      dragging = false;
      if (handled) return;
      var dx = x - startX;
      var dy = y - startY;
      if (Math.abs(dx) >= SWIPE_MIN_DX && Math.abs(dx) > Math.abs(dy) && Math.abs(dy) < SWIPE_MAX_DY) {
        handled = true; // one panel change per swipe, even if more events land after this
        if (dx < 0) goTo(index + 1); else goTo(index - 1);
      }
    }

    if (window.PointerEvent) {
      track.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return; // real swipes only — clicks/drag on desktop stay untouched
        swipeStart(e.clientX, e.clientY);
      });
      track.addEventListener('pointermove', function (e) {
        swipeMove(e.clientX, e.clientY, e);
      }, { passive: false });
      track.addEventListener('pointerup', function (e) { swipeEnd(e.clientX, e.clientY); });
      track.addEventListener('pointercancel', function () { dragging = false; });
    } else {
      // fallback for touch-capable browsers with no Pointer Events support
      track.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        swipeStart(t.clientX, t.clientY);
      }, { passive: true });
      track.addEventListener('touchmove', function (e) {
        var t = e.touches[0];
        swipeMove(t.clientX, t.clientY, e);
      }, { passive: false });
      track.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0];
        swipeEnd(t.clientX, t.clientY);
      });
      track.addEventListener('touchcancel', function () { dragging = false; });
    }
  }

  goTo(0);
})();

// ------------------------------------------------------------
// 3. Entrance reveals
// ------------------------------------------------------------
(function () {
  var els = document.querySelectorAll('[data-anim], [data-ride]');
  if (!els.length) return;

  function reveal(el) {
    var delay = parseInt(el.getAttribute('data-anim-delay') || '0', 10);
    setTimeout(function () { el.classList.add('in-view'); }, delay);
  }

  if (!('IntersectionObserver' in window)) {
    els.forEach(reveal);
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        reveal(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  els.forEach(function (el) { io.observe(el); });
})();

// ------------------------------------------------------------
// 4. Unified, eased scroll-motion engine (Lenis + one rAF loop).
// A single lerped "scroll" value drives every effect, so dots,
// mece and parallax glide instead of snapping frame-to-frame.
// ------------------------------------------------------------
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // coalesces rapid-fire resize events (window drag, orientation change)
  // into at most one handler run per animation frame, instead of once
  // per raw event
  function rafDebounce(fn) {
    var scheduled = false;
    return function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; fn(); });
    };
  }

  var parallax = [];
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    var spec = {};
    el.getAttribute('data-parallax').split(',').forEach(function (pair) {
      var kv = pair.split(':');
      spec[kv[0].trim()] = parseFloat(kv[1]);
    });
    parallax.push({ el: el, ty: spec.ty || 0, tx: spec.tx || 0, scaleAmt: spec.scale || 0 });
  });

  var drops = [];
  document.querySelectorAll('[data-scrolldrop]').forEach(function (el) {
    drops.push({ el: el, max: parseFloat(el.getAttribute('data-scrolldrop')) });
  });

  var slides = [];
  document.querySelectorAll('[data-scrollslide]').forEach(function (el) {
    slides.push({ el: el, max: parseFloat(el.getAttribute('data-scrollslide')) });
  });

  var DROP_RANGE = 650;
  var SLIDE_RANGE = 650;

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function render(scroll) {
    var vh = window.innerHeight || document.documentElement.clientHeight;

    var td = Math.max(0, Math.min(1, scroll / DROP_RANGE));
    var tde = easeInOut(td);
    drops.forEach(function (d) {
      d.el.style.transform = 'translate3d(0,' + (tde * d.max) + 'px,0)';
    });

    var ts = Math.max(0, Math.min(1, scroll / SLIDE_RANGE));
    slides.forEach(function (d) {
      d.el.style.transform = 'translate3d(' + (easeInOut(ts) * d.max) + 'px,0,0)';
    });

    parallax.forEach(function (item) {
      var rect = item.el.getBoundingClientRect();
      var center = rect.top + rect.height / 2;
      var progress = (vh / 2 - center) / (vh / 2);
      var parts = [];
      if (item.ty) parts.push('translateY(' + (progress * item.ty) + 'px)');
      if (item.tx) parts.push('translateX(' + (progress * item.tx * 6) + 'px)');
      if (item.scaleAmt) parts.push('scale(' + (1 + Math.sin((progress + 1) * Math.PI / 2) * item.scaleAmt) + ')');
      item.el.style.transform = parts.join(' ');
    });
  }

  if (reduce) {
    render(window.scrollY || document.documentElement.scrollTop);
    window.addEventListener('resize', rafDebounce(function () {
      render(window.scrollY || document.documentElement.scrollTop);
    }));
    return;
  }

  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.4
    });
    window.__mgLenis = lenis; // exposed so the GSAP ScrollTrigger scene-pin script (below) can sync with it

    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      a.addEventListener('click', function (e) {
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -20, duration: 1.4 });
      });
    });
  }

  var smooth = window.scrollY || 0;
  var rafId = null;
  function frame(time) {
    if (lenis) lenis.raf(time);
    var target = lenis ? lenis.scroll : (window.scrollY || document.documentElement.scrollTop);
    smooth += (target - smooth) * 0.12;
    if (Math.abs(target - smooth) < 0.05) smooth = target;
    render(smooth);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);
  window.addEventListener('resize', rafDebounce(function () { render(smooth); }));

  // pause the rAF loop while the tab is hidden instead of relying only
  // on the browser's own background-tab throttling, and resume cleanly
  // (Lenis keeps its own internal state, so just restarting the loop
  // picks back up correctly)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (rafId === null) {
      rafId = requestAnimationFrame(frame);
    }
  });
})();

// ------------------------------------------------------------
// 5. GSAP + ScrollTrigger power the .mg-scenes horizontal scene
// sequence (Мобилна апликација → Дојди → Веб апликација), desktop
// only. Skipped entirely under prefers-reduced-motion: the three
// scenes just stay in normal document flow and stack/scroll like any
// other section (same as the sub-961px responsive fallback).
// ------------------------------------------------------------
(function () {
  if (!window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);

  // keep ScrollTrigger perfectly in sync with the page's Lenis instance
  if (window.__mgLenis) {
    window.__mgLenis.on('scroll', ScrollTrigger.update);
  }

  var wrap = document.querySelector('.mg-scenes');
  var frame = wrap && wrap.querySelector('.mg-scenes__frame');
  // only the scene sections slide — the watermark stays put, so it's
  // deliberately excluded here
  var panels = frame ? Array.prototype.slice.call(frame.querySelectorAll(':scope > .mg-section')) : [];
  if (panels.length < 2) return;

  ScrollTrigger.matchMedia({
    '(min-width: 961px)': function () {
      // "x" in vw (not xPercent, which is relative to each panel's OWN
      // width — these scene sections are capped at max-width:1240px and
      // centered, so xPercent:100 only moved them by 1240px, not by the
      // full viewport width, leaving a sliver visible on wider screens)
      gsap.set(panels[0], { x: 0 });
      gsap.set(panels.slice(1), { x: '100vw' });

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap,
          pin: frame,
          start: 'top top',
          end: '+=' + (panels.length - 1) * 90 + '%',
          scrub: 1
          // no anticipatePin: with Lenis smoothing the scroll, its early-
          // catch heuristic misfires and the pin grabs way too soon —
          // felt like a "magnet" pulling you in before you'd even
          // scrolled past the hero
        }
      });

      // cumulative (not reused-per-loop) positions — each transition starts
      // exactly where the previous one's hold ended, so the timeline is one
      // clean sequence with no overlap. The last panel (Веб апликација)
      // only ever gets an "enter" tween, never an "exit" one, and the
      // trailing hold keeps it parked dead center until the pin releases.
      var SLIDE = 1, HOLD = 0.4, SEG = SLIDE + HOLD;
      for (var i = 0; i < panels.length - 1; i++) {
        var t = i * SEG;
        tl.to(panels[i],     { x: '-100vw', ease: 'power1.inOut', duration: SLIDE }, t)
          .to(panels[i + 1], { x: 0,        ease: 'power1.inOut', duration: SLIDE }, t);
      }
      tl.to({}, { duration: HOLD }); // final hold on the last (resting) scene

      // cleanup when leaving this breakpoint (matchMedia handles this automatically,
      // but reset inline transforms so mobile/tablet layout isn't left mid-animation)
      return function () {
        gsap.set(panels, { clearProps: 'transform' });
      };
    }
  });

  // fonts/images can still be settling in when this runs, which shifts
  // where the trigger actually starts on the page — recheck once
  // everything (incl. the Google Fonts + hero photo) has truly loaded
  window.addEventListener('load', function () {
    setTimeout(function () { ScrollTrigger.refresh(); }, 200);
  });
})();
