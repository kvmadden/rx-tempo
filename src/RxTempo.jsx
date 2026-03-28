import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ─── RULE TABLE: Real pharmacy content with full behavior contracts ───
const RULES = [
  // ── OPENING ──
  {
    id: "open-orientation",
    label: "Opening orientation",
    description: "Knowing what carried over and what's ahead means fewer surprises once patients start arriving. A two-minute scan now sets the rhythm for the whole shift.",
    category: "opening",
    itemType: "check",
    usualWindow: { startOffset: 0, endOffset: 30 },
    roleContext: "Set the pace before the first patient walks in.",
    carryLogic: "suppress",
    handoffEligibility: "arrival",
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "open-register",
    label: "Registers and systems ready",
    description: "A patient shouldn't have to wait because a register isn't logged in. Getting systems live before the doors open keeps the first interaction smooth.",
    category: "opening",
    itemType: "check",
    usualWindow: { startOffset: 0, endOffset: 20 },
    roleContext: "Smooth first impression for the day.",
    carryLogic: "suppress",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "open-willcall",
    label: "Will call check",
    description: "Patients get frustrated when their script isn't where it should be. A quick scan now catches misfiled bags and expiring holds before they become pickup problems.",
    category: "opening",
    itemType: "check",
    usualWindow: { startOffset: 5, endOffset: 60 },
    roleContext: "Prevents surprises at the pickup window.",
    carryLogic: "carry",
    handoffEligibility: "arrival",
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "open-delivery",
    label: "Delivery scan",
    description: "Catching a short-ship early means you can reorder before it affects a patient. Waiting until someone needs the med makes it urgent instead of routine.",
    category: "opening",
    itemType: "check",
    usualWindow: { startOffset: 0, endOffset: 90 },
    roleContext: "Keeps inventory gaps from reaching patients.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "open-fridge",
    label: "Refrigerator temperature log",
    description: "An out-of-range fridge can mean thousands in lost vaccine and insulin inventory. A 30-second check protects product and keeps you compliant.",
    category: "opening",
    itemType: "compliance",
    usualWindow: { startOffset: 0, endOffset: 45 },
    roleContext: "Protects high-value inventory.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "high",
  },
  // ── MIDDAY ──
  {
    id: "mid-queue",
    label: "Queue and production check",
    description: "A stuck claim or missing part can snowball into a long wait at pickup. Catching it now keeps the line moving and patients happy.",
    category: "midday",
    itemType: "check",
    usualWindow: { startOffset: 120, endOffset: 240 },
    roleContext: "Keeps small problems from becoming big waits.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "mid-immunizations",
    label: "Immunization appointments",
    description: "A patient who booked an appointment chose your pharmacy on purpose. Having supplies ready and the schedule in mind honors that trust.",
    category: "midday",
    itemType: "task",
    usualWindow: { startOffset: 120, endOffset: 300 },
    roleContext: "Patients planned around this — be ready.",
    carryLogic: "carry",
    handoffEligibility: "arrival",
    getAheadEligible: true,
    riskWeight: "medium",
  },
  {
    id: "mid-cycle-count",
    label: "Cycle count window",
    description: "Accurate counts prevent phantom stock situations — where the system says you have it but the shelf is empty. Mid-shift is usually the calmest window.",
    category: "midday",
    itemType: "task",
    usualWindow: { startOffset: 150, endOffset: 330 },
    roleContext: "Best done during a calm stretch.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "mid-dur",
    label: "DUR follow-ups",
    description: "These flags exist because something in the patient's profile needs a pharmacist's eye. Resolving them now means scripts move forward instead of sitting in limbo.",
    category: "midday",
    itemType: "compliance",
    usualWindow: { startOffset: 90, endOffset: 300 },
    roleContext: "Clears the path for scripts to fill.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "mid-mtm",
    label: "MTM alerts",
    description: "These are patients where a quick conversation can genuinely improve outcomes. Documenting it also keeps the store's clinical metrics healthy.",
    category: "midday",
    itemType: "task",
    usualWindow: { startOffset: 120, endOffset: 360 },
    roleContext: "Real impact on patient outcomes.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: true,
    riskWeight: "medium",
  },
  {
    id: "mid-prior-auth",
    label: "Pending prior authorizations",
    description: "A pending PA blocks the fill completely. Calling the insurance and prescriber now prevents a patient from showing up to an empty pickup window.",
    category: "midday",
    itemType: "task",
    usualWindow: { startOffset: 90, endOffset: 300 },
    roleContext: "Someone's fill is waiting on this.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "mid-claim-rejections",
    label: "Rejected insurance claims",
    description: "A bounced claim stops the fill. Resolving it now — contacting insurance or notifying the patient — keeps scripts moving instead of piling up.",
    category: "midday",
    itemType: "task",
    usualWindow: { startOffset: 120, endOffset: 300 },
    roleContext: "Unresolved claims block patient pickups.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "mid-consult-check",
    label: "Patient consultations due",
    description: "New prescriptions, high-risk meds, and significant therapy changes require pharmacist consultation. Completing these before patients leave keeps you compliant.",
    category: "midday",
    itemType: "compliance",
    usualWindow: { startOffset: 60, endOffset: 360 },
    roleContext: "Required by state pharmacy law.",
    carryLogic: "carry",
    handoffEligibility: "arrival",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "mid-narcotics-audit",
    label: "Controlled substance spot check",
    description: "Spot-check that recent C-II and C-III fills have matching hard-copy or electronic records. Catching a missing prescription now is much easier than at end-of-day reconciliation.",
    category: "midday",
    itemType: "compliance",
    usualWindow: { startOffset: 180, endOffset: 300 },
    roleContext: "Keeps the DEA log clean throughout the day.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "high",
  },
  // ── DEADLINE WINDOW ──
  {
    id: "deadline-rts",
    label: "Return to stock cutoff",
    description: "Scripts sitting past their hold window tie up inventory other patients might need. Returning them frees up stock and keeps the shelves accurate.",
    category: "deadline",
    itemType: "task",
    usualWindow: { startOffset: 300, endOffset: 480 },
    roleContext: "Frees up inventory for patients who need it.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "deadline-controls",
    label: "Controlled substance reconciliation",
    description: "This is a compliance requirement, but it also protects you and your team. A clean count today means no surprises at audit time.",
    category: "deadline",
    itemType: "compliance",
    usualWindow: { startOffset: -120, endOffset: -30 },
    roleContext: "Protects the team at audit time.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "deadline-report",
    label: "End-of-day reports",
    description: "These reports catch exceptions before they carry over. Reviewing now means tomorrow's opener doesn't inherit problems you could have flagged today.",
    category: "deadline",
    itemType: "task",
    usualWindow: { startOffset: -60, endOffset: -10 },
    roleContext: "Sets up tomorrow's team for success.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "deadline-fridge",
    label: "Evening temperature log",
    description: "CDC guidelines require twice-daily temperature logging for vaccine and insulin storage. The closing check catches any drift that happened during the day.",
    category: "deadline",
    itemType: "compliance",
    usualWindow: { startOffset: -45, endOffset: -10 },
    roleContext: "Second required log of the day.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "high",
  },
  // ── EXIT ──
  {
    id: "exit-queue-state",
    label: "Queue state at handoff",
    description: "The person coming in next can't see what you saw today. A quick heads-up on queue depth saves them from walking in blind.",
    category: "exit",
    itemType: "check",
    usualWindow: { startOffset: -30, endOffset: 0 },
    roleContext: "Nobody likes walking in blind.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "exit-open-issues",
    label: "Unresolved issues to mention",
    description: "An unmentioned callback or pending prior auth can leave a patient hanging. A 60-second verbal handoff closes the loop and builds team trust.",
    category: "exit",
    itemType: "task",
    usualWindow: { startOffset: -30, endOffset: 0 },
    roleContext: "Keeps patients from falling through the cracks.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  // ── GET AHEAD ──
  {
    id: "ahead-outdates",
    label: "Outdate pull",
    description: "Expired product on the shelf is a dispensing risk and a compliance issue. Pulling it now means one less thing to worry about later.",
    category: "getahead",
    itemType: "task",
    usualWindow: { startOffset: 60, endOffset: -30 },
    roleContext: "Calm moment? Protect the shelves.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: true,
    riskWeight: "low",
  },
  {
    id: "ahead-facing",
    label: "Shelf facing and organization",
    description: "A tidy shelf means faster pulls and fewer pick errors. It's a small investment that speeds up everyone's workflow for the rest of the day.",
    category: "getahead",
    itemType: "task",
    usualWindow: { startOffset: 60, endOffset: -30 },
    roleContext: "Faster pulls, fewer errors.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: true,
    riskWeight: "low",
  },
  {
    id: "ahead-smartcount",
    label: "Smart count prep",
    description: "Getting ahead on tomorrow's counts means tomorrow's team starts with a cleaner board. Good days are built the shift before.",
    category: "getahead",
    itemType: "task",
    usualWindow: { startOffset: 120, endOffset: -30 },
    roleContext: "Tomorrow's team will thank you.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: true,
    riskWeight: "low",
  },
  // ── ADDITIONAL MIDDAY ──
  {
    id: "mid-waiters",
    label: "Waiters check",
    description: "Someone sitting in the waiting area is watching the clock. A quick scan catches anyone who's been waiting longer than they should.",
    category: "midday",
    itemType: "check",
    usualWindow: { startOffset: 60, endOffset: 360 },
    roleContext: "Someone might be watching the clock.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
    riskWeight: "medium",
  },
  {
    id: "mid-voicemail",
    label: "Pharmacy voicemail",
    description: "A prescriber callback sitting in voicemail can delay a patient's fill for hours. Clearing the queue keeps things moving for everyone.",
    category: "midday",
    itemType: "check",
    usualWindow: { startOffset: 90, endOffset: 240 },
    roleContext: "Unanswered calls delay patient care.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "low",
  },
  {
    id: "mid-callbacks",
    label: "Patient callbacks",
    description: "These patients are waiting to hear from you — about insurance, a special order, or a prior auth. Following up builds the kind of trust that keeps them coming back.",
    category: "midday",
    itemType: "task",
    usualWindow: { startOffset: 120, endOffset: 360 },
    roleContext: "Someone is waiting to hear from you.",
    carryLogic: "carry",
    handoffEligibility: "exit",
    getAheadEligible: false,
    riskWeight: "high",
  },
  {
    id: "mid-readyfill",
    label: "ReadyFill review",
    description: "Auto-fills that need intervention will just sit there until someone looks. Catching them now prevents a patient from showing up to nothing ready.",
    category: "midday",
    itemType: "task",
    usualWindow: { startOffset: 150, endOffset: 300 },
    roleContext: "Prevents empty-handed pickups.",
    carryLogic: "carry",
    handoffEligibility: null,
    getAheadEligible: false,
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
};

// Pressure ranking for situation-aware check resurfacing
// Higher number = more pressure. Checks resurface when pressure increases.
const PRESSURE_RANK = { clear: 0, ontrack: 1, needsfocus: 2, highdemand: 3 };

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


  // Coverage mode + handoff detection
  let coverageMode = "solo";
  let inOverlap = false;
  let arrivalWindow = false;

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
  if (rule.usualWindow.endOffset >= 0) {
    end = (shiftStart + rule.usualWindow.endOffset) % 1440;
  } else {
    end = (shiftStart + shiftLen + rule.usualWindow.endOffset + 1440) % 1440;
  }
  return { start, end };
}

function computeItemStates(rules, prevStates, setup, ctx, queueState, checkConfirmedAt) {
  const result = {};
  const prevActive = Object.values(prevStates).filter(
    (s) => s === S.VISIBLE || s === S.NEEDS_ATTENTION || s === S.VISIBLE_HANDOFF
  ).length;
  const q = queueState || "ontrack";
  const highPressure = prevActive > 5 || ctx.timingPressure === "end-of-day" || q === "highdemand";
  const needsFocus = q === "needsfocus" || q === "highdemand";
  const queuesClear = q === "clear";
  const confirmedAt = checkConfirmedAt || {};

  // ShiftType filtering: suppress categories that don't match the shift posture
  const shiftType = setup.shiftType || "open-close";
  const suppressOpening = shiftType === "mid" || shiftType === "mid-close" || shiftType === "overnight";
  const suppressDeadline = shiftType === "open-mid";

  // Dynamic cap based on queue state
  let visibleCount = 0;
  const MAX_VISIBLE = needsFocus ? 5 : queuesClear ? 10 : 7;

  for (const rule of rules) {
    const prev = prevStates[rule.id];

    // User-confirmed states are sticky — EXCEPT checks that should resurface
    // when queue pressure has escalated since they were last confirmed.
    // Situation-aware: "waiters check" confirmed during calm → resurface when it gets busy.
    if (prev === S.CONFIRMED || prev === S.HANDLED_EARLY || prev === S.NOT_APPLICABLE) {
      const isCheck = isCheckItem(rule);
      const confirmedPressure = confirmedAt[rule.id];
      const pressureEscalated = isCheck && confirmedPressure !== undefined &&
        (PRESSURE_RANK[q] || 0) > (PRESSURE_RANK[confirmedPressure] || 0);

      if (pressureEscalated && prev !== S.NOT_APPLICABLE) {
        // Let this check fall through to normal window evaluation — it will resurface if still in-window
      } else {
        result[rule.id] = prev;
        continue;
      }
    }
    // Needs-attention is sticky until user resolves (always counts, no cap)
    if (prev === S.NEEDS_ATTENTION) {
      result[rule.id] = S.NEEDS_ATTENTION;
      visibleCount++;
      continue;
    }

    // ShiftType suppression (compliance items always surface regardless of shift type)
    if (suppressOpening && rule.category === "opening" && !isComplianceItem(rule)) {
      result[rule.id] = S.HIDDEN;
      continue;
    }
    if (suppressDeadline && (rule.category === "deadline" || rule.category === "exit") && !isComplianceItem(rule)) {
      result[rule.id] = S.HIDDEN;
      continue;
    }

    const win = resolveWindow(rule, setup);
    const inWin = isTimeInRange(ctx.currentMin, win.start, win.end);

    // Get Ahead: suppress under pressure or when queues need focus
    // but PROMOTE when queues are clear (show even if not in window yet)
    if (rule.category === "getahead") {
      if (highPressure || needsFocus) {
        result[rule.id] = S.HIDDEN;
        continue;
      }
    }

    // High demand: suppress low-risk items entirely
    if (q === "highdemand" && rule.riskWeight === "low") {
      result[rule.id] = S.HIDDEN;
      continue;
    }

    // Needs focus: suppress low-risk non-compliance items that aren't already visible
    if (!isComplianceItem(rule) && q === "needsfocus" && rule.riskWeight === "low" && prev !== S.VISIBLE && prev !== S.VISIBLE_HANDOFF) {
      result[rule.id] = S.HIDDEN;
      continue;
    }

    // Exit items: only in exit window
    if (rule.category === "exit" && !ctx.exitWindow) {
      result[rule.id] = S.HIDDEN;
      continue;
    }

    if (inWin) {
      // Hard cap: don't surface more than MAX_VISIBLE low-risk items (high-risk + compliance exempt)
      if (visibleCount >= MAX_VISIBLE && rule.riskWeight === "low" && !isComplianceItem(rule)) {
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
function getPacingLine(ctx, visibleCount, coverageMode, queueState, coveredCount, totalActionable, taskCount, checkCount) {
  if (!ctx) return "";
  const mode = coverageMode || "solo";
  const q = queueState || "ontrack";
  const c = coveredCount || 0;
  const total = totalActionable || 1;
  const pct = total > 0 ? c / total : 0;
  const tasks = taskCount || 0;
  const checks = checkCount || 0;

  // High demand override — protective
  if (q === "highdemand") {
    if (visibleCount === 0) return "High demand. Focus on one patient at a time.";
    return "High demand. Showing only what's essential.";
  }

  // Milestone checks — these feel good
  if (c > 0 && visibleCount <= 3) {
    if (pct >= 0.75 && visibleCount > 0) return `Home stretch — ${visibleCount} left.`;
    if (pct >= 0.5 && pct < 0.75 && visibleCount > 0) return `Past the halfway mark. ${visibleCount} on the board.`;
  }

  if (visibleCount === 0) {
    if (c >= 10) return `Board clear — ${c} handled this shift.`;
    if (c >= 5) return `${c} covered. Nothing left right now.`;
    if (c > 0 && pct >= 0.75) return `Nearly everything handled. Nice shift.`;
    if (c > 0) return `${c} down. Clear board.`;
    if (ctx.timingPressure === "early") return "Settling in. Nothing pressing yet.";
    if (ctx.exitWindow) return "Almost done. Nothing left to surface.";
    if (ctx.timingPressure === "end-of-day") return "Wrapping up. Nothing left to surface.";
    if (ctx.timingPressure === "tightening") return "Window is tightening, but you're clear.";
    if (q === "clear") return "All clear. Good time for conversations or getting ahead.";
    return "Nothing pressing right now. Steady window.";
  }
  if (visibleCount === 1) {
    if (c > 0) return `${c} covered. One more worth attention.`;
    if (checks === 1) return "One quick check.";
    if (ctx.exitWindow) return "One thing worth mentioning before you go.";
    if (mode === "overlap") return "One thing worth aligning on.";
    return "One thing worth attention right now.";
  }
  if (visibleCount <= 3) {
    if (c >= 5) return `${c} down, ${visibleCount} to go.`;
    if (c > 0) return `Rolling — ${visibleCount} left right now.`;
    if (ctx.exitWindow) return `${visibleCount} things to check before you go.`;
    if (q === "needsfocus") return `${visibleCount} items. Let's protect the rest of the day.`;
    if (tasks > 0 && checks > 0) return `${tasks} task${tasks > 1 ? "s" : ""}, ${checks} quick check${checks > 1 ? "s" : ""}.`;
    if (checks === visibleCount) return `${checks} quick check${checks > 1 ? "s" : ""}.`;
    return `${visibleCount} things worth attention right now.`;
  }
  if (visibleCount <= 5) {
    if (c > 0) return `${c} covered, ${visibleCount} on the board.`;
    if (ctx.timingPressure === "tightening") return `${visibleCount} items — window is tightening.`;
    if (tasks > 0 && checks > 0) return `${tasks} task${tasks > 1 ? "s" : ""} and ${checks} check${checks > 1 ? "s" : ""} on the board.`;
    return `${visibleCount} items on the board.`;
  }
  if (c > 0) return `${c} covered. Busy board — showing what matters most.`;
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
    amber: "#E3A832",
    amberDim: "rgba(210,153,34,0.12)",
    compliance: "#DA8B96",
    complianceDim: "rgba(201,114,126,0.12)",
    danger: "#F85149",
    dangerDim: "rgba(248,81,73,0.12)",
    mutedBg: "rgba(139,148,158,0.08)",
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
    compliance: "#A8505C",
    complianceDim: "rgba(168,80,92,0.1)",
    danger: "#CF222E",
    dangerDim: "rgba(207,34,46,0.1)",
    mutedBg: "rgba(92,99,112,0.08)",
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

// ─── SHARED ITEM HELPERS ───
const isComplianceItem = (r) => (r.itemType || "task") === "compliance";
const isCheckItem = (r) => (r.itemType || "task") === "check";
const getDotColor = (r, isComp) => isComp ? MF.compliance : r.riskWeight === "high" ? MF.amber : r.riskWeight === "medium" ? MF.secondary : MF.border;

const ExpandChevron = ({ isOpen }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MF.textMuted} strokeWidth="2" strokeLinecap="round" style={{
    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform 0.2s ease", opacity: 0.4, flexShrink: 0,
  }}><polyline points="6 9 12 15 18 9"/></svg>
);

const RequiredBadge = () => (
  <span style={{
    fontSize: "9px", fontWeight: 700, letterSpacing: "0.05em",
    color: MF.compliance, padding: "2px 6px", borderRadius: "4px",
    border: `1px solid ${MF.compliance}40`, background: MF.complianceDim,
  }}>REQ</span>
);

const getStillOpenItems = (rules, itemStates, setup, ctx) => rules.filter((r) => {
  if (r.category === "getahead") return false;
  if ([S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])) return false;
  if ([S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])) return false;
  if (itemStates[r.id] !== S.HIDDEN) return false;
  const win = resolveWindow(r, setup);
  if (win.end >= win.start) return ctx.currentMin > win.end;
  return ctx.currentMin > win.end && ctx.currentMin < win.start;
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
let selectIdCounter = 0;
function SelectField({ label, value, onChange, options, style: extraStyle }) {
  const [selectId] = useState(() => `select-${++selectIdCounter}`);
  return (
    <div style={{ marginBottom: "20px", ...extraStyle }}>
      <label htmlFor={selectId} style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select
          id={selectId}
          style={{ width: "100%", background: MF.card, color: MF.text, border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm, padding: "12px 40px 12px 14px", fontSize: "15px", fontFamily: MF.font, appearance: "none", cursor: "pointer" }}
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
      letterSpacing: "0.06em", marginBottom: "8px", marginTop: "12px",
    }}>
      {children}
    </div>
  );
}

// Empty / quiet state
function QuietState({ message, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "16px 24px", color: MF.textMuted }}>
      <div style={{ fontSize: "13px", lineHeight: 1.5 }}>{message}</div>
      {sub && <div style={{ fontSize: "12px", marginTop: "2px", opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}

// Slide-out info panel with expandable sections
function InfoPanel({ show, onClose }) {
  const [expanded, setExpanded] = useState(null);
  const toggle = (key) => setExpanded((prev) => prev === key ? null : key);

  useEffect(() => {
    if (!show) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [show, onClose]);

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
        <Line label="Engine" value="Surfaces what matters now — time, progress, what's handled" />
        <Line label="Output" value="Right task, right moment" />
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
        <Line label="Skip for today" value="Dismisses cleanly" />
      </>
    )},
    { key: "leader", title: "For leadership", icon: "◆", render: () => (
      <>
        <Bullet>Keeps immunizations visible as a daily priority</Bullet>
        <Bullet>Helps staff stay organized without adding oversight</Bullet>
        <Bullet>Adapts to busy days — quieter when it counts</Bullet>
        <Bullet>Nothing tracked, reported, or stored</Bullet>
        <Bullet>Easy to pilot — no setup, no rollout risk</Bullet>
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
    <div role="dialog" aria-modal="true" aria-label="About RxTempo" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={onClose} aria-hidden="true" style={{
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
          <button aria-label="Close" onClick={onClose} style={{
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
                aria-expanded={expanded === s.key}
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
  const [overlapWindows, setOverlapWindows] = useState([{ id: 1, start: toMin(12, 0), end: toMin(17, 0) }]);
  const nextWindowId = useRef(2);
  const [dayNotes, setDayNotes] = useState([{ id: 1, text: "" }]);
  const nextNoteId = useRef(2);
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
    dayNotes: dayNotes.map((n) => n.text.trim()).filter(Boolean),
    expectedEvents: {
      warehouse: hasWarehouse === "yes",
      ov: hasOV === "yes",
      usps: hasUSPS === "yes",
    },
    immTarget: +immTarget,
    guidance,
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

        {(() => {
          const couriers = [
            ...(hasOV === "yes" ? ["Outside vendor (OV)"] : []),
            ...(hasUSPS === "yes" ? ["Postal service"] : []),
          ];
          const events = [
            ...(hasWarehouse === "yes" ? ["Warehouse delivery"] : []),
          ];
          const trimmedNotes = dayNotes.filter((n) => n.text.trim());
          const rows = [
            ["Role", ROLE_LABELS[role]],
            ["Shift type", SHIFT_TYPE_LABELS[shiftType]],
            ["Your shift", `${fmtTime12(+shiftStart)} — ${fmtTime12(+shiftEnd)}`],
            ["Pharmacy", is24hrToggle ? "24 hours" : `${fmtTime12(+storeOpen)} — ${fmtTime12(+storeClose)}`],
            ["Coverage", hasOverlap === "yes" ? overlapWindows.map((w, i) => `${fmtTime12(+w.start)} — ${fmtTime12(+w.end)}`).join(", ") : "Solo today"],
            ...(couriers.length > 0 ? [["Routine couriers", couriers.join(", ")]] : []),
            ...(events.length > 0 ? [["Events", events.join(", ")]] : []),
            ...(+immTarget > 0 ? [["Immunization target", immTarget]] : []),
            ["Guidance preference", guidance === "minimal" ? "Minimal" : guidance === "full" ? "Full" : guidance === "more" ? "Supportive" : "Balanced"],
            ...(trimmedNotes.length > 0 ? [["Notes", trimmedNotes.join(" · ")]] : []),
          ];

          return (
            <div style={{ background: MF.card, border: `1px solid ${MF.border}`, borderRadius: MF.radius, padding: "16px", marginBottom: "16px" }}>
              {rows.map(([label, val], i) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < rows.length - 1 ? `1px solid ${MF.border}` : "none", gap: "12px" }}>
                  <span style={{ fontSize: "13px", color: MF.textMuted, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, textAlign: "right" }}>{val}</span>
                </div>
              ))}
            </div>
          );
        })()}

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
  useEffect(() => {
    if (shiftValid && !validTypes.find((t) => t.value === shiftType)) {
      const inferred = inferShiftType(shiftStart, shiftEnd, storeOpen, storeClose);
      if (inferred !== shiftType) setShiftType(inferred);
    }
  }, [shiftValid, shiftType, shiftStart, shiftEnd, storeOpen, storeClose]);

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
            {step === "form1" ? "Let's get your shift set up." :
             step === "form2" ? "Who else is working and what's coming in." :
             "A few optional things to dial in."}
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
                fontSize: "12px", color: overnightWithout24hr ? MF.danger : MF.amber,
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
              aria-disabled={!shiftValid}
              onClick={() => shiftValid && setStep("form2")}
            >
              Next
            </button>
          </>
        )}

        {step === "form2" && (
          <>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "10px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Another pharmacist overlapping?
              </label>
              <button
                onClick={() => setHasOverlap(hasOverlap === "yes" ? "no" : "yes")}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: MF.radiusSm,
                  border: `1px solid ${hasOverlap === "yes" ? MF.accent : MF.border}`,
                  background: hasOverlap === "yes" ? MF.accentDim : MF.card,
                  cursor: "pointer", fontFamily: MF.font, transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "15px", fontWeight: 500, color: MF.text }}>
                  {hasOverlap === "yes" ? "Yes — overlap window" : "Solo today"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", color: MF.textMuted, opacity: 0.5 }}>tap to change</span>
                  <span style={{
                    fontSize: "12px", fontWeight: 700, minWidth: "38px", textAlign: "center",
                    color: hasOverlap === "yes" ? MF.accent : MF.textMuted,
                    padding: "3px 10px", borderRadius: "4px",
                    border: `1px solid ${hasOverlap === "yes" ? MF.accent : MF.border}`,
                    background: hasOverlap === "yes" ? MF.accentDim : "transparent",
                    transition: "all 0.15s ease",
                  }}>
                    {hasOverlap === "yes" ? "YES" : "NO"}
                  </span>
                </div>
              </button>
            </div>
            {hasOverlap === "yes" && (() => {
              // Constrain overlap times to within the shift (± a small buffer)
              const overlapTimeOptions = TIME_OPTIONS.filter((opt) => {
                const v = +opt.value;
                const s = +shiftStart, e = +shiftEnd;
                if (e >= s) return v >= s && v <= e;
                return v >= s || v <= e; // overnight
              });
              const updateWindow = (idx, field, val) => {
                setOverlapWindows((prev) => prev.map((w, i) => {
                  if (i !== idx) return w;
                  const updated = { ...w, [field]: val };
                  // Auto-swap if start > end (non-overnight shifts)
                  const s = +shiftStart, e = +shiftEnd;
                  if (e >= s && +updated.start > +updated.end) {
                    return { start: updated.end, end: updated.start };
                  }
                  return updated;
                }));
              };
              const addWindow = () => {
                const s = +shiftStart, e = +shiftEnd;
                const isOvernight = e < s;
                // Default start: 2hrs into shift (clamped to shift bounds)
                let wStart = s + 120;
                if (!isOvernight && wStart >= e) wStart = Math.max(s, e - 60);
                if (isOvernight) wStart = wStart % 1440;
                setOverlapWindows((prev) => [...prev, { id: nextWindowId.current++, start: wStart, end: e }]);
              };
              const removeWindow = (idx) => {
                setOverlapWindows((prev) => prev.filter((_, i) => i !== idx));
              };
              return (
                <div style={{ marginBottom: "16px" }}>
                  {overlapWindows.map((w, idx) => (
                    <div key={w.id} style={{
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
            {/* Expecting today — toggle rows */}
            {(() => {
              const ToggleRow = ({ label, value, onChange, defaultExpected }) => {
                const isOn = value === "yes";
                const handleTap = () => {
                  // If turning off something expected for this day, confirm first
                  if (isOn && defaultExpected) {
                    setConfirmToggle({ key: label, label, setter: () => onChange("no") });
                  } else {
                    onChange(isOn ? "no" : "yes");
                  }
                };
                return (
                  <button
                    onClick={handleTap}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: MF.radiusSm,
                      border: `1px solid ${isOn ? MF.accent : MF.border}`,
                      background: isOn ? MF.accentDim : MF.card,
                      cursor: "pointer", fontFamily: MF.font,
                      marginBottom: "6px", transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "15px", fontWeight: 500, color: MF.text }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: MF.textMuted, opacity: 0.5 }}>tap to change</span>
                      <span style={{
                        fontSize: "12px", fontWeight: 700, minWidth: "38px", textAlign: "center",
                        color: isOn ? MF.accent : MF.textMuted,
                        padding: "3px 10px", borderRadius: "4px",
                        border: `1px solid ${isOn ? MF.accent : MF.border}`,
                        background: isOn ? MF.accentDim : "transparent",
                        transition: "all 0.15s ease",
                      }}>
                        {isOn ? "YES" : "NO"}
                      </span>
                    </div>
                  </button>
                );
              };

              return (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "4px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Expecting today
                  </label>
                  <div style={{ fontSize: "11px", color: MF.textMuted, opacity: 0.6, marginBottom: "10px" }}>
                    Defaults for <span style={{ fontWeight: 700, color: MF.text, opacity: 1 }}>{dayName}</span>. Tap to change if today is different.
                  </div>
                  <ToggleRow label="Outside vendor (OV)" value={hasOV} onChange={setHasOV} defaultExpected={ovExpected} />
                  <ToggleRow label="Postal service" value={hasUSPS} onChange={setHasUSPS} defaultExpected={uspsExpected} />
                  <ToggleRow label="Warehouse delivery" value={hasWarehouse} onChange={setHasWarehouse} defaultExpected={false} />
                </div>
              );
            })()}

            {/* Confirmation dialog — turning off expected event */}
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
                      confirmToggle.setter();
                      setConfirmToggle(null);
                    }}
                    style={{ ...btn(MF.amber, MF.amberDim), flex: 1, padding: "10px", textAlign: "center" }}
                  >
                    Yes, turn off
                  </button>
                  <button
                    onClick={() => setConfirmToggle(null)}
                    style={{ ...btn(MF.textMuted, MF.mutedBg), flex: 1, padding: "10px", textAlign: "center" }}
                  >
                    Keep it on
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{ ...btn(MF.textMuted, MF.mutedBg), flex: 1, padding: "14px", textAlign: "center" }}
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
                  border: `1px solid ${immZero ? MF.danger : immTooLow && !immLowConfirmed ? MF.amber : MF.border}`,
                  borderRadius: MF.radiusSm,
                  padding: "12px 14px", fontSize: "15px", fontFamily: MF.font,
                }}
              />
              {immZero && (
                <div style={{ fontSize: "12px", color: MF.danger, marginTop: "6px", lineHeight: 1.5 }}>
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
                    That's a low target. If it reflects your volume, that's fine — confirm below.
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
              { value: "minimal", label: "Minimal — just the essentials" },
              { value: "balanced", label: "Balanced — recommended" },
              { value: "more", label: "Supportive — encouragement + nudges" },
              { value: "full", label: "Full — contextual tips + shift summary" },
            ]} />

            {/* Notes — optional, up to 5 */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: MF.textMuted, marginBottom: "8px", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Notes for today <span style={{ opacity: 0.5, fontWeight: 400, textTransform: "none" }}>(optional)</span>
              </label>
              {dayNotes.map((note, idx) => (
                <div key={note.id} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input
                    type="text"
                    value={note.text}
                    onChange={(e) => {
                      const updated = [...dayNotes];
                      updated[idx] = { ...updated[idx], text: e.target.value };
                      setDayNotes(updated);
                    }}
                    placeholder={idx === 0 ? "e.g. Supervisor visit at 11am, Call at 1pm..." : "Another note..."}
                    maxLength={120}
                    style={{
                      flex: 1, background: MF.card, color: MF.text,
                      border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm,
                      padding: "12px 14px", fontSize: "15px", fontFamily: MF.font,
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
                  onClick={() => setDayNotes([...dayNotes, { id: nextNoteId.current++, text: "" }])}
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
                style={{ ...btn(MF.textMuted, MF.mutedBg), flex: 1, padding: "14px", textAlign: "center" }}
                onClick={() => setStep("form2")}
              >Back</button>
              <button
                style={{
                  background: canProceed ? MF.gradient : MF.border,
                  color: canProceed ? "#fff" : MF.textMuted,
                  border: "none", borderRadius: MF.radiusSm, padding: "14px 24px",
                  fontSize: "15px", fontWeight: 600, fontFamily: MF.font,
                  cursor: canProceed ? "pointer" : "not-allowed",
                  flex: 2, letterSpacing: "-0.01em",
                  opacity: canProceed ? 1 : 0.5,
                }}
                aria-disabled={!canProceed}
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
function HomeScreen({ rules, itemStates, ctx, setup, onAction, onNav, eventArrivals, onEventArrival, queueState, onQueueState, vaccineCount, onVaccine, dayNoteStates, onDayNoteState, dayNoteConfirm, onDayNoteConfirm, checkConfirmedAt }) {
  const [immExpanded, setImmExpanded] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [showStillOpen, setShowStillOpen] = useState(false);
  const [showCovered, setShowCovered] = useState(false);
  const [showAllVisible, setShowAllVisible] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(null);
  const [confirmTimestamps, setConfirmTimestamps] = useState([]);
  const [confirmSkipCompliance, setConfirmSkipCompliance] = useState(null); // ruleId being skip-confirmed
  const confirmTimerRef = useRef(null);

  const WEIGHT_RANK = { high: 0, medium: 1, low: 2 };
  const MAX_SHOWN = 4;

  const isPIC = setup.role === "pharmacist-manager";
  const TYPE_RANK = { compliance: 0, task: 1, check: 2 };
  const visible = rules.filter((r) =>
    [S.VISIBLE, S.NEEDS_ATTENTION, S.VISIBLE_HANDOFF].includes(itemStates[r.id])
  ).sort((a, b) => {
    // Needs attention first
    const aAttn = itemStates[a.id] === S.NEEDS_ATTENTION ? 0 : 1;
    const bAttn = itemStates[b.id] === S.NEEDS_ATTENTION ? 0 : 1;
    if (aAttn !== bAttn) return aAttn - bAttn;
    // PIC/PM: compliance items float to top (accountability)
    if (isPIC) {
      const aType = (TYPE_RANK[a.itemType] ?? 1);
      const bType = (TYPE_RANK[b.itemType] ?? 1);
      if (aType !== bType) return aType - bType;
    }
    // Then by risk weight
    return (WEIGHT_RANK[a.riskWeight] || 2) - (WEIGHT_RANK[b.riskWeight] || 2);
  });
  const confirmed = rules.filter((r) =>
    [S.CONFIRMED, S.HANDLED_EARLY].includes(itemStates[r.id])
  );

  // Total actionable items (not get-ahead, not shift-suppressed)
  const shiftType = setup.shiftType || "open-close";
  const suppressOpening = shiftType === "mid" || shiftType === "mid-close" || shiftType === "overnight";
  const suppressDeadline = shiftType === "open-mid";
  const totalActionable = rules.filter((r) => {
    if (r.category === "getahead") return false;
    if (suppressOpening && r.category === "opening") return false;
    if (suppressDeadline && (r.category === "deadline" || r.category === "exit")) return false;
    return true;
  }).length;
  const coveredCount = confirmed.length;
  const completionPct = totalActionable > 0 ? (coveredCount / totalActionable) * 100 : 0;

  const isFirstConfirm = coveredCount === 0;
  const guidanceLevel = setup.guidance || "balanced";
  const showEncouragement = guidanceLevel === "more" || guidanceLevel === "full";
  const showSummary = guidanceLevel === "full";

  // Streak detection — 3+ confirms within 15 minutes
  const recentConfirms = confirmTimestamps.filter((t) => Date.now() - t < 15 * 60 * 1000);
  const onAStreak = showEncouragement && recentConfirms.length >= 3;

  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); }, []);

  const handleConfirm = (ruleId) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setJustConfirmed(ruleId);
    const now = Date.now();
    setConfirmTimestamps((prev) => [...prev.filter((t) => now - t < 15 * 60 * 1000), now]);
    const flashDuration = isFirstConfirm ? 600 : 400;
    confirmTimerRef.current = setTimeout(() => {
      onAction(ruleId, S.CONFIRMED);
      setExpandedItem(null);
      setJustConfirmed(null);
      confirmTimerRef.current = null;
    }, flashDuration);
  };

  // Items whose window has passed without being actioned
  const stillOpen = getStillOpenItems(rules, itemStates, setup, ctx);

  const visibleTasks = visible.filter((r) => !isCheckItem(r)).length;
  const visibleChecks = visible.filter(isCheckItem).length;
  const pacingLine = getPacingLine(ctx, visible.length, ctx.coverageMode, queueState, coveredCount, totalActionable, visibleTasks, visibleChecks);
  const phaseLabel = getPhaseLabel(ctx);
  const highPressure = visible.length > 5 || queueState === "highdemand" || queueState === "needsfocus";

  return (
    <div style={{ padding: "12px 16px", animation: "fadeIn 0.2s ease" }}>
      {/* Phase header — compact single line */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "5px", display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{ fontWeight: 600, color: MF.accent }}>{phaseLabel}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{ROLE_LABELS[setup.role]}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{fmtTime12(ctx.currentMin)}</span>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <div style={{ flex: 1, height: "3px", background: MF.border, borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              width: `${ctx.shiftProgress * 100}%`, height: "100%",
              background: highPressure ? MF.amber : MF.gradient,
              borderRadius: "2px", transition: "width 1s ease",
            }} />
          </div>
          {coveredCount > 0 && (
            <div style={{ flex: 1, height: "3px", background: MF.border, borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                width: `${completionPct}%`, height: "100%",
                background: MF.green,
                borderRadius: "2px", transition: "width 0.6s ease",
              }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Workflow status — full-width segmented control ── */}
      {onQueueState && setup.guidance !== "minimal" && (
        <div style={{
          display: "flex", gap: "0",
          marginBottom: "10px",
          border: `1px solid ${MF.border}`,
          borderRadius: MF.radius,
          overflow: "hidden",
        }}>
          {[
            { key: "clear", label: "Queues clear", color: MF.green, bg: MF.greenDim },
            { key: "ontrack", label: "On track", color: MF.accent, bg: MF.accentDim },
            { key: "needsfocus", label: "Needs focus", color: MF.amber, bg: MF.amberDim },
            { key: "highdemand", label: "High demand", color: MF.amber, bg: MF.amberDim },
          ].map((q, i) => (
            <button
              key={q.key}
              onClick={() => onQueueState(q.key)}
              style={{
                flex: 1, padding: "8px 4px", fontSize: "11px", fontWeight: 600,
                fontFamily: MF.font, cursor: "pointer", transition: "all 0.15s ease",
                border: "none",
                borderRight: i < 3 ? `1px solid ${MF.border}` : "none",
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
                  <button style={btn(MF.textMuted, MF.mutedBg)} onClick={() => onDayNoteConfirm(null)}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                <button style={btn(MF.green, MF.greenDim)} onClick={() => onDayNoteState(idx, "happened")}>
                  Already happened
                </button>
                <button style={btn(MF.textMuted, MF.mutedBg)} onClick={() => onDayNoteConfirm(idx)}>
                  Dismiss
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Status line — pacing + pressure + streak (hidden for minimal guidance) */}
      {guidanceLevel !== "minimal" && <div style={{ fontSize: "13px", color: MF.text, fontWeight: 500, marginBottom: "8px", lineHeight: 1.4 }}>
        {onAStreak ? "On a roll." : pacingLine}
        {queueState === "highdemand" && (
          <span style={{ color: MF.amber, marginLeft: "6px", fontSize: "12px", fontWeight: 400 }}>· Optional items hidden</span>
        )}
        {queueState === "needsfocus" && (
          <span style={{ color: MF.amber, marginLeft: "6px", fontSize: "12px", fontWeight: 400 }}>· Low-priority items hidden</span>
        )}
        {queueState === "clear" && visible.length === 0 && coveredCount > 0 && (
          <span style={{ color: MF.green, marginLeft: "6px", fontSize: "12px", fontWeight: 400 }}>· Check Ahead tab</span>
        )}
      </div>}

      {/* Shift summary — appears in closing phase with full guidance */}
      {showSummary && ctx.shiftProgress >= 0.85 && coveredCount > 0 && (() => {
        const skipped = rules.filter((r) => itemStates[r.id] === S.NOT_APPLICABLE).length;
        return (
          <div style={{
            display: "flex", gap: "12px", justifyContent: "space-around",
            padding: "10px 0", marginBottom: "8px",
            borderTop: `1px solid ${MF.border}`, borderBottom: `1px solid ${MF.border}`,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "18px", fontWeight: 700, color: MF.green }}>{coveredCount}</div>
              <div style={{ fontSize: "10px", color: MF.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>covered</div>
            </div>
            {visible.length > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 700, color: MF.accent }}>{visible.length}</div>
                <div style={{ fontSize: "10px", color: MF.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>active</div>
              </div>
            )}
            {skipped > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 700, color: MF.textMuted }}>{skipped}</div>
                <div style={{ fontSize: "10px", color: MF.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>skipped</div>
              </div>
            )}
            {vaccineCount > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 700, color: vaccineCount >= (setup.immTarget || 0) ? MF.green : MF.accent }}>{vaccineCount}</div>
                <div style={{ fontSize: "10px", color: MF.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>vaccines</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Visible items — checks (quick) and tasks (expandable) */}
      {visible.length > 0 && (() => {
        const shown = showAllVisible ? visible : visible.slice(0, MAX_SHOWN);
        const hiddenCount = visible.length - MAX_SHOWN;
        return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {shown.map((r) => {
            const isCheck = isCheckItem(r);
            const isOpen = expandedItem === r.id;
            const st = itemStates[r.id];
            const isAttention = st === S.NEEDS_ATTENTION;
            const isHandoff = st === S.VISIBLE_HANDOFF;
            const isEscalated = isAttention && r.riskWeight === "high" &&
              (ctx.timingPressure === "tightening" || ctx.timingPressure === "end-of-day");
            const dotColor = getDotColor(r, false);
            const isConfirming = justConfirmed === r.id;
            // Resurfaced check: was confirmed earlier but pressure escalated
            const resurfaced = isCheck && checkConfirmedAt && checkConfirmedAt[r.id] !== undefined;

            // ── CHECK ROW: compact, inline confirm, no expand ──
            if (isCheck && !isAttention) {
              return (
                <div key={r.id} style={{
                  background: isConfirming ? MF.greenDim : MF.card,
                  border: `1px solid ${isConfirming ? MF.green + "60" : MF.border}`,
                  transition: "background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, opacity 0.3s ease",
                  transform: isConfirming ? "scale(0.98)" : "scale(1)",
                  opacity: isConfirming ? 0.85 : 1,
                  borderRadius: MF.radiusSm,
                  animation: "slideUp 0.25s ease both",
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 12px",
                }}>
                  <div style={{
                    width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                    background: isConfirming ? MF.green : dotColor, opacity: 0.6,
                    transition: "background 0.2s ease",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "13px", fontWeight: 500,
                      color: isConfirming ? MF.green : MF.text,
                      transition: "color 0.2s ease",
                    }}>
                      {isConfirming ? "Done" : r.label}
                    </div>
                    {!isConfirming && (
                      <div style={{ fontSize: "10px", color: resurfaced ? MF.amber : MF.textMuted, opacity: resurfaced ? 0.8 : 0.6, marginTop: "1px" }}>
                        {resurfaced ? "Things picked up — worth another look" : r.roleContext}
                      </div>
                    )}
                  </div>
                  {!isConfirming && (
                    <button
                      onClick={() => handleConfirm(r.id)}
                      style={{
                        background: MF.greenDim, color: MF.green, border: "none",
                        borderRadius: "12px", padding: "4px 10px",
                        fontSize: "11px", fontWeight: 600, fontFamily: MF.font,
                        cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                      }}
                    >
                      {I.check} Done
                    </button>
                  )}
                </div>
              );
            }

            // ── COMPLIANCE ROW: required items, friction on skip ──
            const isCompliance = isComplianceItem(r);
            if (isCompliance) {
              const isOpen = expandedItem === r.id;
              const isSkipConfirming = confirmSkipCompliance === r.id;
              return (
                <div key={r.id} style={{
                  background: isConfirming ? MF.greenDim : MF.card,
                  border: `1px solid ${isConfirming ? MF.green + "60" : MF.compliance + "40"}`,
                  borderLeft: `3px solid ${isConfirming ? MF.green : MF.compliance}`,
                  transition: "background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, opacity 0.3s ease",
                  transform: isConfirming ? "scale(0.98)" : "scale(1)",
                  opacity: isConfirming ? 0.85 : 1,
                  borderRadius: MF.radius,
                  overflow: "hidden",
                  animation: "slideUp 0.25s ease both",
                }}>
                  <button
                    aria-expanded={isOpen}
                    onClick={() => setExpandedItem(isOpen ? null : r.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "10px 12px", background: "none", border: "none",
                      cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: "8px", height: "8px", borderRadius: "2px", flexShrink: 0,
                      background: isConfirming ? MF.green : MF.compliance,
                      transition: "background 0.2s ease",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em",
                        color: isConfirming ? MF.green : MF.text,
                        transition: "color 0.2s ease",
                      }}>
                        {isConfirming ? "Done" : r.label}
                      </div>
                      {!isConfirming && (
                        <div style={{ fontSize: "11px", color: MF.compliance, marginTop: "1px", lineHeight: 1.3, fontWeight: 500 }}>
                          Required — {r.roleContext.charAt(0).toLowerCase() + r.roleContext.slice(1)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      <RequiredBadge />
                      <ExpandChevron isOpen={isOpen} />
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "0 16px 14px", animation: "fadeIn 0.15s ease" }}>
                      <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.6, marginBottom: "12px" }}>
                        {r.description}
                      </div>
                      {isSkipConfirming ? (
                        <div style={{
                          background: MF.complianceDim, border: `1px solid ${MF.compliance}30`,
                          borderRadius: MF.radiusSm, padding: "10px 14px", marginBottom: "8px",
                        }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: MF.compliance, marginBottom: "8px" }}>
                            This is a compliance requirement. Are you sure?
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              style={btn(MF.compliance, MF.complianceDim)}
                              onClick={() => { onAction(r.id, S.NOT_APPLICABLE); setExpandedItem(null); setConfirmSkipCompliance(null); }}
                            >
                              Yes, skip today
                            </button>
                            <button
                              style={btn(MF.textMuted, MF.mutedBg)}
                              onClick={() => setConfirmSkipCompliance(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          <button style={btn(MF.green, MF.greenDim)} onClick={() => handleConfirm(r.id)}>
                            Looks done
                          </button>
                          <button style={btn(MF.amber, MF.amberDim)} onClick={() => { onAction(r.id, S.NEEDS_ATTENTION); setExpandedItem(null); }}>
                            Still needs attention
                          </button>
                          <button style={btn(MF.textMuted, MF.mutedBg)} onClick={() => setConfirmSkipCompliance(r.id)}>
                            Skip for today
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // ── TASK ROW: full expandable treatment ──
            let leftBorder = MF.border;
            if (isEscalated || isAttention) leftBorder = MF.amber;
            else if (isHandoff) leftBorder = MF.accentMid;

            return (
              <div key={r.id} style={{
                background: isConfirming ? MF.greenDim : isEscalated ? MF.amberDim : MF.card,
                border: `1px solid ${isConfirming ? MF.green + "60" : isEscalated ? MF.amber + "4D" : MF.border}`,
                borderLeft: `3px solid ${isConfirming ? MF.green : leftBorder}`,
                transition: "background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, opacity 0.3s ease",
                transform: isConfirming ? "scale(0.98)" : "scale(1)",
                opacity: isConfirming ? 0.85 : 1,
                borderRadius: MF.radius,
                overflow: "hidden",
                animation: "slideUp 0.25s ease both",
              }}>
                {/* Compact row — always visible */}
                <button
                  aria-expanded={isOpen}
                  onClick={() => setExpandedItem(isOpen ? null : r.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", background: "none", border: "none",
                    cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                  }}
                >
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                    background: isConfirming ? MF.green : dotColor,
                    transition: "background 0.2s ease",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em",
                      color: isConfirming ? MF.green : MF.text,
                      transition: "color 0.2s ease",
                    }}>
                      {isConfirming ? "Done" : r.label}
                    </div>
                    {!isConfirming && (
                    <div style={{ fontSize: "11px", color: MF.textMuted, marginTop: "1px", lineHeight: 1.3 }}>
                      {r.roleContext}
                    </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {isHandoff && <span style={badge(MF.accent, MF.accentDim)}>Handoff</span>}
                    {isAttention && !isEscalated && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: MF.amber }} />}
                    <ExpandChevron isOpen={isOpen} />
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "0 16px 14px", animation: "fadeIn 0.15s ease" }}>
                    <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.6, marginBottom: showEncouragement ? "6px" : "12px" }}>
                      {r.description}
                    </div>
                    {showEncouragement && (() => {
                      const tip = r.riskWeight === "low" && ctx.timingPressure !== "tightening" ? "Quick one." :
                        r.riskWeight === "high" && ctx.timingPressure === "tightening" ? "Worth prioritizing." :
                        ctx.timingPressure === "early" && r.riskWeight !== "high" ? "Good one to knock out early." :
                        coveredCount > 0 && visible.length <= 2 ? "Almost there." :
                        null;
                      if (!tip) return null;
                      return <div style={{ fontSize: "11px", color: MF.accent, marginBottom: "10px", fontStyle: "italic" }}>{tip}</div>;
                    })()}
                    {isEscalated && (
                      <span style={{ ...badge(MF.amber, MF.amberDim), display: "inline-block", marginBottom: "10px" }}>
                        Entering a tighter window
                      </span>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      <button style={btn(MF.green, MF.greenDim)} onClick={() => handleConfirm(r.id)}>
                        Looks done
                      </button>
                      <button style={btn(MF.amber, MF.amberDim)} onClick={() => { onAction(r.id, S.NEEDS_ATTENTION); setExpandedItem(null); }}>
                        Still needs attention
                      </button>
                      <button style={btn(MF.textMuted, MF.mutedBg)} onClick={() => { onAction(r.id, S.NOT_APPLICABLE); setExpandedItem(null); }}>
                        Skip for today
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!showAllVisible && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllVisible(true)}
              style={{
                width: "100%", padding: "10px", marginTop: "2px",
                fontSize: "12px", fontWeight: 600, color: MF.textMuted,
                background: "transparent", border: `1px dashed ${MF.border}`,
                borderRadius: MF.radiusSm, cursor: "pointer", fontFamily: MF.font,
              }}
            >
              {hiddenCount} more items
            </button>
          )}
          {showAllVisible && visible.length > MAX_SHOWN && (
            <button
              onClick={() => setShowAllVisible(false)}
              style={{
                width: "100%", padding: "8px", marginTop: "2px",
                fontSize: "11px", color: MF.textMuted, opacity: 0.6,
                background: "transparent", border: "none",
                cursor: "pointer", fontFamily: MF.font,
              }}
            >
              Show less
            </button>
          )}
        </div>
        );
      })()}

      {/* Summary chips */}
      {(() => {
        const laterCount = onNav ? rules.filter((r) => {
          if ([S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])) return false;
          if (r.category === "getahead") return false;
          if ([S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])) return false;
          if (itemStates[r.id] !== S.HIDDEN) return false;
          const win = resolveWindow(r, setup);
          return win.start > ctx.currentMin;
        }).length : 0;
        const skipped = rules.filter((r) => itemStates[r.id] === S.NOT_APPLICABLE).length;
        const hasChips = laterCount > 0 || stillOpen.length > 0 || confirmed.length > 0;
        if (!hasChips) return null;

        return (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px",
          }}>
            {laterCount > 0 && (
              <button onClick={() => onNav("later")} style={{
                padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                fontFamily: MF.font, cursor: "pointer", transition: "all 0.15s ease",
                border: `1px solid ${MF.border}`, background: "transparent", color: MF.textMuted,
              }}>
                {laterCount} later
              </button>
            )}
            {stillOpen.length > 0 && (
              <button onClick={() => setShowStillOpen(!showStillOpen)} style={{
                padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                fontFamily: MF.font, cursor: "pointer", transition: "all 0.15s ease",
                border: `1px solid ${showStillOpen ? MF.amber + "60" : MF.amber + "40"}`,
                background: showStillOpen ? MF.amberDim : "transparent",
                color: MF.amber,
              }}>
                {stillOpen.length} remaining
              </button>
            )}
            {confirmed.length > 0 && (
              <button onClick={() => setShowCovered(!showCovered)} style={{
                padding: "7px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                fontFamily: MF.font, cursor: "pointer", transition: "all 0.15s ease",
                border: `1px solid ${showCovered ? MF.green + "60" : MF.border}`,
                background: showCovered ? MF.greenDim : "transparent",
                color: showCovered ? MF.green : MF.textMuted,
              }}>
                {confirmed.length} covered
              </button>
            )}
          </div>
        );
      })()}

      {/* Still open — expanded from chip, compact expandable rows */}
      {showStillOpen && stillOpen.length > 0 && (
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px", animation: "fadeIn 0.15s ease" }}>
          {stillOpen.map((r) => {
            const isOpen = expandedItem === `still-${r.id}`;
            const isComp = isComplianceItem(r);
            const isSkipConfirming = confirmSkipCompliance === `still-${r.id}`;
            const dotColor = getDotColor(r, false);
            return (
              <div key={r.id} style={{
                background: MF.card,
                border: `1px solid ${isComp ? MF.compliance + "40" : MF.border}`,
                borderLeft: `3px solid ${isComp ? MF.compliance : MF.amber}`,
                borderRadius: MF.radius, overflow: "hidden",
              }}>
                <button
                  aria-expanded={isOpen}
                  onClick={() => setExpandedItem(isOpen ? null : `still-${r.id}`)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", background: "none", border: "none",
                    cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                  }}
                >
                  <div style={{ width: "8px", height: "8px", borderRadius: isComp ? "2px" : "50%", flexShrink: 0, background: isComp ? MF.compliance : dotColor }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: MF.text }}>{r.label}</div>
                    <div style={{ fontSize: "11px", color: isComp ? MF.compliance : MF.textMuted, marginTop: "1px", lineHeight: 1.3, fontWeight: isComp ? 500 : 400 }}>
                      {isComp ? `Required — ${r.roleContext.charAt(0).toLowerCase() + r.roleContext.slice(1)}` : r.roleContext}
                    </div>
                  </div>
                  {isComp && <RequiredBadge />}
                  <ExpandChevron isOpen={isOpen} />
                </button>
                {isOpen && (
                  <div style={{ padding: "0 16px 14px", animation: "fadeIn 0.15s ease" }}>
                    <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.6, marginBottom: "12px" }}>{r.description}</div>
                    {isSkipConfirming ? (
                      <div style={{
                        background: MF.complianceDim, border: `1px solid ${MF.compliance}30`,
                        borderRadius: MF.radiusSm, padding: "10px 14px", marginBottom: "8px",
                      }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: MF.compliance, marginBottom: "8px" }}>
                          This is a compliance requirement. Are you sure?
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button style={btn(MF.compliance, MF.complianceDim)} onClick={() => { onAction(r.id, S.NOT_APPLICABLE); setExpandedItem(null); setConfirmSkipCompliance(null); }}>
                            Yes, skip today
                          </button>
                          <button style={btn(MF.textMuted, MF.mutedBg)} onClick={() => setConfirmSkipCompliance(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button style={btn(MF.green, MF.greenDim)} onClick={() => { onAction(r.id, S.CONFIRMED); setExpandedItem(null); }}>
                          Already handled
                        </button>
                        <button style={btn(MF.amber, MF.amberDim)} onClick={() => { onAction(r.id, S.NEEDS_ATTENTION); setExpandedItem(null); }}>
                          Still needs attention
                        </button>
                        <button style={btn(MF.textMuted, MF.mutedBg)} onClick={() => { isComp ? setConfirmSkipCompliance(`still-${r.id}`) : (() => { onAction(r.id, S.NOT_APPLICABLE); setExpandedItem(null); })(); }}>
                          Skip for today
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmed — expanded from chip */}
      {showCovered && confirmed.length > 0 && (
        <div style={{ marginTop: "12px", animation: "fadeIn 0.15s ease" }}>
          {confirmed.map((r) => (
            <ConfirmedCard key={r.id} rule={r} state={itemStates[r.id]} />
          ))}
        </div>
      )}

      {/* Events — demoted, shown below active items */}
      {setup.expectedEvents && onEventArrival && (() => {
        const expected = setup.expectedEvents;
        const allEvents = [
          { key: "warehouse", label: "Warehouse delivery" },
          { key: "ov", label: "Outside vendor (OV)" },
          { key: "usps", label: "Postal service" },
        ].filter((e) => expected[e.key]);

        if (allEvents.length === 0) return null;
        const pending = allEvents.filter((e) => !eventArrivals[e.key]);
        const arrived = allEvents.filter((e) => eventArrivals[e.key]);

        if (pending.length === 0 && arrived.length === 0) return null;
        return (
          <div style={{ marginTop: "12px" }}>
            {pending.length > 0 && pending.map((e) => (
              <div key={e.key} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", marginBottom: "4px",
                background: "transparent", border: `1px solid ${MF.border}`,
                borderRadius: MF.radiusSm,
              }}>
                <span style={{ fontSize: "12px", color: MF.textMuted }}>{e.label}</span>
                <button
                  onClick={() => onEventArrival(e.key, ctx.currentMin)}
                  style={{
                    padding: "4px 10px", fontSize: "11px", fontWeight: 600,
                    fontFamily: MF.font, cursor: "pointer",
                    border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm,
                    background: "transparent", color: MF.textMuted,
                  }}
                >
                  Arrived
                </button>
              </div>
            ))}
            {arrived.map((e) => (
              <div key={e.key} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", marginBottom: "4px",
                background: "transparent", border: `1px solid ${MF.border}`,
                borderRadius: MF.radiusSm,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: MF.green, display: "flex" }}>{I.check}</span>
                  <span style={{ fontSize: "12px", color: MF.textMuted }}>{e.label}</span>
                </div>
                <select
                  value={eventArrivals[e.key]}
                  onChange={(ev) => onEventArrival(e.key, +ev.target.value)}
                  style={{
                    background: "transparent", border: `1px solid ${MF.border}`, borderRadius: "6px",
                    color: MF.textMuted, fontSize: "11px", fontFamily: MF.font,
                    padding: "3px 20px 3px 6px", cursor: "pointer",
                    appearance: "none",
                  }}
                >
                  {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Immunization tracker ── */}
      {setup.immTarget > 0 && onVaccine && (() => {
        // Auto-expand when queues are clear and target not yet met
        const autoExpand = queueState === "clear" && vaccineCount < setup.immTarget;
        const isExpanded = immExpanded || autoExpand;
        return (
        <div style={{ marginTop: "8px" }}>
          <button
            onClick={() => setImmExpanded(!immExpanded)}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", background: MF.card,
              border: `1px solid ${autoExpand && !immExpanded ? MF.accent + "40" : MF.border}`,
              borderRadius: isExpanded ? `${MF.radiusSm} ${MF.radiusSm} 0 0` : MF.radiusSm,
              cursor: "pointer", fontFamily: MF.font,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: MF.text }}>Immunizations</span>
              {autoExpand && !immExpanded && (
                <span style={{ fontSize: "10px", color: MF.accent, fontWeight: 500 }}>Good time to think about this</span>
              )}
            </div>
            <span style={{
              fontSize: "12px", fontWeight: 600,
              color: vaccineCount >= setup.immTarget ? MF.green : MF.accent,
            }}>
              {vaccineCount} / {setup.immTarget}
            </span>
          </button>
          {isExpanded && (
            <div style={{
              padding: "12px 16px", background: MF.card, border: `1px solid ${autoExpand && !immExpanded ? MF.accent + "40" : MF.border}`, borderTop: "none",
              borderRadius: `0 0 ${MF.radiusSm} ${MF.radiusSm}`,
            }}>
              {/* Progress bar */}
              <div style={{ width: "100%", height: "4px", background: MF.border, borderRadius: "2px", overflow: "hidden", marginBottom: "12px" }}>
                <div style={{
                  width: `${Math.min(100, setup.immTarget > 0 ? (vaccineCount / setup.immTarget) * 100 : 0)}%`, height: "100%",
                  background: setup.immTarget > 0 && vaccineCount >= setup.immTarget ? MF.green : MF.accent,
                  borderRadius: "2px", transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "12px", fontStyle: "italic" }}>
                {vaccineCount >= setup.immTarget ? "Target met. Well done." :
                 queueState === "clear" && vaccineCount === 0 ? "Calm moment — good time for a conversation." :
                 vaccineCount > 0 ? "Keep it up — every conversation matters." :
                 "Each one protects someone. You've got this."}
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
                      ...btn(MF.textMuted, MF.mutedBg),
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
        );
      })()}
    </div>
  );
}

// ─── HANDOFF SCENARIO DETECTION ───
// Derives the handoff context from setup data so screens adapt automatically
function getHandoffScenario(setup) {
  if (!setup) return { arrivalType: "unknown", exitType: "unknown" };

  const st = setup.shiftType || "open-close";
  const hasOverlap = setup.overlapWindows && setup.overlapWindows.length > 0;
  const isOpener = st === "open-close" || st === "open-mid";
  const isCloser = st === "open-close" || st === "mid-close";
  const isMid = st === "mid";
  const isOvernight = st === "overnight";
  const isSolo = st === "open-close" && !hasOverlap;

  // ARRIVAL scenarios
  let arrivalType, arrivalLabel, arrivalHeadline, arrivalEmpty;
  if (isSolo) {
    arrivalType = "solo-open";
    arrivalLabel = "Starting fresh";
    arrivalHeadline = (n) => n === 0 ? "Opening up. You've got it from here." : `${n} things to check as you open.`;
    arrivalEmpty = { message: "You're opening solo today.", sub: "No handoff needed — check Home for your board." };
  } else if (isOpener && hasOverlap) {
    arrivalType = "opener-with-relief";
    arrivalLabel = "Opening";
    arrivalHeadline = (n) => n === 0 ? "Clean start. Nothing flagged from overnight." : `${n} things flagged to check.`;
    arrivalEmpty = { message: "Clean start.", sub: "Nothing flagged. You're good to go." };
  } else if (isMid) {
    arrivalType = "mid-arriving";
    arrivalLabel = "Getting aligned";
    arrivalHeadline = (n) => n === 0 ? "You're aligned. Nothing to flag." : `${n} things to get aligned on.`;
    arrivalEmpty = { message: "Nothing specific for the handshake.", sub: "You're aligned. Good to go." };
  } else if (isCloser && !isOpener) {
    arrivalType = "closer-arriving";
    arrivalLabel = "Picking up";
    arrivalHeadline = (n) => n === 0 ? "All caught up. Nothing to flag." : `${n} things to pick up.`;
    arrivalEmpty = { message: "Clean pickup.", sub: "Nothing outstanding from earlier." };
  } else if (isOvernight) {
    arrivalType = "overnight-arriving";
    arrivalLabel = "Taking over";
    arrivalHeadline = (n) => n === 0 ? "Quiet handoff. Nothing flagged." : `${n} things from the day shift.`;
    arrivalEmpty = { message: "Nothing flagged from the day.", sub: "Quiet start." };
  } else {
    arrivalType = "generic";
    arrivalLabel = "Arriving";
    arrivalHeadline = (n) => n === 0 ? "You're aligned. Nothing to flag." : `${n} things to get aligned on.`;
    arrivalEmpty = { message: "Nothing specific for the handshake.", sub: "You're aligned. Good to go." };
  }

  // EXIT scenarios
  let exitType, exitLabel, exitHeadline, exitClean;
  if (isSolo) {
    exitType = "solo-close";
    exitLabel = "Closing out";
    exitHeadline = (n) => n === 0 ? "Everything resolved. Good close." : `${n} things to resolve before you lock up.`;
    exitClean = (covered) => covered > 0 ? `${covered} items covered. Clean close.` : "All set. Clean close.";
  } else if (isOpener && hasOverlap && !isCloser) {
    exitType = "opener-handing-off";
    exitLabel = "Handing off";
    exitHeadline = (n) => n === 0 ? "Clean handoff. Nothing unresolved." : `${n} things worth mentioning.`;
    exitClean = (covered) => covered > 0 ? `${covered} items covered. Thanks for setting the pace.` : "All set. Thanks for setting the pace.";
  } else if (isMid) {
    exitType = "mid-handing-off";
    exitLabel = "Handing off";
    exitHeadline = (n) => n === 0 ? "Clean handoff. Nothing to pass along." : `${n} things to pass along.`;
    exitClean = (covered) => covered > 0 ? `${covered} covered. Smooth handoff.` : "Nothing to pass along. Smooth handoff.";
  } else if (isCloser && hasOverlap && !isOpener) {
    exitType = "closer-wrapping";
    exitLabel = "Closing out";
    exitHeadline = (n) => n === 0 ? "Everything resolved. Good close." : `${n} things to resolve before close.`;
    exitClean = (covered) => covered > 0 ? `${covered} items covered. Thanks for a solid close.` : "All clear. Good close.";
  } else if (isOvernight) {
    exitType = "overnight-handing-off";
    exitLabel = "Handing off to morning";
    exitHeadline = (n) => n === 0 ? "Clean handoff for the morning crew." : `${n} things for the morning crew.`;
    exitClean = (covered) => covered > 0 ? `${covered} covered. Morning crew is set.` : "Morning crew is set. Good night.";
  } else {
    exitType = "generic";
    exitLabel = "Handing off";
    exitHeadline = (n) => n === 0 ? "Clean handoff. Nothing unresolved." : `${n} things worth mentioning.`;
    exitClean = (covered) => covered > 0 ? `${covered} items covered. Thanks for a solid shift.` : "All set. Thanks for keeping things steady.";
  }

  return {
    arrivalType, arrivalLabel, arrivalHeadline, arrivalEmpty,
    exitType, exitLabel, exitHeadline, exitClean,
    isSolo, hasOverlap, isOpener, isCloser, isMid, isOvernight,
  };
}

// ARRIVAL HANDSHAKE — adaptive based on shift scenario
function ArrivalScreen({ rules, itemStates, ctx, onAction, setup }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const [justConfirmed, setJustConfirmed] = useState(null);
  const timerRef = useRef(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleConfirm = (ruleId, state) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setJustConfirmed(ruleId);
    timerRef.current = setTimeout(() => { onAction(ruleId, state); setExpandedItem(null); setJustConfirmed(null); timerRef.current = null; }, 400);
  };
  const scenario = getHandoffScenario(setup);
  const items = rules.filter((r) =>
    r.handoffEligibility === "arrival" &&
    [S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])
  );
  const handled = rules.filter((r) =>
    r.handoffEligibility === "arrival" &&
    [S.CONFIRMED, S.HANDLED_EARLY].includes(itemStates[r.id])
  );

  // Solo shift — no arrival handoff
  if (scenario.isSolo) {
    return (
      <div style={{ padding: "16px", animation: "fadeIn 0.2s ease" }}>
        <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "4px" }}>
          <span style={{ fontWeight: 600, color: MF.accent }}>{scenario.arrivalLabel}</span>
          <span style={{ opacity: 0.4 }}> · </span>
          <span>{fmtTime12(ctx.currentMin)}</span>
        </div>
        <div style={{ fontSize: "15px", fontWeight: 600, color: MF.text, marginBottom: "12px" }}>
          You're covering the full day.
        </div>
        <QuietState message="No handoff needed." sub="Check Home for your board." />
      </div>
    );
  }

  // Not in arrival window yet
  if (!ctx.arrivalWindow && items.length === 0) {
    return (
      <div style={{ padding: "16px", animation: "fadeIn 0.2s ease" }}>
        <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "12px" }}>
          <span style={{ fontWeight: 600, color: MF.accent }}>{scenario.arrivalLabel}</span>
          <span style={{ opacity: 0.4 }}> · </span>
          <span>{fmtTime12(ctx.currentMin)}</span>
        </div>
        <QuietState
          message={ctx.inOverlap ? "You're mid-overlap." : "No active arrival window."}
          sub={ctx.inOverlap ? "Check Home for the live board." : "This screen activates when an overlap window starts."}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", animation: "fadeIn 0.2s ease" }}>
      {/* Header */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "4px" }}>
          <span style={{ fontWeight: 600, color: MF.accent }}>{scenario.arrivalLabel}</span>
          <span style={{ opacity: 0.4 }}> · </span>
          <span>{fmtTime12(ctx.currentMin)}</span>
        </div>
        <div style={{ fontSize: "15px", fontWeight: 600, color: MF.text, letterSpacing: "-0.01em" }}>
          {scenario.arrivalHeadline(items.length)}
        </div>
      </div>

      {/* Context from outgoing */}
      {setup?.dayNotes?.length > 0 && (
        <div style={{
          padding: "8px 12px", marginBottom: "8px",
          border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm,
          fontSize: "12px", color: MF.textMuted, lineHeight: 1.4,
        }}>
          <span style={{ fontWeight: 600, color: MF.secondary, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {scenario.isOpener ? "Notes from overnight" : "Notes from earlier"}
          </span>
          {setup.dayNotes.map((n, i) => (
            <div key={i} style={{ marginTop: "4px" }}>{n}</div>
          ))}
        </div>
      )}

      {/* Items — compact expandable rows */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
          {items.map((r) => {
            const isOpen = expandedItem === r.id;
            const isAttention = itemStates[r.id] === S.NEEDS_ATTENTION;
            const isComp = isComplianceItem(r);
            const dotColor = getDotColor(r, isComp);

            const isConfirming = justConfirmed === r.id;
            return (
              <div key={r.id} style={{
                background: isConfirming ? MF.greenDim : MF.card,
                border: `1px solid ${isConfirming ? MF.green + "60" : isAttention ? MF.amber + "4D" : isComp ? MF.compliance + "40" : MF.border}`,
                borderLeft: `3px solid ${isConfirming ? MF.green : isAttention ? MF.amber : isComp ? MF.compliance : MF.accentMid}`,
                borderRadius: MF.radius, overflow: "hidden",
                transition: "background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, opacity 0.3s ease",
                transform: isConfirming ? "scale(0.98)" : "scale(1)",
                opacity: isConfirming ? 0.85 : 1,
              }}>
                <button
                  aria-expanded={isOpen}
                  onClick={() => setExpandedItem(isOpen ? null : r.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", background: "none", border: "none",
                    cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                  }}
                >
                  <div style={{ width: "8px", height: "8px", borderRadius: isComp ? "2px" : "50%", flexShrink: 0, background: isConfirming ? MF.green : dotColor, transition: "background 0.2s ease" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: MF.text }}>{r.label}</div>
                    <div style={{ fontSize: "11px", color: isComp ? MF.compliance : MF.textMuted, marginTop: "1px", fontWeight: isComp ? 500 : 400 }}>
                      {isComp ? `Required — ${r.roleContext.charAt(0).toLowerCase() + r.roleContext.slice(1)}` : r.roleContext}
                    </div>
                  </div>
                  {isComp && <RequiredBadge />}
                  {isAttention && !isComp && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: MF.amber, flexShrink: 0 }} />}
                  <ExpandChevron isOpen={isOpen} />
                </button>

                {isOpen && !isConfirming && (
                  <div style={{ padding: "0 12px 12px", animation: "fadeIn 0.15s ease" }}>
                    <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.5, marginBottom: "10px" }}>
                      {r.description}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={btn(MF.green, MF.greenDim)} onClick={() => handleConfirm(r.id, S.CONFIRMED)}>
                        Noted
                      </button>
                      <button style={btn(MF.amber, MF.amberDim)} onClick={() => handleConfirm(r.id, S.NEEDS_ATTENTION)}>
                        Needs attention
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when all items cleared */}
      {items.length === 0 && <QuietState {...scenario.arrivalEmpty} />}

      {/* Handled count */}
      {handled.length > 0 && (
        <div style={{ fontSize: "12px", color: MF.textMuted, textAlign: "center", marginTop: "8px" }}>
          {handled.length} aligned
        </div>
      )}
    </div>
  );
}

// LATER TODAY
function LaterTodayScreen({ rules, itemStates, setup, ctx, onAction }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(null);
  const timerRef = useRef(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleConfirm = (ruleId, state) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setJustConfirmed(ruleId);
    timerRef.current = setTimeout(() => { onAction(ruleId, state); setExpandedItem(null); setJustConfirmed(null); timerRef.current = null; }, 400);
  };
  const MAX_SHOWN = 5;

  const laterItems = rules.filter((r) => {
    if ([S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])) return false;
    if (r.category === "getahead") return false;
    if ([S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])) return false;
    if (itemStates[r.id] !== S.HIDDEN) return false;
    // Only show if the window is still ahead of us
    const win = resolveWindow(r, setup);
    return win.start > ctx.currentMin;
  });

  const shown = showAll ? laterItems : laterItems.slice(0, MAX_SHOWN);
  const hiddenCount = laterItems.length - MAX_SHOWN;

  return (
    <div style={{ padding: "16px", animation: "fadeIn 0.2s ease" }}>
      <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "4px" }}>
        <span style={{ fontWeight: 600, color: MF.accent }}>Later today</span>
        <span style={{ opacity: 0.4 }}> · </span>
        <span>{fmtTime12(ctx.currentMin)}</span>
      </div>
      <div style={{ fontSize: "15px", fontWeight: 600, color: MF.text, letterSpacing: "-0.01em", marginBottom: "12px" }}>
        {laterItems.length === 0 ? "Nothing upcoming" : `${laterItems.length} item${laterItems.length === 1 ? "" : "s"} coming up later`}
      </div>

      {laterItems.length === 0 ? (
        <QuietState message="Everything upcoming is already on your board." sub="You're ahead of the curve." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {shown.map((r) => {
            const isOpen = expandedItem === r.id;
            const win = resolveWindow(r, setup);
            const isComp = isComplianceItem(r);
            const dotColor = getDotColor(r, isComp);
            const isConfirming = justConfirmed === r.id;
            return (
              <div key={r.id} style={{
                background: isConfirming ? MF.greenDim : MF.card,
                border: `1px solid ${isConfirming ? MF.green + "60" : isComp ? MF.compliance + "40" : MF.border}`,
                borderLeft: isComp ? `3px solid ${isConfirming ? MF.green : MF.compliance}` : undefined,
                borderRadius: MF.radius, overflow: "hidden",
                animation: "slideUp 0.25s ease both",
                transition: "background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, opacity 0.3s ease",
                transform: isConfirming ? "scale(0.98)" : "scale(1)",
                opacity: isConfirming ? 0.85 : 1,
              }}>
                {/* Compact row */}
                <button
                  aria-expanded={isOpen}
                  onClick={() => setExpandedItem(isOpen ? null : r.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", background: "none", border: "none",
                    cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                  }}
                >
                  <div style={{
                    width: "8px", height: "8px", borderRadius: isComp ? "2px" : "50%", flexShrink: 0,
                    background: isConfirming ? MF.green : dotColor,
                    transition: "background 0.2s ease",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em", color: MF.text }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: "11px", color: isComp ? MF.compliance : MF.textMuted, marginTop: "1px", lineHeight: 1.3, fontWeight: isComp ? 500 : 400 }}>
                      {isComp ? `Required — ${r.roleContext.charAt(0).toLowerCase() + r.roleContext.slice(1)}` : r.roleContext}
                    </div>
                  </div>
                  {isComp && <RequiredBadge />}
                  <ExpandChevron isOpen={isOpen} />
                </button>

                {/* Expanded detail */}
                {isOpen && !isConfirming && (
                  <div style={{ padding: "0 16px 14px", animation: "fadeIn 0.15s ease" }}>
                    <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.6, marginBottom: "8px" }}>
                      {r.description}
                    </div>
                    <div style={{ fontSize: "11px", color: MF.textMuted, marginBottom: "10px", fontStyle: "italic" }}>
                      Usually relevant around {fmtTime12(win.start)}
                    </div>
                    <button
                      style={btn(MF.secondary, MF.secondaryDim)}
                      onClick={() => handleConfirm(r.id, S.HANDLED_EARLY)}
                    >
                      Mark handled early
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              style={{
                width: "100%", padding: "10px", marginTop: "2px",
                fontSize: "12px", fontWeight: 600, color: MF.textMuted,
                background: "transparent", border: `1px dashed ${MF.border}`,
                borderRadius: MF.radiusSm, cursor: "pointer", fontFamily: MF.font,
              }}
            >
              {hiddenCount} more items
            </button>
          )}
          {showAll && laterItems.length > MAX_SHOWN && (
            <button
              onClick={() => setShowAll(false)}
              style={{
                width: "100%", padding: "8px", marginTop: "2px",
                fontSize: "11px", color: MF.textMuted, opacity: 0.6,
                background: "transparent", border: "none",
                cursor: "pointer", fontFamily: MF.font,
              }}
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// GET AHEAD
function GetAheadScreen({ rules, itemStates, ctx, onAction, queueState }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const [justConfirmed, setJustConfirmed] = useState(null);
  const timerRef = useRef(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleConfirm = (ruleId, state) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setJustConfirmed(ruleId);
    timerRef.current = setTimeout(() => { onAction(ruleId, state); setExpandedItem(null); setJustConfirmed(null); timerRef.current = null; }, 400);
  };

  const eligible = rules.filter((r) =>
    r.getAheadEligible && ![S.CONFIRMED, S.HANDLED_EARLY, S.NOT_APPLICABLE].includes(itemStates[r.id])
  );
  const activeCount = Object.values(itemStates).filter(
    (s) => s === S.VISIBLE || s === S.NEEDS_ATTENTION
  ).length;
  const toobusy = activeCount > 4 || ctx.timingPressure === "end-of-day" || queueState === "needsfocus" || queueState === "highdemand";

  return (
    <div style={{ padding: "16px", animation: "fadeIn 0.2s ease" }}>
      <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "4px" }}>
        <span style={{ fontWeight: 600, color: MF.accent }}>Get ahead</span>
        <span style={{ opacity: 0.4 }}> · </span>
        <span>{fmtTime12(ctx.currentMin)}</span>
      </div>
      <div style={{ fontSize: "15px", fontWeight: 600, color: MF.text, letterSpacing: "-0.01em", marginBottom: "12px" }}>
        {toobusy ? "Plenty on your plate" : eligible.length === 0 ? "Nothing to get ahead on" : `${eligible.length} optional opportunit${eligible.length === 1 ? "y" : "ies"}`}
      </div>

      {toobusy ? (
        <QuietState
          message="Plenty on your plate already."
          sub="Being present with patients matters more right now."
        />
      ) : eligible.length === 0 ? (
        <QuietState message="Nothing to get ahead on right now." sub="You're in a good spot." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {eligible.map((r) => {
            const isOpen = expandedItem === r.id;
            const isConfirming = justConfirmed === r.id;
            return (
              <div key={r.id} style={{
                background: isConfirming ? MF.greenDim : MF.card,
                border: `1px solid ${isConfirming ? MF.green + "60" : MF.border}`,
                borderRadius: MF.radius, overflow: "hidden",
                animation: "slideUp 0.25s ease both",
                transition: "background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, opacity 0.3s ease",
                transform: isConfirming ? "scale(0.98)" : "scale(1)",
                opacity: isConfirming ? 0.85 : 1,
              }}>
                {/* Compact row */}
                <button
                  aria-expanded={isOpen}
                  onClick={() => setExpandedItem(isOpen ? null : r.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", background: "none", border: "none",
                    cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                  }}
                >
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                    background: isConfirming ? MF.green : MF.border,
                    transition: "background 0.2s ease",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em", color: MF.text }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: "11px", color: MF.textMuted, marginTop: "1px", lineHeight: 1.3 }}>
                      {r.roleContext}
                    </div>
                  </div>
                  <ExpandChevron isOpen={isOpen} />
                </button>

                {/* Expanded detail */}
                {isOpen && !isConfirming && (
                  <div style={{ padding: "0 16px 14px", animation: "fadeIn 0.15s ease" }}>
                    <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.6, marginBottom: "12px" }}>
                      {r.description}
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button style={btn(MF.accent, MF.accentDim)} onClick={() => handleConfirm(r.id, S.HANDLED_EARLY)}>
                        Get a head start
                      </button>
                      <button style={btn(MF.textMuted, MF.mutedBg)} onClick={() => handleConfirm(r.id, S.NOT_APPLICABLE)}>
                        Skip for today
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// EXIT CHECKPOINT — adaptive based on shift scenario
function ExitScreen({ rules, itemStates, ctx, setup, onAction, vaccineCount }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const [showPassed, setShowPassed] = useState(false);
  const [showCovered, setShowCovered] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(null);
  const timerRef = useRef(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleConfirm = (ruleId, state) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setJustConfirmed(ruleId);
    timerRef.current = setTimeout(() => { onAction(ruleId, state); setExpandedItem(null); setJustConfirmed(null); timerRef.current = null; }, 400);
  };
  const scenario = getHandoffScenario(setup);

  const unresolved = rules.filter((r) =>
    r.handoffEligibility === "exit" &&
    [S.VISIBLE, S.VISIBLE_HANDOFF, S.NEEDS_ATTENTION].includes(itemStates[r.id])
  );
  const covered = rules.filter((r) =>
    r.handoffEligibility === "exit" &&
    [S.CONFIRMED, S.HANDLED_EARLY].includes(itemStates[r.id])
  );
  const stillOpenExit = getStillOpenItems(rules, itemStates, setup, ctx);

  const mentionCount = unresolved.length + stillOpenExit.length;
  const showSnapshot = covered.length > 0 || mentionCount > 0 || (setup?.immTarget > 0 && vaccineCount > 0);

  // Not in exit window yet
  if (!ctx.exitWindow) {
    return (
      <div style={{ padding: "16px", animation: "fadeIn 0.2s ease" }}>
        <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "12px" }}>
          <span style={{ fontWeight: 600, color: MF.accent }}>{scenario.exitLabel}</span>
          <span style={{ opacity: 0.4 }}> · </span>
          <span>{fmtTime12(ctx.currentMin)}</span>
        </div>
        <QuietState
          message={scenario.isSolo ? "Not time to close yet." : "Not in the exit window yet."}
          sub={`About ${Math.round(ctx.minutesUntilEnd)} minutes until shift end.`}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", animation: "fadeIn 0.2s ease" }}>
      {/* Header */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "12px", color: MF.textMuted, marginBottom: "4px" }}>
          <span style={{ fontWeight: 600, color: MF.accent }}>{scenario.exitLabel}</span>
          <span style={{ opacity: 0.4 }}> · </span>
          <span>{fmtTime12(ctx.currentMin)}</span>
        </div>
        <div style={{ fontSize: "15px", fontWeight: 600, color: MF.text, letterSpacing: "-0.01em" }}>
          {scenario.exitHeadline(mentionCount)}
        </div>
      </div>

      {/* Shift snapshot */}
      {showSnapshot && (
        <div style={{
          display: "flex", gap: "0", marginBottom: "10px",
          border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm, overflow: "hidden",
        }}>
          {covered.length > 0 && (
            <div style={{ flex: 1, padding: "8px 0", textAlign: "center", borderRight: `1px solid ${MF.border}` }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: MF.green }}>{covered.length}</div>
              <div style={{ fontSize: "9px", color: MF.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>covered</div>
            </div>
          )}
          {mentionCount > 0 && (
            <div style={{ flex: 1, padding: "8px 0", textAlign: "center", borderRight: setup?.immTarget > 0 ? `1px solid ${MF.border}` : "none" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: MF.amber }}>{mentionCount}</div>
              <div style={{ fontSize: "9px", color: MF.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {scenario.isSolo || scenario.isCloser ? "to resolve" : "to mention"}
              </div>
            </div>
          )}
          {setup?.immTarget > 0 && vaccineCount !== undefined && (
            <div style={{ flex: 1, padding: "8px 0", textAlign: "center" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: vaccineCount >= setup.immTarget ? MF.green : MF.accent }}>{vaccineCount}/{setup.immTarget}</div>
              <div style={{ fontSize: "9px", color: MF.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>vaccines</div>
            </div>
          )}
        </div>
      )}

      {/* Day notes — only show when handing off to someone */}
      {!scenario.isSolo && setup?.dayNotes?.length > 0 && (
        <div style={{
          padding: "8px 12px", marginBottom: "8px",
          border: `1px solid ${MF.border}`, borderRadius: MF.radiusSm,
          fontSize: "12px", color: MF.textMuted, lineHeight: 1.4,
        }}>
          <span style={{ fontWeight: 600, color: MF.secondary, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {scenario.isCloser ? "Notes from today" : "Notes to pass along"}
          </span>
          {setup.dayNotes.map((n, i) => (
            <div key={i} style={{ marginTop: "4px" }}>{n}</div>
          ))}
        </div>
      )}

      {/* Unresolved items */}
      {unresolved.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "6px" }}>
          {unresolved.map((r) => {
            const isOpen = expandedItem === r.id;
            const isAttention = itemStates[r.id] === S.NEEDS_ATTENTION;
            const isComp = isComplianceItem(r);
            const dotColor = getDotColor(r, isComp);

            const isConfirming = justConfirmed === r.id;
            return (
              <div key={r.id} style={{
                background: isConfirming ? MF.greenDim : MF.card,
                border: `1px solid ${isConfirming ? MF.green + "60" : isAttention ? MF.amber + "4D" : isComp ? MF.compliance + "40" : MF.border}`,
                borderLeft: `3px solid ${isConfirming ? MF.green : isAttention ? MF.amber : isComp ? MF.compliance : MF.accentMid}`,
                borderRadius: MF.radius, overflow: "hidden",
                transition: "background 0.3s ease, border-color 0.3s ease, transform 0.3s ease, opacity 0.3s ease",
                transform: isConfirming ? "scale(0.98)" : "scale(1)",
                opacity: isConfirming ? 0.85 : 1,
              }}>
                <button
                  aria-expanded={isOpen}
                  onClick={() => setExpandedItem(isOpen ? null : r.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", background: "none", border: "none",
                    cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                  }}
                >
                  <div style={{ width: "8px", height: "8px", borderRadius: isComp ? "2px" : "50%", flexShrink: 0, background: isConfirming ? MF.green : dotColor, transition: "background 0.2s ease" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: MF.text }}>{r.label}</div>
                    <div style={{ fontSize: "11px", color: isComp ? MF.compliance : MF.textMuted, marginTop: "1px", fontWeight: isComp ? 500 : 400 }}>
                      {isComp ? `Required — ${r.roleContext.charAt(0).toLowerCase() + r.roleContext.slice(1)}` : r.roleContext}
                    </div>
                  </div>
                  {isComp && <RequiredBadge />}
                  <ExpandChevron isOpen={isOpen} />
                </button>

                {isOpen && !isConfirming && (
                  <div style={{ padding: "0 12px 12px", animation: "fadeIn 0.15s ease" }}>
                    <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.5, marginBottom: "10px" }}>
                      {r.description}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={btn(MF.green, MF.greenDim)} onClick={() => handleConfirm(r.id, S.CONFIRMED)}>
                        {scenario.isSolo || scenario.isCloser ? "Resolved" : "Covered"}
                      </button>
                      <button style={btn(MF.amber, MF.amberDim)} onClick={() => handleConfirm(r.id, S.NEEDS_ATTENTION)}>
                        {scenario.isSolo || scenario.isCloser ? "Needs follow-up" : "Mention this"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary chips */}
      {(stillOpenExit.length > 0 || covered.length > 0) && (
        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
          {stillOpenExit.length > 0 && (
            <button onClick={() => { setShowPassed(!showPassed); setShowCovered(false); }} style={{
              padding: "6px 12px", borderRadius: "16px", fontSize: "11px", fontWeight: 600,
              fontFamily: MF.font, cursor: "pointer",
              border: `1px solid ${showPassed ? MF.amber + "60" : MF.amber + "40"}`,
              background: showPassed ? MF.amberDim : "transparent",
              color: MF.amber,
            }}>
              {stillOpenExit.length} window passed
            </button>
          )}
          {covered.length > 0 && (
            <button onClick={() => { setShowCovered(!showCovered); setShowPassed(false); }} style={{
              padding: "6px 12px", borderRadius: "16px", fontSize: "11px", fontWeight: 600,
              fontFamily: MF.font, cursor: "pointer",
              border: `1px solid ${showCovered ? MF.green + "60" : MF.border}`,
              background: showCovered ? MF.greenDim : "transparent",
              color: showCovered ? MF.green : MF.textMuted,
            }}>
              {covered.length} covered
            </button>
          )}
        </div>
      )}

      {/* Expanded: window-passed items */}
      {showPassed && stillOpenExit.length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {stillOpenExit.map((r) => {
            const isOpen = expandedItem === `passed-${r.id}`;
            const isComp = isComplianceItem(r);
            const dotColor = getDotColor(r, isComp);
            return (
              <div key={r.id} style={{
                background: MF.card,
                border: `1px solid ${isComp ? MF.compliance + "40" : MF.border}`,
                borderLeft: `3px solid ${isComp ? MF.compliance : MF.amber}`,
                borderRadius: MF.radius, overflow: "hidden",
              }}>
                <button
                  aria-expanded={isOpen}
                  onClick={() => setExpandedItem(isOpen ? null : `passed-${r.id}`)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 12px", background: "none", border: "none",
                    cursor: "pointer", fontFamily: MF.font, textAlign: "left",
                  }}
                >
                  <div style={{ width: "8px", height: "8px", borderRadius: isComp ? "2px" : "50%", flexShrink: 0, background: dotColor }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: MF.text }}>{r.label}</div>
                    <div style={{ fontSize: "11px", color: isComp ? MF.compliance : MF.textMuted, marginTop: "1px", lineHeight: 1.3, fontWeight: isComp ? 500 : 400 }}>
                      {isComp ? `Required — ${r.roleContext.charAt(0).toLowerCase() + r.roleContext.slice(1)}` : r.roleContext}
                    </div>
                  </div>
                  {isComp && <RequiredBadge />}
                  <ExpandChevron isOpen={isOpen} />
                </button>
                {isOpen && (
                  <div style={{ padding: "0 16px 14px", animation: "fadeIn 0.15s ease" }}>
                    <div style={{ fontSize: "13px", color: MF.textMuted, lineHeight: 1.6, marginBottom: "12px" }}>{r.description}</div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={btn(MF.green, MF.greenDim)} onClick={() => { onAction(r.id, S.CONFIRMED); setExpandedItem(null); }}>Handled</button>
                      <button style={btn(MF.textMuted, MF.mutedBg)} onClick={() => { onAction(r.id, S.NOT_APPLICABLE); setExpandedItem(null); }}>Skip</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded: covered items */}
      {showCovered && covered.length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {covered.map((r) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 12px", border: `1px solid ${MF.border}`,
              borderRadius: MF.radiusSm, fontSize: "13px", color: MF.textMuted,
            }}>
              <span style={{ color: MF.green, display: "flex" }}>{I.check}</span>
              <span>{r.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Clean exit message */}
      {unresolved.length === 0 && stillOpenExit.length === 0 && (
        <div style={{ textAlign: "center", padding: "12px 0", marginTop: "4px" }}>
          <div style={{ fontSize: "13px", color: MF.textMuted }}>
            {scenario.exitClean(covered.length)}
          </div>
        </div>
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
              ...btn(simTime === p.min ? "#fff" : MF.textMuted, simTime === p.min ? MF.accent : MF.mutedBg),
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
            ...btn(MF.textMuted, MF.mutedBg),
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
  const [checkConfirmedAt, setCheckConfirmedAt] = useState({}); // { ruleId: queueState } — tracks pressure level when each check was confirmed
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
        itemType: "task",
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
        itemType: "task",
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
        itemType: "task",
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
        itemType: "check",
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
    setItemStates((prev) => computeItemStates(activeRules, prev, setup, ctx, queueState, checkConfirmedAt));
  }, [ctx, setup, activeRules, queueState, checkConfirmedAt]);

  const handleAction = useCallback((ruleId, newState) => {
    setItemStates((prev) => ({ ...prev, [ruleId]: newState }));
    // Track queue pressure at confirmation time for checks (enables situation-aware resurfacing)
    if (newState === S.CONFIRMED || newState === S.HANDLED_EARLY) {
      const rule = activeRules.find((r) => r.id === ruleId);
      if (rule && isCheckItem(rule)) {
        setCheckConfirmedAt((prev) => ({ ...prev, [ruleId]: queueState }));
      }
    }
  }, [activeRules, queueState]);

  // Auto-return: after acting on arrival/exit items, return to Home after a beat
  const actionReturnRef = useRef(null);
  useEffect(() => () => { if (actionReturnRef.current) clearTimeout(actionReturnRef.current); }, []);
  const handleActionAndReturn = useCallback((ruleId, newState) => {
    handleAction(ruleId, newState);
    if (actionReturnRef.current) clearTimeout(actionReturnRef.current);
    actionReturnRef.current = setTimeout(() => { setScreen("home"); actionReturnRef.current = null; }, 600);
  }, [handleAction]);

  const handleSetup = (data) => {
    setSetup(data);
    setItemStates({});
    setCheckConfirmedAt({});
    setScreen("home");
    // Default sim time to shift start
    setSimTime(data.shiftStart);
  };

  const handleReset = () => {
    setSetup(null);
    setItemStates({});
    setCheckConfirmedAt({});
    setEventArrivals({});
    setQueueState("ontrack");
    setVaccineCount(0);
    setDayNoteStates({});
    setDayNoteConfirm(null);
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
    @keyframes errorPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    select option { background: ${MF.selectBg}; color: ${MF.selectText}; }
    ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${MF.border}; border-radius: 3px; }
    button:active { transform: scale(0.97); }
    button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${MF.accent}; outline-offset: 2px; }
    input[type="range"] { height: 28px; cursor: pointer; }
  `;

  // LANDING PAGE
  if (screen === "landing" || (screen === "setup" && !setup) || (!setup && screen !== "setup")) {
    const isSetup = screen === "setup";
    return (
      <div style={{ fontFamily: MF.font, background: MF.bg, color: MF.text, minHeight: "100vh", maxWidth: "430px", margin: "0 auto", overflow: "hidden" }}>
        <style>{globalCSS}{`
          @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
          @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes revealUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes revealScale { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
          @keyframes pulseLine { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.25; } }
          @keyframes scrollLine { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          @keyframes rhythmPulse { 0%, 100% { transform: scaleY(0.75); } 50% { transform: scaleY(1.15); } }
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
                <button aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme} style={{
                  background: "none", border: `1px solid ${MF.border}`, borderRadius: "8px",
                  padding: "6px", cursor: "pointer", color: MF.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {theme === "dark" ? I.sun : I.moon}
                </button>
                <button aria-label="About RxTempo" onClick={() => setShowInfo(!showInfo)} style={{
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
                : "radial-gradient(circle, rgba(45,122,191,0.06) 0%, transparent 70%)",
              animation: "pulse 6s ease-in-out infinite", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: "80px", right: "-80px", width: "280px", height: "280px",
              borderRadius: "50%",
              background: theme === "dark"
                ? "radial-gradient(circle, rgba(126,184,240,0.05) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(90,158,214,0.04) 0%, transparent 70%)",
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
                <button aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme} style={{
                  background: "none", border: `1px solid ${MF.border}`, borderRadius: "8px",
                  padding: "6px", cursor: "pointer", color: MF.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {theme === "dark" ? I.sun : I.moon}
                </button>
                <button aria-label="About RxTempo" onClick={() => setShowInfo(!showInfo)} style={{
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

              {/* Rhythm wave */}
              <div style={{
                marginLeft: "-28px", marginRight: "-28px",
                marginBottom: "24px", overflow: "hidden", height: "72px",
                animation: "revealUp 0.5s ease both 0.25s",
              }}>
                <div style={{ width: "200%", animation: "scrollLine 20s linear infinite" }}>
                <svg width="100%" height="72" viewBox="0 0 750 72" preserveAspectRatio="none" style={{
                  animation: "rhythmPulse 7s ease-in-out infinite",
                  transformOrigin: "center center",
                }}>
                  <defs>
                    <linearGradient id="rFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={MF.accent} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={MF.accent} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,36 C25,4 50,4 75,36 C100,68 125,68 150,36 C175,4 200,4 225,36 C250,68 275,68 300,36 C325,4 350,4 375,36 C400,68 425,68 450,36 C475,4 500,4 525,36 C550,68 575,68 600,36 C625,4 650,4 675,36 C700,68 725,68 750,36 L750,72 L0,72 Z"
                    fill="url(#rFill)"
                  />
                  <path
                    d="M0,36 C25,4 50,4 75,36 C100,68 125,68 150,36 C175,4 200,4 225,36 C250,68 275,68 300,36 C325,4 350,4 375,36 C400,68 425,68 450,36 C475,4 500,4 525,36 C550,68 575,68 600,36 C625,4 650,4 675,36 C700,68 725,68 750,36"
                    fill="none"
                    stroke={MF.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                </svg>
                </div>
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
    home: <HomeScreen rules={activeRules} itemStates={itemStates} ctx={ctx} setup={setup} onAction={handleAction} onNav={setScreen} eventArrivals={eventArrivals} onEventArrival={(key, min) => setEventArrivals((prev) => ({ ...prev, [key]: min }))} queueState={queueState} onQueueState={setQueueState} vaccineCount={vaccineCount} onVaccine={setVaccineCount} dayNoteStates={dayNoteStates} onDayNoteState={(idx, state) => setDayNoteStates((prev) => ({ ...prev, [idx]: state }))} dayNoteConfirm={dayNoteConfirm} onDayNoteConfirm={setDayNoteConfirm} checkConfirmedAt={checkConfirmedAt} />,
    arrival: <ArrivalScreen rules={activeRules} itemStates={itemStates} ctx={ctx} onAction={handleActionAndReturn} setup={setup} />,
    later: <LaterTodayScreen rules={activeRules} itemStates={itemStates} setup={setup} ctx={ctx} onAction={handleAction} />,
    ahead: <GetAheadScreen rules={activeRules} itemStates={itemStates} ctx={ctx} onAction={handleAction} queueState={queueState} />,
    exit: <ExitScreen rules={activeRules} itemStates={itemStates} ctx={ctx} setup={setup} onAction={handleActionAndReturn} vaccineCount={vaccineCount} />,
  };

  const handoffScenario = getHandoffScenario(setup);
  const navItems = [
    { key: "home", label: "Home", icon: I.home },
    { key: "arrival", label: handoffScenario.isSolo ? "Start" : "Arrival", icon: I.handoff, badge: arrivalBadge },
    { key: "later", label: "Later", icon: I.clock },
    { key: "ahead", label: "Ahead", icon: I.ahead },
    { key: "exit", label: handoffScenario.isSolo ? "Close" : "Exit", icon: I.exit, badge: exitBadge },
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
          <button aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme} style={{
            background: "none", border: `1px solid ${MF.border}`, borderRadius: "6px",
            padding: "4px", cursor: "pointer", color: MF.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {theme === "dark" ? I.sun : I.moon}
          </button>
          <button aria-label="About RxTempo" onClick={() => setShowInfo(!showInfo)} style={{
            background: "none", border: `1px solid ${showInfo ? MF.accent : MF.border}`, borderRadius: "6px",
            padding: "4px", cursor: "pointer", color: showInfo ? MF.accent : MF.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {I.info}
          </button>
          <button
            aria-label={simMode ? "Exit simulation" : "Simulate time"}
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
            aria-label="Reset shift"
            onClick={handleReset}
            style={{
              background: "none", border: `1px solid ${MF.border}`, borderRadius: "6px",
              padding: "4px", cursor: "pointer", color: MF.danger,
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
          onReset={() => { setItemStates({}); setCheckConfirmedAt({}); }}
          shiftStart={setup.shiftStart}
          shiftEnd={setup.shiftEnd}
        />
      )}

      {/* ── CONTENT ── */}
      <div key={screen} style={{ flex: 1, overflowY: "auto", paddingBottom: "80px", animation: "fadeIn 0.2s ease" }}>
        {screens[screen]}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        borderTop: `1px solid ${MF.border}`, background: MF.navBg,
        backdropFilter: "blur(12px)", position: "sticky", bottom: 0, zIndex: 100,
      }}>
        <div style={{
          textAlign: "center", padding: "4px 0 2px",
          fontSize: "9px", fontWeight: 500, color: MF.textMuted, opacity: 0.35,
          letterSpacing: "0.04em",
        }}>
          MADDEN FRAMEWORKS
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", padding: "4px 4px 12px" }}>
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
    </div>
  );
}
