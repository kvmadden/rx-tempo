import { useState, useEffect, useCallback, useMemo } from "react";

// ─── RULE TABLE: Real pharmacy content with full behavior contracts ───
const RULES = [
  // ── OPENING ──
  {
    id: "open-orientation",
    label: "Opening orientation",
    description: "Quick scan of what the day looks like — queue depth, will call volume, any carryover.",
    category: "opening",
    usualWindow: { startOffset: 0, endOffset: 30 },
    roleContext: "Usually the opener or first pharmacist in.",
    carryLogic: "suppress",
    handoffEligibility: "arrival",
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "open-register",
    label: "Registers and systems ready",
    description: "POS up, pharmacy system logged in, queues visible.",
    category: "opening",
    usualWindow: { startOffset: 0, endOffset: 20 },
    roleContext: "Often handled before the first customer.",
    carryLogic: "suppress",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "open-willcall",
    label: "Will call check",
    description: "Scan will call bins for returns to stock, misfiled bags, or anything expiring today.",
    category: "opening",
    usualWindow: { startOffset: 5, endOffset: 60 },
    roleContext: "Worth checking early to avoid surprises later.",
    carryLogic: "carry",
    handoffEligibility: "arrival",
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "open-delivery",
    label: "Delivery scan",
    description: "Check for incoming orders and wholesaler delivery. Note anything missing or short-shipped.",
    category: "opening",
    usualWindow: { startOffset: 0, endOffset: 90 },
    roleContext: "Often handled by whoever is at the bench first.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "open-fridge",
    label: "Refrigerator temperature log",
    description: "Check and document fridge temps. Flag anything out of range early.",
    category: "opening",
    usualWindow: { startOffset: 0, endOffset: 45 },
    roleContext: "Usually done at open — quick and routine.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "medium",
  },
  // ── MIDDAY ──
  {
    id: "mid-queue",
    label: "Queue and production check",
    description: "How does the queue look? Any stuck scripts, missing parts, or insurance rejects piling up?",
    category: "midday",
    usualWindow: { startOffset: 120, endOffset: 240 },
    roleContext: "Worth a quick scan by whoever has a moment.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "mid-immunizations",
    label: "Immunization appointments",
    description: "Any scheduled immunizations coming up this afternoon? Supplies ready?",
    category: "midday",
    usualWindow: { startOffset: 120, endOffset: 300 },
    roleContext: "Usually the pharmacist who will be at the window.",
    carryLogic: "carry",
    handoffEligibility: "arrival",
    getAheadEligible: true,
    riskWeight: "medium",
  },
  {
    id: "mid-cycle-count",
    label: "Cycle count window",
    description: "If cycle counts are due today, mid-shift is usually the calmest time to get through them.",
    category: "midday",
    usualWindow: { startOffset: 150, endOffset: 330 },
    roleContext: "Often easier with two people if overlap allows.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: true,
    riskWeight: "low",
  },
  {
    id: "mid-dur",
    label: "DUR follow-ups",
    description: "Any drug utilization reviews flagged that need pharmacist resolution before fill.",
    category: "midday",
    usualWindow: { startOffset: 90, endOffset: 300 },
    roleContext: "Usually the verifying pharmacist.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "mid-mtm",
    label: "MTM alerts",
    description: "Medication therapy management cases due today — review and document if time allows.",
    category: "midday",
    usualWindow: { startOffset: 120, endOffset: 360 },
    roleContext: "Worth fitting in during a calmer stretch.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: true,
    riskWeight: "medium",
  },
  // ── DEADLINE WINDOW ──
  {
    id: "deadline-rts",
    label: "Return to stock cutoff",
    description: "Prescriptions past their hold window — return to stock before end of day.",
    category: "deadline",
    usualWindow: { startOffset: 300, endOffset: 480 },
    roleContext: "Usually handled in a calmer window before close.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: true,
    riskWeight: "high",
  },
  {
    id: "deadline-controls",
    label: "Controlled substance reconciliation",
    description: "Daily CII count or reconciliation if your store requires it.",
    category: "deadline",
    usualWindow: { startOffset: -90, endOffset: -15 },
    roleContext: "Usually the closing pharmacist.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "deadline-report",
    label: "End-of-day reports",
    description: "Print or review daily fill count, exception reports, or anything your store runs at close.",
    category: "deadline",
    usualWindow: { startOffset: -60, endOffset: -10 },
    roleContext: "Usually the closing pharmacist.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "medium",
  },
  // ── EXIT ──
  {
    id: "exit-queue-state",
    label: "Queue state at handoff",
    description: "What does the queue look like for whoever is staying or coming next?",
    category: "exit",
    usualWindow: { startOffset: -30, endOffset: 0 },
    roleContext: "Worth mentioning to the next pharmacist.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "exit-open-issues",
    label: "Unresolved issues to mention",
    description: "Anything that came up today that the next person should know about — insurance problems, patient callbacks, doctor follow-ups.",
    category: "exit",
    usualWindow: { startOffset: -30, endOffset: 0 },
    roleContext: "Verbal handoff material.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  // ── GET AHEAD ──
  {
    id: "ahead-outdates",
    label: "Outdate pull",
    description: "Pull and quarantine anything expiring within the check window.",
    category: "getahead",
    usualWindow: { startOffset: 60, endOffset: -60 },
    roleContext: "Can be started whenever there is a calm window.",
    carryLogic: "suppress",
    handoffEligibility: null,
    getAheadEligible: true,
    riskWeight: "low",
  },
  {
    id: "ahead-facing",
    label: "Shelf facing and organization",
    description: "Quick tidy of fast-mover shelves and high-traffic bins.",
    category: "getahead",
    usualWindow: { startOffset: 60, endOffset: -60 },
    roleContext: "Nice to do when the queue is light.",
    carryLogic: "suppress",
    handoffEligibility: null,
    getAheadEligible: true,
    riskWeight: "low",
  },
  {
    id: "ahead-smartcount",
    label: "Smart count prep",
    description: "Get ahead on smart count pulls for tomorrow if today allows it.",
    category: "getahead",
    usualWindow: { startOffset: 120, endOffset: -60 },
    roleContext: "Only if the day is calm enough to justify it.",
    carryLogic: "suppress",
    handoffEligibility: null,
    getAheadEligible: true,
    riskWeight: "low",
  },
  // ── ADDITIONAL MIDDAY ──
  {
    id: "mid-waiters",
    label: "Waiters check",
    description: "Anyone waiting longer than expected? Quick scan of the waiter bench.",
    category: "midday",
    usualWindow: { startOffset: 60, endOffset: 360 },
    roleContext: "Whoever is near the pickup window.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "mid-voicemail",
    label: "Pharmacy voicemail",
    description: "Check the voicemail queue — prescriber callbacks, patient questions, refill requests.",
    category: "midday",
    usualWindow: { startOffset: 90, endOffset: 240 },
    roleContext: "Usually checked mid-morning and mid-afternoon.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "mid-callbacks",
    label: "Patient callbacks",
    description: "Any patients expecting a call back today? Insurance issues, special orders, prior auth updates.",
    category: "midday",
    usualWindow: { startOffset: 120, endOffset: 360 },
    roleContext: "Usually the pharmacist who took the original call.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "mid-readyfill",
    label: "ReadyFill review",
    description: "Review auto-fill queue for anything that needs pharmacist intervention before it drops.",
    category: "midday",
    usualWindow: { startOffset: 150, endOffset: 300 },
    roleContext: "Usually the verifying pharmacist.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: true,
    riskWeight: "medium",
  },
];

// ─── HELPERS ───
const pad = (n) => String(n).padStart(2, "0");
const toMin = (h, m) => h * 60 + m;
const fmtTime12 = (totalMin) => {
  const h = Math.floor(((totalMin % 1440) + 1440) % 1440 / 60);
  const m = ((totalMin % 1440) + 1440) % 1440 % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${pad(m)} ${ampm}`;
};

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push({ value: toMin(h, m), label: fmtTime12(toMin(h, m)) });
  }
}

const ROLE_LABELS = {
  "pharmacist-manager": "PIC / PM",
  "staff-rph": "Staff RPh",
  floater: "Floater",
  overnight: "Overnight",
};

const COVERAGE_LABELS = {
  solo: "Solo",
  opener: "Opening",
  overlap: "Overlap",
  closer: "Closing",
};

const SHIFT_TYPE_LABELS = {
  "open-close": "Open to close",
  "open-mid": "Opening shift",
  "mid": "Mid shift",
  "mid-close": "Closing shift",
  overnight: "Overnight",
};

// ─── STATE ENGINE ───
const S = {
  HIDDEN: "hidden",
  VISIBLE: "visible",
  VISIBLE_HANDOFF: "visible_handoff",
  HANDLED_EARLY: "handled_early",
  CONFIRMED: "confirmed",
  NOT_APPLICABLE: "not_applicable",
  NEEDS_ATTENTION: "needs_attention",
  EXPIRED: "expired",
};

function deriveContext(setup, now) {
  if (!setup) return null;
  const { shiftStart, shiftEnd, storeOpen, storeClose, overlapWindows } = setup;
  const nowDate = now || new Date();
  const currentMin = nowDate.getHours() * 60 + nowDate.getMinutes();

  // Shift math (overnight-safe)
  const shiftLen = shiftEnd >= shiftStart ? shiftEnd - shiftStart : 1440 - shiftStart + shiftEnd;
  let minutesIntoShift;
  if (shiftEnd >= shiftStart) {
    minutesIntoShift = currentMin - shiftStart;
  } else {
    minutesIntoShift = currentMin >= shiftStart ? currentMin - shiftStart : 1440 - shiftStart + currentMin;
  }
  const minutesUntilEnd = shiftLen - minutesIntoShift;
  const shiftProgress = Math.max(0, Math.min(1, minutesIntoShift / shiftLen));

  // Store day math
  const storeLen = storeClose >= storeOpen ? storeClose - storeOpen : 1440 - storeOpen + storeClose;
  let minutesIntoStore;
  if (storeClose >= storeOpen) {
    minutesIntoStore = currentMin - storeOpen;
  } else {
    minutesIntoStore = currentMin >= storeOpen ? currentMin - storeOpen : 1440 - storeOpen + currentMin;
  }
  const dayPosition = Math.max(0, Math.min(1, minutesIntoStore / storeLen));

  // Coverage mode + handoff detection
  let coverageMode = "solo";
  let inOverlap = false;
  let arrivalWindow = false;
  let nearOverlapExit = false;

  if (overlapWindows && overlapWindows.length > 0) {
    for (const w of overlapWindows) {
      // In overlap
      if (isTimeInRange(currentMin, w.start, w.end)) {
        coverageMode = "overlap";
        inOverlap = true;
      }
      // Arrival window: 10min before overlap starts to 20min after
      if (isTimeInRange(currentMin, (w.start - 10 + 1440) % 1440, (w.start + 20) % 1440)) {
        arrivalWindow = true;
      }
      // Near end of overlap
      const minsToOverlapEnd = ((w.end - currentMin) + 1440) % 1440;
      if (minsToOverlapEnd <= 20 && minsToOverlapEnd > 0) {
        nearOverlapExit = true;
      }
    }
    if (!inOverlap) {
      if (minutesIntoShift < 30) coverageMode = "opener";
      else if (minutesUntilEnd < 30) coverageMode = "closer";
    }
  } else {
    if (minutesIntoShift < 30) coverageMode = "opener";
    else if (minutesUntilEnd < 30) coverageMode = "closer";
  }

  // Timing pressure
  let timingPressure = "standard";
  if (shiftProgress < 0.12) timingPressure = "early";
  else if (shiftProgress > 0.88) timingPressure = "end-of-day";
  else if (shiftProgress > 0.72) timingPressure = "tightening";

  // Exit window: last 35 min of shift
  const exitWindow = minutesUntilEnd <= 35 && minutesUntilEnd >= -5;

  return {
    currentMin,
    minutesIntoShift,
    minutesUntilEnd,
    shiftProgress,
    shiftLen,
    coverageMode,
    inOverlap,
    arrivalWindow,
    timingPressure,
    exitWindow,
  };
}

function isTimeInRange(current, start, end) {
  if (end >= start) return current >= start && current <= end;
  return current >= start || current <= end;
}

function resolveWindow(rule, setup) {
  const { shiftStart, shiftEnd } = setup;
  const shiftLen = shiftEnd >= shiftStart ? shiftEnd - shiftStart : 1440 - shiftStart + shiftEnd;
  let start, end;
  if (rule.usualWindow.startOffset >= 0) {
    start = (shiftStart + rule.usualWindow.startOffset) % 1440;
  } else {
    start = (shiftStart + shiftLen + rule.usualWindow.startOffset + 1440) % 1440;
  }
  if (rule.usualWindow.endOffset > 0) {
    end = (shiftStart + rule.usualWindow.endOffset) % 1440;
  } else {
    end = (shiftStart + shiftLen + rule.usualWindow.endOffset + 1440) % 1440;
  }
  return { start, end };
}

function computeItemStates(rules, prevStates, setup, ctx) {
  const result = {};
  const prevActive = Object.values(prevStates).filter(
    (s) => s === S.VISIBLE || s === S.NEEDS_ATTENTION || s === S.VISIBLE_HANDOFF
  ).length;
  const highPressure = prevActive > 5 || ctx.timingPressure === "end-of-day";

  // ShiftType filtering: suppress categories that don't match the shift posture
  const shiftType = setup.shiftType || "open-close";
  const suppressOpening = shiftType === "mid" || shiftType === "mid-close" || shiftType === "overnight";
  const suppressDeadline = shiftType === "open-mid";

  // Track how many items we're making visible (hard cap for Scenario 3)
  let visibleCount = 0;
  const MAX_VISIBLE = 7;

  for (const rule of rules) {
    const prev = prevStates[rule.id];

    // User-confirmed states are sticky
    if (prev === S.CONFIRMED || prev === S.HANDLED_EARLY || prev === S.NOT_APPLICABLE) {
      result[rule.id] = prev;
      continue;
    }
    // Needs-attention is sticky until user resolves (always counts, no cap)
    if (prev === S.NEEDS_ATTENTION) {
      result[rule.id] = S.NEEDS_ATTENTION;
      visibleCount++;
      continue;
    }

    // ShiftType suppression
    if (suppressOpening && rule.category === "opening") {
      result[rule.id] = S.HIDDEN;
      continue;
    }
    if (suppressDeadline && (rule.category === "deadline" || rule.category === "exit")) {
      result[rule.id] = S.HIDDEN;
      continue;
    }

    const win = resolveWindow(rule, setup);
    const inWin = isTimeInRange(ctx.currentMin, win.start, win.end);

    // Get Ahead: suppress under pressure
    if (rule.category === "getahead" && highPressure) {
      result[rule.id] = S.HIDDEN;
      continue;
    }

    // Exit items: only in exit window
    if (rule.category === "exit" && !ctx.exitWindow) {
      result[rule.id] = S.HIDDEN;
      continue;
    }

    if (inWin) {
      // Hard cap: don't surface more than MAX_VISIBLE items
      if (visibleCount >= MAX_VISIBLE && rule.riskWeight === "low") {
        result[rule.id] = S.HIDDEN;
        continue;
      }
      if (rule.handoffEligibility === "arrival" && ctx.arrivalWindow) {
        result[rule.id] = S.VISIBLE_HANDOFF;
      } else if (rule.handoffEligibility === "exit" && ctx.exitWindow) {
        result[rule.id] = S.VISIBLE_HANDOFF;
      } else {
        result[rule.id] = S.VISIBLE;
      }
      visibleCount++;
    } else if (prev === S.VISIBLE || prev === S.VISIBLE_HANDOFF) {
      result[rule.id] = rule.carryLogic === "carry" ? S.VISIBLE : S.HIDDEN;
      if (rule.carryLogic === "carry") visibleCount++;
    } else {
      result[rule.id] = S.HIDDEN;
    }
  }
  return result;
}

// ─── PACING LANGUAGE ───
function getPacingLine(ctx, visibleCount, coverageMode, queueState) {
  if (!ctx) return "";
  const mode = coverageMode || "solo";
  const q = queueState || "ontrack";

  // High demand override — protective
  if (q === "highdemand") {
    if (visibleCount === 0) return "High demand. Focus on one patient at a time.";
    return "High demand. Showing only what's essential.";
  }

  if (visibleCount === 0) {
    if (ctx.timingPressure === "early") return "Settling in. Nothing pressing yet.";
    if (ctx.exitWindow) return "Almost done. Nothing left to surface.";
    if (ctx.timingPressure === "end-of-day") return "Wrapping up. Nothing left to surface.";
    if (ctx.timingPressure === "tightening") return "Window is tightening, but you're clear.";
    if (q === "clear") return "All clear. Good time for immunization conversations or getting ahead.";
    return "Nothing pressing right now. Steady window.";
  }
  if (visibleCount === 1) {
    if (ctx.exitWindow) return "One thing worth mentioning before you go.";
    if (mode === "overlap") return "One thing worth aligning on.";
    return "One thing worth attention right now.";
  }
  if (visibleCount <= 3) {
    if (ctx.exitWindow) return `${visibleCount} things to check before you go.`;
    if (q === "needsfocus") return `${visibleCount} items. Let's protect the rest of the day.`;
    return `${visibleCount} things worth attention right now.`;
  }
  if (visibleCount <= 5) {
    if (ctx.timingPressure === "tightening") return `${visibleCount} items — window is tightening.`;
    return `${visibleCount} items on the board.`;
  }
  return "Busy board. Showing what matters most.";
}

