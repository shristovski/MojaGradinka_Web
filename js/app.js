/* ============================================================
   mojaGradinka — app.js
   All page behaviour, externalized from the HTML so browsers can
   cache it separately from markup. Loaded with `defer` at the end
   of <body>, so the DOM above it is already parsed.

   Contents:
     1. Demo-form submission (Formspree/Web3Forms-style POST)
     2. Градинки / Родители slider (Сè section)
     3. Entrance reveals (IntersectionObserver)
     4. Unified Lenis + rAF scroll-motion engine
     5. GSAP ScrollTrigger scene pin (Мобилна → Дојди → Веб апликација)
     6. Hero mobile scroll cue (tap/click to scroll to "Ние")
     7. Pricing mobile swipe carousel (scroll-snap + pagination dots)
   ============================================================ */

// ------------------------------------------------------------
// 1. Demo-form submission
//
// No backend/API on this static site, so the form can't actually
// deliver itself anywhere on its own. Instead it builds a mailto:
// link from the visitor's own entered values and hands off to their
// default email app — the page can only ever confirm that the email
// app opened, never that the visitor went on to press send, so there
// is deliberately no "sent successfully" (or "failed to send")
// message anywhere in this handler.
// ------------------------------------------------------------
(function () {
  var form = document.getElementById('demo-form');
  if (!form) return;

  var submitBtn = form.querySelector('.mg-form__submit');
  var isSubmitting = false; // guards a rapid double-click/double-Enter
  // from building and opening the mailto: link twice in a row

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function orNotEntered(v) {
    return v ? v : 'Не е внесен';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (isSubmitting) return;

    // honeypot: real visitors never see or fill this field — if it's
    // filled, just do nothing (no backend left to spam, and no reason
    // to open a bot's "email app" either)
    var honeypot = form.querySelector('[name="_gotcha"]');
    if (honeypot && honeypot.value) return;

    // native required/type="email" validation — same inline browser
    // tooltip + focus-first-invalid-field behaviour as before
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    isSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    var name = val('df-name');
    var kindergarten = val('df-kg');
    var role = val('df-role');
    var email = val('df-email');
    var phone = val('df-phone');
    var kids = val('df-kids');

    var subject = kindergarten
      ? 'Барање за демо – ' + kindergarten
      : 'Барање за MojaGradinka демо';

    var body = [
      'Здраво,',
      '',
      'Заинтересиран/а сум за презентација на платформата MojaGradinka и би сакал/а да закажам демо за нашата градинка.',
      '',
      'Податоци за контакт:',
      '',
      'Име и презиме: ' + name,
      'Име на градинка: ' + kindergarten,
      'Улога: ' + role,
      'Е-пошта: ' + email,
      'Телефон: ' + orNotEntered(phone),
      'Број на деца: ' + orNotEntered(kids),
      '',
      'Ве молам контактирајте ме за да договориме термин за презентација.',
      '',
      'Ви благодарам.'
    ].join('\n');

    var mailtoUrl = 'mailto:kontakt@mojagradinka.mk' +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    window.location.href = mailtoUrl;

    // a mailto: href doesn't navigate this page away or reload it, so
    // without this the button would stay disabled for the rest of the
    // visit after the very first click
    setTimeout(function () {
      isSubmitting = false;
      if (submitBtn) submitBtn.disabled = false;
    }, 1000);
  });

  // fallback "Копирај" button next to the plain mailto: link — copies
  // the address for visitors whose browser has no default email app
  // configured to catch the mailto: handoff above
  var copyBtn = form.querySelector('.mg-form__copy');
  if (copyBtn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(copyBtn.getAttribute('data-copy-email')).then(function () {
          var original = copyBtn.textContent;
          copyBtn.textContent = 'Копирано!';
          setTimeout(function () { copyBtn.textContent = original; }, 1800);
        });
      });
    } else {
      // no Clipboard API (very old browser, or a non-secure context) —
      // the plain mailto: link right next to it still works either way
      copyBtn.hidden = true;
    }
  }
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
        // the -20 offset is a deliberate small gap above a normal
        // in-flow section — but Мобилна апликација/Дојди/Веб апликација
        // live inside .mg-scenes__frame, which GSAP pins flush with the
        // viewport top the moment .mg-scenes itself hits "top top" (see
        // the ScrollTrigger setup below). Any offset there just leaves
        // that much of the page's own cream background showing above
        // the frame's mist background before the pin catches up, since
        // the two colours don't match. offset:0 lands exactly on GSAP's
        // own pin trigger point, closing that gap instead of masking it.
        var inScenes = target.closest('.mg-scenes__frame');
        var offset = inScenes ? 0 : -20;
        // per-link override: #se (Функционалности) has the same kind of
        // problem for a different reason — its own -20 gap exposed the
        // tail end of #nie's last panel (a different, mist-coloured
        // background) instead of the page's plain cream. data-scroll-
        // offset lets a specific link opt out of the shared -20 default
        // without touching every other anchor's behaviour.
        if (a.dataset.scrollOffset !== undefined) offset = parseFloat(a.dataset.scrollOffset);
        lenis.scrollTo(target, { offset: offset, duration: 1.4 });
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

