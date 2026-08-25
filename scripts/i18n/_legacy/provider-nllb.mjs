/**
 * Local NLLB-200 build-time translation provider (Transformers.js).
 * Never import from browser/Worker bundles.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { collectProtectedTokens, protectText, restoreProtected, restoreStructured } from "./translate-protect.mjs";
import { NLLB_SOURCE, nllbCodeForLocale } from "./nllb-locale-map.mjs";
import { selectNllbModel } from "./hardware-detect.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let translatorPromise = null;
let modelMeta = null;

async function getTranslator(env) {
  if (!translatorPromise) {
    const { pipeline, env: hfEnv } = await import("@huggingface/transformers");
    hfEnv.cacheDir = join(ROOT, "tmp", "hf-cache");
    const picked = selectNllbModel();
    modelMeta = { ...picked, ...(env.nllbModel ? { modelId: env.nllbModel } : {}) };
    translatorPromise = pipeline("translation", modelMeta.modelId, {
      dtype: env.nllbDtype || modelMeta.dtype,
    });
  }
  return translatorPromise;
}

export function getNllbModelMeta() {
  return modelMeta || selectNllbModel();
}

async function translatePlainText(text, tgtNllb, env) {
  const raw = String(text || "").trim();
  if (!raw) return raw;
  const tokens = collectProtectedTokens(raw);
  const { text: protectedText, map } = protectText(raw, tokens);
  const translator = await getTranslator(env);
  const out = await translator(protectedText, {
    src_lang: NLLB_SOURCE,
    tgt_lang: tgtNllb,
  });
  const translated = out?.[0]?.translation_text || "";
  return restoreProtected(translated, map);
}

function isTranslatableKey(key, value, path = "") {
  if (typeof value !== "string") return false;
  if (!value.trim()) return false;
  if (key === "src") return false;
  if (path.endsWith(".src")) return false;
  return true;
}

async function walkTranslate(obj, tgtNllb, env, path = "") {
  if (typeof obj === "string") {
    return isTranslatableKey("", obj, path) ? translatePlainText(obj, tgtNllb, env) : obj;
  }
  if (Array.isArray(obj)) {
    const out = [];
    for (let i = 0; i < obj.length; i++) {
      out.push(await walkTranslate(obj[i], tgtNllb, env, `${path}[${i}]`));
    }
    return out;
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      const p = path ? `${path}.${key}` : key;
      if (isTranslatableKey(key, value, p)) {
        out[key] = await translatePlainText(value, tgtNllb, env);
      } else if (typeof value === "object" && value !== null) {
        out[key] = await walkTranslate(value, tgtNllb, env, p);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  return obj;
}

export async function translateStructuredPayload(sourcePayload, { locale, env }) {
  const tgtNllb = nllbCodeForLocale(locale);
  if (!tgtNllb) throw new Error(`Locale ${locale} is not supported by local NLLB model`);
  const data = await walkTranslate(sourcePayload, tgtNllb, env);
  return { data: restoreStructured(data, new Map()), usage: null, nllbCode: tgtNllb };
}

export async function smokeTestNllb(env) {
  const out = await translatePlainText("Hello from 11tik local NLLB smoke test.", "fra_Latn", env);
  return { ok: Boolean(out && out.length > 3), provider: "local_nllb", sample: out?.slice(0, 80) };
}

export async function probeLocale(locale, env) {
  const tgt = nllbCodeForLocale(locale);
  if (!tgt) return { locale, ok: false, reason: "no-nllb-mapping" };
  try {
    const text = await translatePlainText("Hello", tgt, env);
    return { locale, ok: Boolean(text), nllb: tgt, sample: text };
  } catch (err) {
    return { locale, ok: false, nllb: tgt, error: String(err.message || err).slice(0, 120) };
  }
}

export async function resetTranslator() {
  translatorPromise = null;
  modelMeta = null;
}
