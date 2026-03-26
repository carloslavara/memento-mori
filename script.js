const STORAGE_KEY = "pixel-time-tracker-state-v1";

const defaultState = {
  birthDate: "",
  birthTime: "",
  preferences: {
    timeFormat: "24h",
    showSeconds: true,
    soundEnabled: false,
    animationsEnabled: true,
  },
};

const state = loadState();
const audioCtx = { context: null, ready: false };
const lastMilestones = { minute: null, hour: null, day: null };

const el = {
  currentDateTime: document.getElementById("currentDateTime"),
  dayValue: document.getElementById("dayValue"),
  dayPercent: document.getElementById("dayPercent"),
  dayProgress: document.getElementById("dayProgress"),
  weekValue: document.getElementById("weekValue"),
  weekPercent: document.getElementById("weekPercent"),
  weekProgress: document.getElementById("weekProgress"),
  yearValue: document.getElementById("yearValue"),
  yearPercent: document.getElementById("yearPercent"),
  yearProgress: document.getElementById("yearProgress"),
  birthForm: document.getElementById("birthForm"),
  birthDate: document.getElementById("birthDate"),
  birthTime: document.getElementById("birthTime"),
  birthError: document.getElementById("birthError"),
  aliveSeconds: document.getElementById("aliveSeconds"),
  aliveMinutes: document.getElementById("aliveMinutes"),
  aliveHours: document.getElementById("aliveHours"),
  aliveDays: document.getElementById("aliveDays"),
  aliveDerived: document.getElementById("aliveDerived"),
  timezone: document.getElementById("timezone"),
};

hydrateUI();
runTick();
setInterval(runTick, 1000);

function runTick() {
  const now = new Date();
  renderHeader(now);
  renderCountdown(now, "day");
  renderCountdown(now, "week");
  renderCountdown(now, "year");
  renderLifetime(now);
  playMilestones(now);
}

function renderHeader(now) {
  const options = {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: state.preferences.showSeconds ? "2-digit" : undefined,
    hour12: state.preferences.timeFormat === "12h",
  };
  el.currentDateTime.textContent = new Intl.DateTimeFormat(undefined, options).format(now);
  el.timezone.textContent = `TZ: ${Intl.DateTimeFormat().resolvedOptions().timeZone || "Local"}`;
}

function renderCountdown(now, type) {
  const block = computeCountdown(now, type);
  const mainValue = formatDuration(block.remainingMs, type !== "day", state.preferences.showSeconds);
  const percent = `${(block.remainingRatio * 100).toFixed(2)}% remaining`;

  if (type === "day") {
    el.dayValue.textContent = mainValue;
    el.dayPercent.textContent = percent;
    setProgress(el.dayProgress, block.remainingRatio);
  }
  if (type === "week") {
    el.weekValue.textContent = mainValue;
    el.weekPercent.textContent = percent;
    setProgress(el.weekProgress, block.remainingRatio);
  }
  if (type === "year") {
    el.yearValue.textContent = mainValue;
    el.yearPercent.textContent = percent;
    setProgress(el.yearProgress, block.remainingRatio);
  }
}

