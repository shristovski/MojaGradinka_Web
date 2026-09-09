/* ============================================================
   mojaGradinka — app.js
   All page behaviour, externalized from the HTML so browsers can
   cache it separately from markup. Loaded with `defer` at the end
   of <body>, so the DOM above it is already parsed.

   Contents:
     1. Demo-form submission (Formspree/Web3Forms-style POST)
     2. Градинки / Родители tab switch (click + keyboard)
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

  function setStatus(kind, message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = false;
    statusEl.classList.remove('mg-form__status--ok', 'mg-form__status--error');
    statusEl.classList.add(kind === 'ok' ? 'mg-form__status--ok' : 'mg-form__status--error');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

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

    if (submitBtn) submitBtn.disabled = true;
    setStatus('ok', 'Се испраќа...');

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
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
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();

// ------------------------------------------------------------
// 2. Градинки / Родители tab switch (Сè section)
// Click + full keyboard support (Left/Right/Home/End + roving tabindex),
// matching the WAI-ARIA "Tabs" pattern.
// ------------------------------------------------------------
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.mg-features__tab'));
  if (!tabs.length) return;

  function activate(tab) {
    var name = tab.getAttribute('data-tab');
    tabs.forEach(function (t) {
      var active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('.mg-features__panel').forEach(function (panel) {
      var show = panel.getAttribute('data-panel') === name;
      panel.hidden = !show;
      // panels start/stay hidden until switched to, so their [data-anim]
      // cards never intersect the IntersectionObserver in the entrance-
      // reveals script below — reveal them directly the first time this
      // panel is shown, instead of leaving them stuck at opacity:0
      if (show) {
        panel.querySelectorAll('[data-anim]').forEach(function (el) {
          el.classList.add('in-view');
        });
      }
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { activate(tab); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        next.focus();
        activate(next);
      }
    });
  });
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
    window.addEventListener('resize', function () {
      render(window.scrollY || document.documentElement.scrollTop);
    });
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
  function frame(time) {
    if (lenis) lenis.raf(time);
    var target = lenis ? lenis.scroll : (window.scrollY || document.documentElement.scrollTop);
    smooth += (target - smooth) * 0.12;
    if (Math.abs(target - smooth) < 0.05) smooth = target;
    render(smooth);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', function () { render(smooth); });
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
