export function detectProvider(url) {
  if (url.includes("anthropic.com")) return "anthropic";
  if (url.includes("generativelanguage.googleapis")) return "gemini";
  return "openai";
}

export function buildRequest(cfg, messages) {
  const provider = detectProvider(cfg.apiUrl);

  if (provider === "anthropic") {
    return {
      url: cfg.apiUrl,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: +cfg.maxTokens,
        system: cfg.systemPrompt,
        messages,
        stream: cfg.stream,
      }),
    };
  }

  if (provider === "gemini") {
    let url = cfg.apiUrl.replace("{model}", cfg.model).replace("{key}", cfg.apiKey);
    if (cfg.stream) url = url.replace("generateContent", "streamGenerateContent") + "&alt=sse";

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    return {
      url,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: cfg.systemPrompt }] },
        generationConfig: {
          maxOutputTokens: +cfg.maxTokens,
          temperature: +cfg.temperature,
        },
      }),
    };
  }

  return {
    url: cfg.apiUrl,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: cfg.systemPrompt }, ...messages],
      max_tokens: +cfg.maxTokens,
      temperature: +cfg.temperature,
      stream: cfg.stream,
    }),
  };
}

export function parseStreamLine(provider, line) {
  if (!line.startsWith("data:")) return null;
  const raw = line.slice(5).trim();
  if (!raw) return null;
  try {
    if (provider === "anthropic") {
      const json = JSON.parse(raw);
      if (json.type === "message_stop") return "[DONE]";
      if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
        return json.delta.text;
      }
      return null;
    }
    if (provider === "gemini") {
      const data = JSON.parse(raw);
      const item = Array.isArray(data) ? data[0] : data;
      return item?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
    if (raw === "[DONE]") return "[DONE]";
    return JSON.parse(raw).choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

function normalizeSseText(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function splitSseEvents(text, flush = false) {
  const parts = normalizeSseText(text).split(/\n\n+/);
  if (flush) return { events: parts.filter(Boolean), rest: "" };
  return {
    events: parts.slice(0, -1).filter(Boolean),
    rest: parts[parts.length - 1] || "",
  };
}

export function processSseEvent(provider, event, onDelta) {
  for (const line of normalizeSseText(event).split("\n")) {
    const delta = parseStreamLine(provider, line.trim());
    if (delta === "[DONE]") return true;
    if (delta) onDelta(delta);
  }
  return false;
}

export function parseFullResponse(provider, responseText) {
  if (responseText.includes("data:")) {
    let result = "";
    const { events } = splitSseEvents(responseText, true);
    for (const event of events) {
      processSseEvent(provider, event, (delta) => { result += delta; });
    }
    if (result) return result;
  }
  try {
    const json = JSON.parse(responseText);
    if (provider === "anthropic") return json.content?.[0]?.text || "";
    if (provider === "gemini") {
      const item = Array.isArray(json) ? json[0] : json;
      return item?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    return json.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}
