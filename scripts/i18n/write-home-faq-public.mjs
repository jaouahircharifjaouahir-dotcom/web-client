import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHomeFaqArtifact } from "./translate-home-faq.mjs";
import { getTargetLocales } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(ROOT, "public", "i18n", "home-faq");

function toPublicDoc(artifact) {
  if (!artifact?.faq?.length) return null;
  return {
    heading: artifact.faqHeading || "FAQ",
    items: artifact.faq.map((row) => ({
      question: row.question,
      answerHtml: row.answerHtml || row.answer || "",
    })),
  };
}

export function writeHomeFaqPublicFiles() {
  mkdirSync(OUT_DIR, { recursive: true });
  const locales = ["en", ...getTargetLocales()];
  let count = 0;
  for (const locale of locales) {
    const artifact = loadHomeFaqArtifact(locale);
    const doc = toPublicDoc(artifact);
    if (!doc) continue;
    writeFileSync(join(OUT_DIR, `${locale}.json`), `${JSON.stringify(doc, null, 2)}\n`);
    count += 1;
  }
  return { outDir: OUT_DIR, count };
}

const isMain = process.argv[1]?.endsWith("write-home-faq-public.mjs");
if (isMain) {
  const r = writeHomeFaqPublicFiles();
  console.log(`home-faq public: ${r.count} files → ${r.outDir}`);
}