function getPhaseLabel(ctx) {
  if (!ctx) return "";
  if (ctx.shiftProgress < 0.12) return "Early shift";
  if (ctx.shiftProgress < 0.35) return "Getting into rhythm";
  if (ctx.shiftProgress < 0.55) return "Mid-shift";
  if (ctx.shiftProgress < 0.72) return "Second half";
  if (ctx.shiftProgress < 0.88) return "Winding down";
  return "Closing out";
}

// ─── DESIGN SYSTEM (dual theme) ───
const THEMES = {
  dark: {
    bg: "#0F1114",
    card: "#181A1F",
    border: "#2E3035",
    text: "#E6EDF3",
    textMuted: "#8B949E",
    accent: "#4A9EFF",
    accentDim: "rgba(74,158,255,0.12)",
    accentMid: "rgba(74,158,255,0.35)",
    secondary: "#7EB8F0",
    secondaryDim: "rgba(126,184,240,0.12)",
    green: "#3FB950",
    greenDim: "rgba(63,185,80,0.12)",
    amber: "#D29922",
    amberDim: "rgba(210,153,34,0.12)",
    gradient: "linear-gradient(135deg, #4A9EFF 0%, #3A7FCC 100%)",
    topBarBg: "rgba(15,17,20,0.95)",
    navBg: "rgba(15,17,20,0.95)",
    selectBg: "#181A1F",
    selectText: "#E6EDF3",
  },
  light: {
    bg: "#EEEEF2",
    card: "#F6F6F8",
    border: "#D8DAE0",
    text: "#1C1E21",
    textMuted: "#5C6370",
    accent: "#2D7ABF",
    accentDim: "rgba(45,122,191,0.1)",
    accentMid: "rgba(45,122,191,0.25)",
    secondary: "#5A9ED6",
    secondaryDim: "rgba(90,158,214,0.12)",
    green: "#2DA44E",
    greenDim: "rgba(45,164,78,0.1)",
    amber: "#BF8700",
    amberDim: "rgba(191,135,0,0.1)",
    gradient: "linear-gradient(135deg, #2D7ABF 0%, #24629A 100%)",
    topBarBg: "rgba(238,238,242,0.95)",
    navBg: "rgba(238,238,242,0.95)",
    selectBg: "#F6F6F8",
    selectText: "#1C1E21",
  },
};

// MF is set dynamically per render — start with dark
let MF = { ...THEMES.dark, font: "'IBM Plex Sans', -apple-system, sans-serif", radius: "12px", radiusSm: "8px" };

// ─── ICONS (inline SVG) ───
const I = {
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  handoff: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ahead: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>,
  exit: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  reset: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  sim: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

// ─── SHARED STYLE FACTORIES ───
const btn = (color, bg) => ({
  background: bg,
  color: color,
  border: "none",
  borderRadius: "20px",
  padding: "7px 14px",
  fontSize: "12px",
  fontWeight: 600,
  fontFamily: MF.font,
  cursor: "pointer",
  transition: "all 0.15s ease",
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
});

const badge = (color, bg) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "3px 10px",
  borderRadius: "12px",
  fontSize: "11px",
  fontWeight: 600,
  color,
  background: bg,
  letterSpacing: "0.02em",
});

// Brand component — single line: RxTempo Lite + MADDEN FRAMEWORKS
function Brand({ size = 17, compact = false, dim = false }) {
  const opacity = dim ? 0.4 : 1;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", opacity }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={{ fontSize: `${size}px`, fontWeight: 700, color: MF.accent, letterSpacing: "-0.02em" }}>Rx</span>
        <span style={{ fontSize: `${size}px`, fontWeight: 700, color: MF.text, letterSpacing: "-0.02em" }}>Tempo</span>
        <span style={{
          fontSize: "10px", fontWeight: 600, color: MF.textMuted,
          border: `1px solid ${MF.border}`, background: "transparent",
          padding: "1px 6px", borderRadius: "4px", marginLeft: "5px",
          letterSpacing: "0.05em", lineHeight: "16px",
          position: "relative", top: "-0.5px",
        }}>LITE</span>
      </div>
      {!compact && (
        <>
          <span style={{ color: MF.border, fontSize: "12px", opacity: 0.6, position: "relative", top: "-0.5px" }}>|</span>
          <span style={{ fontSize: "10px", fontWeight: 500, color: MF.textMuted, letterSpacing: "0.04em", opacity: 0.6, position: "relative", top: "-0.5px" }}>
            MADDEN FRAMEWORKS
          </span>
        </>
      )}
    </div>
  );
}

// ─── COMPONENTS ───

