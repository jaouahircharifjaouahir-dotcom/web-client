/**
 * Provider router — build-time only.
 * Active provider: chrome_gtx (Google Translate extension engine).
 */
import { assertProviderReady, readProviderEnv } from "./provider-config.mjs";
import { smokeTestChromeGtx, translateStructuredPayload as chromeGtxTranslate } from "./provider-chrome-gtx.mjs";

export async function translateWithProvider(sourcePayload, locale, env = readProviderEnv()) {
  assertProviderReady();

  if (env.provider === "chrome_gtx") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.timeoutMs);
    try {
      return await chromeGtxTranslate(sourcePayload, { locale, env, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    `Unsupported provider: ${env.provider}. Use TRANSLATION_PROVIDER=chrome_gtx (NLLB/Google Cloud/OpenAI removed from active path).`,
  );
}

export async function providerSmokeTest(env = readProviderEnv()) {
  assertProviderReady();
  if (env.provider === "chrome_gtx") return smokeTestChromeGtx(env);
  throw new Error(`Smoke test not implemented for provider: ${env.provider}`);
}
