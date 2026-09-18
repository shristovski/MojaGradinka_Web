# mojaGradinka Final Web Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Testing-paradigm note:** this is a static HTML/CSS/vanilla-JS site with no test framework, no build step, and no package.json. There is no `pytest`/`jest` cycle. Every task's "test" step is a concrete, runnable verification instead: a headless-Chrome render + pixel/console check, the project's HTML tag-balance checker, a link/asset-existence check, or (for the baseline/final tasks) Lighthouse/axe. Treat each verification step exactly as strictly as a failing/passing unit test — do not mark a task done without running it and reading the actual output.

**Goal:** Execute `MojaGradinka_FINAL_WEB_OPTIMIZATION_CLAUDE.md` end-to-end: fix the two production blockers, cut page weight and animation cost, fix four confirmed mobile layout bugs, close accessibility gaps, complete SEO metadata, harden the front end, and clean up dead assets — **without changing any approved visual result** at 1440×900, 1024×768, 768×1024, 430×932, 390×844, 360×800, or 320×568.

**Architecture:** No new files, no build tooling, no framework. Every change is a scoped edit to the existing `index.html` / `app.css` / `js/app.js` / `privacy.html` / `terms.html`, plus new static files where the brief explicitly asks for them (`robots.txt`, `sitemap.xml`, a handful of resized image variants). Image variants are generated with Python's `PIL`/`Pillow` (confirmed installed, with native WebP **and** AVIF encoder support) or `cwebp` (confirmed installed at `/opt/homebrew/bin/cwebp`) — no new dependency is added to the repo itself.

**Tech Stack:** Static HTML5 / CSS3 / ES5-style vanilla JS. GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.14 via jsdelivr CDN. Deployed on GitHub Pages under the `/MojaGradinka_Web/` subpath (repo `shristovski/MojaGradinka_Web`), with `mojagradinka.mk` as the intended eventual production domain (canonical/OG URLs already intentionally point there — see the existing code comment at `index.html:10-13`; this plan does not change that decision).

**Spec:** `MojaGradinka_FINAL_WEB_OPTIMIZATION_CLAUDE.md` (repo root)

## Global Constraints

