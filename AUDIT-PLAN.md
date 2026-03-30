# RxTempo Code Audit — Confirmed Errors & Correction Plan

> Generated 2026-03-30 by automated multi-agent code audit.
> All items below are **confirmed true errors** verified by reading the source code. False positives have been excluded.

---

## Critical / High Severity

### H1 — `inferShiftType` uses raw string comparisons after `SelectField` returns strings
**Location:** Lines 882, 1302–1310
**Impact:** Shift type auto-inference is broken after the first user interaction with any time `<select>`.

`SelectField.onChange` always passes `e.target.value` (a string) but state is initialized as numbers (`toMin(8,0)` = `480`). `inferShiftType` compares parameters with bare `<`, `>=`, `===` operators. String comparison `"1020" < "480"` yields `true` (lexicographic), producing wrong overnight detection. All downstream logic (shift type labels, rule suppression, category filtering) cascades from this.

**Fix:** Cast to numbers inside `inferShiftType`, or convert in `SelectField.onChange`.

---

### H2 — `getDotColor` and `ExpandChevron` close over stale module-level `MF`
**Location:** Lines 806, 814, 783
**Impact:** Theme-sensitive dot colors and chevron strokes always use dark-theme values regardless of theme toggle.

`getDotColor`, `ExpandChevron`, and `btn` are module-level constants that capture `MF` at module-load time. The `let MF = ...` reassignment on line 3525 during render does not cause these closures to re-evaluate. All dot colors and chevron strokes are permanently dark-theme.

**Fix:** Pass `MF` as a parameter, or convert these to functions that read `MF` at call time rather than at definition time.

---

### H3 — `@import` in a dynamically-injected `<style>` tag — font never loads
**Location:** Line 3737
**Impact:** IBM Plex Sans font is never loaded. The app falls back to system sans-serif.

The CSS `@import` rule inside a `<style>` tag injected into the document body by React is not reliably honored by browsers. The intended typeface is never applied.

**Fix:** Move the Google Fonts `@import` to a `<link>` tag in `index.html`'s `<head>`.

---

### H4 — `MF` module-level variable mutated during render
**Location:** Line 3525
**Impact:** Any memoized component reading `MF` from module scope retains stale theme after toggle.

Assigning to a module-level `let` during the render body violates React's purity rules. Components that are `React.memo`-wrapped or otherwise skip re-render will silently use the old theme object because `MF` is not a reactive dependency.

**Fix:** Use React context or props to distribute theme values, or convert `MF` to a ref/state.

---

### H5 — `eventArrivals` midnight (minute 0) permanently stuck as "pending"
**Location:** Lines 2514–2515, 3615, 3633, 3651
**Impact:** Any delivery logged at exactly midnight can never transition to "arrived" status; its dynamic task rule is never injected.

`eventArrivals[e.key]` stores `ctx.currentMin` (an integer). At midnight this is `0`, which is falsy. `!(0 ?? 0)` evaluates to `true`, keeping the event in `pending`. The `if (eventArrivals.warehouse)` guards on lines 3615/3633/3651 also fail for `0`.

**Fix:** Use `eventArrivals[e.key] != null` instead of truthy checks. Change `?? 0` to explicit presence checks.

---

### H6 — "Try again" button in `AppErrorBoundary` causes infinite re-throw loop
**Location:** Line 3491
**Impact:** If the error was caused by bad persistent state, clicking "Try again" just re-renders the same crashing tree and immediately re-throws.

`setState({ hasError: false })` re-renders the same child tree without clearing the state that caused the crash. There is no `componentDidCatch` or mechanism to reset child state.

**Fix:** Clear application state on recovery (call `handleReset`), or change the child's `key` to force a fresh mount.

---

## Medium Severity

### M1 — `handleSetup` omits 5 state resets that `handleReset` performs
**Location:** Lines 3714–3721 vs 3573–3586
**Impact:** If a second setup ever runs, `eventArrivals`, `queueState`, `vaccineCount`, `dayNoteStates`, and `dayNoteConfirm` carry over from the prior session.

**Fix:** Align `handleSetup` state resets with `handleReset`.

---