function computeCountdown(now, type) {
  let start;
  let end;

  if (type === "day") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (type === "week") {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  } else {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  const totalMs = Math.max(1, end.getTime() - start.getTime());
  const remainingMs = Math.max(0, end.getTime() - now.getTime());
  return { totalMs, remainingMs, remainingRatio: remainingMs / totalMs };
}

function renderLifetime(now) {
  if (!state.birthDate) {
    el.aliveSeconds.textContent = "--";
    el.aliveMinutes.textContent = "--";
    el.aliveHours.textContent = "--";
    el.aliveDays.textContent = "--";
    el.aliveDerived.textContent = "Set birth date to calculate";
    return;
  }

  const birth = parseBirthDateTime(state.birthDate, state.birthTime);
  if (!birth || birth.getTime() > now.getTime()) {
    el.aliveDerived.textContent = "Birth date/time is invalid";
    return;
  }

  const aliveMs = Math.max(0, now.getTime() - birth.getTime());
  const seconds = Math.floor(aliveMs / 1000);
  const minutes = Math.floor(aliveMs / 60000);
  const hours = Math.floor(aliveMs / 3600000);
  const days = Math.floor(aliveMs / 86400000);

  el.aliveSeconds.textContent = formatInt(seconds);
  el.aliveMinutes.textContent = formatInt(minutes);
  el.aliveHours.textContent = formatInt(hours);
  el.aliveDays.textContent = formatInt(days);

  const derived = diffCalendarAge(birth, now);
  el.aliveDerived.textContent = `${derived.years}y ${derived.months}m ${derived.days}d`;
}

function parseBirthDateTime(datePart, timePart) {
  if (!datePart) return null;
  const time = timePart && timePart.length > 0 ? timePart : "00:00:00";
  const [year, month, day] = datePart.split("-").map(Number);
  const [h, m, s] = time.split(":").map(Number);
  const dt = new Date(year, (month || 1) - 1, day || 1, h || 0, m || 0, s || 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== year || dt.getMonth() !== (month || 1) - 1 || dt.getDate() !== (day || 1)) return null;
  return dt;
}

function diffCalendarAge(from, to) {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();

  if (days < 0) {
    const prevMonthEnd = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    days += prevMonthEnd;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
}

function formatDuration(ms, includeDays, showSeconds) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (includeDays) {
    return `${days}d ${hh}:${mm}${showSeconds ? `:${ss}` : ""}`;
  }
  return `${hh}:${mm}${showSeconds ? `:${ss}` : ""}`;
}

function setProgress(node, ratio) {
  node.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
}

function formatInt(value) {
  return new Intl.NumberFormat().format(value);
}

function hydrateUI() {
  el.birthDate.value = state.birthDate || "";
  el.birthTime.value = state.birthTime || "";
  updateToggleButtons();
  applyAnimationPreference();

  document.querySelectorAll(".toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.setting;
      const rawValue = button.dataset.value;
      const parsed = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;
      state.preferences[key] = parsed;
      updateToggleButtons();
      applyAnimationPreference();
      saveState();
      playTone("ui");
    });
  });

  el.birthForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const birth = parseBirthDateTime(el.birthDate.value, el.birthTime.value);
    if (!birth) {
      el.birthError.textContent = "Please provide a valid birth date/time.";
      return;
    }
    if (birth.getTime() > Date.now()) {
      el.birthError.textContent = "Birth date/time cannot be in the future.";
      return;
    }

    state.birthDate = el.birthDate.value;
    state.birthTime = el.birthTime.value;
    el.birthError.textContent = "";
    saveState();
    playTone("ui");
    renderLifetime(new Date());
  });

  document.body.addEventListener(
    "pointerdown",
    () => {
      initAudio();
    },
    { once: true }
  );
}

function updateToggleButtons() {
  document.querySelectorAll(".toggle").forEach((button) => {
    const key = button.dataset.setting;
    const rawValue = button.dataset.value;
    const parsed = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;
    button.setAttribute("aria-pressed", String(state.preferences[key] === parsed));
  });
}

function applyAnimationPreference() {
  document.body.classList.toggle("no-anim", !state.preferences.animationsEnabled);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      birthDate: parsed.birthDate || "",
      birthTime: parsed.birthTime || "",
      preferences: {
        ...defaultState.preferences,
        ...(parsed.preferences || {}),
      },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initAudio() {
  if (audioCtx.context) return;
  audioCtx.context = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.ready = true;
}

function playTone(type) {
  if (!state.preferences.soundEnabled || !audioCtx.ready) return;
  const ctx = audioCtx.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  const map = {
    tick: { freq: 620, dur: 0.03, vol: 0.03 },
    minute: { freq: 740, dur: 0.05, vol: 0.05 },
    hour: { freq: 880, dur: 0.09, vol: 0.06 },
    day: { freq: 440, dur: 0.12, vol: 0.07 },
    ui: { freq: 700, dur: 0.04, vol: 0.04 },
  };
  const cfg = map[type] || map.tick;

  osc.frequency.setValueAtTime(cfg.freq, now);
  gain.gain.setValueAtTime(cfg.vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur);
  osc.start(now);
  osc.stop(now + cfg.dur);
}

function playMilestones(now) {
  if (!state.preferences.soundEnabled) return;

  if (state.preferences.showSeconds) playTone("tick");

  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  if (minuteKey !== lastMilestones.minute) {
    lastMilestones.minute = minuteKey;
    playTone("minute");
  }

  const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  if (hourKey !== lastMilestones.hour && now.getMinutes() === 0) {
    lastMilestones.hour = hourKey;
    playTone("hour");
  }

  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  if (dayKey !== lastMilestones.day && now.getHours() === 0 && now.getMinutes() === 0) {
    lastMilestones.day = dayKey;
    playTone("day");
  }
}