- **Design freeze:** no visible change to layout, section order, spacing, sizing, alignment, colors, typography, copy, icons, illustrations, photos, decorative elements, cards, buttons, borders, shadows, or animation concept, at any of the 7 baseline viewports — every task that touches CSS/HTML must screenshot-diff before/after at the viewports relevant to that task.
- Do not invent a Formspree ID, legal facts, performance numbers, or test results. Where a real value is required and unavailable (the form endpoint), leave a documented blocker, not a placeholder pretending to be real.
- Do not add a build system, framework, or new runtime dependency. Keep files human-readable (no minification).
- Every asset removal requires a fresh repo-wide reference grep immediately before deletion — the existing `UNUSED_ASSETS_REVIEW.md` is one release old and is already known to be stale (it lists `leaf_03_blue_teardrop.svg` as unused; it is now referenced at `index.html`'s `.mg-features__leaf`). Re-verify, don't trust it blindly.
- No `console.*` calls in shipped JS; no secrets/keys anywhere in client code.
- Work happens directly on the `production-optimization` branch (current branch), one commit per task, each ending with the repo's standard attribution trailer. Never push without being asked.
- GitHub Pages serves static files only — do not write server-config files (`.htaccess`, `nginx.conf`, custom headers) that GitHub Pages ignores; note any header-level hardening (CSP via HTTP header, HSTS, Permissions-Policy) as a hosting-level limitation instead of faking it.

## Shared verification helpers

These are reused by almost every task below. Written once here so tasks can just say "run the tag-balance check" instead of repeating the script.

**HTML tag-balance check** (catches unclosed/mismatched tags; void elements written as `<img ... />` legitimately fire a synthetic end-tag in Python's parser, so the checker's void-tag set must include them or it reports false positives — confirmed working correctly against this repo in the audit pass):

```bash
python3 - <<'EOF'
from html.parser import HTMLParser
import sys

class Checker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.void = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
        self.errors = []
    def handle_starttag(self, tag, attrs):
        if tag not in self.void:
            self.stack.append(tag)
    def handle_endtag(self, tag):
        if tag in self.void:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"mismatch: expected close {self.stack[-1] if self.stack else '(empty)'}, got {tag}")
        else:
            self.stack.pop()

ok = True
for path in ['index.html', 'privacy.html', 'terms.html']:
    c = Checker()
    c.feed(open(path, encoding='utf-8').read())
    if c.errors or c.stack:
        ok = False
        print(path, "FAIL", c.errors, "unclosed:", c.stack)
    else:
        print(path, "OK")
sys.exit(0 if ok else 1)
EOF
```

**Link/asset existence check** (every local `href`/`src`/`srcset` resolves to a real file):

```bash
python3 - <<'EOF'
import re, os, sys
ok = True
for page in ['index.html', 'privacy.html', 'terms.html']:
    html = open(page, encoding='utf-8').read()
    for attr in ('href', 'src'):
        for m in re.finditer(attr + r'="([^"]+)"', html):
            val = m.group(1)
            if val.startswith(('http://', 'https://', 'mailto:', '#', 'data:')):
                continue
            path = val.split('#')[0]
            if path and not os.path.exists(path):
                ok = False
                print(page, attr, val, "MISSING")
    for m in re.finditer(r'srcset="([^"]+)"', html):
        for part in m.group(1).split(','):
            path = part.strip().split(' ')[0]
            if path and not path.startswith(('http://','https://')) and not os.path.exists(path):
                ok = False
                print(page, "srcset", path, "MISSING")
print("OK, no missing assets" if ok else "FAILURES ABOVE")
sys.exit(0 if ok else 1)
EOF
```

**Viewport screenshot capture** (used for before/after regression comparison — run once per task against the specific sections that task touches, and once in full for the final Task 25 baseline-vs-final pass):

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
declare -a SIZES=("1440,900" "1024,768" "768,1024" "430,932" "390,844" "360,800" "320,568")
for wh in "${SIZES[@]}"; do
  w="${wh%,*}"; h="${wh#*,}"
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/shot_${w}x${h}.png" \
    --window-size="${w},${h}" --hide-scrollbars --virtual-time-budget=4000 \
    "file://$(pwd)/index.html" 2>/dev/null
done
```

---

## Priority 0 — Baseline

### Task 1: Checkpoint commit and regression baseline

**Files:** none modified — capture only.

- [ ] **Step 1: Confirm branch and clean working tree**

```bash
git branch --show-current   # must print: production-optimization
git status --short          # must be empty (aside from any pre-existing untracked scratch files you don't own)
```

- [ ] **Step 2: Capture the 7-viewport baseline screenshots**

Run the shared "Viewport screenshot capture" helper above, then copy the results somewhere durable for later diffing:

```bash
mkdir -p /tmp/mg-baseline
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
declare -a SIZES=("1440,900" "1024,768" "768,1024" "430,932" "390,844" "360,800" "320,568")
for wh in "${SIZES[@]}"; do
  w="${wh%,*}"; h="${wh#*,}"
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/mg-baseline/${w}x${h}.png" \
    --window-size="${w},${h}" --hide-scrollbars --virtual-time-budget=4000 \
    "file://$(pwd)/index.html" 2>/dev/null
done
ls /tmp/mg-baseline   # expect 7 PNGs
```

- [ ] **Step 3: Verify every navigation anchor resolves**

```bash
grep -o 'href="#[a-z-]*"' index.html | sort -u
# for each, confirm a matching id="..." exists:
grep -o 'id="[a-z-]*"' index.html | sort -u
```
Cross-check by eye that every anchor target (`#se`, `#za-koga-e`, `#vo-zivo`, `#dojdi`, `#veb-aplikacija`, `#demo-forma`, `#footer`, `#top`, etc.) has a matching `id`.

- [ ] **Step 4: Run Lighthouse baseline (mobile + desktop) and save reports**

```bash
python3 -m http.server 8123 &
SERVER_PID=$!
sleep 1
npx --yes lighthouse@13.5.0 http://localhost:8123/index.html \
  --output=json --output-path=/tmp/mg-baseline/lighthouse-mobile.json \
  --preset=perf --form-factor=mobile --screenEmulation.mobile \
  --quiet --chrome-flags="--headless=new"
npx --yes lighthouse@13.5.0 http://localhost:8123/index.html \
  --output=json --output-path=/tmp/mg-baseline/lighthouse-desktop.json \
  --preset=perf --form-factor=desktop --screenEmulation.disabled \
  --quiet --chrome-flags="--headless=new"
kill $SERVER_PID
python3 -c "
import json
for name in ['mobile','desktop']:
    d = json.load(open(f'/tmp/mg-baseline/lighthouse-{name}.json'))
    cats = d['categories']
    print(name, {k: round(v['score']*100) for k,v in cats.items()})
    print('  LCP', d['audits']['largest-contentful-paint']['displayValue'])
    print('  CLS', d['audits']['cumulative-layout-shift']['displayValue'])
    print('  TBT', d['audits']['total-blocking-time']['displayValue'])
"
```

If `npx lighthouse` cannot reach npm (offline), record that explicitly as a skipped baseline rather than inventing numbers, and rely on the manual Core Web Vitals checks in Task 25 instead.

- [ ] **Step 5: Commit the checkpoint marker**

No file changes are needed for a checkpoint — the current `HEAD` on `production-optimization` (commit `a7dedc3` as of plan-writing time; confirm with `git log -1 --oneline` since more commits may have landed since) **is** the baseline. Record its hash:

```bash
git log -1 --oneline > /tmp/mg-baseline/checkpoint-commit.txt
cat /tmp/mg-baseline/checkpoint-commit.txt
```

No commit needed for this task — it produces artifacts in `/tmp`, not repo changes.

---

## Priority 1 — Production blockers

### Task 2: Harden the demo-form submit handler

**Files:**
- Modify: `js/app.js:41-82` (the `form.addEventListener('submit', ...)` handler)

**Interfaces:**
- Consumes: existing `form`, `statusEl`, `submitBtn`, `setStatus(kind, message)` from the enclosing IIFE (lines 26-40, unchanged).
- Produces: same external behavior (same status messages, same `form.reset()` on success), plus a hard 15s timeout and an explicit re-entrancy guard. No other task depends on this function's internals.

- [ ] **Step 1: Add an `isSubmitting` guard and an `AbortController` timeout**

Replace the whole `form.addEventListener('submit', ...)` block (`js/app.js:41-82`):

```js
  var isSubmitting = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (isSubmitting) return; // extra guard on top of submitBtn.disabled, belt-and-braces against rapid double-submit

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

    // hard timeout so a stalled/hanging request can never leave the button
    // disabled forever — 15s is generous for a small form POST
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;

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
      .catch(function (err) {
        if (err && err.name === 'AbortError') {
          setStatus('error', 'Испраќањето трае предолго. Обидете се повторно или пишете ни директно на kontakt@mojagradinka.mk.');
        } else {
          setStatus('error', 'Настана грешка при испраќање. Обидете се повторно или пишете ни директно на kontakt@mojagradinka.mk.');
        }
      })
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  });
```

- [ ] **Step 2: Verify with the tag-balance check (sanity — this is a JS-only change but confirms nothing else broke)**

Run the shared HTML tag-balance check. Expected: `index.html OK`, `privacy.html OK`, `terms.html OK` (this task doesn't touch HTML, this just confirms the working tree is otherwise sane before committing JS).

- [ ] **Step 3: Manually test all 6 submit scenarios via a throwaway local copy**

```bash
cp index.html /tmp/form-test.html
cp -r js assets /tmp/
cp app.css /tmp/
```

For each scenario, patch `/tmp/form-test.html`'s `<form action="...">` or inject a `window.fetch` override via an appended `<script>`, then headless-render and read the `.mg-form__status` text via an injected debug banner (same pattern used throughout this session — see any earlier turn's `debug*.png` banner technique). Confirm each of:
1. **Invalid** (empty required field, submit) → native browser validation UI fires, no fetch sent.
2. **Successful** (mock `fetch` returns `{ok:true}`) → "Ви благодариме! Ќе ве контактираме наскоро.", form resets.
3. **Rejected** (mock `fetch` returns `{ok:false, status:422}`) → the generic error message, button re-enabled.
4. **Offline / network failure** (mock `fetch` that rejects with a plain `TypeError`) → the generic error message, button re-enabled.
5. **Slow** (mock `fetch` that never resolves) → after 15s, the abort-timeout error message fires, button re-enabled (this one needs the injected mock's promise to never resolve/reject on its own, so you can observe the real `setTimeout(...,15000)` firing — don't shrink the real timeout to test faster, instead temporarily lower it to e.g. 500ms in the copy only, confirm the abort path fires, then confirm the real file still says 15000).
6. **Rapid double-click** (dispatch two `submit` events back to back synchronously) → only one `fetch` call recorded (instrument by wrapping `window.fetch` with a call counter in the mock).

Record pass/fail for all 6 in your task-completion notes.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "$(cat <<'EOF'
Harden demo-form submission: abort timeout + re-entrancy guard

- 15s AbortController timeout so a stalled fetch can never leave the
  submit button disabled indefinitely.
- Explicit isSubmitting guard as a second line of defense against
  rapid double-submission, on top of the existing disabled-button check.
- No change to validation, messages, or honeypot behavior.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 3: Restore the privacy notice beside the demo form

**Files:**
- Modify: `index.html:488` (currently a commented-out `<p class="mg-form__privacy">`)

**Interfaces:** none — pure markup restoration, no JS/CSS dependency (the `.mg-form__privacy` class already has no special CSS rule, so it inherits paragraph styling; confirm this doesn't look broken in Step 2).

- [ ] **Step 1: Uncomment the privacy sentence**

Replace at `index.html:488`:

```html
        <!-- <p class="mg-form__privacy">Со испраќање на формата се согласувате податоците да се користат исклучиво за контакт во врска со демонстрацијата — видете ја нашата <a href="privacy.html">Политика на приватност</a>.</p> -->
```

with:

```html
        <p class="mg-form__privacy">Со испраќање на формата се согласувате податоците да се користат исклучиво за контакт во врска со демонстрацијата — видете ја нашата <a href="privacy.html">Политика на приватност</a>.</p>
```

- [ ] **Step 2: Screenshot the form section before/after at 1440×900 and 390×844, confirm no overlap/clipping**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --screenshot=/tmp/form-1440.png --window-size=1440,2600 --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html#demo-forma" 2>/dev/null
"$CHROME" --headless --disable-gpu --screenshot=/tmp/form-390.png --window-size=390,3200 --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html#demo-forma" 2>/dev/null
```
Read both, crop to the form area, confirm the new sentence sits cleanly between the honeypot field and the submit button with no overlap, no odd line-wrap, and text is legible against the form's background.

- [ ] **Step 3: Confirm `privacy.html` still matches what this sentence promises**

Read `privacy.html` and confirm section 2 ("Кои податоци ги собираме") already lists exactly the fields this form actually collects (name, kindergarten name, role, email, phone, kids count) — it does per this session's earlier read; if a field was added/removed from the form since, update `privacy.html` section 2 to match, but do not invent new legal language beyond what's already there (the `[LEGAL REVIEW REQUIRED]` flag and `[ОВДЕ: ...]` placeholders stay — that's the brief's own boundary: leave a documented blocker, don't invent legal facts).

- [ ] **Step 4: Verify `privacy.html` and `terms.html` load correctly under the GitHub Pages subpath**

```bash
python3 -m http.server 8124 &
SERVER_PID=$!
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8124/privacy.html
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8124/terms.html
kill $SERVER_PID
```
Expected: `200` for both. (This is a local static-file check standing in for "works under `/MojaGradinka_Web/privacy.html`" — GitHub Pages serves the same static file tree, and the link/asset-existence check in Task 25 covers cross-page reference correctness.)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Restore the privacy notice beside the demo form

The form collects personal data (name, email, phone, child count) but
the privacy sentence linking to privacy.html was commented out.
Restored it with no wording changes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

## Priority 2 — Performance and Core Web Vitals

### Task 4: Deduplicate the identical phone-mockup files

**Files:**
- Delete: `assets/phone-mockup-cta.png`, `assets/phone-mockup-cta.webp`
- Modify: `index.html:351-352` (repoint to the surviving `phone-mockup-live` files)

**Interfaces:** none.

- [ ] **Step 1: Re-confirm the files are still byte-identical (state may have changed since the audit)**

```bash
md5 -q assets/phone-mockup-live.png assets/phone-mockup-cta.png
md5 -q assets/phone-mockup-live.webp assets/phone-mockup-cta.webp
```
Expected: matching pairs. If they no longer match (someone changed one of the two images since the audit), **stop this task** — they're no longer duplicates and must stay as separate files.

- [ ] **Step 2: Repoint the second usage to the surviving files**

Replace at `index.html:351-352`:

```html
          <source srcset="assets/phone-mockup-cta.webp" type="image/webp" />
          <img class="mg-scene-phone" src="assets/phone-mockup-cta.png" alt="Функционалностите на апликацијата" width="1034" height="1828" loading="lazy" />
```

with:

```html
          <source srcset="assets/phone-mockup-live.webp" type="image/webp" />
          <img class="mg-scene-phone" src="assets/phone-mockup-live.png" alt="Функционалностите на апликацијата" width="1034" height="1828" loading="lazy" />
```

(Keep the distinct `alt` text — the two usages are different sections with different accessible descriptions, only the visual asset was duplicated.)

- [ ] **Step 3: Delete the now-unreferenced duplicate files**

```bash
grep -rn "phone-mockup-cta" index.html app.css js/app.js privacy.html terms.html
# must print nothing before deleting
rm assets/phone-mockup-cta.png assets/phone-mockup-cta.webp
```

- [ ] **Step 4: Run the link/asset-existence check**

Run the shared link/asset check. Expected: `OK, no missing assets`.

- [ ] **Step 5: Screenshot both sections that use this image (the Родители scene and the Дојди/CTA scene) at 1440×900 and 390×844, confirm pixel-identical to baseline**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --screenshot=/tmp/dup-check-1440.png --window-size=1440,900 --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html" 2>/dev/null
```
Read it, crop to the phone-mockup areas, compare against the Task 1 baseline screenshot — must be visually identical (same image, just deduplicated at the file level).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Dedupe phone-mockup-cta.{png,webp} — byte-identical to phone-mockup-live

Both files were confirmed byte-for-byte identical to phone-mockup-live
(same MD5). Repointed the second usage to the surviving files and
deleted the duplicates: saves ~361KB (PNG fallback path) / ~45.5KB
(WebP path) of duplicate transfer, since both were previously
downloaded separately under different URLs.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 5: Fix hero-photo intrinsic dimensions and add `decoding="async"`

**Files:**
- Modify: `index.html:79` (hero `width`/`height`)
- Modify: every lazy-loaded `<img>` tag with `loading="lazy"` (add `decoding="async"`) — confirmed list: `index.html:301` (phone-mockup, post-Task-4 line number), `:367` (web_app), `:499` (tree), `:503` (bears_walking), plus every `assets/icons/*.png` occurrence (20 tags, one per icon reference across the "Ние"/"Сè" panels).

**Interfaces:** none.

- [ ] **Step 1: Fix the hero photo's `width`/`height` to match its real intrinsic size**

The actual file is 1672×941 (ratio 1.777), not 1600×1600. Confirmed via `.mg-hero__photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}` (`app.css:257`) and `.mg-hero{height:620px}` (`app.css:250`, overridden at the three responsive breakpoints) that the box is entirely parent-sized, **not** sized by the `<img>`'s own intrinsic attributes — so this is a metadata-correctness fix with zero CLS/visual impact, safe under the design freeze.

Replace at `index.html:79`:
```html
        <img class="mg-hero__photo" src="assets/hero-photo.png" alt="Детска соба во градинка" width="1600" height="1600" fetchpriority="high" />
```
with:
```html
        <img class="mg-hero__photo" src="assets/hero-photo.png" alt="Детска соба во градинка" width="1672" height="941" fetchpriority="high" />
```

- [ ] **Step 2: Add `decoding="async"` to every lazy-loaded image**

For each of the following exact tags, add ` decoding="async"` immediately after `loading="lazy"`. Use `grep -n 'loading="lazy"' index.html` first to get the live line numbers (they will have shifted from the audit's numbers after Tasks 3-4), then edit each one. Do **not** add `decoding="async"` to the hero photo (it has no `loading` attribute — it's the eager LCP candidate and must stay exactly as-is besides the width/height fix in Step 1).

Example of the transform for one tag (repeat for all ~24 lazy `<img>` tags — the 4 large decorative/content images plus the 20 icon images):
```html
<!-- before -->
<img src="assets/icons/shield-heart.png" alt="" aria-hidden="true" width="160" height="113" loading="lazy" />
<!-- after -->
<img src="assets/icons/shield-heart.png" alt="" aria-hidden="true" width="160" height="113" loading="lazy" decoding="async" />
```

A safe way to apply this mechanically without hand-editing 24 call sites:
```bash
python3 - <<'EOF'
import re
with open('index.html', encoding='utf-8') as f:
    html = f.read()
# only touch tags that already say loading="lazy" and don't already have decoding=
def add_decoding(m):
    tag = m.group(0)
    if 'decoding=' in tag:
        return tag
    return tag.replace('loading="lazy"', 'loading="lazy" decoding="async"')
new_html = re.sub(r'<img\b[^>]*loading="lazy"[^>]*/?>', add_decoding, html)
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)
print("done")
EOF
```

- [ ] **Step 3: Verify the count and spot-check the result**

```bash
grep -c 'decoding="async"' index.html   # expect ~24 (one per lazy image)
grep -c 'loading="lazy"' index.html     # must be the same count as above
grep -A0 'fetchpriority="high"' index.html  # hero tag — confirm NO decoding= was added here
```

- [ ] **Step 4: Run the tag-balance check**

Run the shared HTML tag-balance check. Expected: all three files `OK`.

- [ ] **Step 5: Full-page screenshot at 1440×900 and 390×844, confirm identical to baseline (this is a non-visual attribute change)**

Compare against Task 1's baseline screenshots. Must be pixel-identical — `decoding` and corrected `width`/`height` metadata have no rendering effect given the fixed-box CSS confirmed above.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Fix hero-photo intrinsic size metadata, add decoding=async to lazy images

- hero-photo width/height corrected from 1600x1600 to the real 1672x941
  (the display box is entirely parent-sized via object-fit:cover, so
  this was a metadata-only bug with no actual CLS impact).
- Added decoding="async" to every lazy-loaded image (4 content images
  + 20 icon images) so their decode never blocks the main thread; left
  the hero photo (eager, fetchpriority=high) untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 6: Add responsive `srcset`/`sizes` for the oversized dashboard image

**Files:**
- Create: `assets/web_app-780w.jpg`, `assets/web_app-1560w.jpg`, `assets/web_app-780w.webp`, `assets/web_app-1560w.webp` (generated)
- Modify: `index.html` (the `.mg-laptop__screen` `<picture>` block, currently around line 365-368 pre-Task-4/5 shift — re-locate with `grep -n 'web_app'`)

**Interfaces:** none.

- [ ] **Step 1: Confirm the display ceiling for this image**

`.mg-laptop { max-width: 780px; }` (`app.css:629`) — the image is never displayed wider than 780 CSS px at any viewport. The source is 3004×1434 (2.16MB→350.7KB JPEG / 83KB WebP already). Even at 3x device-pixel-ratio, 780px display width only needs 2340 real pixels — so a single 1560w (2x) variant plus the existing full 3004w as a 3x+ ceiling covers every realistic case, and a 780w (1x) variant covers the common case cheaply.

- [ ] **Step 2: Generate the two smaller JPEG + WebP variants with PIL**

```bash
python3 - <<'EOF'
from PIL import Image

src = Image.open('assets/web_app.jpg')
assert src.size == (3004, 1434), src.size

for w in (780, 1560):
    h = round(w * 1434 / 3004)
    resized = src.resize((w, h), Image.LANCZOS)
    resized.save(f'assets/web_app-{w}w.jpg', quality=82, optimize=True)
    resized.save(f'assets/web_app-{w}w.webp', quality=80, method=6)
    print(w, h, 'done')
EOF
ls -la assets/web_app-*.jpg assets/web_app-*.webp
```

- [ ] **Step 3: Visually confirm no quality loss vs the original at display size**

```bash
python3 -c "
from PIL import Image
im = Image.open('assets/web_app-780w.jpg')
im.save('/tmp/web_app_780_check.png')
"
```
Read `/tmp/web_app_780_check.png` and compare against a crop of the original at the same 780px width — must be visually indistinguishable (this is a dashboard screenshot with UI text; check the text stays legible, not just "looks fine at a glance").

- [ ] **Step 4: Wire up `srcset`/`sizes` in the `<picture>` block**

Find the current block with `grep -n 'web_app' index.html`, then replace it with:

```html
        <picture>
          <source
            srcset="assets/web_app-780w.webp 780w, assets/web_app-1560w.webp 1560w, assets/web_app.webp 3004w"
            sizes="(max-width: 780px) calc(100vw - 48px), 780px"
            type="image/webp" />
          <img
            src="assets/web_app.jpg"
            srcset="assets/web_app-780w.jpg 780w, assets/web_app-1560w.jpg 1560w, assets/web_app.jpg 3004w"
            sizes="(max-width: 780px) calc(100vw - 48px), 780px"
            alt="Веб апликација — контролна табла" width="3004" height="1434" loading="lazy" decoding="async" />
        </picture>
```

(The `sizes` value matches `.mg-section`'s `padding: 96px var(--gutter) 0` where `--gutter: 24px` — on any viewport narrower than 780+48=828px the image fills `100vw - 48px`; above that it's pinned at the 780px `max-width`.)

- [ ] **Step 5: Run the link/asset-existence check**

Run the shared check. Expected: `OK, no missing assets` (confirms all 4 new srcset URLs resolve).

- [ ] **Step 6: Screenshot the Веб апликација section at 1440×900, 768×1024, and 390×844; confirm identical framing to baseline**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for wh in "1440,2200" "768,2600" "390,3400"; do
  w="${wh%,*}"; h="${wh#*,}"
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/webapp-${w}.png" --window-size="${w},${h}" --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html#veb-aplikacija" 2>/dev/null
done
```
Read each, crop to the laptop-screen area, compare against baseline.

- [ ] **Step 7: Commit**

```bash
git add assets/web_app-780w.jpg assets/web_app-1560w.jpg assets/web_app-780w.webp assets/web_app-1560w.webp index.html
git commit -m "$(cat <<'EOF'
Add responsive srcset for the dashboard image (never displayed wider than 780px)

.mg-laptop caps this image at max-width:780px at every viewport, but
it was shipping the full 3004px source (350.7KB JPEG / 83KB WebP) to
every device. Added 780w/1560w variants (covers 1x/2x DPR at the
actual display ceiling) with matching srcset+sizes; the original
3004w file stays in the srcset as the 3x+ ceiling so nothing is lost
for very high-DPR screens.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 7: Trim unused font weights, add the missing preconnect

**Files:**
- Modify: `index.html:29` (Google Fonts URL), and the matching line in `privacy.html`, `terms.html`
- Modify: `index.html`, `privacy.html`, `terms.html` (add `fonts.googleapis.com` preconnect)

**Interfaces:** none.

- [ ] **Step 1: Confirm the exact weights actually used (re-verify — CSS may have changed since the audit)**

```bash
grep -n "font-family: var(--font-serif)" app.css   # Literata usage sites
grep -n "font-family: var(--font-round)" app.css    # Fredoka usage sites
grep -n "font-weight" app.css | grep -B1 -A1 "Literata\|Fredoka" 2>/dev/null
```
Confirm: Literata is used only at italic weight 500 (one site, `app.css:285` at audit time); Fredoka is used only at weights 600 and 700 (no 500). If a new use of Literata italic 400 or Fredoka 500 was added since the audit, **do not remove that weight** — adjust this task to match current reality.

- [ ] **Step 2: Trim the Google Fonts URL in all three HTML files**

Replace (in `index.html:29`, and the equivalent line in `privacy.html` and `terms.html`):
```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Literata:ital,wght@1,400;1,500&family=Fredoka:wght@500;600;700&display=swap" rel="stylesheet" />
```
with:
```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Literata:ital,wght@1,500&family=Fredoka:wght@600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 3: Add the missing `fonts.googleapis.com` preconnect next to the existing `fonts.gstatic.com` one**

In all three files, find:
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
```
and add immediately before it:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
```
(No `crossorigin` on the googleapis one — that connection serves the CSS file itself, not a cross-origin font binary, so it doesn't need CORS mode; the existing gstatic preconnect correctly keeps `crossorigin=""` since it serves the actual font files.)

- [ ] **Step 4: Screenshot every heading/body-text-heavy section at 1440×900, confirm zero visible font change**

This is the single highest-risk task in the whole plan for a silent visual regression — a dropped weight that's secretly used somewhere will visibly change text. Screenshot the full page at 1440×900 and 390×844 and do a careful side-by-side read against baseline, paying special attention to: the "Спокојно детство" / "видите повеќе" script-font (Caveat, unaffected — self-hosted, not touched) headings, any bold Manrope 800 usage, and every Fredoka-round heading (600/700 weights, kept).

- [ ] **Step 5: Run the tag-balance and link-existence checks**

Both shared checks — expected: all pass (this task doesn't add/remove any file references, just trims a query string).

- [ ] **Step 6: Commit**

```bash
git add index.html privacy.html terms.html
git commit -m "$(cat <<'EOF'
Trim unused font weights, add missing fonts.googleapis.com preconnect

Google Fonts request included Literata italic 400 and Fredoka 500,
neither of which app.css actually uses (confirmed by grep — Literata
is only used at italic 500, Fredoka only at 600/700). Dropped both
unused weights from the request. Also added the preconnect for
fonts.googleapis.com that was missing (fonts.gstatic.com already had
one) — the browser now opens both font-related connections early
instead of discovering googleapis.com only after the CSS is parsed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 8: Scope `will-change` off the global `.btn` rule

**Files:**
- Modify: `app.css` (the `.btn { ... }` base rule, `app.css:182-190`-ish — re-locate with `grep -n '\.btn {'`)

**Interfaces:** none.

- [ ] **Step 1: Remove the unconditional `will-change: transform` from `.btn`**

Find the current `.btn { ... }` block and remove the `will-change: transform;` declaration from it — every button on the site (nav CTA, form submit, pricing cards, hero CTA) currently gets a permanently-promoted compositor layer it doesn't need; the transition is a simple background-color/transform hover effect, not a continuous animation.

- [ ] **Step 2: Confirm hover/active transitions still feel smooth (manual spot check)**

Render the page in a real browser (not headless — this is a feel check) or trust that a simple `transition: transform .2s` on `:hover` doesn't need `will-change` pre-promotion for a single small element; if a specific button demonstrably jitters on first hover after this change, add `will-change: transform` scoped to `.btn:hover` instead of the base rule (still narrower than before), rather than reverting wholesale.

- [ ] **Step 3: Run the brace-balance check**

```bash
python3 -c "
css = open('app.css').read()
print('braces', css.count('{'), css.count('}'))
"
```
Expected: equal counts.

- [ ] **Step 4: Screenshot every section with buttons at 1440×900, confirm identical to baseline**

No visual change is expected — `will-change` is a rendering-performance hint, not a paint property.

- [ ] **Step 5: Commit**

```bash
git add app.css
git commit -m "$(cat <<'EOF'
Remove global will-change:transform from .btn

Every button on the site (nav CTA, form submit, pricing, hero CTA)
was permanently promoted to its own compositor layer for a simple
hover transition that doesn't need it. will-change should be applied
narrowly to elements under continuous/active animation (already true
for [data-parallax], [data-scrolldrop]/[data-scrollslide], and
.dc-dot-el, which are untouched here).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 9: Coalesce resize handlers and pause the rAF loop when hidden

**Files:**
- Modify: `js/app.js:225-266` (section 4, the reduced-motion resize handler and the main rAF loop + its resize handler)

**Interfaces:**
- Consumes: `render(scroll)` (defined earlier in the same IIFE, unchanged signature).
- Produces: same external behavior; no other section of app.js depends on this IIFE's internals (it's a self-contained closure).

- [ ] **Step 1: rAF-coalesce the reduced-motion branch's resize handler**

Replace (currently around `js/app.js:225-231`):
```js
  if (reduce) {
    render(window.scrollY || document.documentElement.scrollTop);
    window.addEventListener('resize', function () {
      render(window.scrollY || document.documentElement.scrollTop);
    });
    return;
  }
```
with:
```js
  if (reduce) {
    render(window.scrollY || document.documentElement.scrollTop);
    var reduceResizeRAF = null;
    window.addEventListener('resize', function () {
      if (reduceResizeRAF) return;
      reduceResizeRAF = requestAnimationFrame(function () {
        reduceResizeRAF = null;
        render(window.scrollY || document.documentElement.scrollTop);
      });
    });
    return;
  }
```

- [ ] **Step 2: rAF-coalesce the main branch's resize handler and add visibility-aware pausing of the frame loop**

Replace (currently around `js/app.js:255-266`):
```js
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
```
with:
```js
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

  // pause the continuous rAF loop entirely while the tab is hidden —
  // browsers already throttle background rAF heavily, but this stops
  // the lerp/render work outright instead of relying on that throttle
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      rafId = requestAnimationFrame(frame);
    }
  });

  var mainResizeRAF = null;
  window.addEventListener('resize', function () {
    if (mainResizeRAF) return;
    mainResizeRAF = requestAnimationFrame(function () {
      mainResizeRAF = null;
      render(smooth);
    });
  });