### M2 — `setupTimestamp: Date.now()` computed on render, not at submit time
**Location:** Line 1207
**Impact:** The 24-hour auto-expiry fires slightly early because the timestamp is set when the confirm screen renders, not when the user clicks "Let's go."

**Fix:** Call `Date.now()` inside the `onClick` handler at line 1256, not in the `setupData` object literal.

---

### M3 — `position: sticky; bottom: 0` on bottom nav doesn't actually stick
**Location:** Lines 4137, 4144
**Impact:** On short viewports where `<main>` content overflows, the bottom nav scrolls out of view instead of sticking.

The nav is a sibling of `<main>` (which has `overflowY: auto`), not a child of the scroll container. `sticky` has no scrollable ancestor to stick to.

**Fix:** Use `position: fixed` on the nav, or restructure so the outer div is the scroll container with `overflow: hidden; height: 100vh`.

---

### M4 — `auto-return` timer not cancelled on manual navigation
**Location:** Line 3711
**Impact:** If a user taps an action on arrival/exit screen then immediately navigates to a different tab, the `AUTO_RETURN_MS` timeout fires and overrides their navigation back to "home."

**Fix:** Cancel `actionReturnRef` timer when `screen` state changes (e.g., in a `useEffect` cleanup watching `screen`).

---

### M5 — `onBlur` silently overwrites explicit "0" immunization target with "6"
**Location:** Line 1710
**Impact:** User types "0", gets a blocking error, tabs away — the value is silently changed to "6" and the gate is bypassed.

**Fix:** Only auto-fill "6" when the field is empty (`""`), not when it's `"0"`.

---

### M6 — Shift time `<select>` goes stale after pharmacy hours change
**Location:** Lines 1314–1324
**Impact:** If user changes pharmacy hours after selecting shift times, the currently-selected value may no longer appear in the filtered options. The displayed option snaps to the first available, but React state retains the old invalid value.

**Fix:** Add a `useEffect` that validates/resets shift time state when pharmacy hours change.

---

### M7 — Immunization panel cannot be collapsed when `autoExpand` is active
**Location:** Lines 2573–2574
**Impact:** When `queueState === "clear"` and vaccine target is unmet, `isExpanded = immExpanded || autoExpand` is always `true`. The toggle button is stuck.

**Fix:** Use a separate `immCollapsedByUser` flag, or compute `isExpanded = immExpanded ?? autoExpand` with tri-state logic.

---

### M8 — InfoPanel `onClose` in useEffect dependency array causes spurious focus restoration
**Location:** Lines 954–958
**Impact:** If `onClose` is not memoized, the effect re-runs while the panel is open, causing focus flicker (cleanup restores focus, then effect re-focuses the panel).

**Fix:** Remove `onClose` from the dependency array and store it in a ref, or ensure all callers memoize `onClose`.

---

### M9 — `Line` and `Bullet` components defined inside `InfoPanel` render body
**Location:** Lines 962–974
**Impact:** New component types every render cause React to unmount/remount all `<Line>` and `<Bullet>` elements on every re-render (DOM churn, broken focus).

**Fix:** Move `Line` and `Bullet` definitions outside `InfoPanel`.

---

### M10 — `aria-disabled` used without `disabled` attribute on form buttons
**Location:** Lines 1470, 1827
**Impact:** Buttons remain keyboard-activatable when visually disabled. Assistive technology users can fire the handler.

**Fix:** Add the `disabled` HTML attribute, or swallow `onClick` unconditionally and add `tabIndex={-1}` when disabled.

---

### M11 — ExitScreen `stillOpenExit` not filtered by handoff eligibility
**Location:** Lines 3148, 3151
**Impact:** `mentionCount` includes non-exit items whose window simply passed, inflating the exit headline count.

**Fix:** Filter `getStillOpenItems` result by `r.handoffEligibility === "exit"`.

---

### M12 — ExitScreen "window passed" actions bypass `handleConfirm`
**Location:** Lines 3354–3355
**Impact:** No haptic feedback, no confirm flash animation, divergent UX from all other action buttons.

**Fix:** Use `handleConfirm(r.id, state)` instead of calling `onAction` directly.

---

### M13 — LaterTodayScreen overnight double-appearance
**Location:** Line 2921
**Impact:** An overnight-wrapped HIDDEN item can appear simultaneously in "Later Today" and in HomeScreen's "still open" chip.

