import { DEFAULTS, PRESETS } from "../src/lib/defaults.js";
import { Cfg } from "../src/lib/storage.js";

const $ = (id) => document.getElementById(id);

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

async function init() {
  renderPresets();
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