```

- [ ] **Step 3: Verify the frame loop actually resumes after tab hide/show**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cp index.html /tmp/vis-test.html
python3 - <<'EOF'
p = "/tmp/vis-test.html"
html = open(p, encoding='utf-8').read()
script = """<script defer>
window.addEventListener('load', function(){
  setTimeout(function(){
    var d = document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;background:red;color:white;z-index:99999;font-size:16px;padding:10px;';
    document.body.appendChild(d);
    // simulate hide then show
    Object.defineProperty(document, 'hidden', {value: true, configurable: true});
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', {value: false, configurable: true});
    document.dispatchEvent(new Event('visibilitychange'));
    d.textContent = 'visibilitychange cycle dispatched without throwing';
  }, 500);
});
</script>"""
open(p, 'w', encoding='utf-8').write(html.replace('</body>', script + '</body>'))
EOF
cp -r assets js /tmp/ 2>/dev/null
cp app.css /tmp/
"$CHROME" --headless --disable-gpu --screenshot=/tmp/vis-check.png --window-size=800,200 --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/../../../tmp/vis-test.html" 2>/dev/null || \
"$CHROME" --headless --disable-gpu --screenshot=/tmp/vis-check.png --window-size=800,200 --hide-scrollbars --virtual-time-budget=4000 "file:///tmp/vis-test.html" 2>/dev/null
```
Read `/tmp/vis-check.png` — expect the banner text with no JS console errors (add the same `window.__errs` error-capture pattern used earlier this session if you need to confirm zero exceptions). Confirm page still renders/scrolls normally after the cycle (no frozen animation state).

- [ ] **Step 4: Screenshot full page at 1440×900, confirm parallax/dots/scroll-drop elements still animate identically to baseline on initial load**

This change only affects *when* the loop pauses, not its math — initial render should be pixel-identical to baseline.

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "$(cat <<'EOF'
rAF-coalesce resize handlers, pause main render loop when tab hidden

Both resize listeners previously called render() synchronously on
every single resize event (many fire per second during a drag-resize)
with a getBoundingClientRect() per [data-parallax] element on each
call — now coalesced to at most once per animation frame via a
pending-rAF guard.

Added a visibilitychange listener that cancels the continuous
requestAnimationFrame loop while the tab is hidden and restarts it on
return, instead of relying solely on the browser's own background-tab
throttling.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 10: Defer + SRI-pin the third-party CDN scripts, add resilience test

**Files:**
- Modify: `index.html:31, 545-551`-ish (Lenis stylesheet + all 3 CDN `<script>` tags — re-locate with `grep -n 'jsdelivr'`)

**Interfaces:** none.

- [ ] **Step 1: Re-verify the SRI hashes are still current for the exact pinned versions**

The versions are pinned exactly (`lenis@1.1.14`, `gsap@3.12.5`) so jsdelivr serves byte-identical content indefinitely for these URLs — re-fetch to double check nothing has changed since plan-writing time:

```bash
for url in \
  "https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js" \
  "https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.css" \
  "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" \
  "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"; do
  echo "$url"
  echo "  sha384-$(curl -s "$url" | openssl dgst -sha384 -binary | openssl base64 -A)"
done
```
Confirm these match (they were, at plan-writing time):
```
lenis.min.js:      sha384-O55L/6rhHr9CFvrxqv5luxOCcmVaBmETbZbJDP+Do8T0pztTACsFBD/IXCNkj7DV
lenis.css:         sha384-M1DRVyMBQCn7t7o8JenyqyzTEBTBcRc7a0kAfM8vdUmf4mkvQV0xnGPgxTXekKqU
gsap.min.js:       sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt
ScrollTrigger.min.js: sha384-Z3REaz79l2IaAZqJsSABtTbhjgOUYyV3p90XNnAPCSHg3EMTz1fouunq9WZRtj3d
```
If any hash differs, **stop and re-derive it from the fresh `curl` output** — never reuse a stale or invented hash; a mismatched SRI hash makes the browser refuse to load the file at all, which would be a real regression.

- [ ] **Step 2: Add `defer`, `integrity`, and `crossorigin` to all three script tags and the stylesheet link**

Locate the current tags (`grep -n 'jsdelivr' index.html`) and replace all four:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.css" integrity="sha384-M1DRVyMBQCn7t7o8JenyqyzTEBTBcRc7a0kAfM8vdUmf4mkvQV0xnGPgxTXekKqU" crossorigin="anonymous" />
```
```html
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js" defer integrity="sha384-O55L/6rhHr9CFvrxqv5luxOCcmVaBmETbZbJDP+Do8T0pztTACsFBD/IXCNkj7DV" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer integrity="sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer integrity="sha384-Z3REaz79l2IaAZqJsSABtTbhjgOUYyV3p90XNnAPCSHg3EMTz1fouunq9WZRtj3d" crossorigin="anonymous"></script>
<script src="js/app.js" defer></script>
```

**Order matters and is preserved:** `defer` scripts execute in document order regardless of individual download speed, so Lenis → GSAP → ScrollTrigger → app.js still resolves in that exact sequence before `DOMContentLoaded` — app.js's `window.gsap`/`window.Lenis` existence checks (`js/app.js:234`, `:276`) still see fully-initialized globals when they run.

- [ ] **Step 3: Verify with headless Chrome that all three CDN resources still load successfully with SRI enforced, and that the page's own console stays clean**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cp index.html /tmp/sri-test.html
python3 - <<'EOF'
p = "/tmp/sri-test.html"
html = open(p, encoding='utf-8').read()
head_script = """<script>
window.__errs = [];
window.addEventListener('error', function(e){ window.__errs.push((e.message||'')+' @ '+(e.filename||'')); });
</script>"""
html = html.replace("<head>", "<head>\n" + head_script, 1)
tail_script = """<script defer>
window.addEventListener('load', function(){
  setTimeout(function(){
    var d = document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;background:red;color:white;z-index:99999;font-size:14px;padding:10px;max-width:1400px;';
    d.textContent = 'gsap=' + !!window.gsap + ' ScrollTrigger=' + !!window.ScrollTrigger + ' Lenis=' + !!window.Lenis + ' errs=' + JSON.stringify(window.__errs);
    document.body.appendChild(d);
  }, 1500);
});
</script>"""
html = html.replace('</body>', tail_script + '</body>')
open(p, 'w', encoding='utf-8').write(html)
EOF
"$CHROME" --headless --disable-gpu --screenshot=/tmp/sri-check.png --window-size=1440,300 --hide-scrollbars --virtual-time-budget=6000 "file:///tmp/sri-test.html" 2>/dev/null
```
Read `/tmp/sri-check.png` — expect `gsap=true ScrollTrigger=true Lenis=true errs=[]`. If `errs` shows an SRI/integrity mismatch error, the hash was wrong or the CDN content changed — go back to Step 1.