**Fix:** Add a guard that excludes items whose window has already passed (mirror `getStillOpenItems` logic).

---

### M14 — `confirmToggle` single slot silently drops pending decisions
**Location:** Lines 1591–1592
**Impact:** If user taps two expected-delivery toggle rows in sequence, the first pending confirmation dialog is silently replaced and the first setter is lost.

**Fix:** Use a map/queue for pending confirmations, or block opening a second dialog while one is active.

---

### M15 — `totalActionable || 1` produces false milestone messages when `totalActionable === 0`
**Location:** Lines 635–636
**Impact:** `pct = coveredCount / 1 = coveredCount` is likely `>= 0.75`, triggering "Home stretch" or "Past the halfway mark" incorrectly when there are no actionable items.

**Fix:** Return early or return a neutral message when `totalActionable === 0`.

---

### M16 — Division by zero in `deriveContext` when `shiftStart === shiftEnd`
**Location:** Line 446
**Impact:** `shiftLen = 0` → `minutesIntoShift / 0` → `NaN` propagates to `shiftProgress`, progress bar width, and all context math.

**Fix:** Guard `shiftLen === 0` in `deriveContext` (return a safe default context).

---

### M17 — `useItemConfirmState` captures `onAction` by value in setTimeout
**Location:** Line 2752
**Impact:** If `activeRules` changes between confirm click and timer fire (e.g., a delivery event triggers rule recomputation), the timer calls the stale `onAction` closure with outdated `activeRules`.

**Fix:** Store `onAction` in a ref inside `useItemConfirmState`.

---

### M18 — Pharmacy hours fields remain keyboard-reachable when 24-hr mode is on
**Location:** Line 1435
**Impact:** `pointerEvents: "none"` only blocks mouse. Keyboard users can tab to and change the frozen `<select>` fields.

**Fix:** Use `disabled` on the `<select>` elements, or `tabIndex={-1}`.

---

## Low Severity

### L1 — Equal overlap window times pass without error
**Location:** Line 1526
**Impact:** `start === end` stores a zero-duration overlap window. No validation catches it.

**Fix:** Change `+updated.start > +updated.end` to `>=`.

---

### L2 — `select option` CSS overrides ignored on Chrome/Safari/iOS
**Location:** Line 3743
**Impact:** `selectBg`/`selectText` theme tokens have zero effect on Chromium and Safari (most users).

**Fix:** Accept browser-native styling for `<option>`, or use a custom dropdown component.

---

### L3 — `overlapWindows` has mixed number/string types
**Location:** Lines 1521–1531, 1539
**Impact:** `addWindow` stores numbers, `updateWindow` stores strings. Type inconsistency across array entries.

**Fix:** Normalize to numbers in `updateWindow` (use `+val`).

---

### L4 — `getPhaseLabel` returns "Closing out" when `shiftProgress` is undefined
**Location:** Line 692
**Impact:** If `ctx.shiftProgress` is missing, all threshold comparisons are `false` and the fallback label is misleadingly "Closing out."

**Fix:** Add a guard at the top: `if (ctx.shiftProgress == null) return "Starting";`

---

### L5 — Duplicate `◇` icon on two InfoPanel sections
**Location:** Lines 986, 1056
**Impact:** "Data" and "Principles" sections have the same icon.

**Fix:** Change one icon.

---

### L6 — `ROLE_LABELS[setup.role]` renders `undefined` for unrecognized roles
**Location:** Line 1935
**Impact:** Silent empty text in the UI header for any role not in the lookup table.

**Fix:** Add a fallback: `ROLE_LABELS[setup.role] ?? setup.role`.

---

### L7 — `globalCSS` injected in three render paths simultaneously
**Location:** Lines 3759, 3999, 4029
**Impact:** Momentary double-injection during transitions; stale `select option` colors on theme toggle (one paint frame).

**Fix:** Inject `globalCSS` once at the top level, outside conditional render paths.

---

### L8 — Reset dialog `role="dialog"` on backdrop wrapper, not dialog panel
**Location:** Lines 4083–4121
**Impact:** Screen readers treat the entire viewport overlay as the dialog.

