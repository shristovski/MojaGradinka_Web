# mojaGradinka — final technical optimization brief for Claude

## Context

This is the final approved design of the website:

`https://shristovski.github.io/MojaGradinka_Web/index.html`

Perform a careful technical optimization of the existing implementation for desktop, tablet, and mobile.

## Non-negotiable design freeze

**Do not redesign or visually restyle anything.** The current appearance is approved and must remain pixel-equivalent.

Do not change:

- layout, section order, spacing, sizing, alignment, colors, typography, copy, icons, illustrations, photos, decorative elements, cards, buttons, borders, shadows, or animation concept;
- the current responsive visual composition unless a genuine overflow, clipping, overlap, distortion, or usability bug is being fixed;
- the desktop GSAP/ScrollTrigger scene sequence or the intended mobile stacked layout;
- IDs and anchors unless every reference is updated and behavior remains identical.

Optimization means improving loading, stability, accessibility, SEO, resilience, security, maintainability, and mobile behavior **without changing the approved visual result**.

## Files to inspect before editing

Inspect the whole repository first, especially:

- `index.html`
- `app.css`
- `js/app.js`
- `privacy.html`
- `terms.html`
- all files under `assets/`

Do not assume an asset is unused from its filename. Confirm references in HTML, CSS, JavaScript, and metadata before removing anything.

## Confirmed findings from the live site

The following are verified on the current deployed version and should guide the work:

- The demo form still posts to `https://formspree.io/f/YOUR_FORM_ID`. This is a launch blocker because real enquiries cannot be delivered.
- The privacy sentence directly beside the demo form is commented out, although the form collects personal data.
- The page already has good foundations: one H1, Macedonian `lang`, description, canonical URL, Open Graph tags, JSON-LD, labelled form controls, named carousel controls, lazy loading for below-the-fold images, keyboard-controlled tabs, `aria-live` form status, responsive breakpoints, and `prefers-reduced-motion` handling. Preserve these.
- Current first-party code is approximately 36 KB HTML, 40 KB CSS, and 14 KB JavaScript before compression. The main likely payload cost is imagery and third-party animation/font resources, not the source text.
- Large raster assets include the phone mockups and web dashboard image. They currently lack responsive `srcset`/`sizes` alternatives.
- Google Fonts loads three families and multiple weights. GSAP, ScrollTrigger, and Lenis are loaded from third-party CDNs.
- Hero content correctly uses `fetchpriority="high"`; most below-the-fold images already use `loading="lazy"`.
- Breakpoints currently exist at 960 px, 640 px, and 380 px. Desktop horizontal scenes fall back to normal stacked sections below 961 px.

## Priority 0 — preserve a safe working baseline

Before changing code:

1. Create a new branch or checkpoint commit.
2. Record screenshots at these viewport sizes for later regression comparison:
   - 1440 × 900
   - 1024 × 768
   - 768 × 1024
   - 430 × 932
   - 390 × 844
   - 360 × 800
   - 320 × 568
3. Record the current section positions and verify every navigation anchor.
4. Run Lighthouse once for mobile and once for desktop and save the reports as the baseline.

Do not make visual improvements based only on Lighthouse suggestions. Apply only technical fixes that preserve the design.

## Priority 1 — fix production blockers

### 1. Make the demo form operational

- Replace `YOUR_FORM_ID` with the real production endpoint supplied by the owner.
- If the endpoint is not available, **do not invent an ID or service**. Leave a clearly documented blocker and keep the code ready for one configuration value.
- Keep submission asynchronous and on the same page.
- Preserve native validation and the current Macedonian success/error messages.
- Add an explicit request timeout or abort handling so the button cannot remain disabled indefinitely.
- Prevent duplicate submissions while a request is active.
- Continue using the honeypot, but treat it only as basic spam reduction, not complete anti-spam protection.
- Verify success, invalid input, server rejection, offline/network failure, slow response, and rapid double-click behavior.
- Never log personal form data to the console.

### 2. Restore the privacy notice beside the form

- Uncomment or restore the existing short privacy sentence and link it to `privacy.html`.
- Do not add a marketing-consent checkbox unless legally/business-required; the form is for responding to a user-requested demo.
- Confirm that `privacy.html` accurately states what fields are collected, why, where they are sent, retention, and contact details.
- Verify `privacy.html` and `terms.html` return 200 and work from both the GitHub Pages project path and the production custom domain.

## Priority 2 — performance and Core Web Vitals

### 3. Optimize raster assets without changing their appearance