- [ ] **Step 4: Test the CDN-failure fallback still works (page usable if a CDN 404s)**

```bash
cp index.html /tmp/cdn-fail-test.html
python3 - <<'EOF'
p = "/tmp/cdn-fail-test.html"
html = open(p, encoding='utf-8').read()
# break the gsap URL so it 404s, simulating a CDN outage
html = html.replace('gsap@3.12.5/dist/gsap.min.js" defer integrity=', 'gsap@3.12.5/dist/DOES-NOT-EXIST.js" defer integrity=')
open(p, 'w', encoding='utf-8').write(html)
EOF
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --screenshot=/tmp/cdn-fail-check.png --window-size=1440,900 --hide-scrollbars --virtual-time-budget=5000 "file:///tmp/cdn-fail-test.html" 2>/dev/null
```
Read the screenshot — the page must still render its normal content (hero, nav, all sections in stacked/static form), because `js/app.js`'s GSAP section already guards with `if (!window.gsap || !window.ScrollTrigger) return;` (`js/app.js:276`) — confirm that guard still fires correctly and nothing else in `app.js` throws (check for a JS error banner using the same error-capture pattern as Step 3, this time expecting the gsap-section IIFE to exit quietly rather than throw).

- [ ] **Step 5: Run the tag-balance check**

Expected: all three HTML files `OK`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Defer + SRI-pin the third-party CDN scripts (Lenis, GSAP, ScrollTrigger)

All three were blocking, non-deferred <script> tags with no integrity
checking. Added defer (document order — and therefore execution
order — is unchanged: Lenis, GSAP, ScrollTrigger, then app.js) plus
SRI integrity hashes computed from the actual pinned CDN files
(lenis@1.1.14, gsap@3.12.5) and crossorigin="anonymous". Verified via
headless Chrome that all three globals still initialize correctly
with SRI enforced, and that the page still renders its full static
content if a CDN script 404s (js/app.js's existing
`if (!window.gsap ...) return;` guard already handles this).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

## Priority 3 — Mobile and responsive robustness (the four confirmed bugs)

### Task 11: Fix `.mg-panel-grid--cols-4` mobile padding inconsistency (Ние trust panel)

**Files:**
- Modify: `app.css` (the `@media (max-width: 960px)` block around `.mg-panel-grid--cols-4`, currently `app.css:658-660`)

**Interfaces:** none.

**Root cause (confirmed by audit):** the desktop rule `.mg-panel-grid--cols-4 .mg-panel-col:nth-child(n+2):nth-child(-n+3) { padding-left: 14px; padding-right: 14px; }` (`app.css:398`) is **not scoped to a `min-width` media query**, so it's active at every viewport including mobile, at specificity `(0,4,0)`. The existing `@media (max-width: 960px)` override only resets child 3's padding at specificity `(0,3,0)` — lower, so it loses the cascade against the always-on desktop rule. Result: computed mobile `padding-left` across the 4 stacked items is `0 / 14 / 14 / 28px` instead of a consistent pattern (child 2 never loses its desktop "halved middle-column" padding on mobile).

- [ ] **Step 1: Add an explicit, equal-or-higher-specificity reset for child 2's padding inside the existing mobile block**

Find (`app.css:658-660`):
```css
  .mg-panel-grid--cols-4 { grid-template-columns: repeat(2, 1fr); row-gap: 28px; }
  .mg-panel-grid--cols-4 .mg-panel-col:nth-child(3) { border-left: none; padding-left: 0; }
  .mg-panel-grid--cols-4 .mg-panel-col:nth-child(3), .mg-panel-grid--cols-4 .mg-panel-col:nth-child(4) { padding-top: 28px; border-top: 1px solid rgba(31,81,55,0.15); }
```
Replace with:
```css
  .mg-panel-grid--cols-4 { grid-template-columns: repeat(2, 1fr); row-gap: 28px; }
  /* the desktop "halved middle-column" rule
     (.mg-panel-grid--cols-4 .mg-panel-col:nth-child(n+2):nth-child(-n+3),
     specificity 0,4,0) is not min-width-scoped, so it stays active here
     too and beats a lower-specificity mobile reset — match its
     specificity exactly so this wins by source order instead */
  .mg-panel-grid--cols-4 .mg-panel-col:nth-child(n+2):nth-child(-n+3) { padding-left: 0; padding-right: 0; }
  .mg-panel-grid--cols-4 .mg-panel-col:nth-child(3) { border-left: none; }
  .mg-panel-grid--cols-4 .mg-panel-col:nth-child(3), .mg-panel-grid--cols-4 .mg-panel-col:nth-child(4) { padding-top: 28px; border-top: 1px solid rgba(31,81,55,0.15); }
```
(This 2-column mobile layout still needs child 1/3 to keep `padding-left:0` and child 2/4 to keep `padding-right:0` at their outer edges — check the full surrounding block for `:first-child`/`:last-child`/`nth-child(odd/even)` rules already present before finalizing; if the 2-column grid relies on `.mg-panel-col:first-child{padding-left:0}` from the shared base rule at `app.css:420`, note that `:first-child` only matches item 1, not item 3 which starts row 2 — verify this in Step 2's screenshot rather than assuming.)

- [ ] **Step 2: Screenshot the Ние trust panel at 430×932, 390×844, 360×800 and compare left/right padding across all 4 items with a ruler**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for wh in "430,1600" "390,1600" "360,1600"; do
  w="${wh%,*}"; h="${wh#*,}"
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/trust-${w}.png" --window-size="${w},${h}" --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html#top" 2>/dev/null
done
```
Read each, crop to the 4-item trust panel, and pixel-measure the left inset of each item's icon/heading (same technique used earlier this session for divider-line measurement — scan a horizontal row of pixels and find where the panel's background color transitions to content). All 4 items must show the same left inset within a couple pixels.

- [ ] **Step 3: Run the brace-balance check**

Expected: equal `{`/`}` counts.

- [ ] **Step 4: Screenshot the same panel at 1440×900 and 1024×768, confirm zero change from baseline (this task only touches the ≤960px block)**

- [ ] **Step 5: Commit**

```bash
git add app.css
git commit -m "$(cat <<'EOF'
Fix inconsistent mobile padding in the Ние trust panel (cols-4)

The desktop "halve the middle columns' padding" rule
(.mg-panel-grid--cols-4 .mg-panel-col:nth-child(n+2):nth-child(-n+3))
isn't min-width-scoped, so at specificity (0,4,0) it kept beating the
existing ≤960px override, which only reset child 3 at a lower
specificity (0,3,0). Computed mobile left-padding across the 4 stacked
items was 0/14/14/28px instead of consistent. Added an explicit
same-specificity reset inside the mobile block so it wins by source
order.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 12: Fix `.mg-features__tabs` overflow/clipping on mobile

**Files:**
- Modify: `app.css` (the `@media (max-width: 960px)` block, add a rule for `.mg-features__tabs`)

**Interfaces:** none.

**Root cause (confirmed by audit):** `.mg-features__tabs { ...; transform: translateX(170px); }` (`app.css:332`) has **no responsive override anywhere** — it's the same session's own most recent styling change (shifting the tabs right to sit under the hint-text arrow on desktop). At ~390px viewport the two-pill tab group is centered then shifted +170px, pushing it roughly 113px past the container's right edge; `.mg-features{overflow:hidden}` and the global `overflow-x:hidden` on `html`/`body` prevent a page-level horizontal scrollbar, but the "Родители" button itself becomes genuinely unreachable/off-screen. This exactly matches the brief's bug #2. Note that `.mg-features__hint` (the thing the 170px shift was aligning the tabs *under*) is **already** `display:none` at ≤960px (`app.css:702`) — so the shift exists for a purpose (aligning with the arrow) that doesn't even apply on mobile, making a mobile reset both correct and risk-free.

- [ ] **Step 1: Re-verify the current live value of the transform (it may have changed since the audit if more nudging happened)**

```bash
grep -n "mg-features__tabs {" app.css
```
Confirm the exact current `transform: translateX(...)` value before writing the override (the fix pattern below works regardless of the exact desktop pixel value, but note it in the commit message accurately).

- [ ] **Step 2: Add a mobile reset in the existing `@media (max-width: 960px)` block**

Find the "Сè: switch block re-centers..." comment block (`app.css:699-706`-ish) and add the tabs reset alongside the existing `.mg-features__hint { display: none; }` rule:

```css
  .mg-features__intro { max-width: 100%; }
  .mg-features__hint { display: none; }
  /* the desktop translateX shift exists to align the tabs under the
     hint-text arrow, which is hidden on mobile anyway (rule above) —
     reset it here or the tabs get pushed past the right edge and the
     "Родители" button becomes unreachable */
  .mg-features__tabs { transform: none; }
  .mg-features__leaf { display: none; }
```

- [ ] **Step 3: Screenshot the Функционалности tab area at 430×932, 390×844, 360×800, 320×568 — confirm both pills fully visible, tappable, and centered**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for wh in "430,1400" "390,1400" "360,1400" "320,1400"; do
  w="${wh%,*}"; h="${wh#*,}"
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/tabs-${w}.png" --window-size="${w},${h}" --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html#se" 2>/dev/null
done
```
Read all four, confirm the full "Градинки" and "Родители" pill labels are entirely within the viewport with visible margin on both sides at every one of the 4 widths — especially the narrowest, 320px.

- [ ] **Step 4: Confirm no accidental change to the 961px+ breakpoint (desktop/tablet keep the 170px shift)**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --screenshot=/tmp/tabs-1440.png --window-size=1440,2000 --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html#se" 2>/dev/null
```
Compare against baseline — the tabs should still sit shifted right, under the arrow, exactly as before at 1440px.

- [ ] **Step 5: Run the brace-balance check**

Expected: equal counts.

- [ ] **Step 6: Commit**

```bash
git add app.css
git commit -m "$(cat <<'EOF'
Fix Градинки/Родители tabs overflowing off-screen on mobile

.mg-features__tabs carries a translateX shift (added this session, to
align the tabs under the hint-text arrow on desktop). That shift had
no mobile override, so at narrow widths the tab group was pushed past
the container's right edge — the "Родители" button became genuinely
unreachable, not just visually clipped. The hint text/arrow this
shift aligns with is already hidden below 960px, so resetting the
transform there is risk-free and fixes the overflow.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 13: Fix `.mg-panel-grid--cols-3` mobile item-2 indentation (Родители/Градинки panels)

**Files:**
- Modify: `app.css` (the `@media (max-width: 960px)` block around `.mg-panel-grid--cols-3`, currently `app.css:665-668`)

**Interfaces:** none.

**Root cause (confirmed by audit — same pattern as Task 11):** the desktop rule `.mg-panel-grid--cols-3 .mg-panel-col:nth-child(3n+2) { padding-left: 14px; padding-right: 14px; }` (`app.css:436`) is not `min-width`-scoped, specificity `(0,3,0)`, beats the existing mobile single-column reset `.mg-panel-grid--cols-3 .mg-panel-col { padding: 0; border-left: none; }` (`app.css:666`, specificity `(0,2,0)`). In the 6-item single-column mobile stack, items **#2 and #5** in each panel keep 14px/14px padding while items 1,3,4,6 sit flush — items 1 vs 2 (immediately adjacent) show a directly visible mismatch. **This affects both `#panel-gradinki` and `#panel-roditeli`** — they share this exact CSS, so fix both even though the brief names only Родители.

- [ ] **Step 1: Add an explicit same-specificity reset inside the mobile block**

Find (`app.css:665-668`):
```css
  .mg-panel-grid--cols-3 { grid-template-columns: 1fr; row-gap: 24px; padding: 28px 24px; }
  .mg-panel-grid--cols-3 .mg-panel-col { padding: 0; border-left: none; }
  .mg-panel-grid--cols-3 .mg-panel-col:not(:first-child) { padding-top: 24px; }
  .mg-panel-grid--cols-3 .mg-panel-col:not(:first-child)::before {
```
(read a few more lines after this to see the rest of the `::before` divider rule and keep it intact)

Add immediately after the `.mg-panel-grid--cols-3 .mg-panel-col { padding: 0; border-left: none; }` line:
```css
  /* same cascade problem as cols-4: the desktop "middle column" rule
     (nth-child(3n+2), specificity 0,3,0) isn't min-width-scoped and
     beats this reset (0,2,0) — items #2 and #5 in the 6-item mobile
     stack kept 14px left/right padding while the rest sat flush */
  .mg-panel-grid--cols-3 .mg-panel-col:nth-child(3n+2) { padding-left: 0; padding-right: 0; }
```

- [ ] **Step 2: Screenshot both the Градинки and Родители single-column mobile panels at 430×932 and 360×800, pixel-measure left inset of every one of the 6 items in each**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for wh in "430,3000" "360,3000"; do
  w="${wh%,*}"; h="${wh#*,}"
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/panels3-${w}.png" --window-size="${w},${h}" --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html#se" 2>/dev/null
done
cp index.html /tmp/roditeli-mobile-test.html
python3 - <<'EOF'
p = "/tmp/roditeli-mobile-test.html"
html = open(p, encoding='utf-8').read()
html = html.replace('id="tab-gradinki" class="mg-features__tab is-active"', 'id="tab-gradinki" class="mg-features__tab"')
html = html.replace('id="tab-roditeli" class="mg-features__tab"', 'id="tab-roditeli" class="mg-features__tab is-active"')
html = html.replace('<div class="mg-features__slider-track">', '<div class="mg-features__slider-track" style="transform: translateX(-100%);">')
html = html.replace('<script src="js/app.js" defer></script>', '<!-- disabled for static mobile layout check -->')
open(p, 'w', encoding='utf-8').write(html)
EOF
cp -r assets js /tmp/ 2>/dev/null; cp app.css /tmp/
"$CHROME" --headless --disable-gpu --screenshot=/tmp/panels3-roditeli-430.png --window-size=430,3000 --hide-scrollbars --virtual-time-budget=4000 "file:///tmp/roditeli-mobile-test.html#se" 2>/dev/null
```
Read all screenshots. All 6 items in each panel (Градинки and Родители) must show the same left inset for their icon/heading/text.

- [ ] **Step 3: Run the brace-balance check**

Expected: equal counts.

- [ ] **Step 4: Screenshot at 1440×900 and 1024×768, confirm zero change from baseline (desktop 3-column layout untouched)**

- [ ] **Step 5: Commit**

```bash
git add app.css
git commit -m "$(cat <<'EOF'
Fix inconsistent mobile item indentation in Градинки/Родители panels

Same cascade bug as the Ние trust panel fix: the desktop "middle
column" padding rule (.mg-panel-grid--cols-3 .mg-panel-col:nth-child
(3n+2), specificity 0,3,0) isn't min-width-scoped, so it kept beating
the ≤960px single-column reset (0,2,0). Items #2 and #5 in each
6-item mobile stack (both #panel-gradinki and #panel-roditeli share
this CSS) sat indented 14px/14px while the rest were flush — most
visible as item 1 vs item 2. Added an explicit same-specificity reset.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 14: Align "Мобилна апликација" mobile layout with "Дојди" (the approved reference)

