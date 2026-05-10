import { DEFAULTS, PRESETS } from "../src/lib/defaults.js";
import { Cfg } from "../src/lib/storage.js";

const $ = (id) => document.getElementById(id);

const MODE_HINTS = {
  "off": "Opening the panel waits for you to click Start Summary.",
  "on-open": "Clicking the floating button opens the panel and immediately starts summarizing.",
  "implicit": "Summarization runs in the background as soon as the page finishes loading. Opening the panel shows progress or the finished result.",
};

let currentMode = "off";

function setMode(mode) {
  currentMode = mode;
  for (const btn of document.querySelectorAll("#f-mode .seg")) {
    btn.classList.toggle("active", btn.dataset.value === mode);
    btn.setAttribute("aria-checked", btn.dataset.value === mode ? "true" : "false");
  }
  $("f-mode-hint").textContent = MODE_HINTS[mode] || "";
}

function fillForm(cfg) {
  $("f-url").value = cfg.apiUrl ?? "";
  $("f-key").value = cfg.apiKey ?? "";
  $("f-model").value = cfg.model ?? "";
  $("f-tokens").value = cfg.maxTokens ?? 2048;
  $("f-maxlen").value = cfg.maxContentLength ?? 16000;
  $("f-temp").value = cfg.temperature ?? 0.7;
  $("f-stream").checked = !!cfg.stream;
  $("f-sys").value = cfg.systemPrompt ?? "";
  $("f-prompt").value = cfg.userPrompt ?? "";
  setMode(cfg.summarizeMode || "off");
}

function renderPresets() {
  const wrap = $("presets");
  wrap.innerHTML = "";
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pre";
    b.textContent = p.name;
    b.addEventListener("click", async () => {
      $("f-url").value = p.url;
      $("f-model").value = p.model;
      $("f-key").value = await Cfg.getProviderKey(p.id);
    });
    wrap.appendChild(b);
  }
}

function bindSegmented() {
  const root = $("f-mode");
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg");
    if (!btn) return;
    setMode(btn.dataset.value);
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const segs = [...root.querySelectorAll(".seg")];
    const i = segs.findIndex((s) => s.classList.contains("active"));
    const next = e.key === "ArrowLeft"
      ? segs[(i - 1 + segs.length) % segs.length]
      : segs[(i + 1) % segs.length];
    setMode(next.dataset.value);
    next.focus();
    e.preventDefault();
  });
}

async function init() {
  renderPresets();
  bindSegmented();
  fillForm(await Cfg.get());
}

$("save").addEventListener("click", async () => {
  const url = $("f-url").value.trim();
  const key = $("f-key").value.trim();
  const matched = PRESETS.find((p) => p.url === url);
  if (matched && key) await Cfg.setProviderKey(matched.id, key);

  await Cfg.set({
    apiUrl: url,
    apiKey: key,
    model: $("f-model").value.trim(),
    maxTokens: +$("f-tokens").value || DEFAULTS.maxTokens,
    maxContentLength: +$("f-maxlen").value || DEFAULTS.maxContentLength,
    temperature: parseFloat($("f-temp").value) || DEFAULTS.temperature,
    stream: $("f-stream").checked,
    summarizeMode: currentMode,
    systemPrompt: $("f-sys").value,
    userPrompt: $("f-prompt").value,
  });
  flash("✓ Saved");
});

$("reset").addEventListener("click", async () => {
  if (!confirm("Restore all default settings?")) return;
  await Cfg.reset();
  fillForm(DEFAULTS);
  flash("✓ Defaults restored");
});

function flash(text) {
  const el = $("status");
  el.textContent = text;
  setTimeout(() => { el.textContent = ""; }, 1800);
}

init();