// Select field
function SelectField({ label, value, onChange, options, style: extraStyle }) {
  return (
    <div style={{ marginBottom: "20px", ...extraStyle }}>
      <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select
          style={{ width: "100%", background: MF.card, color: MF.text, border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm, padding: "12px 40px 12px 14px", fontSize: "15px", fontFamily: MF.font, appearance: "none", cursor: "pointer", outline: "none" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{
          position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", color: MF.textMuted, opacity: 0.6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// Item card with actions
function ItemCard({ rule, state, onAction, showRole = true, timingPressure }) {
  const isAttention = state === S.NEEDS_ATTENTION;
  const isHandoff = state === S.VISIBLE_HANDOFF;
  const isEscalated = isAttention && rule.riskWeight === "high" &&
    (timingPressure === "tightening" || timingPressure === "end-of-day");
  const isTightening = !isAttention && !isEscalated && rule.riskWeight === "high" &&
    (timingPressure === "tightening" || timingPressure === "end-of-day");

  let borderColor = MF.border;
  if (isEscalated) borderColor = MF.amber;
  else if (isAttention) borderColor = MF.amber;
  else if (isTightening) borderColor = MF.secondary;
  else if (isHandoff) borderColor = MF.accentMid;

  return (
    <div style={{
      background: isEscalated ? MF.amberDim : MF.card,
      border: `1px solid ${isEscalated ? MF.amber + "4D" : MF.border}`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: MF.radius,
      padding: "16px",
      marginBottom: "10px",
      animation: "slideUp 0.25s ease both",
    }}>
      <div style={{ display: "flex", gap: "10px" }}>
        <div style={{
          width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, marginTop: "6px",
          background: rule.riskWeight === "high" ? MF.amber : rule.riskWeight === "medium" ? MF.secondary : MF.border,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" }}>
              {rule.label}
            </span>
            {isHandoff && (
              <span style={badge(MF.accent, MF.accentDim)}>Handoff</span>
            )}
          </div>
          <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.5, marginBottom: showRole ? "6px" : "12px" }}>
            {rule.description}
          </div>
          {showRole && (
            <div style={{ fontSize: "11px", color: MF.textMuted, fontStyle: "italic", opacity: 0.65, marginBottom: "12px" }}>
              {rule.roleContext}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {isEscalated && (
              <span style={{ ...badge(MF.amber, MF.amberDim), marginBottom: "6px", marginRight: "auto", width: "100%" }}>
                Entering a tighter window
              </span>
            )}
            {isTightening && (
              <span style={{ ...badge(MF.secondary, MF.secondaryDim), marginBottom: "6px", marginRight: "auto", width: "100%" }}>
                Worth checking soon
              </span>
            )}
            {isAttention && !isEscalated && (
              <span style={{ ...badge(MF.amber, MF.amberDim), marginBottom: "6px", marginRight: "auto", width: "100%" }}>
                Still needs attention
              </span>
            )}
            <button style={btn(MF.green, MF.greenDim)} onClick={() => onAction(rule.id, S.CONFIRMED)}>
              Looks done
            </button>
            <button style={btn(MF.amber, MF.amberDim)} onClick={() => onAction(rule.id, S.NEEDS_ATTENTION)}>
              Still needs attention
            </button>
            <button style={btn(MF.textMuted, "rgba(139,148,158,0.08)")} onClick={() => onAction(rule.id, S.NOT_APPLICABLE)}>
              Not needed today
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Confirmed item (collapsed)
function ConfirmedCard({ rule, state }) {
  return (
    <div style={{
      background: MF.card, border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm,
      padding: "10px 14px", marginBottom: "6px", opacity: 0.45,
      display: "flex", alignItems: "center", gap: "10px",
    }}>
      <span style={{ color: MF.green, display: "flex" }}>{I.check}</span>
      <span style={{ fontSize: "13px", fontWeight: 500 }}>{rule.label}</span>
      {state === S.HANDLED_EARLY && (
        <span style={badge(MF.secondary, MF.secondaryDim)}>Handled early</span>
      )}
    </div>
  );
}

// Section heading
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: "11px", fontWeight: 600, color: MF.textMuted, textTransform: "uppercase",
      letterSpacing: "0.06em", marginBottom: "10px", marginTop: "24px",
    }}>
      {children}
    </div>
  );
}

// Empty / quiet state
function QuietState({ icon, message, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 24px", color: MF.textMuted }}>
      <div style={{ fontSize: "28px", marginBottom: "10px", opacity: 0.35 }}>{icon || "○"}</div>
      <div style={{ fontSize: "14px", lineHeight: 1.5 }}>{message}</div>
      {sub && <div style={{ fontSize: "13px", marginTop: "4px", opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}

// Slide-out info panel with expandable sections
function InfoPanel({ show, onClose }) {
  const [expanded, setExpanded] = useState(null);
  const toggle = (key) => setExpanded((prev) => prev === key ? null : key);

  if (!show) return null;

  const Line = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${MF.border}`, gap: "12px" }}>
      <span style={{ fontSize: "12px", color: MF.textMuted }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: MF.text, textAlign: "right" }}>{value}</span>
    </div>
  );

  const Bullet = ({ children }) => (
    <div style={{ display: "flex", gap: "8px", padding: "4px 0", fontSize: "12px", color: MF.textMuted, lineHeight: 1.5 }}>
      <span style={{ color: MF.accent, flexShrink: 0 }}>·</span>
      <span>{children}</span>
    </div>
  );

  const sections = [
    { key: "how", title: "How it works", icon: "◎", render: () => (
      <>
        <Line label="Input" value="Time + role + shift" />
        <Line label="Engine" value="22 time-aware rules" />
        <Line label="Output" value="What matters right now" />
        <Line label="Adapts to" value="Queue pressure + coverage" />
        <Line label="Resets" value="Every shift (24hr max)" />
      </>
    )},
    { key: "data", title: "Your data & privacy", icon: "◇", render: () => (
      <>
        <Bullet>No login, no account, no backend</Bullet>
        <Bullet>All state lives in device memory only</Bullet>
        <Bullet>Resets automatically within 24 hours</Bullet>
        <Bullet>No one can see your activity — ever</Bullet>
        <Bullet>No data leaves your device</Bullet>
      </>
    )},
    { key: "handoffs", title: "Handoffs", icon: "⇄", render: () => (
      <>
        <Line label="Arrival screen" value="What to align on" />
        <Line label="Exit screen" value="What's still open" />
        <Line label="Format" value="Side-by-side conversation" />
        <Line label="Devices" value="Independent — no sync" />
      </>
    )},
    { key: "queue", title: "Workflow status", icon: "◈", render: () => (
      <>
        <Line label="All clear" value="Get Ahead + immunizations surface" />
        <Line label="On track" value="Steady — default state" />
        <Line label="Needs focus" value="Optional items hide" />
        <Line label="High demand" value="Protective mode — essentials only" />
        <div style={{ fontSize: "11px", color: MF.textMuted, opacity: 0.6, marginTop: "6px", fontStyle: "italic" }}>Self-reported · Never stored · Never shared</div>
      </>
    )},
    { key: "imm", title: "Immunizations", icon: "＋", render: () => (
      <>
        <Bullet>Optional daily target set during setup</Bullet>
        <Bullet>Tap +Vaccine when you give one</Bullet>
        <Bullet>Always user-initiated — app never asks</Bullet>
        <Bullet>Always visible, even in High demand</Bullet>
        <Bullet>Never framed as pressure or guilt</Bullet>
      </>
    )},
    { key: "events", title: "Events & deliveries", icon: "◉", render: () => (
      <>
        <Line label="Setup" value="Flag what to expect today" />
        <Line label="During shift" value="Tap 'Arrived' when it happens" />
        <Line label="Arrival time" value="Editable if you forgot" />
        <Line label="Warehouse" value="2hr check-in window" />
        <Line label="OV order" value="90min processing window" />
        <Line label="USPS" value="20min handoff window" />
      </>
    )},
    { key: "ahead", title: "Get Ahead", icon: "»", render: () => (
      <>
        <Bullet>Tasks not due yet that can be done early</Bullet>
        <Bullet>Handled early = removed from later reminders</Bullet>
        <Bullet>Hides automatically when queues need focus</Bullet>
        <Bullet>A reward for calm moments, never an expectation</Bullet>
      </>
    )},
    { key: "still", title: "Still open items", icon: "○", render: () => (
      <>
        <Line label="What" value="Window passed, not yet actioned" />
        <Line label="Already handled" value="Confirm it — moves to covered" />
        <Line label="Still needs attention" value="Flags it for follow-up" />
        <Line label="Not needed today" value="Dismisses cleanly" />
      </>
    )},
    { key: "leader", title: "For leadership", icon: "◆", render: () => (
      <>
        <Bullet>No new data streams or reporting</Bullet>
        <Bullet>No performance metrics — ever</Bullet>
        <Bullet>Immunizations reinforced as constant priority</Bullet>
        <Bullet>Gets quieter on bad days, not louder</Bullet>
        <Bullet>Designed as an optional pilot</Bullet>
      </>
    )},
    { key: "principles", title: "Design principles", icon: "◇", render: () => (
      <>
        <Line label="Primary model" value="Time, not tasks" />
        <Line label="Confirmation" value="More powerful than completion" />
        <Line label="Silence" value="A feature, not a failure" />
        <Line label="Optional" value="Must actually mean optional" />
        <Line label="Purpose" value="Conversation starter, not the conversation" />
      </>
    )},
  ];

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={onClose} style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        animation: "fadeIn 0.2s ease",
      }} />
      <div style={{
        position: "relative", width: "85%", maxWidth: "360px",
        background: MF.bg, borderLeft: `1px solid ${MF.border}`,
        overflowY: "auto", padding: "20px 16px",
        animation: "slideInRight 0.25s ease both",
      }}>
        {/* Header — centered brand + tagline */}
        <div style={{ textAlign: "center", marginBottom: "16px", position: "relative" }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 0, right: 0,
            background: "none", border: `1px solid ${MF.border}`, borderRadius: "6px",
            padding: "4px 8px", cursor: "pointer", color: MF.textMuted,
            fontSize: "14px", fontFamily: MF.font,
          }}>✕</button>
          <div style={{ display: "inline-flex", alignItems: "baseline", marginBottom: "6px" }}>
            <span style={{ fontSize: "22px", fontWeight: 700, color: MF.accent, letterSpacing: "-0.02em" }}>Rx</span>
            <span style={{ fontSize: "22px", fontWeight: 700, color: MF.text, letterSpacing: "-0.02em" }}>Tempo</span>
            <span style={{ fontSize: "10px", fontWeight: 600, color: MF.textMuted, border: `1px solid ${MF.border}`, padding: "1px 6px", borderRadius: "3px", marginLeft: "6px", letterSpacing: "0.04em" }}>LITE</span>
          </div>
          <div style={{ fontSize: "13px", color: MF.textMuted, opacity: 0.6 }}>
            Intelligent support for the pharmacy day.
          </div>
        </div>

        {/* Expandable sections */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {sections.map((s) => (
            <div key={s.key}>
              <button
                onClick={() => toggle(s.key)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "10px",
                  padding: "11px 2px", background: "none", border: "none",
                  borderBottom: `1px solid ${MF.border}`,
                  cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                }}
              >
                <span style={{ fontSize: "13px", color: expanded === s.key ? MF.accent : MF.textMuted, width: "18px", textAlign: "center", flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: expanded === s.key ? MF.text : MF.textMuted, flex: 1 }}>{s.title}</span>
                <span style={{ fontSize: "14px", color: MF.textMuted, opacity: 0.5, transition: "transform 0.2s ease", transform: expanded === s.key ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
              </button>
              {expanded === s.key && (
                <div style={{ padding: "8px 2px 12px 28px", animation: "fadeIn 0.15s ease" }}>
                  {s.render()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div style={{
          background: MF.card, border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm,
          padding: "12px 14px", marginTop: "16px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "8px" }}>What this is</div>
          <div style={{ fontSize: "12px", color: MF.textMuted, opacity: 0.6, lineHeight: 1.6 }}>
            An optional decision-support tool.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "8px 0 10px" }}>
            {["Not a system of record", "Not a compliance requirement", "Not a policy"].map((line) => (
              <div key={line} style={{ display: "flex", gap: "8px", fontSize: "12px", color: MF.textMuted, opacity: 0.6 }}>
                <span style={{ color: MF.accent, flexShrink: 0 }}>·</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "12px", color: MF.textMuted, opacity: 0.6, lineHeight: 1.6 }}>
            Just a practical guide that helps pharmacists stay organized during their shift.
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "16px", fontSize: "10px", color: MF.textMuted, opacity: 0.35 }}>
          <div style={{ fontWeight: 600, letterSpacing: "0.04em" }}>MADDEN FRAMEWORKS · © 2026</div>
        </div>
      </div>
    </div>
  );
}

function ScreenHeader({ title, subtitle, ctx }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "4px" }}>
          {title}
        </h1>
        {ctx && (
          <span style={{ fontSize: "12px", color: MF.textMuted }}>
            {fmtTime12(ctx.currentMin)}
          </span>
        )}
      </div>
      <p style={{ fontSize: "14px", color: MF.textMuted, lineHeight: 1.45 }}>
        {subtitle}
      </p>
    </div>
  );
}

// ─── SCREENS ───

// START DAY
function StartDayScreen({ onComplete }) {
  const [step, setStep] = useState("form1"); // form1 | form2 | form3 | confirm
  const [role, setRole] = useState("pharmacist-manager");
  const [shiftType, setShiftType] = useState("open-close");
  const [shiftStart, setShiftStart] = useState(toMin(8, 0));
  const [shiftEnd, setShiftEnd] = useState(toMin(17, 0));
  const [storeOpen, setStoreOpen] = useState(toMin(8, 0));
  const [storeClose, setStoreClose] = useState(toMin(21, 0));
  const [is24hrToggle, setIs24hrToggle] = useState(false);
  const [hasOverlap, setHasOverlap] = useState("no");
  const [overlapWindows, setOverlapWindows] = useState([{ start: toMin(12, 0), end: toMin(17, 0) }]);
  const [dayNotes, setDayNotes] = useState([""]);
  // Today's events — smart defaults based on day of week
  const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today];
  const ovExpected = today >= 1 && today <= 5; // Mon–Fri
  const uspsExpected = today >= 1 && today <= 6; // Mon–Sat
  const [hasWarehouse, setHasWarehouse] = useState("no");
  const [hasOV, setHasOV] = useState(() => ovExpected ? "yes" : "no");
  const [hasUSPS, setHasUSPS] = useState(() => uspsExpected ? "yes" : "no");
  const [confirmToggle, setConfirmToggle] = useState(null); // { key: "ov"|"usps", current: "yes" }
  // Immunization target
  const [immTarget, setImmTarget] = useState("");
  // Notification frequency
  const [guidance, setGuidance] = useState("balanced");
  const [immLowConfirmed, setImmLowConfirmed] = useState(false);
  const [immNudgeFlash, setImmNudgeFlash] = useState(false);

  const setupData = {
    role,
    shiftType,
    shiftStart: +shiftStart,
    shiftEnd: +shiftEnd,
    storeOpen: +storeOpen,
    storeClose: +storeClose,
    overlapWindows: hasOverlap === "yes" ? overlapWindows.map((w) => ({ start: +w.start, end: +w.end })) : [],
    dayNotes: dayNotes.map((n) => n.trim()).filter(Boolean),
    expectedEvents: {
      warehouse: hasWarehouse === "yes",
      ov: hasOV === "yes",
      usps: hasUSPS === "yes",
    },
    immTarget: +immTarget,
    guidance,
    eventArrivals: {},
    setupTimestamp: Date.now(),
  };

  if (step === "confirm") {
    return (
      <div style={{ padding: "20px", animation: "fadeIn 0.25s ease" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "4px" }}>
          Confirm your day
        </h1>
        <p style={{ fontSize: "14px", color: MF.textMuted, marginBottom: "20px" }}>
          Quick check before we go.
        </p>

        <div style={{ background: MF.card, border: `1px solid ${MF.border}`, borderRadius: MF.radius, padding: "16px", marginBottom: "16px" }}>
          {[
            ["Role", ROLE_LABELS[role]],
            ["Shift type", SHIFT_TYPE_LABELS[shiftType]],
            ["Your shift", `${fmtTime12(+shiftStart)} — ${fmtTime12(+shiftEnd)}`],
            ["Pharmacy", is24hrToggle ? "24 hours" : `${fmtTime12(+storeOpen)} — ${fmtTime12(+storeClose)}`],
            ["Coverage", hasOverlap === "yes" ? overlapWindows.map((w, i) => `${fmtTime12(+w.start)} — ${fmtTime12(+w.end)}`).join(", ") : "Solo today"],
            ...(hasWarehouse === "yes" ? [["Warehouse", "Expected today"]] : []),
            ...(hasOV === "yes" ? [["OV delivery", "Expected today"]] : []),
            ...(hasUSPS === "yes" ? [["USPS pickup", "Expected today"]] : []),
            ...(+immTarget > 0 ? [["Immunizations", `Target: ${immTarget}`]] : []),
            ["Guidance", guidance === "minimal" ? "Minimal" : guidance === "more" ? "More guidance" : "Balanced"],
          ].map(([label, val], i, arr) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${MF.border}` : "none" }}>
              <span style={{ fontSize: "13px", color: MF.textMuted }}>{label}</span>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{val}</span>
            </div>
          ))}
        </div>

        {dayNotes.filter((n) => n.trim()).length > 0 && (
          <div style={{
            background: MF.card, border: `1px solid ${MF.border}`, borderRadius: MF.radius,
            padding: "14px 16px", marginBottom: "16px",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {dayNotes.filter((n) => n.trim()).length === 1 ? "Note" : "Notes"}
            </div>
            {dayNotes.filter((n) => n.trim()).map((n, i) => (
              <div key={i} style={{ fontSize: "14px", color: MF.text, lineHeight: 1.5, marginBottom: i < dayNotes.filter((n) => n.trim()).length - 1 ? "4px" : 0 }}>
                {n.trim()}
              </div>
            ))}
          </div>
        )}

        <button
          style={{ background: MF.gradient, color: "#fff", border: "none", borderRadius: MF.radiusSm, padding: "14px 24px", fontSize: "15px", fontWeight: 600, fontFamily: MF.font, cursor: "pointer", width: "100%", letterSpacing: "-0.01em", marginBottom: "10px" }}
          onClick={() => onComplete(setupData)}
        >
          Let's go
        </button>
        <button
          style={{ background: "none", color: MF.textMuted, border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm, padding: "12px 24px", fontSize: "14px", fontFamily: MF.font, cursor: "pointer", width: "100%" }}
          onClick={() => setStep("form1")}
        >
          Go back and edit
        </button>
      </div>
    );
  }

  // 24-hour pharmacy detection
  const is24hr = is24hrToggle;

  // Determine which shift types are valid given current times
  const getValidShiftTypes = () => {
    const s = +shiftStart, e = +shiftEnd, o = +storeOpen, c = +storeClose;
    const isOvernight = e < s;
    const types = [];

    // Mid shift — always available
    types.push({ value: "mid", label: "Mid shift" });

    if (isOvernight) {
      types.push({ value: "overnight", label: "Overnight" });
    } else {
      const isOpener = s <= o;
      const isCloser = e >= c;
      if (isOpener && isCloser) {
        types.push({ value: "open-close", label: "Open to close" });
      }
      if (isOpener) {
        types.push({ value: "open-mid", label: is24hr ? "Early shift" : "Opening shift" });
      }
      if (isCloser) {
        types.push({ value: "mid-close", label: "Closing shift" });
      }
    }

    return types;
  };

  // Auto-infer the best shift type from times
  const inferShiftType = (start, end, open, close) => {
    const s = +start, e = +end, o = +open, c = +close;
    if (e < s) return "overnight";
    const isOpener = s <= o; // you're there when the pharmacy opens
    const isCloser = e >= c; // you're there when the pharmacy closes
    if (isOpener && isCloser) return "open-close";
    if (isOpener) return "open-mid";
    if (isCloser) return "mid-close";
    return "mid";
  };

  // Generate shift time options constrained to pharmacy hours (± 1hr)
  const getShiftTimeOptions = () => {
    if (is24hr) return TIME_OPTIONS; // 24hr store — all times valid
    const o = +storeOpen, c = +storeClose;
    const earliest = (o - 60 + 1440) % 1440;
    const latest = (c + 60) % 1440;
    return TIME_OPTIONS.filter((opt) => {
      const v = +opt.value;
      if (c >= o) return v >= earliest && v <= latest;
      return v >= earliest || v <= latest;
    });
  };

  // When any time changes, auto-update shift type
  const handleStoreOpenChange = (val) => {
    setStoreOpen(val);
    setShiftType(inferShiftType(shiftStart, shiftEnd, val, storeClose));
  };
  const handleStoreCloseChange = (val) => {
    setStoreClose(val);
    setShiftType(inferShiftType(shiftStart, shiftEnd, storeOpen, val));
  };
  const handleShiftStartChange = (val) => {
    setShiftStart(val);
    setShiftType(inferShiftType(val, shiftEnd, storeOpen, storeClose));
  };
  const handleShiftEndChange = (val) => {
    setShiftEnd(val);
    setShiftType(inferShiftType(shiftStart, val, storeOpen, storeClose));
  };

  // Validation
  const overnightWithout24hr = role === "overnight" && !is24hrToggle;
  const shiftTimeSame = +shiftStart === +shiftEnd;
  const shiftValid = !shiftTimeSame && !overnightWithout24hr;
  const shiftError = shiftTimeSame ? "Shift start and end can't be the same time."
    : overnightWithout24hr ? "Overnight pharmacist requires a 24-hour pharmacy."
    : null;

  // Ensure current shiftType is in valid list, otherwise auto-correct
  const validTypes = getValidShiftTypes();
  if (shiftValid && !validTypes.find((t) => t.value === shiftType)) {
    const inferred = inferShiftType(shiftStart, shiftEnd, storeOpen, storeClose);
    if (inferred !== shiftType) setShiftType(inferred);
  }

  const stepTitles = ["Your shift", "Coverage & events", "Goals & notes"];
  const totalSteps = 3;
  const formStep = step === "form1" ? 0 : step === "form2" ? 1 : step === "form3" ? 2 : -1;

  // Step indicator component
  const StepIndicator = () => (
    <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
      {stepTitles.map((t, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center" }}>
          <div style={{
            height: "3px", borderRadius: "2px", marginBottom: "6px",
            background: i <= formStep ? MF.accent : MF.border,
            transition: "background 0.3s ease",
          }} />
          <span style={{ fontSize: "10px", color: i <= formStep ? MF.accent : MF.textMuted, fontWeight: i === formStep ? 600 : 400 }}>
            {t}
          </span>
        </div>
      ))}
    </div>
  );

  if (step === "form1" || step === "form2" || step === "form3") {
    return (
      <div style={{ padding: "20px", animation: "fadeIn 0.2s ease" }}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "4px" }}>
            Start your day
          </h1>
          <p style={{ fontSize: "14px", color: MF.textMuted, lineHeight: 1.45 }}>
            {step === "form1" ? "The basics — role and shift." :
             step === "form2" ? "Coverage and what to expect today." :
             "Immunizations, guidance, and notes."}
          </p>
        </div>

        <StepIndicator />

        {step === "form1" && (
          <>
            {/* Role + 24hr toggle row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "end" }}>
              <SelectField label="Role Today" value={role} onChange={setRole} options={[
                { value: "pharmacist-manager", label: "PIC / PM" },
                { value: "staff-rph", label: "Staff Pharmacist" },
                { value: "floater", label: "Floater" },
                { value: "overnight", label: "Overnight Pharmacist" },
              ]} />
              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  24-hr?
                </label>
                <button
                  onClick={() => {
                    const next = !is24hrToggle;
                    setIs24hrToggle(next);
                    if (next) { setStoreOpen(toMin(0, 0)); setStoreClose(toMin(0, 0)); }
                    else { setStoreOpen(toMin(8, 0)); setStoreClose(toMin(21, 0)); }
                  }}
                  style={{
                    width: "52px", height: "44px", borderRadius: MF.radiusSm,
                    border: `1px solid ${is24hrToggle ? MF.accent : MF.border}`,
                    background: is24hrToggle ? MF.accentDim : MF.card,
                    color: is24hrToggle ? MF.accent : MF.textMuted,
                    fontSize: "14px", fontWeight: 700, fontFamily: MF.font,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {is24hrToggle ? "Yes" : "No"}
                </button>
              </div>
            </div>

            {/* Pharmacy hours — disabled when 24hr */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", opacity: is24hrToggle ? 0.4 : 1, pointerEvents: is24hrToggle ? "none" : "auto" }}>
              <SelectField label="Pharmacy Opens" value={storeOpen} onChange={handleStoreOpenChange} options={TIME_OPTIONS} />
              <SelectField label="Pharmacy Closes" value={storeClose} onChange={handleStoreCloseChange} options={TIME_OPTIONS} />
            </div>
            {is24hrToggle && (
              <div style={{ fontSize: "11px", color: MF.accent, marginTop: "-12px", marginBottom: "12px", opacity: 0.7 }}>
                24-hour pharmacy — open around the clock.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <SelectField label="Your Shift Starts" value={shiftStart} onChange={handleShiftStartChange} options={getShiftTimeOptions()} />
              <SelectField label="Your Shift Ends" value={shiftEnd} onChange={handleShiftEndChange} options={getShiftTimeOptions()} />
            </div>
            <SelectField label="Shift Type" value={shiftType} onChange={setShiftType} options={validTypes} />
            {shiftError && (
              <div style={{
                fontSize: "12px", color: overnightWithout24hr ? "#D93D42" : MF.amber,
                marginBottom: "12px", marginTop: "-8px",
                fontWeight: overnightWithout24hr ? 600 : 400,
                animation: overnightWithout24hr ? "errorPulse 1.2s ease-in-out infinite" : "none",
              }}>
                {shiftError}
              </div>
            )}
            <button
              style={{
                background: shiftValid ? MF.gradient : MF.border,
                color: shiftValid ? "#fff" : MF.textMuted,
                border: "none", borderRadius: MF.radiusSm, padding: "14px 24px",
                fontSize: "15px", fontWeight: 600, fontFamily: MF.font,
                cursor: shiftValid ? "pointer" : "not-allowed",
                width: "100%", letterSpacing: "-0.01em",
                opacity: shiftValid ? 1 : 0.5,
              }}
              onClick={() => shiftValid && setStep("form2")}
            >
              Next
            </button>
          </>
        )}

        {step === "form2" && (
          <>
            <SelectField label="Another pharmacist overlapping today?" value={hasOverlap} onChange={setHasOverlap} options={[
              { value: "no", label: "No — solo today" },
              { value: "yes", label: "Yes — overlap window" },
            ]} />
            {hasOverlap === "yes" && (() => {
              // Constrain overlap times to within the shift (± a small buffer)
              const overlapTimeOptions = TIME_OPTIONS.filter((opt) => {
                const v = +opt.value;
                const s = +shiftStart, e = +shiftEnd;
                if (e >= s) return v >= s && v <= e;
                return v >= s || v <= e; // overnight
              });
              const updateWindow = (idx, field, val) => {
                setOverlapWindows((prev) => prev.map((w, i) => i === idx ? { ...w, [field]: val } : w));
              };
              const addWindow = () => {
                setOverlapWindows((prev) => [...prev, { start: +shiftStart + 120, end: +shiftEnd }]);
              };
              const removeWindow = (idx) => {
                setOverlapWindows((prev) => prev.filter((_, i) => i !== idx));
              };
              return (
                <div style={{ marginBottom: "16px" }}>
                  {overlapWindows.map((w, idx) => (
                    <div key={idx} style={{
                      background: MF.accentDim, border: `1px solid ${MF.accentMid}`,
                      borderRadius: MF.radius, padding: "14px", marginBottom: "8px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: MF.accent }}>
                          {overlapWindows.length > 1 ? `Overlap ${idx + 1}` : "Overlap Window"}
                        </div>
                        {overlapWindows.length > 1 && (
                          <button
                            onClick={() => removeWindow(idx)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              fontSize: "12px", color: MF.textMuted, fontFamily: MF.font,
                            }}
                          >Remove</button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <SelectField label="Arrives" value={w.start} onChange={(v) => updateWindow(idx, "start", v)} style={{ marginBottom: "0" }} options={overlapTimeOptions} />
                        <SelectField label="Until" value={w.end} onChange={(v) => updateWindow(idx, "end", v)} style={{ marginBottom: "0" }} options={overlapTimeOptions} />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addWindow}
                    style={{
                      background: "none", border: `1px dashed ${MF.border}`, borderRadius: MF.radiusSm,
                      padding: "10px", width: "100%", cursor: "pointer", fontFamily: MF.font,
                      fontSize: "12px", color: MF.textMuted, display: "flex", alignItems: "center",
                      justifyContent: "center", gap: "6px",
                    }}
                  >
                    + Add another overlap window
                  </button>
                </div>
              );
            })()}
            {/* Routine events — predictable schedule */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "4px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Routine events
              </label>
              <div style={{ fontSize: "11px", color: MF.textMuted, opacity: 0.6, marginBottom: "10px" }}>
                Defaults for <span style={{ fontWeight: 700, color: MF.text, opacity: 1 }}>{dayName}</span>. Change if today is different.
              </div>
              <SelectField label="" value={hasOV} onChange={(val) => {
                if (val === "no" && ovExpected) {
                  setConfirmToggle({ key: "ov", label: "OV order delivery" });
                } else {
                  setHasOV(val);
                }
              }} style={{ marginBottom: "8px" }} options={[
                { value: "no", label: "OV order delivery — No" },
                { value: "yes", label: "OV order delivery — Yes" },
              ]} />
              <SelectField label="" value={hasUSPS} onChange={(val) => {
                if (val === "no" && uspsExpected) {
                  setConfirmToggle({ key: "usps", label: "USPS pickup" });
                } else {
                  setHasUSPS(val);
                }
              }} style={{ marginBottom: "0" }} options={[
                { value: "no", label: "USPS pickup — No" },
                { value: "yes", label: "USPS pickup — Yes" },
              ]} />
            </div>

            {/* Confirmation dialog */}
            {confirmToggle && (
              <div style={{
                background: MF.amberDim, border: `1px solid ${MF.amber}30`,
                borderRadius: MF.radius, padding: "16px", marginBottom: "16px",
              }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: MF.text, marginBottom: "8px" }}>
                  Turn off {confirmToggle.label}?
                </div>
                <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.5, marginBottom: "14px" }}>
                  It's <span style={{ fontWeight: 600 }}>{dayName}</span> — you'd typically expect this today unless it's a holiday or something unusual.
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      if (confirmToggle.key === "ov") setHasOV("no");
                      else setHasUSPS("no");
                      setConfirmToggle(null);
                    }}
                    style={{ ...btn(MF.amber, MF.amberDim), flex: 1, padding: "10px", textAlign: "center" }}
                  >
                    Yes, turn off
                  </button>
                  <button
                    onClick={() => setConfirmToggle(null)}
                    style={{ ...btn(MF.textMuted, "rgba(139,148,158,0.08)"), flex: 1, padding: "10px", textAlign: "center" }}
                  >
                    Keep it on
                  </button>
                </div>
              </div>
            )}

            {/* Store events — manual */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "10px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Store events <span style={{ opacity: 0.5, fontWeight: 400, textTransform: "none" }}>(if applicable)</span>
              </label>
              <SelectField label="" value={hasWarehouse} onChange={setHasWarehouse} style={{ marginBottom: "0" }} options={[
                { value: "no", label: "Warehouse delivery — No" },
                { value: "yes", label: "Warehouse delivery — Yes" },
              ]} />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{ ...btn(MF.textMuted, "rgba(139,148,158,0.08)"), flex: 1, padding: "14px", textAlign: "center" }}
                onClick={() => setStep("form1")}
              >Back</button>
              <button
                style={{ background: MF.gradient, color: "#fff", border: "none", borderRadius: MF.radiusSm, padding: "14px 24px", fontSize: "15px", fontWeight: 600, fontFamily: MF.font, cursor: "pointer", flex: 2, letterSpacing: "-0.01em" }}
                onClick={() => setStep("form3")}
              >Next</button>
            </div>
          </>
        )}

        {step === "form3" && (() => {
          const immNum = parseInt(immTarget) || 0;
          const immIsEmpty = immTarget === "";
          const immTooLow = immNum >= 1 && immNum <= 3;
          const immZero = immTarget === "0"; // only explicit zero, not empty
          const immOver500 = immNum > 500;
          const immValid = immNum >= 1 && immNum <= 500;
          const canProceed = (immValid && (!immTooLow || immLowConfirmed)) || immIsEmpty; // empty is ok — defaults on blur

          return (
          <>
            {/* Immunization target — required */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Immunization target today
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="500"
                value={immTarget}
                onChange={(e) => { setImmTarget(e.target.value); setImmLowConfirmed(false); }}
                onBlur={() => { if (immTarget === "" || immTarget === "0") setImmTarget("6"); }}
                placeholder="6"
                style={{
                  width: "100%", background: MF.card, color: MF.text,
                  border: `1px solid ${immZero ? "#D93D42" : immTooLow && !immLowConfirmed ? MF.amber : MF.border}`,
                  borderRadius: MF.radiusSm,
                  padding: "12px 14px", fontSize: "15px", fontFamily: MF.font,
                  outline: "none",
                }}
              />
              {immZero && (
                <div style={{ fontSize: "12px", color: "#D93D42", marginTop: "6px", lineHeight: 1.5 }}>
                  Immunizations are a core part of pharmacy care. Please set a target — even a small one helps protect the community you serve.
                </div>
              )}
              {immOver500 && (
                <div style={{ fontSize: "12px", color: MF.amber, marginTop: "6px" }}>
                  Maximum target is 500.
                </div>
              )}
              {immTooLow && !immLowConfirmed && (
                <div style={{
                  background: MF.amberDim, border: `1px solid ${MF.amber}30`,
                  borderRadius: MF.radiusSm, padding: "12px", marginTop: "8px",
                  animation: immNudgeFlash ? "errorPulse 0.4s ease-in-out" : "none",
                }} onAnimationEnd={() => setImmNudgeFlash(false)}>
                  <div style={{ fontSize: "12px", color: MF.textMuted, lineHeight: 1.5, marginBottom: "8px" }}>
                    A target of {immNum} means very few patients are being offered protection today. If this truly reflects your store's patient volume, confirm below — but most pharmacies can do more.
                  </div>
                  <button
                    onClick={() => setImmLowConfirmed(true)}
                    style={{ ...btn(MF.amber, MF.amberDim), fontSize: "12px", padding: "6px 14px" }}
                  >
                    I've considered this — {immNum} reflects our realistic capacity
                  </button>
                </div>
              )}
              {immTooLow && immLowConfirmed && (
                <div style={{ fontSize: "11px", color: MF.green, marginTop: "6px" }}>
                  Confirmed — every immunization counts.
                </div>
              )}
            </div>

            <SelectField label="Guidance level" value={guidance} onChange={setGuidance} options={[
              { value: "minimal", label: "Minimal — only time-sensitive" },
              { value: "balanced", label: "Balanced — recommended" },
              { value: "more", label: "More guidance — gentle nudges" },
            ]} />

            {/* Notes — optional, up to 5 */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Notes for today <span style={{ opacity: 0.5, fontWeight: 400, textTransform: "none" }}>(optional)</span>
              </label>
              {dayNotes.map((note, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => {
                      const updated = [...dayNotes];
                      updated[idx] = e.target.value;
                      setDayNotes(updated);
                    }}
                    placeholder={idx === 0 ? "e.g. Supervisor visit at 11am, Call at 1pm..." : "Another note..."}
                    maxLength={120}
                    style={{
                      flex: 1, background: MF.card, color: MF.text,
                      border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm,
                      padding: "12px 14px", fontSize: "15px", fontFamily: MF.font,
                      outline: "none",
                    }}
                  />
                  {dayNotes.length > 1 && (
                    <button
                      onClick={() => setDayNotes(dayNotes.filter((_, i) => i !== idx))}
                      style={{
                        background: "none", border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm,
                        padding: "0 10px", cursor: "pointer", color: MF.textMuted,
                        fontSize: "16px", fontFamily: MF.font, flexShrink: 0,
                      }}
                    >×</button>
                  )}
                </div>
              ))}
              {dayNotes.length < 5 && (
                <button
                  onClick={() => setDayNotes([...dayNotes, ""])}
                  style={{
                    background: "none", border: `1px dashed ${MF.border}`, borderRadius: MF.radiusSm,
                    padding: "10px", width: "100%", cursor: "pointer", fontFamily: MF.font,
                    fontSize: "12px", color: MF.textMuted, display: "flex", alignItems: "center",
                    justifyContent: "center", gap: "6px",
                  }}
                >
                  + Add another note
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{ ...btn(MF.textMuted, "rgba(139,148,158,0.08)"), flex: 1, padding: "14px", textAlign: "center" }}
                onClick={() => setStep("form2")}
              >Back</button>
              <button
                style={{
                  background: canProceed ? MF.gradient : MF.border,
                  color: canProceed ? "#fff" : MF.textMuted,
                  border: "none", borderRadius: MF.radiusSm, padding: "14px 24px",
                  fontSize: "15px", fontWeight: 600, fontFamily: MF.font,
                  cursor: canProceed ? "pointer" : "pointer",
                  flex: 2, letterSpacing: "-0.01em",
                  opacity: canProceed ? 1 : 0.5,
                }}
                onClick={() => {
                  if (canProceed) {
                    // Auto-fill empty immunization target
                    if (immTarget === "") setImmTarget("6");
                    setStep("confirm");
                  } else if (immTooLow && !immLowConfirmed) {
                    setImmNudgeFlash(true);
                  }
                }}
              >Review</button>
            </div>
          </>
          );
        })()}
      </div>
    );
  }
}

// HOME
function HomeScreen({ rules, itemStates, ctx, setup, onAction, onNav, eventArrivals, onEventArrival, queueState, onQueueState, vaccineCount, onVaccine, dayNoteStates, onDayNoteState, dayNoteConfirm, onDayNoteConfirm }) {
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [immExpanded, setImmExpanded] = useState(false);

  const visible = rules.filter((r) =>
    [S.VISIBLE, S.NEEDS_ATTENTION, S.VISIBLE_HANDOFF].includes(itemStates[r.id])
  );
  const confirmed = rules.filter((r) =>
    [S.CONFIRMED, S.HANDLED_EARLY].includes(itemStates[r.id])
  );

  // Items whose window has passed without being actioned
  const stillOpen = rules.filter((r) => {
    if (r.category === "getahead") return false;
    if ([S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])) return false;
    if ([S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])) return false;
    if (itemStates[r.id] !== S.HIDDEN) return false;
    const win = resolveWindow(r, setup);
    // Window has ended and is in the past
    return win.end < ctx.currentMin && win.end > 0;
  });

  const pacingLine = getPacingLine(ctx, visible.length, ctx.coverageMode, queueState);
  const phaseLabel = getPhaseLabel(ctx);
  const highPressure = visible.length > 5 || queueState === "highdemand";

  return (
    <div style={{ padding: "20px", animation: "fadeIn 0.2s ease" }}>
      {/* Phase header */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: MF.accent }}>{phaseLabel}</span>
            <span style={badge(MF.textMuted, "rgba(139,148,158,0.1)")}>{ROLE_LABELS[setup.role]}</span>
            {setup.shiftType && setup.shiftType !== "open-close" && (
              <span style={badge(MF.textMuted, "rgba(139,148,158,0.1)")}>{SHIFT_TYPE_LABELS[setup.shiftType]}</span>
            )}
            <span style={badge(
              ctx.coverageMode === "overlap" ? MF.accent : MF.textMuted,
              ctx.coverageMode === "overlap" ? MF.accentDim : "rgba(139,148,158,0.1)"
            )}>
              {COVERAGE_LABELS[ctx.coverageMode]}
            </span>
          </div>
          <span style={{ fontSize: "12px", color: MF.textMuted }}>
            {fmtTime12(ctx.currentMin)} · {Math.round(ctx.shiftProgress * 100)}%
          </span>
        </div>
        <div style={{ width: "100%", height: "3px", background: MF.border, borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            width: `${ctx.shiftProgress * 100}%`, height: "100%",
            background: highPressure ? MF.amber : MF.gradient,
            borderRadius: "2px", transition: "width 1s ease",
          }} />
        </div>
      </div>

      {/* ── Workflow status — always at top, always editable ── */}
      {onQueueState && setup.guidance !== "minimal" && (
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          marginBottom: "14px", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "12px", color: MF.textMuted, fontWeight: 500 }}>Workflow</span>
          {[
            { key: "clear", label: "All clear", color: MF.green, bg: MF.greenDim },
            { key: "ontrack", label: "On track", color: MF.accent, bg: MF.accentDim },
            { key: "needsfocus", label: "Needs focus", color: MF.amber, bg: MF.amberDim },
            { key: "highdemand", label: "High demand", color: MF.amber, bg: MF.amberDim },
          ].map((q) => (
            <button
              key={q.key}
              onClick={() => onQueueState(q.key)}
              style={{
                padding: "5px 12px", borderRadius: "16px", fontSize: "11px", fontWeight: 600,
                fontFamily: MF.font, cursor: "pointer", transition: "all 0.15s ease",
                border: queueState === q.key ? `1.5px solid ${q.color}` : `1px solid ${MF.border}`,
                background: queueState === q.key ? q.bg : "transparent",
                color: queueState === q.key ? q.color : MF.textMuted,
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Day notes — each independently dismissible */}
      {setup.dayNotes && setup.dayNotes.length > 0 && setup.dayNotes.map((note, idx) => {
        const state = dayNoteStates[idx] || "active";
        if (state !== "active") return null;
        return (
          <div key={idx} style={{
            background: MF.card, border: `1px solid ${MF.border}`,
            borderLeft: `3px solid ${MF.accent}`,
            borderRadius: MF.radius, padding: "14px 16px", marginBottom: "8px",
          }}>
            <div style={{ fontSize: "14px", fontWeight: 500, lineHeight: 1.4 }}>{note}</div>
            {dayNoteConfirm === idx ? (
              <div style={{
                background: MF.amberDim, border: `1px solid ${MF.amber}25`,
                borderRadius: MF.radiusSm, padding: "10px 12px", marginTop: "10px",
              }}>
                <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "8px" }}>
                  Dismiss this note? Only do this if it's no longer relevant.
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button style={btn(MF.amber, MF.amberDim)} onClick={() => { onDayNoteState(idx, "dismissed"); onDayNoteConfirm(null); }}>
                    Yes, dismiss
                  </button>
                  <button style={btn(MF.textMuted, "rgba(139,148,158,0.08)")} onClick={() => onDayNoteConfirm(null)}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                <button style={btn(MF.green, MF.greenDim)} onClick={() => onDayNoteState(idx, "happened")}>
                  Already happened
                </button>
                <button style={btn(MF.textMuted, "rgba(139,148,158,0.08)")} onClick={() => onDayNoteConfirm(idx)}>
                  Dismiss
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Events — pending and arrived */}
      {setup.expectedEvents && onEventArrival && (() => {
        const expected = setup.expectedEvents;
        const allEvents = [
          { key: "warehouse", label: "Warehouse delivery", pendingDesc: "Tap when totes are in the pharmacy." },
          { key: "ov", label: "OV order delivery", pendingDesc: "Tap when the outside vendor delivery arrives." },
          { key: "usps", label: "USPS pickup", pendingDesc: "Tap when the USPS driver arrives." },
        ].filter((e) => expected[e.key]);

        if (allEvents.length === 0) return null;
        const pending = allEvents.filter((e) => !eventArrivals[e.key]);
        const arrived = allEvents.filter((e) => eventArrivals[e.key]);

        return (
          <div style={{ marginBottom: "14px" }}>
            {pending.length > 0 && (
              <>
                <SectionLabel>Expecting today</SectionLabel>
                {pending.map((e) => (
                  <div key={e.key} style={{
                    background: MF.card, border: `1px solid ${MF.border}`,
                    borderLeft: `3px solid ${MF.secondary}`,
                    borderRadius: MF.radius, padding: "14px 16px", marginBottom: "8px",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
                  }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "2px" }}>{e.label}</div>
                      <div style={{ fontSize: "12px", color: MF.textMuted, lineHeight: 1.4 }}>{e.pendingDesc}</div>
                    </div>
                    <button
                      onClick={() => onEventArrival(e.key, ctx.currentMin)}
                      style={{
                        ...btn("#fff", MF.accent),
                        padding: "8px 14px", fontSize: "12px", flexShrink: 0, borderRadius: MF.radiusSm,
                      }}
                    >
                      Arrived
                    </button>
                  </div>
                ))}
              </>
            )}
            {arrived.length > 0 && (
              <>
                <SectionLabel>Arrived today</SectionLabel>
                {arrived.map((e) => (
                  <div key={e.key} style={{
                    background: MF.card, border: `1px solid ${MF.border}`,
                    borderLeft: `3px solid ${MF.green}`,
                    borderRadius: MF.radius, padding: "12px 16px", marginBottom: "8px",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: MF.green, display: "flex" }}>{I.check}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{e.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <select
                        value={eventArrivals[e.key]}
                        onChange={(ev) => onEventArrival(e.key, +ev.target.value)}
                        style={{
                          background: MF.card, border: `1px solid ${MF.border}`, borderRadius: "6px",
                          color: MF.text, fontSize: "12px", fontFamily: MF.font,
                          padding: "4px 24px 4px 8px", cursor: "pointer",
                          appearance: "none", outline: "none",
                          backgroundImage: "none",
                        }}
                      >
                        {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* Pressure indicator */}
      {highPressure && (
        <div style={{
          background: MF.amberDim, border: `1px solid ${MF.amber}30`,
          borderRadius: MF.radiusSm, padding: "10px 14px", marginBottom: "16px",
          fontSize: "13px", color: MF.amber, fontWeight: 500,
        }}>
          {queueState === "highdemand"
            ? "High demand — optional items hidden. Focus on what's essential."
            : "Busy board — showing only what matters most. Optional items are hidden."}
        </div>
      )}
      {queueState === "needsfocus" && !highPressure && (
        <div style={{
          background: MF.secondaryDim, border: `1px solid ${MF.secondary}30`,
          borderRadius: MF.radiusSm, padding: "10px 14px", marginBottom: "16px",
          fontSize: "13px", color: MF.secondary, fontWeight: 500,
        }}>
          Queues need focus. Let's protect the rest of the day.
        </div>
      )}

      {/* Pacing line */}
      <h2 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "18px" }}>
        {pacingLine}
      </h2>

      {/* Visible items */}
      {visible.length === 0 ? (
        <QuietState
          message={queueState === "highdemand" ? "Focus on the patient in front of you." : "Nothing pressing right now."}
          sub={queueState === "highdemand" ? "We'll stay out of the way." :
               queueState === "clear" ? "Focus on the patient in front of you." :
               ctx.timingPressure === "early" ? "You're settling in." :
               ctx.timingPressure === "tightening" ? "Window is tightening, but you're in good shape." :
               "You're in a steady window."}
        />
      ) : (
        visible.map((r) => (
          <ItemCard key={r.id} rule={r} state={itemStates[r.id]} onAction={onAction} timingPressure={ctx.timingPressure} />
        ))
      )}

      {/* Later today link */}
      {onNav && (() => {
        const laterCount = rules.filter((r) => {
          if ([S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])) return false;
          if (r.category === "getahead") return false;
          if ([S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])) return false;
          if (itemStates[r.id] !== S.HIDDEN) return false;
          const win = resolveWindow(r, setup);
          return win.start > ctx.currentMin;
        }).length;
        if (laterCount === 0) return null;
        return (
          <button
            onClick={() => onNav("later")}
            style={{
              background: "none", border: "none", color: MF.textMuted,
              fontSize: "13px", fontFamily: MF.font, cursor: "pointer",
              padding: "12px 0", width: "100%", textAlign: "center",
              opacity: 0.7, transition: "opacity 0.15s",
            }}
          >
            {"View later today (" + laterCount + " upcoming) →"}
          </button>
        );
      })()}

      {/* Still open — window passed, never actioned */}
      {stillOpen.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <SectionLabel>Still open</SectionLabel>
          <div style={{
            background: MF.amberDim, borderRadius: MF.radiusSm,
            padding: "10px 14px", marginBottom: "12px",
            fontSize: "13px", color: MF.amber, fontWeight: 500, lineHeight: 1.5,
          }}>
            {stillOpen.length === 1
              ? "One item's usual window has passed. Worth a quick check."
              : `${stillOpen.length} items' usual windows have passed. Worth a quick check.`}
          </div>
          {stillOpen.map((r) => (
            <div key={r.id} style={{
              background: MF.card, border: `1px solid ${MF.border}`,
              borderLeft: `3px solid ${MF.amber}`,
              borderRadius: MF.radius, padding: "14px 16px", marginBottom: "8px",
            }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, marginTop: "6px",
                  background: r.riskWeight === "high" ? MF.amber : MF.secondary,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{r.label}</div>
                  <div style={{ fontSize: "12px", color: MF.textMuted, lineHeight: 1.5, marginBottom: "10px" }}>{r.description}</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button style={btn(MF.green, MF.greenDim)} onClick={() => onAction(r.id, S.CONFIRMED)}>
                      Already handled
                    </button>
                    <button style={btn(MF.amber, MF.amberDim)} onClick={() => onAction(r.id, S.NEEDS_ATTENTION)}>
                      Still needs attention
                    </button>
                    <button style={btn(MF.textMuted, "rgba(139,148,158,0.08)")} onClick={() => onAction(r.id, S.NOT_APPLICABLE)}>
                      Not needed today
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmed */}
      {confirmed.length > 0 && (
        <>
          <SectionLabel>Already covered today</SectionLabel>
          {confirmed.map((r) => (
            <ConfirmedCard key={r.id} rule={r} state={itemStates[r.id]} />
          ))}
        </>
      )}

      {/* Day summary */}
      {(confirmed.length > 0 || visible.length > 0) && (
        <div style={{
          textAlign: "center", padding: "16px 0 4px",
          fontSize: "12px", color: MF.textMuted, opacity: 0.5,
        }}>
          {confirmed.length} covered · {visible.length} active{stillOpen.length > 0 ? ` · ${stillOpen.length} still open` : ""} · {rules.filter((r) => itemStates[r.id] === S.NOT_APPLICABLE).length} skipped
        </div>
      )}

      {/* ── Immunization tracker ── */}
      {setup.immTarget > 0 && onVaccine && (
        <div style={{ marginTop: "8px" }}>
          <button
            onClick={() => setImmExpanded(!immExpanded)}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", background: MF.card, border: `1px solid ${MF.border}`,
              borderRadius: immExpanded ? `${MF.radiusSm} ${MF.radiusSm} 0 0` : MF.radiusSm,
              cursor: "pointer", fontFamily: MF.font,
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, color: MF.text }}>Immunizations</span>
            <span style={{
              fontSize: "12px", fontWeight: 600,
              color: vaccineCount >= setup.immTarget ? MF.green : MF.accent,
            }}>
              {vaccineCount} / {setup.immTarget}
            </span>
          </button>
          {immExpanded && (
            <div style={{
              padding: "12px 16px", background: MF.card, border: `1px solid ${MF.border}`, borderTop: "none",
              borderRadius: `0 0 ${MF.radiusSm} ${MF.radiusSm}`,
            }}>
              {/* Progress bar */}
              <div style={{ width: "100%", height: "4px", background: MF.border, borderRadius: "2px", overflow: "hidden", marginBottom: "12px" }}>
                <div style={{
                  width: `${Math.min(100, (vaccineCount / setup.immTarget) * 100)}%`, height: "100%",
                  background: vaccineCount >= setup.immTarget ? MF.green : MF.accent,
                  borderRadius: "2px", transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "12px", fontStyle: "italic" }}>
                {vaccineCount >= setup.immTarget ? "You've met today's target." :
                 vaccineCount > 0 ? "Keep it up — every conversation matters." :
                 "Immunizations remain an important part of patient care."}
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onVaccine(vaccineCount + 1); }}
                  style={{
                    ...btn("#fff", MF.accent),
                    padding: "8px 18px", fontSize: "13px", borderRadius: MF.radiusSm,
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  + Vaccine
                </button>
                {vaccineCount > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onVaccine(Math.max(0, vaccineCount - 1)); }}
                    style={{
                      ...btn(MF.textMuted, "rgba(139,148,158,0.08)"),
                      padding: "8px 12px", fontSize: "12px", borderRadius: MF.radiusSm,
                    }}
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ARRIVAL HANDSHAKE
function ArrivalScreen({ rules, itemStates, ctx, onAction }) {
  const items = rules.filter((r) =>
    r.handoffEligibility === "arrival" &&
    [S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])
  );

  return (
    <div style={{ padding: "20px", animation: "fadeIn 0.2s ease" }}>
      <ScreenHeader
        title="Arrival handshake"
        subtitle={ctx.arrivalWindow
          ? "A few things worth checking as you get aligned."
          : "Handoff items will appear here when the overlap window begins."}
        ctx={ctx}
      />

      {!ctx.arrivalWindow && items.length === 0 ? (
        <QuietState
          message="No active arrival window right now."
          sub={ctx.inOverlap ? "You're mid-overlap — check Home for the live board." : "This screen activates when an overlap window starts."}
        />
      ) : items.length === 0 ? (
        <QuietState message="Nothing specific for the handshake." sub="Everything looks covered." />
      ) : (
        <>
          <div style={{
            background: MF.accentDim, borderRadius: MF.radiusSm,
            padding: "12px 14px", marginBottom: "14px",
            fontSize: "13px", color: MF.accent, fontWeight: 500, lineHeight: 1.5,
          }}>
            {items.length === 1
              ? "One thing worth a quick alignment."
              : `${items.length} things worth a quick alignment.`}
          </div>
          {items.map((r) => <ItemCard key={r.id} rule={r} state={itemStates[r.id]} onAction={onAction} timingPressure={ctx.timingPressure} />)}
        </>
      )}
    </div>
  );
}

// LATER TODAY
function LaterTodayScreen({ rules, itemStates, setup, ctx, onAction }) {
  const laterItems = rules.filter((r) => {
    if ([S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])) return false;
    if (r.category === "getahead") return false;
    if ([S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])) return false;
    if (itemStates[r.id] !== S.HIDDEN) return false;
    // Only show if the window is still ahead of us
    const win = resolveWindow(r, setup);
    return win.start > ctx.currentMin;
  });

  return (
    <div style={{ padding: "20px", animation: "fadeIn 0.2s ease" }}>
      <ScreenHeader
        title="Later today"
        subtitle="What's likely to matter later. No action needed yet."
        ctx={ctx}
      />

      {laterItems.length === 0 ? (
        <QuietState message="Nothing upcoming that isn't already on your board." sub="You're tracking well." />
      ) : (
        laterItems.map((r) => {
          const win = resolveWindow(r, setup);
          return (
            <div key={r.id} style={{
              background: MF.card, border: `1px solid ${MF.border}`, borderRadius: MF.radius,
              padding: "16px", marginBottom: "10px", opacity: 0.75,
            }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, marginTop: "6px",
                  background: r.riskWeight === "high" ? MF.amber : r.riskWeight === "medium" ? MF.secondary : MF.border,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>{r.label}</div>
                  <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.5, marginBottom: "8px" }}>{r.description}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: MF.textMuted }}>
                      Usually relevant around {fmtTime12(win.start)}
                    </span>
                    <button
                      style={btn(MF.secondary, MF.secondaryDim)}
                      onClick={() => onAction(r.id, S.HANDLED_EARLY)}
                    >
                      Mark handled early
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// GET AHEAD
function GetAheadScreen({ rules, itemStates, ctx, onAction, queueState }) {
  const eligible = rules.filter((r) =>
    r.getAheadEligible && ![S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])
  );
  const activeCount = Object.values(itemStates).filter(
    (s) => s === S.VISIBLE || s === S.NEEDS_ATTENTION
  ).length;
  const toobusy = activeCount > 4 || ctx.timingPressure === "end-of-day" || queueState === "needsfocus" || queueState === "highdemand";

  return (
    <div style={{ padding: "20px", animation: "fadeIn 0.2s ease" }}>
      <ScreenHeader
        title="Get ahead"
        subtitle="Optional early opportunities. Skip anything here without guilt."
        ctx={ctx}
      />

      {toobusy ? (
        <QuietState
          message="The day is busy enough right now."
          sub="Being present with patients matters more than checking boxes."
        />
      ) : eligible.length === 0 ? (
        <QuietState message="Nothing to get ahead on right now." sub="That's usually a good sign." />
      ) : (
        eligible.map((r) => (
          <div key={r.id} style={{
            background: MF.card, border: `1px solid ${MF.border}`, borderRadius: MF.radius,
            padding: "16px", marginBottom: "10px",
          }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, marginTop: "6px", background: MF.border }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>{r.label}</div>
                <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.5, marginBottom: "10px" }}>{r.description}</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button style={btn(MF.accent, MF.accentDim)} onClick={() => onAction(r.id, S.HANDLED_EARLY)}>
                    Get a head start
                  </button>
                  <button style={btn(MF.textMuted, "rgba(139,148,158,0.08)")} onClick={() => onAction(r.id, S.CONFIRMED)}>
                    Dismiss for now
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// EXIT CHECKPOINT
function ExitScreen({ rules, itemStates, ctx, setup, onAction, vaccineCount }) {
  const unresolved = rules.filter((r) =>
    r.handoffEligibility === "exit" &&
    [S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])
  );
  const covered = rules.filter((r) =>
    r.handoffEligibility === "exit" &&
    [S.CONFIRMED, S.HANDLED_EARLY].includes(itemStates[r.id])
  );

  return (
    <div style={{ padding: "20px", animation: "fadeIn 0.2s ease" }}>
      <ScreenHeader
        title="Exit checkpoint"
        subtitle={ctx.exitWindow
          ? "What's worth mentioning before you leave."
          : "This screen will show your handoff items as shift end approaches."}
        ctx={ctx}
      />

      {/* Day note — context for handoff */}
      {setup && setup.dayNotes && setup.dayNotes.length > 0 && (
        <div style={{
          background: MF.secondaryDim, borderRadius: MF.radiusSm,
          padding: "10px 14px", marginBottom: "14px",
          fontSize: "13px", color: MF.secondary, fontWeight: 500,
          lineHeight: 1.4,
        }}>
          {setup.dayNotes.map((n, i) => (
            <div key={i} style={{ marginBottom: i < setup.dayNotes.length - 1 ? "4px" : 0 }}>
              {setup.dayNotes.length > 1 ? `${i + 1}. ${n}` : n}
            </div>
          ))}
        </div>
      )}

      {/* Vaccine summary — handoff context */}
      {setup && setup.immTarget > 0 && vaccineCount !== undefined && (
        <div style={{
          background: MF.accentDim, borderRadius: MF.radiusSm,
          padding: "10px 14px", marginBottom: "14px",
          fontSize: "13px", color: MF.accent, fontWeight: 500, lineHeight: 1.4,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>Immunizations today</span>
          <span style={{ fontWeight: 700 }}>{vaccineCount} of {setup.immTarget}</span>
        </div>
      )}

      {unresolved.length === 0 ? (
        <QuietState
          message={ctx.exitWindow ? "Nothing unresolved to hand off." : "Not in the exit window yet."}
          sub={ctx.exitWindow ? "All set for today. Thanks for keeping patients and the team steady." : `About ${Math.round(ctx.minutesUntilEnd)} minutes until shift end.`}
        />
      ) : (
        <>
          <div style={{
            background: MF.accentDim, borderRadius: MF.radiusSm,
            padding: "12px 14px", marginBottom: "14px",
            fontSize: "13px", color: MF.accent, fontWeight: 500, lineHeight: 1.5,
          }}>
            {unresolved.length === 1
              ? "One thing worth a quick mention to whoever is next."
              : `${unresolved.length} things worth a quick mention to whoever is next.`}
          </div>
          {unresolved.map((r) => (
          <div key={r.id} style={{
            background: MF.card, border: `1px solid ${MF.border}`, borderRadius: MF.radius,
            padding: "16px", marginBottom: "10px",
            borderLeft: `3px solid ${itemStates[r.id] === S.NEEDS_ATTENTION ? MF.amber : MF.accentMid}`,
          }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, marginTop: "6px",
                background: r.riskWeight === "high" ? MF.amber : r.riskWeight === "medium" ? MF.secondary : MF.border,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>{r.label}</div>
                <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.5, marginBottom: "10px" }}>{r.description}</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button style={btn(MF.green, MF.greenDim)} onClick={() => onAction(r.id, S.CONFIRMED)}>
                    Looks covered
                  </button>
                  <button style={btn(MF.amber, MF.amberDim)} onClick={() => onAction(r.id, S.NEEDS_ATTENTION)}>
                    Still worth mentioning
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        </>
      )}

      {/* Still open — window passed, worth mentioning at handoff */}
      {(() => {
        const stillOpenExit = rules.filter((r) => {
          if (r.category === "getahead") return false;
          if ([S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])) return false;
          if ([S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])) return false;
          if (itemStates[r.id] !== S.HIDDEN) return false;
          // Exclude items already shown in unresolved
          if (r.handoffEligibility === "exit" && [S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])) return false;
          const win = resolveWindow(r, setup);
          return win.end < ctx.currentMin && win.end > 0;
        });
        if (stillOpenExit.length === 0) return null;
        return (
          <>
            <SectionLabel>Still open — window passed</SectionLabel>
            {stillOpenExit.map((r) => (
              <div key={r.id} style={{
                background: MF.card, border: `1px solid ${MF.border}`,
                borderLeft: `3px solid ${MF.amber}`,
                borderRadius: MF.radius, padding: "12px 16px", marginBottom: "8px",
              }}>
                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{r.label}</div>
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  <button style={btn(MF.green, MF.greenDim)} onClick={() => onAction(r.id, S.CONFIRMED)}>Already handled</button>
                  <button style={btn(MF.textMuted, "rgba(139,148,158,0.08)")} onClick={() => onAction(r.id, S.NOT_APPLICABLE)}>Not needed</button>
                </div>
              </div>
            ))}
          </>
        );
      })()}

      {covered.length > 0 && (
        <>
          <SectionLabel>Already covered</SectionLabel>
          {covered.map((r) => <ConfirmedCard key={r.id} rule={r} state={itemStates[r.id]} />)}
        </>
      )}
    </div>
  );
}

// ─── TIME SIMULATOR ───
function TimeSimulator({ simTime, onSimTimeChange, onClose, onReset, shiftStart, shiftEnd }) {
  const shiftLen = shiftEnd >= shiftStart ? shiftEnd - shiftStart : 1440 - shiftStart + shiftEnd;
  const presets = [
    { label: "Shift start", min: shiftStart },
    { label: "+30 min", min: (shiftStart + 30) % 1440 },
    { label: "+2 hrs", min: (shiftStart + 120) % 1440 },
    { label: "Mid-shift", min: (shiftStart + Math.floor(shiftLen / 2)) % 1440 },
    { label: "-1 hr", min: (shiftStart + shiftLen - 60 + 1440) % 1440 },
    { label: "-20 min", min: (shiftStart + shiftLen - 20 + 1440) % 1440 },
    { label: "Shift end", min: shiftEnd },
  ];

  // Slider value: minutes into shift
  const sliderMin = 0;
  const sliderMax = shiftLen;
  let sliderVal;
  if (shiftEnd >= shiftStart) {
    sliderVal = simTime - shiftStart;
  } else {
    sliderVal = simTime >= shiftStart ? simTime - shiftStart : 1440 - shiftStart + simTime;
  }
  sliderVal = Math.max(0, Math.min(shiftLen, sliderVal));

  const handleSlider = (e) => {
    const val = +e.target.value;
    onSimTimeChange((shiftStart + val) % 1440);
  };

  return (
    <div style={{
      background: MF.card, border: `1px solid ${MF.border}`, borderRadius: "14px",
      padding: "16px", margin: "0 12px 8px", backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: MF.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Time Simulator
        </span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: MF.textMuted, cursor: "pointer",
          fontSize: "18px", fontFamily: MF.font, padding: "0 4px",
        }}>×</button>
      </div>

      <div style={{ fontSize: "20px", fontWeight: 700, textAlign: "center", marginBottom: "12px", fontFamily: MF.font }}>
        {fmtTime12(simTime)}
      </div>

      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        value={sliderVal}
        onChange={handleSlider}
        style={{ width: "100%", accentColor: MF.accent, marginBottom: "12px" }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center" }}>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => onSimTimeChange(p.min)}
            style={{
              ...btn(simTime === p.min ? "#fff" : MF.textMuted, simTime === p.min ? MF.accent : "rgba(139,148,158,0.08)"),
              fontSize: "11px", padding: "5px 10px",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {onReset && (
        <button
          onClick={onReset}
          style={{
            ...btn(MF.textMuted, "rgba(139,148,158,0.08)"),
            width: "100%", marginTop: "10px", fontSize: "11px", textAlign: "center",
          }}
        >
          Reset all actions
        </button>
      )}
    </div>
  );
}

// ─── MAIN APP ───
export default function RxTempo() {
  const [setup, setSetup] = useState(null);
  const [screen, setScreen] = useState("landing");
  const [itemStates, setItemStates] = useState({});
  const [now, setNow] = useState(new Date());
  const [simMode, setSimMode] = useState(false);
  const [simTime, setSimTime] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [showInfo, setShowInfo] = useState(false);
  const [eventArrivals, setEventArrivals] = useState({});
  const [queueState, setQueueState] = useState("ontrack");
  const [vaccineCount, setVaccineCount] = useState(0);
  const [dayNoteStates, setDayNoteStates] = useState({}); // { 0: "active"|"happened"|"dismissed", 1: ... }
  const [dayNoteConfirm, setDayNoteConfirm] = useState(null); // index of note showing dismiss confirm

  // Update MF on every render based on current theme
  MF = { ...THEMES[theme], font: "'IBM Plex Sans', -apple-system, sans-serif", radius: "12px", radiusSm: "8px" };
  const toggleTheme = useCallback(() => setTheme((t) => t === "dark" ? "light" : "dark"), []);

  // Tick every 30s (real time)
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  // Build the "now" object for context derivation — either real or simulated
  const effectiveNow = useMemo(() => {
    if (!simMode || simTime === null) return now;
    const d = new Date(now);
    d.setHours(Math.floor(simTime / 60), simTime % 60, 0, 0);
    return d;
  }, [now, simMode, simTime]);

  // Auto-expire: 24hr ceiling
  useEffect(() => {
    if (setup && Date.now() - setup.setupTimestamp > 24 * 60 * 60 * 1000) {
      handleReset();
    }
  }, [now, setup]);

  const ctx = useMemo(() => deriveContext(setup, effectiveNow), [setup, effectiveNow]);

  // Build active rule set — includes dynamic rules from events that have arrived
  const activeRules = useMemo(() => {
    if (!setup) return RULES;
    const expected = setup.expectedEvents || {};
    const extras = [];

    // Warehouse: once totes arrive, 2hr window to check them in
    if (expected.warehouse && eventArrivals.warehouse) {
      const offset = ((eventArrivals.warehouse - (setup.shiftStart || 0)) + 1440) % 1440;
      extras.push({
        id: "event-warehouse",
        label: "Warehouse delivery check-in",
        description: "Totes are here. Check in order, verify counts, flag shortages or damages.",
        category: "midday",
        usualWindow: { startOffset: offset, endOffset: offset + 120 },
        roleContext: "Usually handled by whoever is at the bench.",
        carryLogic: "carry",
        handoffEligibility: "exit",
        getAheadEligible: false,
        riskWeight: "high",
      });
    }

    // OV delivery: once it arrives, 90min window to process
    if (expected.ov && eventArrivals.ov) {
      const offset = ((eventArrivals.ov - (setup.shiftStart || 0)) + 1440) % 1440;
      extras.push({
        id: "event-ov",
        label: "OV order check-in",
        description: "Outside vendor delivery is here. Check in order and verify against PO.",
        category: "midday",
        usualWindow: { startOffset: offset, endOffset: offset + 90 },
        roleContext: "Usually handled by whoever is at the bench.",
        carryLogic: "carry",
        handoffEligibility: "exit",
        getAheadEligible: false,
        riskWeight: "medium",
      });
    }

    // USPS: once driver arrives, it's go-time — short window
    if (expected.usps && eventArrivals.usps) {
      const offset = ((eventArrivals.usps - (setup.shiftStart || 0)) + 1440) % 1440;
      extras.push({
        id: "event-usps",
        label: "USPS pickup — now",
        description: "USPS driver is here. Get all outgoing shipments to pick-n-pack now.",
        category: "deadline",
        usualWindow: { startOffset: offset, endOffset: offset + 20 },
        roleContext: "All outgoing deliveries need to be handed off.",
        carryLogic: "carry",
        handoffEligibility: "exit",
        getAheadEligible: false,
        riskWeight: "high",
      });
    }

    // USPS: if expected but not yet arrived, surface a prep reminder in the second half of shift
    if (expected.usps && !eventArrivals.usps) {
      extras.push({
        id: "event-usps-prep",
        label: "USPS pickup prep",
        description: "USPS pickup expected today. Make sure outgoing shipments are ready in pick-n-pack.",
        category: "midday",
        usualWindow: { startOffset: 180, endOffset: -30 },
        roleContext: "Check that everything outgoing is packaged and labeled.",
        carryLogic: "carry",
        handoffEligibility: "exit",
        getAheadEligible: true,
        riskWeight: "medium",
      });
    }

    return [...RULES, ...extras];
  }, [setup, eventArrivals]);

  // Recompute item states
  useEffect(() => {
    if (!ctx || !setup) return;
    setItemStates((prev) => computeItemStates(activeRules, prev, setup, ctx));
  }, [ctx, setup, activeRules]);

  const handleAction = useCallback((ruleId, newState) => {
    setItemStates((prev) => ({ ...prev, [ruleId]: newState }));
  }, []);

  // Auto-return: after acting on arrival/exit items, return to Home after a beat
  const handleActionAndReturn = useCallback((ruleId, newState) => {
    handleAction(ruleId, newState);
    setTimeout(() => setScreen("home"), 600);
  }, [handleAction]);

  const handleSetup = (data) => {
    setSetup(data);
    setItemStates({});
    setScreen("home");
    // Default sim time to shift start
    setSimTime(data.shiftStart);
  };

  const handleReset = () => {
    setSetup(null);
    setItemStates({});
    setEventArrivals({});
    setQueueState("ontrack");
    setVaccineCount(0);
    setScreen("landing");
    setSimMode(false);
    setSimTime(null);
  };

  const handleSimTimeChange = (min) => {
    setSimTime(min);
    // Reset all user-actioned states when time changes for clean demos
  };

  // Nav badge counts
  const countByFilter = (filterFn) =>
    activeRules.filter((r) => filterFn(r) && [S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])).length;

  const arrivalBadge = countByFilter((r) => r.handoffEligibility === "arrival");
  const exitBadge = countByFilter((r) => r.handoffEligibility === "exit");

  // Global styles
  const globalCSS = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    select option { background: ${MF.selectBg}; color: ${MF.selectText}; }
    ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${MF.border}; border-radius: 3px; }
    button:active { transform: scale(0.97); }
    input[type="range"] { height: 4px; }
  `;

  // LANDING PAGE
  if (screen === "landing" || (screen === "setup" && !setup) || (!setup && screen !== "setup")) {
    const isSetup = screen === "setup";
    return (
      <div style={{ fontFamily: MF.font, background: MF.bg, color: MF.text, minHeight: "100vh", maxWidth: "430px", margin: "0 auto", overflow: "hidden" }}>
        <style>{globalCSS}{`
          @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
          @keyframes errorPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
          @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes revealUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes revealScale { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
          @keyframes pulseLine { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.25; } }
          @keyframes scrollLine { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        `}</style>

        {isSetup ? (
          <>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px", borderBottom: `1px solid ${MF.border}`,
              background: MF.topBarBg, backdropFilter: "blur(12px)",
            }}>
              <Brand compact />
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button onClick={toggleTheme} style={{
                  background: "none", border: `1px solid ${MF.border}`, borderRadius: "8px",
                  padding: "6px", cursor: "pointer", color: MF.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {theme === "dark" ? I.sun : I.moon}
                </button>
                <button onClick={() => setShowInfo(!showInfo)} style={{
                  background: "none", border: `1px solid ${showInfo ? MF.accent : MF.border}`, borderRadius: "8px",
                  padding: "6px", cursor: "pointer", color: showInfo ? MF.accent : MF.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {I.info}
                </button>
                <button onClick={() => setScreen("landing")} style={{
                  background: "none", border: `1px solid ${MF.border}`, borderRadius: "6px",
                  color: MF.textMuted, fontSize: "12px", fontFamily: MF.font, padding: "5px 12px",
                  cursor: "pointer",
                }}>Back</button>
              </div>
            </div>
            <StartDayScreen onComplete={handleSetup} />
            <div style={{ textAlign: "center", padding: "20px", fontSize: "11px", color: MF.textMuted, opacity: 0.5 }}>
              <div>© 2026 Madden Frameworks</div>
              <div style={{ fontStyle: "italic", marginTop: "2px" }}>Smart systems. Better judgment.</div>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100dvh", position: "relative", overflow: "hidden" }}>
            {/* Background glow effects */}
            <div style={{
              position: "absolute", top: "-60px", left: "-60px", width: "320px", height: "320px",
              borderRadius: "50%",
              background: theme === "dark"
                ? "radial-gradient(circle, rgba(74,158,255,0.07) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(74,158,255,0.04) 0%, transparent 70%)",
              animation: "pulse 6s ease-in-out infinite", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: "80px", right: "-80px", width: "280px", height: "280px",
              borderRadius: "50%",
              background: theme === "dark"
                ? "radial-gradient(circle, rgba(126,184,240,0.05) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(126,184,240,0.03) 0%, transparent 70%)",
              animation: "pulse 8s ease-in-out infinite 2s", pointerEvents: "none",
            }} />

            {/* Header bar — consistent with all other screens */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: `1px solid ${MF.border}`,
              background: MF.topBarBg, backdropFilter: "blur(12px)",
              position: "relative", zIndex: 10,
            }}>
              <Brand dim />
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button onClick={toggleTheme} style={{
                  background: "none", border: `1px solid ${MF.border}`, borderRadius: "8px",
                  padding: "6px", cursor: "pointer", color: MF.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {theme === "dark" ? I.sun : I.moon}
                </button>
                <button onClick={() => setShowInfo(!showInfo)} style={{
                  background: "none", border: `1px solid ${showInfo ? MF.accent : MF.border}`, borderRadius: "8px",
                  padding: "6px", cursor: "pointer", color: showInfo ? MF.accent : MF.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {I.info}
                </button>
              </div>
            </div>

            {/* Vertically centered content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 28px 40px" }}>

              {/* Headline — Rx in blue, Tempo in white, LITE badge */}
              <div style={{ animation: "revealUp 0.5s ease both 0.15s", marginBottom: "24px" }}>
                <h1 style={{
                  fontSize: "52px", fontWeight: 700, letterSpacing: "-0.04em",
                  lineHeight: 1.05, marginBottom: "14px", display: "flex", alignItems: "baseline", gap: "4px",
                }}>
                  <span style={{ color: MF.accent }}>Rx</span>
                  <span style={{ color: MF.text }}>Tempo</span>
                  <span style={{
                    fontSize: "15px", fontWeight: 600, color: MF.textMuted,
                    border: `1.5px solid ${MF.border}`, background: "transparent",
                    padding: "2px 10px", borderRadius: "5px", marginLeft: "8px",
                    letterSpacing: "0.05em", lineHeight: "20px", position: "relative", top: "-9px",
                  }}>LITE</span>
                </h1>
                <p style={{
                  fontSize: "19px", fontWeight: 400, color: MF.textMuted, lineHeight: 1.4,
                  letterSpacing: "-0.01em",
                }}>
                  Intelligent support for the pharmacy day.
                </p>
              </div>

              {/* Rhythm wave — morphing pulse */}
              <div style={{
                marginLeft: "-28px", marginRight: "-28px",
                marginBottom: "24px", overflow: "hidden", height: "80px",
                animation: "revealUp 0.5s ease both 0.25s",
                position: "relative",
              }}>
                <svg width="100%" height="80" viewBox="0 0 400 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="waveFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={MF.accent} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={MF.accent} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="waveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={MF.accent} stopOpacity="0" />
                      <stop offset="15%" stopColor={MF.accent} stopOpacity="0.6" />
                      <stop offset="50%" stopColor={MF.accent} stopOpacity="0.8" />
                      <stop offset="85%" stopColor={MF.accent} stopOpacity="0.6" />
                      <stop offset="100%" stopColor={MF.accent} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Filled area under the wave */}
                  <path fill="url(#waveFill)" stroke="none">
                    <animate
                      attributeName="d"
                      dur="6s"
                      repeatCount="indefinite"
                      values="
                        M0,40 C30,10 70,10 100,40 C130,70 170,70 200,40 C230,10 270,10 300,40 C330,70 370,70 400,40 L400,80 L0,80 Z;
                        M0,40 C40,65 60,65 100,40 C140,15 160,15 200,40 C240,65 260,65 300,40 C340,15 360,15 400,40 L400,80 L0,80 Z;
                        M0,40 C25,5 75,5 100,40 C125,75 175,75 200,40 C225,5 275,5 300,40 C325,75 375,75 400,40 L400,80 L0,80 Z;
                        M0,40 C30,10 70,10 100,40 C130,70 170,70 200,40 C230,10 270,10 300,40 C330,70 370,70 400,40 L400,80 L0,80 Z
                      "
                      calcMode="spline"
                      keySplines="0.45 0 0.55 1; 0.45 0 0.55 1; 0.45 0 0.55 1"
                    />
                  </path>
                  {/* Main stroke */}
                  <path fill="none" stroke="url(#waveStroke)" strokeWidth="2.5" strokeLinecap="round">
                    <animate
                      attributeName="d"
                      dur="6s"
                      repeatCount="indefinite"
                      values="
                        M0,40 C30,10 70,10 100,40 C130,70 170,70 200,40 C230,10 270,10 300,40 C330,70 370,70 400,40;
                        M0,40 C40,65 60,65 100,40 C140,15 160,15 200,40 C240,65 260,65 300,40 C340,15 360,15 400,40;
                        M0,40 C25,5 75,5 100,40 C125,75 175,75 200,40 C225,5 275,5 300,40 C325,75 375,75 400,40;
                        M0,40 C30,10 70,10 100,40 C130,70 170,70 200,40 C230,10 270,10 300,40 C330,70 370,70 400,40
                      "
                      calcMode="spline"
                      keySplines="0.45 0 0.55 1; 0.45 0 0.55 1; 0.45 0 0.55 1"
                    />
                  </path>
                  {/* Subtle echo stroke */}
                  <path fill="none" stroke={MF.accent} strokeWidth="1" strokeLinecap="round" opacity="0.15">
                    <animate
                      attributeName="d"
                      dur="6s"
                      repeatCount="indefinite"
                      values="
                        M0,40 C40,65 60,65 100,40 C140,15 160,15 200,40 C240,65 260,65 300,40 C340,15 360,15 400,40;
                        M0,40 C25,5 75,5 100,40 C125,75 175,75 200,40 C225,5 275,5 300,40 C325,75 375,75 400,40;
                        M0,40 C30,10 70,10 100,40 C130,70 170,70 200,40 C230,10 270,10 300,40 C330,70 370,70 400,40;
                        M0,40 C40,65 60,65 100,40 C140,15 160,15 200,40 C240,65 260,65 300,40 C340,15 360,15 400,40
                      "
                      calcMode="spline"
                      keySplines="0.45 0 0.55 1; 0.45 0 0.55 1; 0.45 0 0.55 1"
                    />
                  </path>
                </svg>
              </div>

              {/* Value propositions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "revealUp 0.5s ease both 0.3s", marginBottom: "28px" }}>
                {[
                  {
                    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={MF.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                    text: "Knows what matters right now",
                  },
                  {
                    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={MF.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><line x1="3" y1="5" x2="21" y2="5"/><polyline points="7 23 3 19 7 15"/><line x1="21" y1="19" x2="3" y2="19"/></svg>,
                    text: "Cleaner, shorter handoffs",
                  },
                  {
                    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={MF.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
                    text: "Resets every shift — nothing stored",
                  },
                ].map((f, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "18px",
                    animation: `revealUp 0.4s ease both ${0.4 + i * 0.12}s`,
                  }}>
                    <div style={{ flexShrink: 0, width: "26px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {f.icon}
                    </div>
                    <span style={{ fontSize: "17px", fontWeight: 600, color: MF.text, letterSpacing: "-0.02em", lineHeight: 1.3 }}>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{ animation: "revealUp 0.5s ease both 0.7s" }}>
                <button
                  onClick={() => setScreen("setup")}
                  style={{
                    width: "100%", padding: "18px 24px", border: "none", borderRadius: "16px",
                    fontSize: "17px", fontWeight: 600, fontFamily: MF.font, cursor: "pointer",
                    color: "#fff", letterSpacing: "-0.01em",
                    background: MF.gradient,
                    backgroundSize: "200% 200%",
                    animation: "gradientShift 4s ease infinite",
                    boxShadow: theme === "dark"
                      ? "0 6px 28px rgba(74,158,255,0.3), 0 2px 6px rgba(74,158,255,0.12)"
                      : "0 4px 16px rgba(45,122,191,0.25), 0 1px 4px rgba(45,122,191,0.1)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                >
                  Start your day
                </button>
                <div style={{
                  textAlign: "center", marginTop: "16px",
                  fontSize: "12px", color: MF.textMuted, opacity: 0.5, lineHeight: 1.7,
                }}>
                  <div>Single-shift use only · No tracking or reporting · No history</div>
                  <div>Nothing is saved. No data leaves your device.</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                textAlign: "center", marginTop: "32px",
                animation: "revealUp 0.5s ease both 0.85s",
              }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  fontSize: "11px", color: MF.textMuted, opacity: 0.4,
                  padding: "6px 14px", borderRadius: "20px",
                  border: `1px solid ${MF.border}`,
                  marginBottom: "4px",
                }}>
                  <span style={{ fontWeight: 600, letterSpacing: "0.04em" }}>MADDEN FRAMEWORKS</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>© 2026</span>
                </div>
                <div style={{ fontSize: "12px", color: MF.textMuted, opacity: 0.35, fontStyle: "italic" }}>
                  Smart systems. Better judgment.
                </div>
              </div>
            </div>
          </div>
        )}
        <InfoPanel show={showInfo} onClose={() => setShowInfo(false)} />
      </div>
    );
  }

  // If ctx isn't ready yet, show loading
  if (!ctx || !setup) {
    return (
      <div style={{ fontFamily: MF.font, background: MF.bg, color: MF.text, minHeight: "100vh", maxWidth: "430px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{globalCSS}</style>
        <span style={{ color: MF.textMuted }}>Loading...</span>
      </div>
    );
  }

  // MAIN APP SHELL
  const screens = {
    home: <HomeScreen rules={activeRules} itemStates={itemStates} ctx={ctx} setup={setup} onAction={handleAction} onNav={setScreen} eventArrivals={eventArrivals} onEventArrival={(key, min) => setEventArrivals((prev) => ({ ...prev, [key]: min }))} queueState={queueState} onQueueState={setQueueState} vaccineCount={vaccineCount} onVaccine={setVaccineCount} dayNoteStates={dayNoteStates} onDayNoteState={(idx, state) => setDayNoteStates((prev) => ({ ...prev, [idx]: state }))} dayNoteConfirm={dayNoteConfirm} onDayNoteConfirm={setDayNoteConfirm} />,
    arrival: <ArrivalScreen rules={activeRules} itemStates={itemStates} ctx={ctx} onAction={handleActionAndReturn} />,
    later: <LaterTodayScreen rules={activeRules} itemStates={itemStates} setup={setup} ctx={ctx} onAction={handleAction} />,
    ahead: <GetAheadScreen rules={activeRules} itemStates={itemStates} ctx={ctx} onAction={handleAction} queueState={queueState} />,
    exit: <ExitScreen rules={activeRules} itemStates={itemStates} ctx={ctx} setup={setup} onAction={handleActionAndReturn} vaccineCount={vaccineCount} />,
  };

  const navItems = [
    { key: "home", label: "Home", icon: I.home },
    { key: "arrival", label: "Arrival", icon: I.handoff, badge: arrivalBadge },
    { key: "later", label: "Later", icon: I.clock },
    { key: "ahead", label: "Ahead", icon: I.ahead },
    { key: "exit", label: "Exit", icon: I.exit, badge: exitBadge },
  ];

  return (
    <div style={{ fontFamily: MF.font, background: MF.bg, color: MF.text, minHeight: "100vh", maxWidth: "430px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <style>{globalCSS}</style>

      {/* ── TOP BAR ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: `1px solid ${MF.border}`,
        background: MF.topBarBg, backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <Brand compact />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button onClick={toggleTheme} style={{
            background: "none", border: `1px solid ${MF.border}`, borderRadius: "6px",
            padding: "4px", cursor: "pointer", color: MF.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {theme === "dark" ? I.sun : I.moon}
          </button>
          <button onClick={() => setShowInfo(!showInfo)} style={{
            background: "none", border: `1px solid ${showInfo ? MF.accent : MF.border}`, borderRadius: "6px",
            padding: "4px", cursor: "pointer", color: showInfo ? MF.accent : MF.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {I.info}
          </button>
          <button
            onClick={() => { setSimMode(!simMode); if (!simMode && simTime === null) setSimTime(setup.shiftStart); }}
            style={{
              background: "none", border: `1px solid ${simMode ? MF.accent : MF.border}`, borderRadius: "6px",
              padding: "4px", cursor: "pointer", color: simMode ? MF.accent : MF.textMuted,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {I.sim}
          </button>
          <button
            onClick={handleReset}
            style={{
              background: "none", border: `1px solid ${MF.border}`, borderRadius: "6px",
              padding: "4px", cursor: "pointer", color: "#D93D42",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {I.reset}
          </button>
        </div>
      </div>

      <InfoPanel show={showInfo} onClose={() => setShowInfo(false)} />

      {/* ── SIMULATOR ── */}
      {simMode && setup && (
        <TimeSimulator
          simTime={simTime ?? setup.shiftStart}
          onSimTimeChange={handleSimTimeChange}
          onClose={() => setSimMode(false)}
          onReset={() => setItemStates({})}
          shiftStart={setup.shiftStart}
          shiftEnd={setup.shiftEnd}
        />
      )}

      {/* ── CONTENT ── */}
      <div key={screen} style={{ flex: 1, overflowY: "auto", paddingBottom: "80px", animation: "fadeIn 0.2s ease" }}>
        {screens[screen]}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: "center", padding: "12px", fontSize: "11px", color: MF.textMuted, opacity: 0.4 }}>
        <div>© 2026 Madden Frameworks</div>
        <div style={{ fontStyle: "italic", marginTop: "2px" }}>Smart systems. Better judgment.</div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        display: "flex", justifyContent: "space-around", padding: "8px 4px 12px",
        borderTop: `1px solid ${MF.border}`, background: MF.navBg,
        backdropFilter: "blur(12px)", position: "sticky", bottom: 0, zIndex: 100,
      }}>
        {navItems.map((tab) => {
          const isActive = screen === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setScreen(tab.key)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: isActive ? MF.accent : MF.textMuted,
                fontSize: "10px", fontWeight: isActive ? 600 : 400,
                fontFamily: MF.font, display: "flex", flexDirection: "column",
                alignItems: "center", gap: "3px", padding: "4px 12px",
                transition: "color 0.15s ease", position: "relative",
              }}
            >
              <div style={{ position: "relative" }}>
                {tab.icon}
                {tab.badge > 0 && (
                  <span style={{
                    position: "absolute", top: "-5px", right: "-9px",
                    background: MF.accent, color: "#fff", fontSize: "9px", fontWeight: 700,
                    borderRadius: "50%", width: "15px", height: "15px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {tab.badge}
                  </span>
                )}
              </div>
              {tab.label}
              {isActive && (
                <div style={{
                  position: "absolute", bottom: "-4px", left: "50%", transform: "translateX(-50%)",
                  width: "16px", height: "3px", borderRadius: "2px", background: MF.accent,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