**Files:**
- Modify: `app.css` (the `@media (max-width: 640px)` block, `app.css:709-717`-ish)

**Interfaces:** none.

**Root cause (confirmed by audit):** both sections share the `.mg-live__promo-feature` row component and are built to mirror each other at desktop. The divergence is entirely inside the `≤640px` block: `#vo-zivo` (Мобилна апликација, `index.html` id confirmed) gets `text-align:center` on its text column and its feature rows force-stacked to `flex-direction:column; align-items:center` (icon above text, centered) via a scoped `#vo-zivo .mg-live__promo-feature` rule — while `#dojdi` (Дојди, the brief's approved reference) gets neither override and keeps its desktop left-aligned icon+text row layout on mobile too. The brief says Дојди is correct and Мобилна апликација should be adjusted to match it — i.e. **remove** `#vo-zivo`'s extra centering, not add it elsewhere.

- [ ] **Step 1: Read the full current block before editing (line numbers will have shifted from earlier tasks)**

```bash
grep -n "vo-zivo\|mg-live__row\|mg-live__promo " app.css
```
Read the ~20 lines around the `@media (max-width: 640px)` "Live: stack, same order/behaviour as Дојди" comment to see the exact current rules (some may have shifted or been touched since the audit).

- [ ] **Step 2: Remove `#vo-zivo`'s extra centering, keep the shared stacking behavior**

Find and remove exactly these two rules (keep everything else in the block, including `.mg-live__row { flex-direction: column; align-items: center; }` and `.mg-scene-phone { height: 400px; margin: 0 auto; }`, which are shared/correct):

```css
  .mg-live__promo { min-width: 0; width: 100%; max-width: 100%; text-align: center; }
  /* icon above title+text, both centered as a column — scoped to this
     section only: Дојди's feature rows (same .mg-live__promo-feature
     class) stay left-aligned icon+text the way they already were,
     since only Мобилна апликација's rows looked mismatched (icon stuck
     off to one side while the centered text floated independently) */
  #vo-zivo .mg-live__promo-feature { flex-direction: column; align-items: center; text-align: center; gap: 8px; }
  .mg-live__promo-badges { justify-content: center; }
```

Replace with:
```css
  /* Дојди is the approved mobile reference for this row component —
     both sections now share identical mobile alignment/spacing here,
     no #vo-zivo-specific centering override */
  .mg-live__promo { min-width: 0; width: 100%; max-width: 100%; }
  .mg-live__promo-badges { justify-content: flex-start; }
```

(Keep `.mg-live__promo-badges` visible/functional — just switch its justification from centered to the same left-start alignment Дојди already uses. Confirm Дојди's own `.mg-live__promo-badges` styling by grepping `app.css` for that class — if Дојди has no `justify-content` override at all for badges at this breakpoint, i.e. it relies on the un-scoped default, match that instead of hardcoding `flex-start`.)

- [ ] **Step 3: Screenshot both "Мобилна апликација" and "Дојди" sections side-by-side at 430×932, 390×844, 360×800 — confirm identical structural pattern (title, paragraph, icon+text rows, content width, padding, vertical rhythm)**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for wh in "430,3400" "390,3400" "360,3400"; do
  w="${wh%,*}"; h="${wh#*,}"
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/live-${w}.png" --window-size="${w},${h}" --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html" 2>/dev/null
done
```
Read each, crop to both the Мобилна апликација (`#vo-zivo`) and Дојди (`#dojdi`) sections, and visually confirm: same text alignment (left, not centered), same icon-and-text row layout (icon beside text, not stacked), same left/right padding, same paragraph width behavior.

- [ ] **Step 4: Confirm Дојди's own mobile appearance is completely unchanged (it's the reference — nothing in this task should touch its CSS)**

Same screenshots from Step 3 already cover this — just explicitly note in your task completion that `#dojdi`'s section pixel-matches its Task 1 baseline crop.

- [ ] **Step 5: Screenshot at 1440×900 and 1024×768, confirm zero change to either section's desktop appearance (this task only touches the ≤640px block)**

- [ ] **Step 6: Run the brace-balance check**

Expected: equal counts.

- [ ] **Step 7: Commit**

```bash
git add app.css
git commit -m "$(cat <<'EOF'
Мобилна апликација mobile layout now matches the Дојди reference

Per the brief, Дојди и погледни одблиску's mobile layout (left-aligned
icon+text rows, no forced centering) is the approved structural
reference. Мобилна апликација (#vo-zivo) had a scoped ≤640px override
that force-stacked and centered its feature rows and text column —
removed that override so both sections now share identical mobile
alignment/spacing/rhythm. Neither section's desktop appearance changed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

## Priority 4 — Accessibility

### Task 15: Hide the inactive slider panel from the accessibility tree

**Files:**
- Modify: `js/app.js:104-122` (the `goTo(i, focusTab)` function)

**Interfaces:**
- Consumes: `panels` array (unchanged, from `js/app.js:99`).
- Produces: same visual/interaction behavior; adds `aria-hidden` toggling that has zero layout effect (unlike `hidden`, which would break the flex slide-track that needs both panels present to compute the sliding transform).

**Why `aria-hidden`, not `hidden`:** both panels are permanently side-by-side inside a `display:flex` track (`app.css:349`) and switch visibility purely via `transform: translateX(...)` on the shared track — adding the `hidden` attribute (or `display:none`) to the inactive panel would remove it from layout entirely and break the flex-track width math the slide animation depends on. `aria-hidden="true"` removes it from the accessibility tree without touching layout/rendering at all, which is exactly what's needed here since there are no interactive/focusable elements inside `.mg-panel-col` (confirmed: plain `<img>`/`<h3>`/`<p>`, no links or buttons) — so no extra `inert`/tabindex handling is required.

- [ ] **Step 1: Toggle `aria-hidden` on panels inside `goTo()`**

Replace (`js/app.js:106-122`):
```js
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
    // the panel that was off-screen never intersected the entrance-
    // reveal IntersectionObserver below — reveal its [data-anim] cards
    // directly the first time it slides into view
    panels[index].querySelectorAll('[data-anim]').forEach(function (el) {
      el.classList.add('in-view');
    });
  }
```
with:
```js
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
    panels.forEach(function (panel, pi) {
      // aria-hidden only (not the `hidden` attribute) — both panels
      // stay in the flex slide-track's layout permanently, only their
      // accessibility-tree exposure toggles; there are no focusable
      // elements inside .mg-panel-col so nothing else needs gating
      panel.setAttribute('aria-hidden', pi === index ? 'false' : 'true');
    });
    // the panel that was off-screen never intersected the entrance-
    // reveal IntersectionObserver below — reveal its [data-anim] cards
    // directly the first time it slides into view
    panels[index].querySelectorAll('[data-anim]').forEach(function (el) {
      el.classList.add('in-view');
    });
  }
```

- [ ] **Step 2: Verify via headless Chrome that `aria-hidden` toggles correctly on tab switch and layout is unaffected**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cp index.html /tmp/aria-test.html
python3 - <<'EOF'
p = "/tmp/aria-test.html"
html = open(p, encoding='utf-8').read()
script = """<script defer>document.getElementById('tab-roditeli').click();</script>"""
open(p, 'w', encoding='utf-8').write(html.replace('</body>', script + '</body>'))
EOF
cp -r assets js /tmp/ 2>/dev/null; cp app.css /tmp/
python3 - <<'EOF'
p = "/tmp/aria-test.html"
html = open(p, encoding='utf-8').read()
tail = """<script defer>
setTimeout(function(){
  var d = document.createElement('div');
  d.style.cssText='position:fixed;top:0;left:0;background:red;color:white;z-index:99999;font-size:16px;padding:10px;';
  var g = document.getElementById('panel-gradinki');
  var r = document.getElementById('panel-roditeli');
  d.textContent = 'gradinki aria-hidden=' + g.getAttribute('aria-hidden') + ' roditeli aria-hidden=' + r.getAttribute('aria-hidden');
  document.body.appendChild(d);
}, 300);
</script>"""
open(p, 'w', encoding='utf-8').write(html.replace('</body>', tail + '</body>'))
EOF
"$CHROME" --headless --disable-gpu --screenshot=/tmp/aria-check.png --window-size=1440,300 --hide-scrollbars --virtual-time-budget=4000 "file:///tmp/aria-test.html" 2>/dev/null
```
Read `/tmp/aria-check.png` — expect `gradinki aria-hidden=true roditeli aria-hidden=false` (after the simulated click to Родители). Note: the earlier session discovered that `defer`-script click injection can race with CDN script loading in headless mode — if the banner shows stale/default values, retry with a longer `--virtual-time-budget` and confirm `js/app.js` actually executed (check `tabs.length` etc. per the same debugging pattern from earlier this session) before concluding the fix is broken.

- [ ] **Step 3: Screenshot the slider at 1440×900 before and after a simulated tab switch — confirm zero visual change (aria-hidden has no rendering effect)**

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "$(cat <<'EOF'
Hide the inactive slider panel from the accessibility tree

The Градинки/Родители panels are permanently side-by-side in a flex
track and switch via transform, so the off-screen panel's content
stayed exposed to keyboard/screen-reader navigation with no signal
that it was inactive. Added aria-hidden toggling in goTo() — not the
hidden attribute, which would remove the panel from layout and break
the flex slide-track's width math. No focusable elements live inside
.mg-panel-col, so aria-hidden alone is sufficient.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 16: Add a "Skip to main content" link

**Files:**
- Modify: `index.html` (add a skip link as the first focusable element in `<body>`)
- Modify: `index.html` (add `id="main-content"` to the existing `<main>` — confirm its exact current opening tag first)
- Modify: `app.css` (add the visually-hidden-until-focused skip-link styling)

**Interfaces:** none.

- [ ] **Step 1: Find the exact current `<main>` opening tag and body structure**

```bash
grep -n "<body>\|<main" index.html
```

- [ ] **Step 2: Add `id="main-content"` to the `<main>` tag**

If it currently reads `<main>` with no attributes, change it to `<main id="main-content">`. If it already has other attributes, add the id alongside them without removing anything.

- [ ] **Step 3: Add the skip link as the very first element inside `<body>`**

Immediately after the opening `<body>` tag (before any existing content, including the nav), add:
```html
<a href="#main-content" class="mg-skip-link">Прескокни на главната содржина</a>
```

- [ ] **Step 4: Add the visually-hidden-until-focused CSS**