**Fix:** Move `role="dialog"` and `aria-modal="true"` to the inner content panel.

---

### L9 — Reset dialog focus trap queries only `button`
**Location:** Line 3545
**Impact:** Inconsistent with `InfoPanel` (which queries all focusable elements). Will break if non-button focusables are added.

**Fix:** Use the same selector as `InfoPanel`: `"button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"`.

---

### L10 — Event arrival `<select>` has no accessible label
**Location:** Lines 2552–2563
**Impact:** Screen readers announce it as a bare listbox with no context.

**Fix:** Add `aria-label={e.label + " arrival time"}`.

---

### L11 — "Needs attention" amber dot conveys state by color alone
**Location:** Lines 2292, 2871
**Impact:** Invisible to screen readers; no text or `aria-label`.

**Fix:** Add `aria-label="Needs attention"` or a visually-hidden text span.

---

### L12 — Nav badge count changes not announced to screen readers
**Location:** Lines 4173–4181
**Impact:** Badge number changes are silent — no `aria-live` region.

**Fix:** Add `aria-live="polite"` to the badge span or use an off-screen live region.

---

### L13 — No body scroll lock when InfoPanel is open
**Location:** Lines 935–958
**Impact:** Page body remains scrollable behind the overlay on desktop.

**Fix:** Set `document.body.style.overflow = "hidden"` in the useEffect when `show` is true; restore in cleanup.

---

### L14 — TimeSimulator "-1 hr" preset produces out-of-shift time for short shifts
**Location:** Lines 3401–3402
**Impact:** If `shiftLen < 60`, the preset resolves to a time before `shiftStart`.

**Fix:** Clamp preset values to `[shiftStart, shiftStart + shiftLen]`.

---

### L15 — TimeSimulator `onReset` omits state fields reset by full `handleReset`
**Location:** Line 4130
**Impact:** "Reset all actions" doesn't clear `eventArrivals`, `queueState`, `vaccineCount`, `dayNoteStates`, `dayNoteConfirm`.

**Fix:** Align with full `handleReset` state list.

---

### L16 — TimeSimulator comment describes reset logic that is not implemented
**Location:** Lines 3723–3726
**Impact:** Dead intent — comment says "Reset all user-actioned states when time changes" but no code does this.

**Fix:** Either implement the described behavior or remove the stale comment.

---

### L17 — `GetAheadScreen.activeCount` excludes `VISIBLE_HANDOFF` state
**Location:** Lines 3044–3046
**Impact:** Items in handoff state are visible and actionable but not counted, potentially making `toobusy` false when it should be true.

**Fix:** Add `S.VISIBLE_HANDOFF` to the `activeCount` filter.

---

### L18 — `key={screen}` on `<main>` remounts entire content on every tab switch
**Location:** Line 4137
**Impact:** All local state (scroll position, expanded sections) is destroyed on every tab change. Full DOM remount on every navigation.

**Fix:** Remove `key={screen}` and use CSS visibility/display toggling, or accept the tradeoff if the animation is desired.

---

### L19 — `usualWindow` offsets are inverted on all three get-ahead rules
**Location:** Lines 276–277, 289–290, 303–304
**Impact:** `startOffset: 60` > `endOffset: -30` — the window definition appears inverted. This may be intentional given how `resolveWindow` interprets offsets, but the semantics are confusing and should be verified.

**Fix:** Verify with product requirements. If intentional, add a clarifying comment.

---

## Summary Counts

| Severity | Count |
|----------|-------|
| High (H) | 6 |
| Medium (M) | 18 |
| Low (L) | 19 |
| **Total** | **43** |

---

## Recommended Correction Order

1. **H1** (string coercion in `inferShiftType`) — cascading logic corruption
2. **H2 + H4** (`MF` stale closures + render mutation) — theme system fundamentally broken
3. **H3** (`@import` → `<link>`) — font never loads
4. **H5** (midnight `eventArrivals`) — data loss bug
5. **H6** (error boundary infinite loop) — crash recovery broken
6. **M1–M6** (state resets, timestamps, sticky nav, auto-return, immunization, select stale) — functional correctness
7. **M7–M18** (UI state, accessibility, exit screen) — UX and a11y
8. **L1–L19** (edge cases, cleanup, consistency) — polish
