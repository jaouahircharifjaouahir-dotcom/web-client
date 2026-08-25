/**
 * OpenAI build-time translation provider adapter.
 * Never imported from browser/Worker bundles.
 */
import { collectProtectedTokens, protectText, restoreStructured } from "./translate-protect.mjs";
import { withRetry, sleep } from "./rate-limiter.mjs";

const SYSTEM_PROMPT = `You are a professional translator for 11tik.com SEO content.
Translate the JSON payload into the target locale language.
Rules:
- Return ONLY valid JSON matching the input schema (same keys/structure).
- Translate human-readable prose only.
- Do NOT translate or alter: URLs, href values, src values, domain names, filenames, YouTube video IDs, code blocks, HTML tag names/attributes, placeholder tokens like __PRESERVE_N__, the brand name "11tik".
- Preserve all HTML tags and structure in html/answerHtml/captionHtml fields.
- Keep section count and FAQ count identical to the source.
- Preserve technical terms inside <code> and <pre> exactly.`;

export async function translateStructuredPayload(sourcePayload, { locale, localeName, env, signal }) {
  const blob = JSON.stringify(sourcePayload, null, 2);
  const tokens = collectProtectedTokens(blob);
  const { text: protectedBlob, map } = protectText(blob, tokens);

  const userPrompt = `Target locale: ${locale} (${localeName || locale})
Translate this JSON document:

${protectedBlob}`;

  const body = {
    model: env.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  };

  const base = env.baseUrl?.replace(/\/+$/, "") || "https://api.openai.com/v1";
  const url = `${base}/chat/completions`;

  const response = await withRetry(
    async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const err = new Error(`OpenAI HTTP ${res.status}: ${detail.slice(0, 200)}`);
        err.status = res.status;
        err.retryable = res.status === 429 || res.status >= 500;
        throw err;
      }
      return res;
    },
    { maxRetries: env.maxRetries, baseDelayMs: 1000 },
  );

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON content");
  }

  return {
    data: restoreStructured(parsed, map),
    usage: data.usage || null,
  };
}

/** Minimal connectivity check — one tiny translation. */
export async function smokeTestOpenAI(env) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.timeoutMs);
  try {
    const result = await translateStructuredPayload(
      { ping: "Hello from 11tik build-time translation smoke test." },
      { locale: "fr", localeName: "French", env, signal: controller.signal },
    );
    return { ok: Boolean(result?.data?.ping ?? result?.ping), provider: "openai" };
  } finally {
    clearTimeout(timer);
  }
}

export async function delayBetweenCalls(env) {
  if (env.rateLimitMs > 0) await sleep(env.rateLimitMs);
}