Create optimized versions while preserving the original framing, transparency, color, and sharpness.

Focus first on:

- `assets/hero-photo.webp`
- `assets/mece-skirol.webp`
- `assets/phone-mockup-live.png`
- `assets/phone-mockup-cta.png`
- `assets/web_app.jpg`
- `assets/tree.png`
- `assets/bears_walking.png`
- PNG icons under `assets/icons/`

Requirements:

- Generate appropriately sized AVIF/WebP variants where quality is visually indistinguishable.
- Keep PNG only where alpha/transparency or image quality requires it.
- Use `<picture>` with safe fallback where useful.
- Add meaningful `srcset` and `sizes` for large responsive images. Do not make mobile download the 3004 px dashboard or full desktop phone mockup when a smaller source is sufficient.
- Do not upscale assets.
- Preserve correct intrinsic `width` and `height` attributes matching each source aspect ratio to prevent layout shift.
- Decorative images must remain `alt=""` and `aria-hidden="true"`; informative mockups retain useful alt text.
- Keep the hero as an eager, high-priority LCP candidate. Do not lazy-load it.
- Keep below-the-fold heavy images lazy-loaded and add `decoding="async"` where safe.
- Confirm lazy images still load before they enter the visible area and do not appear blank during the desktop horizontal scene.

### 4. Improve font loading

- Audit which font families, weights, and italic variants are genuinely rendered.
- Request only used weights/styles.
- Keep `display=swap`.
- Add `preconnect` for both `fonts.googleapis.com` and `fonts.gstatic.com` with correct `crossorigin` usage, or self-host legal WOFF2 files if the repository/project policy permits it.
- If self-hosting, subset carefully for Macedonian Cyrillic and Latin; do not accidentally remove Cyrillic glyphs.
- Do not replace the approved fonts or create visible typography changes.

### 5. Reduce animation runtime cost while retaining the same result

- Keep Lenis, GSAP, and ScrollTrigger only where they are actually needed.
- Preserve the desktop horizontal scene and current animation appearance.
- Avoid running expensive `getBoundingClientRect()` work for elements far outside the active viewport when possible.
- Pause or minimize the continuous animation loop when the document is hidden.
- Use one debounced or `requestAnimationFrame`-coalesced resize handler rather than repeated heavy recalculation.
- Ensure resize/orientation changes correctly refresh ScrollTrigger and clear stale transforms.
- On touch/mobile widths, do not initialize desktop-only pinning work.
- Continue to fully respect `prefers-reduced-motion` and preserve the stacked fallback.
- Do not use `will-change` globally; apply it narrowly and remove it when no longer beneficial.

### 6. Loading order and third-party resilience

- Ensure scripts do not block HTML parsing. `app.js` is already deferred; preserve or improve this behavior.
- Test the page when GSAP, ScrollTrigger, Lenis, or Google Fonts fails to load. Content and navigation must remain usable.
- Consider self-hosting the small pinned library versions if licensing/project policy permits, reducing third-party dependency and privacy exposure.
- If CDN scripts remain, add appropriate Subresource Integrity hashes and `crossorigin="anonymous"` after verifying the exact pinned files. Never invent hashes.
- Do not defer the hero stylesheet or apply a loading trick that causes flash/layout shift.

### 7. Caching and compression

- Keep assets fingerprintable or versioned where practical so long-lived caching can be used safely.
- GitHub Pages controls most response headers, so do not add fake server configuration that GitHub Pages ignores.
- Ensure assets are compressible and avoid duplicate copies of identical files.
- Produce a before/after table for total page weight, image weight, request count, LCP, CLS, INP/TBT, and Lighthouse scores.

## Priority 3 — mobile and responsive robustness

Test real behavior, not only CSS inspection.

### Known mobile issues confirmed from screenshots

Treat these as specific bugs that must be corrected, not as optional redesign suggestions:

1. In the security/access panel, the icons, headings, descriptions, dividers, and inner left/right padding are not consistently aligned between the four items on mobile. Make every item follow one consistent mobile grid and padding rule.
2. In the “Функционалности” heading area, the “Градинки / Родители” tab control extends beyond the right side of the viewport and becomes clipped. It must fit completely inside the mobile viewport without horizontal scrolling and without becoming too small to tap.
3. In the “Родители” feature panel, the first item and the following items use visibly different horizontal indentation. Use identical content alignment and spacing for every item while preserving the existing colors, typography, icons, dividers, and card appearance.
4. Use the mobile layout of the **“Дојди и погледни одблиску”** section as the approved reference for how the content portion of **“Мобилна апликација”** should behave on mobile. “Дојди и погледни одблиску” is correct: its title, paragraph, icon-and-text rows, content width, left/right padding, vertical rhythm, and readable use of the available viewport are the target. Adjust only the mobile layout of “Мобилна апликација” so it follows that same structural alignment and spacing logic. Do not copy its wording or assets, do not change the individual section identities, and do not alter either section's approved desktop appearance.