Add to `app.css`, near the top of the "Base" section (after the existing `:focus-visible` rules, `app.css:93-99`, so it's grouped with other accessibility-related base styles):
```css
/* Skip link: off-screen until keyboard-focused, then a clearly visible
   pill matching the site's own focus-ring/brand styling — doesn't
   change the normal (non-focused) visual state of the page at all */
.mg-skip-link {
  position: absolute;
  top: -100px;
  left: 12px;
  z-index: 9999;
  background: var(--forest);
  color: #fff;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 700;
  text-decoration: none;
  transition: top .15s ease;
}
.mg-skip-link:focus-visible {
  top: 12px;
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Verify the link is invisible in the normal (non-focused) state and appears correctly on Tab**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --screenshot=/tmp/skiplink-normal.png --window-size=1440,300 --hide-scrollbars --virtual-time-budget=3000 "file://$(pwd)/index.html" 2>/dev/null
```
Read it — the top-left corner must look identical to baseline (link is off-screen at `top:-100px`). Then simulate focus:
```bash
cp index.html /tmp/skip-test.html
python3 - <<'EOF'
p = "/tmp/skip-test.html"
html = open(p, encoding='utf-8').read()
script = """<script defer>window.addEventListener('load', function(){ document.querySelector('.mg-skip-link').focus(); }); </script>"""
open(p, 'w', encoding='utf-8').write(html.replace('</body>', script + '</body>'))
EOF
cp -r assets js /tmp/ 2>/dev/null; cp app.css /tmp/
"$CHROME" --headless --disable-gpu --screenshot=/tmp/skiplink-focused.png --window-size=1440,300 --hide-scrollbars --virtual-time-budget=4000 "file:///tmp/skip-test.html" 2>/dev/null
```
Read `/tmp/skiplink-focused.png` — the green pill with white text must now be visible near the top-left, readable, with the gold focus ring.

- [ ] **Step 6: Run the tag-balance check**

Expected: all three HTML files `OK` (only `index.html` changed in this task).

- [ ] **Step 7: Commit**

```bash
git add index.html app.css
git commit -m "$(cat <<'EOF'
Add a "Skip to main content" link

Keyboard/screen-reader users previously had to tab through the full
nav before reaching page content. Added a link that's off-screen
until keyboard-focused (position:absolute, top:-100px → top:12px on
:focus-visible), matching the site's existing focus-ring color/brand
styling. No change to the page's normal visual state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 17: Form field accessibility — numeric input mode, autocomplete, error association

**Files:**
- Modify: `index.html:454-455, 477-478` (kindergarten field, kids-count field)
- Modify: `js/app.js` (the submit handler, to set `aria-invalid`/`aria-describedby` on validation failure)

**Interfaces:**
- Consumes: existing `form`, `setStatus` from Task 2's already-modified handler.
- Produces: no change to any other task's interfaces.

- [ ] **Step 1: Add `inputmode="numeric"` and constraints to the "Број на деца" field, without changing its visual type**

Replace (`index.html:477-478`):
```html
            <label for="df-kids" class="mg-field__label">Број на деца</label>
            <input id="df-kids" name="kids" type="text" class="mg-input" />
```
with:
```html
            <label for="df-kids" class="mg-field__label">Број на деца</label>
            <input id="df-kids" name="kids" type="text" inputmode="numeric" pattern="[0-9]*" min="1" step="1" class="mg-input" />
```
(Deliberately **not** `type="number"` — that would change the visual style by adding the browser's default spinner arrows, which the brief prohibits unless it doesn't alter the visual style. `inputmode="numeric"` gets the same numeric keyboard on mobile with zero visual change; `pattern`/`min`/`step` document the intent for form-processing/validation tooling without enforcing browser-native number-input chrome.)

- [ ] **Step 2: Add `autocomplete="organization"` to the kindergarten name field**

Replace (`index.html:454-455`):
```html
          <label for="df-kg" class="mg-field__label">Име на градинка *</label>
          <input id="df-kg" name="kindergarten" type="text" required class="mg-input" />
```
with:
```html
          <label for="df-kg" class="mg-field__label">Име на градинка *</label>
          <input id="df-kg" name="kindergarten" type="text" required class="mg-input" autocomplete="organization" />
```

- [ ] **Step 3: Wire `aria-invalid`/`aria-describedby` on validation failure**

In `js/app.js`, inside the submit handler (already modified by Task 2), extend the `if (!form.checkValidity())` branch to mark the actual invalid field(s):

Replace:
```js
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
```
with:
```js
    if (!form.checkValidity()) {
      // clear any stale aria-invalid from a previous attempt, then mark
      // every currently-invalid field so assistive tech announces which
      // one(s) need attention, not just that "something" is wrong
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        el.removeAttribute('aria-invalid');
        el.removeAttribute('aria-describedby');
      });
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.validity.valid) return;
        el.setAttribute('aria-invalid', 'true');
        var label = form.querySelector('label[for="' + el.id + '"]');
        if (label) {
          if (!label.id) label.id = el.id + '-label';
          el.setAttribute('aria-describedby', label.id);
        }
      });
      form.reportValidity();
      return;
    }
```
Also add a success-path cleanup so a previously-invalid field doesn't stay marked invalid forever after a later successful submission — in the `.then()` success branch, after `form.reset();`, add:
```js
          Array.prototype.forEach.call(form.elements, function (el) {
            el.removeAttribute('aria-invalid');
            el.removeAttribute('aria-describedby');
          });
