# Edge Agent — AI Summary

Microsoft Edge / Chromium extension port of the [AI-summary](septuagintks/AI-summary) Tampermonkey script.

One-click extraction of webpage main content, with intelligent summarization via AI APIs. Supports OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter and other compatible interfaces. Supports streaming output and multi-round follow-up chat.

**API key is stored locally in `chrome.storage.local` and never uploaded.**

## Status

Work in progress. Porting the Tampermonkey userscript to a Manifest V3 extension.

### Porting plan

| Userscript API | Extension replacement |
| --- | --- |
| `GM_xmlhttpRequest` (cross-origin + streaming) | `fetch` in the service worker, streamed back to the content script via `chrome.runtime.connect` |
| `GM_setValue` / `GM_getValue` | `chrome.storage.local` |
| `GM_addStyle` | `content_scripts.css` |
| `GM_registerMenuCommand` | Toolbar popup + `chrome.contextMenus` |

## Load unpacked (development)

1. Open `edge://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this directory.
4. Pin the extension and click its icon, or use the floating button injected into pages.

## Layout

```
manifest.json         MV3 manifest
src/
  background.js       Service worker: fetch + streaming relay
  content.js          Injected UI (floating button, panel)
  content.css         Panel styles (formerly GM_addStyle)
  lib/
    storage.js        chrome.storage wrapper (Cfg get/set/reset)
    providers.js      OpenAI / Anthropic / Gemini adapters
    extract.js        Main-content extraction
  popup/              Toolbar popup
options/              Full settings page
icons/                Toolbar / store icons
```

## License

Same as the upstream userscript.