For all four fixes, compare before/after screenshots at 430 px, 390 px, 360 px, and 320 px widths. Apply the smallest mobile-scoped CSS/HTML changes necessary. Do not globally change the design system to solve a local responsive issue.

### 8. Prevent overflow, clipping, and overlap

At all listed viewport sizes verify:

- no horizontal scroll is created by content; do not merely hide a genuine layout bug with `overflow-x: hidden`;
- navigation remains readable and tappable when it wraps;
- hero title, bear, and CTA do not overlap or clip;
- tabs and previous/next buttons fit and remain usable;
- both feature panels are fully reachable;
- phone mockups maintain aspect ratio and never become a narrow or stretched sliver;
- the dashboard/laptop image remains readable and does not exceed the viewport;
- pricing cards do not overflow;
- form fields fit at 320 px width and remain usable when the on-screen keyboard appears;
- footer tree and bears do not cover links or text;
- 200% text zoom and browser font enlargement do not hide essential content.

Fix only confirmed responsive defects, using the smallest scoped CSS changes possible.

### 9. Touch usability

- Ensure interactive controls have an effective touch target around 44 × 44 CSS pixels without visually enlarging them if invisible padding/pseudo-elements can do it safely.
- Ensure controls have enough separation to prevent accidental taps.
- Do not depend on hover for essential information or functionality.
- Test tab switching, slider buttons, anchors, and form submission by touch.
- Confirm smooth scrolling does not fight native touch scrolling or cause scroll trapping.

### 10. Safe-area and mobile browser behavior

- Test iOS Safari and Android Chrome behavior, including orientation change.
- Apply `env(safe-area-inset-*)` only where actually needed, especially around footer/background decoration; do not visibly shift the established desktop design.
- Check that focus scrolling reveals the active form field above the mobile keyboard.

## Priority 4 — accessibility

### 11. Tabs and slider semantics

- Keep arrow-key operation.
- When changing panels, set the inactive `tabpanel` to `hidden` or otherwise ensure off-screen content is not exposed confusingly to keyboard/screen-reader navigation.
- Ensure each tab has a correct `aria-controls`, each panel has `aria-labelledby`, and only the active tab has `tabindex="0"`.
- Decide and document whether previous/next controls should move screen-reader focus; behavior must be predictable.
- Verify screen-reader announcement in VoiceOver and NVDA/Chrome if available.

### 12. Keyboard and focus

- Preserve the existing visible `:focus-visible` styling.
- Verify logical focus order from navigation through the page and form.
- Add a visually unobtrusive “Skip to main content” link if it can be introduced without changing the normal visual state.
- Ensure no animation/pinned section traps keyboard focus.
- Ensure all links and buttons activate with standard keyboard controls.

### 13. Form accessibility

- Keep explicit labels and appropriate input types.
- Change “Број на деца” to a suitable numeric input/input mode only if it does not alter the visual style; set sensible minimum/step constraints.
- Add useful autocomplete tokens where applicable, including organization for the kindergarten field if semantically appropriate.
- Associate validation errors with the relevant fields using `aria-invalid` and `aria-describedby` when errors occur.
- Keep status messages in an `aria-live` region and distinguish neutral “sending” from success semantically and visually without redesigning it.

### 14. Automated and manual checks

- Run axe or Lighthouse accessibility checks.
- Manually check keyboard-only navigation, screen-reader landmark/headings output, contrast, 200% zoom, reduced motion, and forced/high contrast where available.
- Do not alter brand colors unless a measured contrast failure exists. If one exists, report the exact pair and ratio before making the smallest possible correction.

## Priority 5 — SEO and sharing

### 15. Production URL correctness

- The current canonical and Open Graph URLs point to `https://mojagradinka.mk/` while the reviewed page is on the GitHub Pages project URL. Confirm which URL is production.
- If `mojagradinka.mk` is the real public domain, keep canonical/OG URLs there and verify every referenced asset exists on that domain.
- If the GitHub Pages URL remains the only public URL, update metadata consistently. Do not allow a canonical URL whose page/assets return errors.
- Ensure the site has one preferred host and redirect/normalization strategy where the hosting platform supports it.