```

- [ ] **Step 4: Verify via headless Chrome — submit with an empty required field, confirm `aria-invalid="true"` lands on the right input(s)**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cp index.html /tmp/invalid-test.html
python3 - <<'EOF'
p = "/tmp/invalid-test.html"
html = open(p, encoding='utf-8').read()
script = """<script defer>
window.addEventListener('load', function(){
  setTimeout(function(){
    document.getElementById('demo-form').requestSubmit ?
      document.getElementById('demo-form').requestSubmit() :
      document.querySelector('.mg-form__submit').click();
    setTimeout(function(){
      var d = document.createElement('div');
      d.style.cssText='position:fixed;top:0;left:0;background:red;color:white;z-index:99999;font-size:14px;padding:10px;';
      var name = document.getElementById('df-name');
      d.textContent = 'df-name aria-invalid=' + name.getAttribute('aria-invalid') + ' aria-describedby=' + name.getAttribute('aria-describedby');
      document.body.appendChild(d);
    }, 200);
  }, 500);
});
</script>"""
open(p, 'w', encoding='utf-8').write(html.replace('</body>', script + '</body>'))
EOF
cp -r assets js /tmp/ 2>/dev/null; cp app.css /tmp/
"$CHROME" --headless --disable-gpu --screenshot=/tmp/invalid-check.png --window-size=1440,300 --hide-scrollbars --virtual-time-budget=4000 "file:///tmp/invalid-test.html" 2>/dev/null
```
Read it — expect `df-name aria-invalid=true aria-describedby=df-name-label` (since `name` is empty/required and is the first invalid field the browser's native validation would report — note native `reportValidity()` shows one error at a time, but this task's own loop marks *every* currently-invalid field, which is a superset of what's natively shown; confirm the banner reflects that).

- [ ] **Step 5: Screenshot the form at 1440×900 and 320×568, confirm zero visual change (all changes are non-visual attributes)**

- [ ] **Step 6: Run the tag-balance check**

Expected: all three HTML files `OK`.

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js
git commit -m "$(cat <<'EOF'
Form accessibility: numeric inputmode, organization autocomplete, aria-invalid wiring

- "Број на деца" gets inputmode="numeric" + pattern/min/step, kept as
  type="text" so no native number-spinner UI appears (would have
  changed the visual style).
- "Име на градинка" gets autocomplete="organization".
- On failed validation, every currently-invalid field now gets
  aria-invalid="true" and aria-describedby pointing at its label (not
  just a single native validation bubble), cleared again on a
  subsequent successful submission.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

## Priority 5 — SEO and sharing

### Task 18: Complete Open Graph / Twitter metadata, add theme-color

**Files:**
- Modify: `index.html:19-25`-ish (the OG/Twitter meta block)

**Interfaces:** none.

- [ ] **Step 1: Confirm the real social-preview image dimensions**

```bash
python3 -c "from PIL import Image; print(Image.open('assets/social-preview.jpg').size)"
```
Confirmed at audit time: `(1200, 630)`.

- [ ] **Step 2: Add the missing OG dimension/alt tags and full Twitter Card fields, and theme-color**

Replace the current OG block (`index.html:19-25`-ish, re-locate with `grep -n 'og:\|twitter:'`):
```html
<meta property="og:type" content="website" />
<meta property="og:title" content="mojaGradinka — Апликација за градинки и родители" />
<meta property="og:description" content="Сè што им е потребно на градинките и родителите, на едно безбедно место." />
<meta property="og:image" content="https://mojagradinka.mk/assets/social-preview.jpg" />
<meta property="og:url" content="https://mojagradinka.mk/" />
<meta property="og:locale" content="mk_MK" />
<meta name="twitter:card" content="summary_large_image" />
```
with:
```html
<meta property="og:type" content="website" />
<meta property="og:title" content="mojaGradinka — Апликација за градинки и родители" />
<meta property="og:description" content="Сè што им е потребно на градинките и родителите, на едно безбедно место." />
<meta property="og:image" content="https://mojagradinka.mk/assets/social-preview.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="mojaGradinka — Апликација за градинки и родители" />
<meta property="og:url" content="https://mojagradinka.mk/" />
<meta property="og:locale" content="mk_MK" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="mojaGradinka — Апликација за градинки и родители" />
<meta name="twitter:description" content="Сè што им е потребно на градинките и родителите, на едно безбедно место." />
<meta name="twitter:image" content="https://mojagradinka.mk/assets/social-preview.jpg" />
<meta name="theme-color" content="#1F5137" />
```
(`#1F5137` is the existing `--forest` brand token from `app.css:24` — an approved brand color, per the brief's "using an existing approved brand/background color" requirement.)

- [ ] **Step 3: Validate the resulting markup structurally**

```bash
grep -c 'og:\|twitter:' index.html   # sanity count
```
Run the shared tag-balance check — expected: `index.html OK`.

- [ ] **Step 4: Screenshot the `<head>` has no visual effect (meta tags never render) — confirm full-page screenshot at 1440×900 is pixel-identical to baseline**

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Complete Open Graph/Twitter metadata, add theme-color

Added og:image:width/height/alt (1200x630, confirmed against the
actual file), twitter:title/description/image (previously only
twitter:card existed), and theme-color using the existing --forest
brand token (#1F5137). No visual page change — meta tags only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 19: Add `robots.txt` and `sitemap.xml`

**Files:**
- Create: `robots.txt`
- Create: `sitemap.xml`

**Interfaces:** none.

- [ ] **Step 1: Create `robots.txt` for the intended production domain**

The canonical/OG URLs already intentionally point at `https://mojagradinka.mk/` (documented decision, `index.html:10-13`) — match that here rather than the temporary GitHub Pages URL:

```
User-agent: *
Allow: /

Sitemap: https://mojagradinka.mk/sitemap.xml
```
Save as `robots.txt` in the repo root.

- [ ] **Step 2: Create `sitemap.xml` listing the three real pages**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mojagradinka.mk/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://mojagradinka.mk/privacy.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://mojagradinka.mk/terms.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
```
Save as `sitemap.xml` in the repo root. (No `<lastmod>` dates are included — the brief prohibits inventing facts, and a fabricated last-modified date would be exactly that; omitting `lastmod` is valid per the sitemap spec.)

- [ ] **Step 3: Validate the XML is well-formed**

```bash
python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('sitemap.xml'); print('valid XML')"
```

- [ ] **Step 4: Confirm both files are served correctly from the repo root under a local static server**

```bash
python3 -m http.server 8125 &
SERVER_PID=$!
sleep 1
curl -s http://localhost:8125/robots.txt
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8125/sitemap.xml
kill $SERVER_PID
```

- [ ] **Step 5: Commit**

```bash
git add robots.txt sitemap.xml
git commit -m "$(cat <<'EOF'
Add robots.txt and sitemap.xml for the intended production domain

Both reference https://mojagradinka.mk/ to match the already-decided
canonical/OG URL choice (documented at index.html:10-13) rather than
the temporary GitHub Pages URL. sitemap.xml lists the three real pages
(index, privacy, terms) with no fabricated lastmod dates.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

## Priority 6 — Security and resilience

### Task 20: Add a conservative Referrer-Policy meta tag

**Files:**
- Modify: `index.html`, `privacy.html`, `terms.html` (add one `<meta name="referrer">` tag to each `<head>`)

**Interfaces:** none.

- [ ] **Step 1: Add the meta tag to all three HTML files' `<head>`**

Add, near the other meta tags (after `<meta name="viewport" ...>` is a reasonable spot in all three files):
```html
<meta name="referrer" content="strict-origin-when-cross-origin" />
```
(This is the current browser default in most cases, but making it explicit is cheap, documented, and doesn't rely on default behavior potentially changing — it sends the full URL on same-origin requests but only origin on cross-origin ones, and nothing over a downgrade from HTTPS to HTTP.)

- [ ] **Step 2: Run the tag-balance check**

Expected: all three files `OK`.

- [ ] **Step 3: Commit**

```bash
git add index.html privacy.html terms.html
git commit -m "$(cat <<'EOF'
Add explicit Referrer-Policy (strict-origin-when-cross-origin)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 21: Evaluate a CSP meta tag (implement only if verification is clean)

**Files:**
- Modify (conditionally — see Step 4): `index.html`, `privacy.html`, `terms.html`

**Interfaces:** none.

**This task has an explicit abort condition.** The brief says: *"test all fonts, images, styles, scripts, the Formspree connection, and inline JSON-LD/markup carefully. Do not deploy a CSP that silently breaks the site."* If Step 3's verification shows any violation that can't be resolved without weakening the policy below GitHub-Pages-realistic protection, stop and document it as a deferred item instead of shipping a broken or meaningless CSP — do not force it through.

- [ ] **Step 1: Enumerate every real origin/inline-content the pages actually use**

Confirmed by the audit + this plan's own tasks:
- Scripts: `cdn.jsdelivr.net` (Lenis, GSAP, ScrollTrigger — all SRI-pinned as of Task 10), `'self'` (app.js), and one inline `<script type="application/ld+json">` block (index.html only — per CSP3, `script-src` does not restrict `<script>` elements whose `type` is a non-JavaScript MIME like `application/ld+json`, but verify this empirically in Step 3 rather than trusting spec text alone).
- Styles: `fonts.googleapis.com`, `cdn.jsdelivr.net` (lenis.css), `'self'` (app.css), plus **inline `<style>` blocks in `privacy.html` and `terms.html`** (their legal-page layout CSS) — these require `'unsafe-inline'` in `style-src` unless extracted to external files (out of scope for this task; note as the reason `'unsafe-inline'` is present in `style-src` below).
- Fonts: `fonts.gstatic.com`.
- Images: `'self'` only (all images are local `assets/...`).
- Connect (fetch): `formspree.io` (the demo form's POST target).

- [ ] **Step 2: Draft the CSP meta tag**

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self' https://formspree.io; base-uri 'self'; form-action https://formspree.io;" />
```

- [ ] **Step 3: Verify with headless Chrome across all three pages — zero unexpected CSP violations**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for page in index privacy terms; do
  cp "${page}.html" "/tmp/csp-test-${page}.html"
  python3 - "$page" <<'EOF'
import sys
page = sys.argv[1]
p = f"/tmp/csp-test-{page}.html"
html = open(p, encoding='utf-8').read()
csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' https://cdn.jsdelivr.net; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src \'self\' https://fonts.gstatic.com; img-src \'self\'; connect-src \'self\' https://formspree.io; base-uri \'self\'; form-action https://formspree.io;" />'
html = html.replace('<head>', '<head>\n' + csp, 1)
err_capture = """<script>
window.__cspViolations = [];
document.addEventListener('securitypolicyviolation', function(e){
  window.__cspViolations.push(e.violatedDirective + ': ' + e.blockedURI);
});
</script>"""
html = html.replace('<head>', '<head>\n' + err_capture, 1)
tail = """<script defer>
setTimeout(function(){
  var d = document.createElement('div');
  d.style.cssText='position:fixed;top:0;left:0;background:red;color:white;z-index:99999;font-size:12px;padding:10px;max-width:1400px;';
  d.textContent = 'violations=' + JSON.stringify(window.__cspViolations);
  document.body.appendChild(d);
}, 2500);
</script>"""
html = html.replace('</body>', tail + '</body>')
open(p, 'w', encoding='utf-8').write(html)
EOF
  cp -r assets js /tmp/ 2>/dev/null; cp app.css /tmp/
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/csp-check-${page}.png" --window-size=1440,400 --hide-scrollbars --virtual-time-budget=6000 "file:///tmp/csp-test-${page}.html" 2>/dev/null
done
```
Read all three screenshots — expect `violations=[]` on every page. Additionally, on the `index` page specifically, dispatch a real form submission attempt (mocking `fetch` to avoid actually POSTing) to confirm `form-action` doesn't block the legitimate Formspree submission path, and confirm the desktop GSAP scene sequence still animates (no `connect-src`/`script-src` violation from ScrollTrigger's internal work).

- [ ] **Step 4: Decide based on real results**

- If `violations` is empty on all three pages and the form/GSAP checks pass: add the meta tag to all three real HTML files (same content as Step 2), commit.
- If any violation appears that can only be fixed by weakening the policy to the point of near-uselessness (e.g. adding `'unsafe-inline'` to `script-src`, which would defeat the entire point): **do not add the CSP tag**. Instead, document in the final report (Task 26) exactly which resource triggered the violation and why a safe fix wasn't applied within this pass's scope (e.g. "the JSON-LD block would need moving to an external `.json` file fetched via `fetch()`+manual injection, which is a larger structural change than this optimization pass covers").

- [ ] **Step 5 (only if shipping): commit**

```bash
git add index.html privacy.html terms.html
git commit -m "$(cat <<'EOF'
Add a Content-Security-Policy meta tag

Verified via headless Chrome (securitypolicyviolation listener) across
all three pages, plus a mocked form-submission and the desktop GSAP
scene sequence, with zero violations under this policy:
default-src 'self'; script-src 'self' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com;
img-src 'self'; connect-src 'self' https://formspree.io;
base-uri 'self'; form-action https://formspree.io;

style-src needs 'unsafe-inline' for privacy.html/terms.html's inline
legal-page layout <style> blocks — extracting those to an external
stylesheet was out of scope for this pass.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

## Priority 7 — Code quality and maintainability

### Task 22: Delete confirmed-unused assets

**Files:**
- Delete: `assets/administracija.png`, `assets/app_functionality.png`, `assets/badge-floral-cream-full.svg`, `assets/komunikacija.png`, `assets/leaf_05_gold_three_lobed.svg`, `assets/lockup-forest-old.svg`, `assets/lockup-white-old.svg`, `assets/mobile_app.jpg`, `assets/naplata.png`, `assets/playing_bears.png`, `assets/prisustvo.png`
- Modify: `UNUSED_ASSETS_REVIEW.md` (update to reflect the deletions, and correct the stale `leaf_03_blue_teardrop.svg` entry)

**Interfaces:** none.

**Do not trust `UNUSED_ASSETS_REVIEW.md` as-is** — it already contains one confirmed-stale entry (`leaf_03_blue_teardrop.svg`, listed as unused but now referenced by `.mg-features__leaf`). Re-verify every single file fresh in Step 1.

- [ ] **Step 1: Re-verify each candidate is still unreferenced right now**

```bash
for f in administracija.png app_functionality.png badge-floral-cream-full.svg komunikacija.png leaf_05_gold_three_lobed.svg lockup-forest-old.svg lockup-white-old.svg mobile_app.jpg naplata.png playing_bears.png prisustvo.png; do
  count=$(grep -rl "$f" index.html app.css js/app.js privacy.html terms.html robots.txt sitemap.xml 2>/dev/null | wc -l | tr -d ' ')
  echo "$f -> referenced in $count file(s)"
done
```
Every line must print `-> referenced in 0 file(s)`. **If any file now shows a nonzero count, remove it from the deletion list** — something started using it since this plan was written.

- [ ] **Step 2: Explicitly do NOT delete the 4 "Keep" source files**

`Mobile_App_Odblisku.png`, `Mobilna_App.png`, `phone_14_01.eps` (plus whatever the doc's 4th "Keep" entry is — re-read `UNUSED_ASSETS_REVIEW.md` to confirm the exact 4th filename before finalizing) stay — they're source material for the phone-mockup compositing pipeline, not dead weight.

- [ ] **Step 3: Delete the confirmed-unused files**

```bash
rm assets/administracija.png assets/app_functionality.png assets/badge-floral-cream-full.svg \
   assets/komunikacija.png assets/leaf_05_gold_three_lobed.svg assets/lockup-forest-old.svg \
   assets/lockup-white-old.svg assets/mobile_app.jpg assets/naplata.png \
   assets/playing_bears.png assets/prisustvo.png
```

- [ ] **Step 4: Run the link/asset-existence check**

Expected: `OK, no missing assets` (confirms nothing deleted was actually still referenced).

- [ ] **Step 5: Run the tag-balance check**

Expected: all three files `OK` (this task doesn't touch HTML structure, just confirms nothing else broke).

- [ ] **Step 6: Full-page screenshot at 1440×900 and 390×844, confirm pixel-identical to baseline**

None of the deleted files are referenced, so the rendered page cannot change — this is a sanity confirmation, not a real risk area.

- [ ] **Step 7: Update `UNUSED_ASSETS_REVIEW.md`**

Rewrite it to reflect current reality: remove the now-deleted rows, correct the `leaf_03_blue_teardrop.svg` row (it's in use — remove it from the table entirely, or add a note that it was found in-use and kept), and keep the 4 "Keep" rows and their explanations as-is.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Delete 11 confirmed-unused assets (~4.7MB), correct the stale review doc

Re-verified every candidate in UNUSED_ASSETS_REVIEW.md against the
current repo state before deleting (the doc had gone stale — it
listed leaf_03_blue_teardrop.svg as unused, but it's now referenced
by .mg-features__leaf; left that one alone and corrected the doc).
Deleted: administracija.png, app_functionality.png,
badge-floral-cream-full.svg, komunikacija.png,
leaf_05_gold_three_lobed.svg, lockup-forest-old.svg,
lockup-white-old.svg, mobile_app.jpg, naplata.png, playing_bears.png,
prisustvo.png — all leftover material from earlier iterations of the
"Сè" section and old logo versions, confirmed zero references.
The 4 source files for the phone-mockup compositing pipeline are kept.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

### Task 23: Touch target sizing and hover-independence audit

**Files:**
- Modify (conditionally, only where Step 1 finds a real gap): `app.css`

**Interfaces:** none.

- [ ] **Step 1: Measure the actual rendered size of every interactive control at mobile widths**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cp index.html /tmp/touch-test.html
python3 - <<'EOF'
p = "/tmp/touch-test.html"
html = open(p, encoding='utf-8').read()
tail = """<script defer>
setTimeout(function(){
  var d = document.createElement('div');
  d.style.cssText='position:fixed;top:0;left:0;background:red;color:white;z-index:99999;font-size:10px;padding:10px;max-width:1400px;max-height:800px;overflow:auto;';
  var sel = 'a, button, input, select, .mg-features__tab, .mg-features__slider-nav, .mg-nav__links a';
  var els = document.querySelectorAll(sel);
  var rows = [];
  els.forEach(function(el){
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    rows.push((el.tagName + (el.className ? '.' + el.className.split(' ')[0] : '')) + ': ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  d.textContent = rows.join(' | ');
  document.body.appendChild(d);
}, 500);
</script>"""
html = html.replace('</body>', tail + '</body>')
open(p, 'w', encoding='utf-8').write(html)
EOF
cp -r assets js /tmp/ 2>/dev/null; cp app.css /tmp/
"$CHROME" --headless --disable-gpu --screenshot=/tmp/touch-check-390.png --window-size=390,4000 --hide-scrollbars --virtual-time-budget=4000 "file:///tmp/touch-test.html" 2>/dev/null
"$CHROME" --headless --disable-gpu --screenshot=/tmp/touch-check-320.png --window-size=320,4000 --hide-scrollbars --virtual-time-budget=4000 "file:///tmp/touch-test.html" 2>/dev/null
```
Read both banners. List every control whose rendered `height` (the more commonly-violated dimension for pill buttons/links) is below 44 CSS px at 390px and 320px widths — this is expected to include the shrunk `.mg-features__tab` pills from this session (currently ~30px tall with `padding: 7px 16px` + `font-size: 12.5px`) and possibly the slider prev/next chevron buttons (`21px` icon, check their actual clickable box via `.mg-features__slider-nav` padding).

- [ ] **Step 2: For each control under 44px, add invisible padding via `::before`/`::after` to enlarge the *hit area* without changing the *visual* size**

This is the brief's own specified technique ("without visually enlarging them if invisible padding/pseudo-elements can do it safely"). For a control that's visually `H`px tall but needs a `44px` hit area, add a pseudo-element or increase `padding`-driven hit area while keeping the visible background/border the same size — the cleanest zero-visual-risk method for a `position:relative` control is an absolutely-positioned invisible `::after` sized to `44px` minimum, centered:

```css
/* example pattern — adapt the exact selector(s) found in Step 1 */
.mg-features__tab { position: relative; }
.mg-features__tab::after {
  content: "";
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: max(100%, 44px);
  height: max(100%, 44px);
}
```
Only add this to controls Step 1 actually found below 44px — do not touch controls that already pass, and do not change any `padding`/`font-size`/visible geometry (that would violate the design freeze).

- [ ] **Step 3: Confirm hover-independence — no essential information/functionality is hover-only**

```bash
grep -n ":hover" app.css
```
Read every `:hover` rule and confirm each one only adds a *cosmetic* enhancement (color shift, subtle transform, shadow) with the underlying functionality/information already available without hovering — e.g. tab switching works via click/tap/keyboard regardless of hover state (confirmed true — `goTo()` fires from click/keydown, hover is not involved anywhere in `js/app.js`). No task action expected here unless a genuine hover-gated dependency is found.

- [ ] **Step 4: Screenshot the re-touched controls at 390px and 320px, confirm zero visible size change from before this task**

Compare pixel dimensions of the visible box (border/background), not the invisible hit area, against Task 1's baseline.

- [ ] **Step 5: Re-run Step 1's measurement script, confirm the *hit areas* (not just visible size) are now ≥44px for every previously-failing control**

Extend the injected script to also read `el.querySelector ? el : el` — actually since the `::after` hit area isn't itself hoverable/clickable as a separate DOM node, verify effective tap-target size the practical way: confirm the `::after`'s own computed box (via `getComputedStyle` on a synthetic check, or simply trust the `max(100%, 44px)` CSS math since it's a deterministic transform) rather than trying to click-test a pseudo-element directly (not possible via `dispatchEvent`) — cross-check by reasoning about the CSS instead of trying to simulate a real touch hit-test, since headless Chrome has no real touch input simulation available here.

- [ ] **Step 6: Run the brace-balance check**

Expected: equal counts.

- [ ] **Step 7: Commit**

```bash
git add app.css
git commit -m "$(cat <<'EOF'
Enlarge sub-44px touch targets via invisible hit-area padding

Measured every interactive control's rendered size at 390px/320px
widths. Controls found below the ~44x44 CSS px touch-target
guideline got an invisible ::after hit area sized to max(100%,44px),
centered — visible size/padding/font-size untouched, so nothing
about the approved visual design changed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

(If Step 1 finds every control already ≥44px, skip Steps 2/4/5/7 and commit nothing — record "no gap found" instead of forcing a change.)

---

### Task 24: Safe-area insets and mobile-keyboard focus scroll

**Files:**
- Modify (conditionally): `app.css` (footer decoration only, if Step 1 finds real overlap risk), `index.html` (viewport meta, if not already present)

**Interfaces:** none.

- [ ] **Step 1: Check the current viewport meta tag supports safe-area-inset variables**

```bash
grep -n '<meta name="viewport"' index.html privacy.html terms.html
```
`env(safe-area-inset-*)` only activates when the viewport meta includes `viewport-fit=cover`. Confirmed current tag (`index.html:5`): `<meta name="viewport" content="width=device-width, initial-scale=1">` — **no `viewport-fit=cover`**. Since nothing in the current design intentionally extends into the notch/home-indicator area (no edge-to-edge full-bleed elements at the very top/bottom of the viewport), check first whether adding `viewport-fit=cover` is even necessary: it's only needed if a fixed/absolutely-positioned element sits flush against a device edge where a notch/home-indicator could visually collide with it.

- [ ] **Step 2: Identify any element that sits flush against the viewport edge**

The nav is not `position:fixed` (site uses normal document flow with Lenis smooth-scroll, confirmed no fixed header in this codebase), so there's no top-edge collision risk. The footer's tree/bear decorations (`.mg-footer-deco--tree`, `.mg-footer-deco--bears`) sit at the bottom of the footer, not fixed to the viewport bottom edge — check their exact positioning:

```bash
grep -n "mg-footer-deco" app.css
```
Read the rules. If they're `position:absolute` within a normal-flow footer (not viewport-fixed), there's no safe-area collision possible — device home-indicator overlays sit on top of the actual viewport bottom, not inside scrolled document content.

- [ ] **Step 3: Decide based on Step 2's findings**

If no element is fixed/sticky to a viewport edge (expected, given this site has no fixed header/footer bars): **no `viewport-fit=cover` or `env(safe-area-inset-*)` change is needed** — document this finding rather than adding unused CSS. This matches the brief's own instruction ("apply only where actually needed").

If a genuine edge-fixed element is found (re-check, since CSS may have changed since this plan was written), add `viewport-fit=cover` to the viewport meta in all three HTML files, and pad that specific element with `env(safe-area-inset-bottom, 0px)` (or the relevant side), verified via a screenshot at a notched-device aspect ratio (e.g. 430×932, matching iPhone 14 Pro Max's safe-area-relevant aspect ratio) with no visual change at NON-notched viewports (the `env()` function safely resolves to `0` on devices without an inset, so this is inherently zero-risk to add if actually needed).

- [ ] **Step 4: Verify focus-scroll behavior for the mobile keyboard**

Confirm no CSS actively prevents the browser's default "scroll focused input into view" behavior (check for `overflow: hidden` on any ancestor of the form, or a `scroll-behavior`/`scroll-margin` conflict):
```bash
grep -n "mg-form\b" app.css | grep -i "overflow"
```
Expected: no match (the form section doesn't restrict overflow). The existing `.mg-section { scroll-margin-top: 24px; }` (`app.css:107`) already gives focused/scrolled-to elements inside sections a small top offset, which also benefits keyboard-triggered scroll-into-view. No fix needed unless Step 4 finds an actual `overflow:hidden`/similar block on an ancestor of `#demo-forma`'s fields.

- [ ] **Step 5: Document the outcome (this task is verification-first; only commit if Step 3 found a real fix to make)**

- [ ] **Step 6 (only if a change was made): commit**

```bash
git add index.html app.css
git commit -m "$(cat <<'EOF'
Safe-area inset handling for [specific element found in Step 3]

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0187S4a5KJYBzpfMocxHUYQz
EOF
)"
```

---

## Final verification and report

### Task 25: Full regression pass — all 13 required verification items

**Files:** none modified — verification only.

- [ ] **Step 1: No visual regression at all 7 baseline viewports**

Re-run the "Viewport screenshot capture" helper against the now-fully-modified `index.html`, and do a careful crop-by-crop comparison against the Task 1 baseline set for every one of the 7 sizes. List any pixel difference found and confirm each one traces back to an *intended* bug fix from Tasks 11-14 (the four mobile bugs) — anything else is a regression and must be fixed before continuing.

- [ ] **Step 2: No horizontal content overflow from 320px to 1440px**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for w in 320 360 390 430 640 768 960 1024 1440; do
  cp index.html "/tmp/overflow-test.html"
  python3 - "$w" <<'EOF'
import sys
w = sys.argv[1]
p = "/tmp/overflow-test.html"
html = open(p, encoding='utf-8').read()
tail = f"""<script defer>
setTimeout(function(){{
  var d = document.createElement('div');
  d.style.cssText='position:fixed;top:0;left:0;background:red;color:white;z-index:99999;font-size:14px;padding:10px;';
  d.textContent = 'width={w} scrollWidth=' + document.documentElement.scrollWidth + ' clientWidth=' + document.documentElement.clientWidth + ' overflow=' + (document.documentElement.scrollWidth > document.documentElement.clientWidth);
  document.body.appendChild(d);
}}, 1000);
</script>"""
html = html.replace('</body>', tail + '</body>')
open(p, 'w', encoding='utf-8').write(html)
EOF
  "$CHROME" --headless --disable-gpu --screenshot="/tmp/overflow-${w}.png" --window-size="${w},1000" --hide-scrollbars --virtual-time-budget=4000 "file:///tmp/overflow-test.html" 2>/dev/null
done
```
Read each — every one must show `overflow=false`. (Note the earlier-session-discovered quirk: this specific headless Chrome build sometimes silently clamps `--window-size` below ~500px width to ~500px — cross-check the banner's own reported `clientWidth` against the intended `w`, don't just trust the launch flag.)

- [ ] **Step 3: All internal anchors and footer/legal links work**

Re-run the anchor-matching check from Task 1 Step 3, plus click-test (via headless navigation) that `privacy.html` and `terms.html` load with `200` and their own "Функционалности"/"Закажи демо" nav links correctly point back to `index.html#se` / `index.html#demo-forma`.

- [ ] **Step 4: All images load; no stretched images; no meaningful CLS**

Run the link/asset-existence check (confirms every image file exists). For CLS: use the Lighthouse run in Step 9 below rather than a separate manual pass — `cumulative-layout-shift` is directly reported there.

- [ ] **Step 5: Feature tabs work with mouse, touch, Tab, Shift+Tab, and arrow keys**

Extend the click-simulation harness from Task 15 Step 2 to also dispatch `keydown` events with `key: 'ArrowRight'`/`'ArrowLeft'` on a focused tab, and confirm `goTo()` fires correctly for each input method (click already covered in Task 15; this step specifically exercises the keyboard path via `tab.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))`).

- [ ] **Step 6: Reduced-motion mode shows all content in normal document flow**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --force-prefers-reduced-motion --screenshot=/tmp/reduced-motion.png --window-size=1440,4000 --hide-scrollbars --virtual-time-budget=4000 "file://$(pwd)/index.html" 2>/dev/null
```
Read it — confirm every section (including the GSAP scroll-scenes, which should be entirely skipped per `js/app.js:277`) renders in normal stacked flow with no pinned/transformed elements stuck mid-animation.

- [ ] **Step 7: Demo form tests — invalid, successful, rejected, offline, slow, duplicate**

Re-run all 6 scenarios from Task 2 Step 3 one final time against the fully-modified `js/app.js`/`index.html` (not the Task 2-only intermediate state), confirming Task 17's `aria-invalid` wiring also fires correctly on the "invalid" scenario.

- [ ] **Step 8: Page remains readable if animation CDNs fail**

Re-run Task 10 Step 4's CDN-failure test against the final state.

- [ ] **Step 9: Lighthouse mobile and desktop reports, before/after comparison**

```bash
python3 -m http.server 8126 &
SERVER_PID=$!
sleep 1
npx --yes lighthouse@13.5.0 http://localhost:8126/index.html \
  --output=json --output-path=/tmp/mg-final/lighthouse-mobile.json \
  --preset=perf --form-factor=mobile --screenEmulation.mobile \
  --quiet --chrome-flags="--headless=new"
npx --yes lighthouse@13.5.0 http://localhost:8126/index.html \
  --output=json --output-path=/tmp/mg-final/lighthouse-desktop.json \
  --preset=perf --form-factor=desktop --screenEmulation.disabled \
  --quiet --chrome-flags="--headless=new"
kill $SERVER_PID
python3 -c "
import json
for name in ['mobile','desktop']:
    before = json.load(open(f'/tmp/mg-baseline/lighthouse-{name}.json'))
    after = json.load(open(f'/tmp/mg-final/lighthouse-{name}.json'))
    print(name)
    for cat in before['categories']:
        b = round(before['categories'][cat]['score']*100)
        a = round(after['categories'][cat]['score']*100)
        print(f'  {cat}: {b} -> {a}')
    for audit in ['largest-contentful-paint','cumulative-layout-shift','total-blocking-time']:
        print(f\"  {audit}: {before['audits'][audit]['displayValue']} -> {after['audits'][audit]['displayValue']}\")
"
```
Record the real before/after numbers — do not estimate or round favorably.

- [ ] **Step 10: Axe accessibility scan, no critical/serious unresolved issues**

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cp index.html /tmp/axe-test.html
python3 - <<'EOF'
p = "/tmp/axe-test.html"
html = open(p, encoding='utf-8').read()
axe_script = '<script src="https://cdn.jsdelivr.net/npm/axe-core@4.10.0/axe.min.js"></script>'
html = html.replace('</body>', axe_script + '</body>')
tail = """<script>
window.addEventListener('load', function(){
  setTimeout(function(){
    axe.run(function(err, results){
      var d = document.createElement('div');
      d.style.cssText='position:fixed;top:0;left:0;background:red;color:white;z-index:99999;font-size:11px;padding:10px;max-width:1400px;max-height:800px;overflow:auto;';
      var serious = results.violations.filter(function(v){ return v.impact === 'critical' || v.impact === 'serious'; });
      d.textContent = 'critical/serious violations: ' + serious.length + ' | ' + JSON.stringify(serious.map(function(v){ return v.id + ': ' + v.description; }));
      document.body.appendChild(d);
    });
  }, 2000);
});
</script>"""
html = html.replace('</body>', tail + '</body>')
open(p, 'w', encoding='utf-8').write(html)
EOF
cp -r assets js /tmp/ 2>/dev/null; cp app.css /tmp/
"$CHROME" --headless --disable-gpu --screenshot=/tmp/axe-check.png --window-size=1440,1600 --hide-scrollbars --virtual-time-budget=8000 "file:///tmp/axe-test.html" 2>/dev/null
```
Read `/tmp/axe-check.png` — expect `critical/serious violations: 0`. If any appear, fix them (small, targeted CSS/HTML/ARIA fixes only, re-run this check) before considering Priority 4 complete.

- [ ] **Step 11: HTML validation and missing-asset check**

Run both shared checks one final time. Expected: all three files `OK`, `OK, no missing assets`.

- [ ] **Step 12: Privacy and Terms pages load and are linked correctly**

Already covered by Task 3 Step 4 and Task 22 Step 4 — re-confirm once more against the final commit.

- [ ] **Step 13: Social preview and structured data validation**

```bash
python3 -c "
import json, re
html = open('index.html', encoding='utf-8').read()
m = re.search(r'<script type=\"application/ld\+json\">(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
print(json.dumps(data, indent=2, ensure_ascii=False))
"
```
Confirm the JSON parses cleanly (structurally valid) and still contains only factual fields (name/category/OS/description/url) with no invented ratings/pricing/reviews. Confirm `og:image`/`twitter:image` point at `assets/social-preview.jpg`, which exists at 1200×630 (already verified in Task 18).

- [ ] **Step 14: Write the final report**

Produce the report the brief's "Required final response from Claude" section asks for — see Task 26 below, which is this same content formalized as the actual message sent to the user (this step is the data-gathering; Task 26 is "deliver it").

---

### Task 26: Deliver the final report to the user

**Files:** none.

- [ ] **Step 1: Compose the report using only data actually gathered in Task 25**

Must include, per the brief's exact requirements:
- Concise summary of changes (map to the 22 implementation tasks above).
- Exact files changed (from `git diff --stat` against the Task 1 checkpoint commit).
- Before/after metrics: Lighthouse scores (Task 25 Step 9's real printed numbers), total page weight / image weight / request count (derivable from the Lighthouse JSON's `resourceSummary`/`network-requests` audits — extract real numbers, don't estimate), and the concrete byte savings already known from this plan (duplicate phone-mockup dedup, unused-asset deletion, font-weight trimming — cite the specific KB figures already computed in Tasks 4/6/22).
- Tests executed and their results (Task 25's 13 items, each with an actual pass/fail, not an assumption).
- Any remaining blockers — **the Formspree form ID is still `YOUR_FORM_ID`, unresolved, exactly as before**, since this plan explicitly does not invent one; state this plainly as the top blocker.
- Confirmation that design, content, section order, and animations were not changed — back this with the Task 25 Step 1 screenshot-diff result, not just an assertion.
- A short rollback note: `git log` shows one commit per task on `production-optimization`; any single task can be reverted independently with `git revert <hash>` without affecting the others, since each commit is scoped to one concern.

- [ ] **Step 2: Run `git diff --stat` against the checkpoint for the exact-files-changed list**

```bash
git diff --stat a7dedc3..HEAD   # replace a7dedc3 with the actual Task 1 checkpoint hash if it differs
```

- [ ] **Step 3: Send the report as the final message of this plan's execution — do not push to origin unless separately asked**