// ------------------------------------------------------------
// 6. Hero mobile scroll cue — taps/clicks scroll down to "Ние" (the
// section right after the hero that explains what mojaGradinka is),
// the same target the desktop "Дознај зошто" button already links to.
// Not nested inside section 4's Lenis setup because that whole block
// returns early under prefers-reduced-motion — the cue itself is only
// visible on mobile via CSS, but must still work (just without Lenis's
// eased scroll) if reduced motion is on or the Lenis CDN failed to load.
// ------------------------------------------------------------
(function () {
  var cue = document.querySelector('.mg-hero__scroll-cue');
  if (!cue) return;

  cue.addEventListener('click', function () {
    var target = document.getElementById('nie');
    if (!target) return;
    if (window.__mgLenis) {
      window.__mgLenis.scrollTo(target, { offset: -20, duration: 1.4 });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();

// ------------------------------------------------------------
// 7. Pricing mobile swipe carousel — CSS scroll-snap does the actual
// swiping natively (no touch handlers here), so vertical page scroll
// is never at risk of being intercepted. JS only: (a) centers
// "Професионален" on load with no visible scroll animation, (b) keeps
// the current card correctly centered if the viewport resizes/rotates
// (falling back to "Професионален" only on first load — landscape
// phone width, where CSS switches this to a plain 3-across grid with
// no scrolling, has no "current card" concept to preserve), (c) keeps
// the pagination dots synced to whichever card is nearest-center as
// the user swipes, and (d) lets tapping a dot scroll to that card.
// ------------------------------------------------------------
(function () {
  var grid = document.querySelector('.mg-pricing__grid');
  var dotsWrap = document.querySelector('.mg-pricing__dots');
  if (!grid || !dotsWrap) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.mg-pricing-plan'));
  var dots = Array.prototype.slice.call(dotsWrap.querySelectorAll('.mg-pricing__dot'));
  if (!cards.length || !dots.length) return;

  var featuredIndex = 0;
  cards.forEach(function (card, i) {
    if (card.classList.contains('mg-pricing-plan--featured')) featuredIndex = i;
  });
  // the package the carousel should show/re-show — starts on the
  // featured plan, then tracks whatever the user last swiped/tapped to
  var currentIndex = featuredIndex;
  var hintAnimating = false; // true only while the swipe-hint nudge tween (below) is running

  // the grid is only actually a horizontally-scrollable carousel at the
  // portrait mobile breakpoint (CSS switches it to display:flex/
  // overflow-x:auto there) — at landscape-phone and desktop/tablet
  // widths it's a plain CSS grid with no overflow, so this is
  // naturally false there and everything below becomes a harmless
  // no-op instead of needing its own width/orientation check
  function isCarouselActive() {
    return grid.scrollWidth > grid.clientWidth + 1;
  }

  function cardCenter(card) {
    return card.offsetLeft + card.offsetWidth / 2;
  }

  function scrollToCard(index, smooth) {
    var card = cards[index];
    if (!card) return;
    var left = cardCenter(card) - grid.clientWidth / 2;
    if (grid.scrollTo) grid.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' });
    else grid.scrollLeft = left;
  }

  function setActiveDot(index) {
    dots.forEach(function (d, i) {
      var active = i === index;
      d.classList.toggle('is-active', active);
      if (active) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  }

  // instant (behavior:'auto'), never animated, so there's no visible
  // scroll on page load — a resize/orientation change re-centers the
  // same way afterward (it's a correction, not a user-initiated
  // navigation, so it shouldn't animate either)
  function centerCurrent() {
    if (hintAnimating) return; // don't fight the nudge tween's own scrollLeft writes
    if (!isCarouselActive()) return;
    scrollToCard(currentIndex, false);
    setActiveDot(currentIndex);
  }

  // A single synchronous call here was enough in every desktop-browser
  // test, but on real phones the very first paint can still be
  // mid-layout when this deferred script runs — scrollTo()/scrollLeft
  // set before the browser has committed the carousel's true
  // scrollWidth is liable to be silently dropped, leaving the first
  // card flush-left with no peek of its neighbours until *something*
  // (a touch, a resize) forces a fresh layout pass. Re-asserting the
  // same, still-instant, still-invisible centering at each of these
  // points closes that race without ever producing a visible jump:
  centerCurrent();                               // as soon as this script runs
  requestAnimationFrame(function () {            // after a guaranteed layout + paint
    requestAnimationFrame(centerCurrent);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(centerCurrent);    // in case a late font swap reflows anything
  }
  window.addEventListener('load', function () {  // after every image has its final size
    setTimeout(centerCurrent, 50);
  });

  var resizeRAF = null;
  function scheduleRecenter() {
    if (resizeRAF) return;
    resizeRAF = requestAnimationFrame(function () {
      resizeRAF = null;
      centerCurrent();
    });
  }
  window.addEventListener('resize', scheduleRecenter);
  window.addEventListener('orientationchange', scheduleRecenter);

  var scrollRAF = null;
  grid.addEventListener('scroll', function () {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(function () {
      scrollRAF = null;
      if (!isCarouselActive()) return;
      var center = grid.scrollLeft + grid.clientWidth / 2;
      var closest = 0;
      var closestDist = Infinity;
      cards.forEach(function (card, i) {
        var dist = Math.abs(cardCenter(card) - center);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      currentIndex = closest;
      setActiveDot(closest);
    });
  }, { passive: true });

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      currentIndex = i;
      scrollToCard(i, !reduce);
      setActiveDot(i);
      dismissSwipeHint();
    });
  });

  // --------------------------------------------------------------
  // First-visit swipe hint — a short text line + a couple of pixels of
  // nudge-and-back on the carousel itself, shown once per browser
  // session so a first-time visitor realizes the section is swipeable
  // even though the adjacent-card previews (fixed above) already give
  // it away visually. Dismissed permanently the moment the visitor
  // actually touches/clicks/scrolls the carousel themselves.
  // --------------------------------------------------------------
  var hintEl = document.querySelector('[data-pricing-swipe-hint]');
  var HINT_STORAGE_KEY = 'mgPricingSwiped';
  var hintDismissed = false;

  function hintStorageGet() {
    try { return window.sessionStorage.getItem(HINT_STORAGE_KEY); } catch (e) { return null; }
  }
  function hintStorageSet() {
    // sessionStorage can throw in some private-browsing modes — if so,
    // the hint just won't remember across reloads; the carousel itself
    // is completely unaffected either way
    try { window.sessionStorage.setItem(HINT_STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
  }

  function dismissSwipeHint() {
    if (hintDismissed) return;
    hintDismissed = true;
    hintAnimating = false; // interrupts an in-flight nudge tween mid-frame
    hintStorageSet();
    if (hintEl) hintEl.classList.add('is-dismissed');
  }

  if (hintEl) {
    if (hintStorageGet()) {
      // already swiped earlier this session — skip straight to hidden,
      // no fade-out needed since it was never shown this page view
      hintDismissed = true;
      hintEl.classList.add('is-dismissed');
    } else {
      // any of these only ever fire from real input, never from this
      // file's own programmatic scrollLeft writes, so the hint can't
      // end up dismissing itself
      ['touchstart', 'pointerdown', 'wheel'].forEach(function (type) {
        grid.addEventListener(type, dismissSwipeHint, { passive: true });
      });

      var runHintAnimation = function () {
        if (hintDismissed || !isCarouselActive()) return;
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return; // adjacent-card previews are already visible from load; no motion needed

        hintAnimating = true;
        grid.classList.add('mg-pricing__grid--hint-active');
        var startLeft = grid.scrollLeft;
        var nudge = 24; // px — a small nudge, not a full peek reveal
        var duration = 260;

        function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

        function tween(from, to, onDone) {
          var start = null;
          function step(ts) {
            if (!hintAnimating) return; // interrupted mid-flight by dismissSwipeHint()
            if (!start) start = ts;
            var t = Math.min(1, (ts - start) / duration);
            grid.scrollLeft = from + (to - from) * easeInOut(t);
            if (t < 1) requestAnimationFrame(step);
            else onDone();
          }
          requestAnimationFrame(step);
        }

        tween(startLeft, startLeft + nudge, function () {
          if (!hintAnimating) return;
          tween(startLeft + nudge, startLeft, function () {
            hintAnimating = false;
            grid.classList.remove('mg-pricing__grid--hint-active');
          });
        });
      };

      if ('IntersectionObserver' in window) {
        var hintIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              hintIO.disconnect();
              setTimeout(runHintAnimation, 500);
            }
          });
        }, { threshold: 0.4 });
        hintIO.observe(grid);
      } else {
        setTimeout(runHintAnimation, 800);
      }
    }
  }
})();