### 16. Complete metadata and crawl files

- Verify `og:image` exists, is publicly accessible, and has a suitable social-preview size and aspect ratio.
- Add `og:image:width`, `og:image:height`, and `og:image:alt`.
- Add `twitter:title`, `twitter:description`, and `twitter:image` if they are not reliably inferred.
- Add `theme-color` using an existing approved brand/background color.
- Add `robots.txt` and `sitemap.xml` for the production domain.
- Add a web app manifest only if it provides genuine install/icon value; do not present the marketing website as the actual mobile product.
- Validate the JSON-LD. Keep claims factual; do not add ratings, reviews, pricing, availability, or organization facts that were not supplied.
- Consider adding factual `Organization` data only when official organization name, URL, logo, and contact information are confirmed.

## Priority 6 — security, privacy, and resilience

### 17. Front-end hardening suitable for GitHub Pages

- Pin third-party versions exactly.
- Add valid SRI where CDN assets remain.
- Add a conservative `Referrer-Policy` using supported markup/hosting configuration.
- Acknowledge that strong security headers such as CSP, HSTS customization, Permissions-Policy, and frame protection may require a host/CDN that supports response headers; do not pretend a non-functional file config secures GitHub Pages.
- If adding a CSP meta tag, test all fonts, images, styles, scripts, the Formspree connection, and inline JSON-LD/markup carefully. Do not deploy a CSP that silently breaks the site.
- Remove production console logs, dead code, commented secrets, and unused third-party calls.
- Never place private API keys in client-side code.

### 18. External form privacy

- Document that submitted data is sent to the selected form provider.
- Send only fields required for the demo request.
- Do not add analytics, trackers, cookies, fingerprinting, or marketing scripts as part of this optimization.

## Priority 7 — code quality and maintainability

### 19. Clean up safely

- Remove genuinely unused CSS selectors, JavaScript, and assets only after repository-wide reference checks and visual regression tests.
- Keep the existing naming approach and avoid a framework migration.
- Do not introduce React, Vue, a build system, or new runtime dependencies for this static page.
- Avoid minifying source files in the working repository unless the project already has an automated build step. Readability matters.
- Deduplicate resize/animation logic where possible.
- Add short comments only for non-obvious behavior, especially responsive scene fallbacks and reduced-motion handling.

### 20. Error-proof relative paths

- Verify every HTML page and asset works under the GitHub Pages subpath `/MojaGradinka_Web/` as well as the configured custom domain.
- Avoid root-relative paths such as `/assets/...` unless deployment is guaranteed at the domain root.
- Run an internal-link and missing-asset check with zero 404s.

## Required verification before completion

Run and report all of the following:

1. No visual regression at the seven baseline viewport sizes.
2. No horizontal content overflow at widths from 320 px through 1440 px.
3. All internal anchors and footer/legal links work.
4. All images load; no stretched images; no meaningful cumulative layout shift.
5. Feature tabs work with mouse, touch, Tab, Shift+Tab, and arrow keys.
6. Reduced-motion mode shows all content in normal document flow.
7. Demo form tests: invalid, successful, rejected, offline, slow, and duplicate submission.
8. Page remains readable if animation CDNs fail.
9. Lighthouse mobile and desktop reports, with before/after comparison.
10. Axe/accessibility scan with no critical or serious unresolved issues.
11. HTML validation and a check for missing assets/404s.
12. Privacy and Terms pages load and are linked correctly.
13. Social preview and structured data validation.

Performance targets are goals, not permission to alter the design:

- CLS ≤ 0.10
- LCP ≤ 2.5 s on a representative mobile test
- INP ≤ 200 ms where measurable
- Lighthouse Performance ≥ 90 where feasible on static hosting
- Lighthouse Accessibility, Best Practices, and SEO ≥ 95

If a target cannot be met without a visible design change, preserve the design and document the tradeoff instead of changing it.

## Required final response from Claude

After implementation, provide:

- a concise summary of changes;
- exact files changed;
- before/after metrics and asset-size reductions;
- tests executed and their results;
- any remaining blockers, especially the real form endpoint or hosting-header limitations;
- confirmation that the design, content, section order, and intended animations were not changed;
- a short rollback note.

Do not claim a check passed unless it was actually run. Do not invent production credentials, form IDs, legal facts, performance measurements, or browser-test results.
