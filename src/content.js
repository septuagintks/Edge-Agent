/*
 * Content script for AI Summary extension.
 *
 * Status: scaffold. Renders a minimal floating button and an empty panel,
 * and proves end-to-end streaming via the service worker port.
 *
 * TODO (port from the userscript):
 *   - Full panel UI (header, meta, body, footer, chat input)
 *   - Settings panel + presets
 *   - Drag, snap-to-edge, hover pop-out
 *   - Markdown rendering, toasts, copy
 *   - Stop / re-summarize / multi-round chat
 * The userscript at ../AI-summary is the source of truth for behavior.
 */
(() => {
  if (window.__aiSummaryInjected) return;
  window.__aiSummaryInjected = true;

  /* ---------- Inline content extraction (mirrors src/lib/extract.js) ---------- */
  const STRIP_SEL = [
    "script", "style", "noscript", "iframe", "svg", "canvas",
    "nav", "header", "footer", "aside",
    '[role="navigation"]',
    '[class*="navbar"]', '[class*="nav-"]', '[id*="nav-"]',
    '[class*="sidebar"]', '[class*="side-bar"]',
    '[class*="comment"]', '[class*="footer"]', '[class*="header"]',
    '[class*="banner"]',
    '[class*="advertisement"]', '[class*="-ads"]', '[class*="ads-"]', '[id*="ads"]',
    '[class*="popup"]', '[class*="modal"]', '[class*="cookie"]',
    ".share", ".social", ".related", ".recommend",
  ];
  const CONTENT_SEL = [
    "article", '[role="main"]', "main",
    ".article-content", ".article-body", ".post-content", ".entry-content",
    ".content-body", ".news-content", ".detail-content", ".story-content",
    "#article", "#content", "#main-content",
  ];
  const cleanText = (t) => String(t || "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  function extractContent() {
    try {
      const clone = document.documentElement.cloneNode(true);
      for (const sel of STRIP_SEL) {
        try { clone.querySelectorAll(sel).forEach((e) => e.remove()); } catch {}
      }
      for (const sel of CONTENT_SEL) {
        const el = clone.querySelector(sel);
        if (el) {
          const t = (el.innerText || el.textContent || "").trim();
          if (t.length > 300) return cleanText(t);
        }
      }
      const body = clone.querySelector("body");
      return cleanText(body?.innerText || body?.textContent || document.body.textContent || "");
    } catch {
      return cleanText(document.body.textContent || "");
    }
  }

  /* ---------- Minimal UI (placeholder) ---------- */
  const wrap = document.createElement("div");
  wrap.id = "ais-fab-wrap";

  const fab = document.createElement("button");
  fab.id = "ais-fab";
  fab.title = "AI Content Summary";
  fab.textContent = "📍";
  wrap.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "ais-main";
  panel.className = "ais-off";
  panel.innerHTML = `
    <div class="ais-hd">
      <span class="ais-hd-title">🤖 AI Content Summary</span>
      <button class="ais-hbtn" id="ais-cfg-open">⚙️</button>
      <button class="ais-hbtn" id="ais-main-close">✕</button>
    </div>
    <div class="ais-meta" id="ais-meta"></div>
    <div class="ais-body" id="ais-body">
      <div class="ais-ph">Click "Start Summary" to analyze this page.</div>
    </div>
    <div class="ais-ft">
      <button class="ais-btn ais-danger" id="ais-stop" style="display:none">⏹ Stop</button>
      <button class="ais-btn ais-primary" id="ais-run">✨ Start Summary</button>
    </div>
  `;

  document.body.appendChild(wrap);
  document.body.appendChild(panel);

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const toggle = (id, show) => $(id)?.classList.toggle("ais-off", !show);

  let panelOpen = false;
  let currentPort = null;

  fab.addEventListener("click", () => {
    panelOpen = !panelOpen;
    toggle("ais-main", panelOpen);
  });
  $("ais-main-close").addEventListener("click", () => {
    panelOpen = false;
    toggle("ais-main", false);
  });
  $("ais-cfg-open").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open-options" }).catch(() => {});
  });
  $("ais-run").addEventListener("click", runSummary);
  $("ais-stop").addEventListener("click", stopSummary);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "open-and-summarize") {
      panelOpen = true;
      toggle("ais-main", true);
      runSummary();
    }
  });

  function setBody(html) { $("ais-body").innerHTML = html; }

  async function runSummary() {
    if (currentPort) return;
    const content = extractContent();
    const title = document.title;
    if (!content || content.length < 50) {
      setBody(`<div class="ais-err">❌ Page content extraction failed or content is too short.</div>`);
      return;
    }

    $("ais-meta").textContent = `📄 ${title}  ·  Extracted ${content.length} chars`;
    $("ais-stop").style.display = "";
    $("ais-run").style.display = "none";
    setBody(`<div class="ais-loading"><div class="ais-spinner"></div> AI is analyzing...</div>`);

    // Build a minimal user message; full prompt templating will be ported with the rest of the UI.
    const cfg = await chrome.storage.local.get(["userPrompt", "maxContentLength"]);
    const userPrompt = cfg.userPrompt ||
      "Please summarize the following webpage.\n\nTitle: {title}\n\nContent:\n{content}";
    const maxLen = cfg.maxContentLength || 16000;
    const userMsg = userPrompt
      .replace("{title}", title)
      .replace("{content}", String(content).slice(0, maxLen));

    const port = chrome.runtime.connect({ name: "ai-call" });
    currentPort = port;
    let lastText = "";

    port.onMessage.addListener((msg) => {
      if (msg.type === "chunk") {
        lastText = msg.text;
        setBody(`<div class="ais-res">${esc(lastText)}</div>`);
      } else if (msg.type === "done") {
        finishCall();
        setBody(`<div class="ais-res">${esc(msg.text || lastText || "(empty)")}</div>`);
      } else if (msg.type === "error") {
        finishCall();
        setBody(`<div class="ais-err">❌ ${esc(msg.error)}</div>`);
      }
    });
    port.onDisconnect.addListener(finishCall);

    port.postMessage({ type: "start", messages: [{ role: "user", content: userMsg }] });
  }

  function stopSummary() {
    if (currentPort) {
      try { currentPort.disconnect(); } catch {}
    }
    finishCall();
  }

  function finishCall() {
    currentPort = null;
    $("ais-stop").style.display = "none";
    $("ais-run").style.display = "";
  }
})();
