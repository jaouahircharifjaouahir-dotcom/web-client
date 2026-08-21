/**
 * Build FR/ES Blogger themes from the English source.
 * Blogger API v3 cannot upload themes; files are for Restore / later API if Google adds it.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "docs/blogger-theme.xml"), "utf8");

const locales = {
  fr: {
    dir: "themes/fr",
    host: "https://fr.11tik.com",
    lang: "fr",
    locale: "fr_FR",
    title: "Extracteur de miniatures YouTube – Télécharger des miniatures HD",
    description:
      "Téléchargez gratuitement la miniature YouTube de plus haute qualité disponible. Extrayez des images HD depuis une URL YouTube ou Shorts.",
    notFound: "Page introuvable | 11tik",
    notFoundH1: "Cette page n’est pas sur 11tik",
    notFoundP:
      "Le lien est cassé ou la page a été retirée. Vous serez redirigé vers l’extracteur dans <span id='yte-404-count'>5</span> secondes.",
    goNow: "Aller sur 11tik maintenant",
    h1: "Extracteur de miniatures YouTube",
    intro:
      "Collez une URL YouTube ou Vimeo publique pour télécharger la miniature publique de plus haute qualité dans le navigateur. 11tik vérifie les fichiers image réels.",
    howto: "Comment télécharger une miniature YouTube en HD ?",
    crumbHome: "Accueil",
  },
  es: {
    dir: "themes/es",
    host: "https://es.11tik.com",
    lang: "es",
    locale: "es_ES",
    title: "Extractor de miniaturas de YouTube – Descargar miniaturas HD",
    description:
      "Descarga gratis la miniatura de YouTube de mayor calidad disponible. Extrae imágenes HD de cualquier URL de YouTube o Shorts.",
    notFound: "Página no encontrada | 11tik",
    notFoundH1: "Esta página no está en 11tik",
    notFoundP:
      "El enlace está roto o la página se eliminó. Irás al extractor en <span id='yte-404-count'>5</span> segundos.",
    goNow: "Ir a 11tik ahora",
    h1: "Extractor de miniaturas de YouTube",
    intro:
      "Pega una URL pública de YouTube o Vimeo para descargar la miniatura pública de mayor calidad en el navegador. 11tik comprueba archivos de imagen reales.",
    howto: "¿Cómo descargo una miniatura de YouTube en HD?",
    crumbHome: "Inicio",
  },
};

function localize(xml, loc) {
  let out = xml.replace("dir='ltr' lang='en'", `dir='ltr' lang='${loc.lang}'`);
  out = out.replaceAll("en_US", loc.locale);
  out = out.replaceAll('"inLanguage":"en"', `"inLanguage":"${loc.lang}"`);
  out = out.replace("Page not found | 11tik", loc.notFound);
  out = out.replace("This page is not on 11tik", loc.notFoundH1);
  out = out.replace(
    "The link is broken or the page was removed. You will be taken to the thumbnail extractor in <span id='yte-404-count'>5</span> seconds.",
    loc.notFoundP,
  );
  out = out.replace("Go to 11tik now", loc.goNow);
  out = out.replaceAll("YouTube Thumbnail Extractor – Download HD YouTube Thumbnails", loc.title);
  out = out.replaceAll(
    "Download YouTube thumbnails instantly in the highest available quality, free. Extract HD images from any YouTube video or Shorts URL.",
    loc.description,
  );
  out = out.replace("<h1>YouTube Thumbnail Extractor</h1>", `<h1>${loc.h1}</h1>`);
  out = out.replace(">Home</a> / YouTube Thumbnail Extractor", `>${loc.crumbHome}</a> / ${loc.h1}`);
  out = out.replace(
    "Paste a public YouTube or Vimeo URL to download the highest available public thumbnail in your browser. 11tik checks real image files, lists only sizes that exist, and does not upload your link to an 11tik server.",
    loc.intro,
  );
  out = out.replace("How do I download a YouTube thumbnail in HD?", loc.howto);
  out = out.replaceAll("https://www.11tik.com/' rel='canonical'", `${loc.host}/' rel='canonical'`);
  out = out.replaceAll("content='https://www.11tik.com/' property='og:url'", `content='${loc.host}/' property='og:url'`);
  out = out.replace("5;url=https://www.11tik.com/", `5;url=${loc.host}/`);
  out = out.replaceAll("var home = 'https://www.11tik.com/';", `var home = '${loc.host}/';`);
  out = out.replaceAll("a.setAttribute('href', 'https://www.11tik.com/');", `a.setAttribute('href', '${loc.host}/');`);
  out = out.replaceAll("brand.setAttribute('href', 'https://www.11tik.com/');", `brand.setAttribute('href', '${loc.host}/');`);
  out = out.replaceAll("https://www.11tik.com/#", `${loc.host}/#`);
  out = out.replaceAll('"url":"https://www.11tik.com/"', `"url":"${loc.host}/"`);
  out = out.replaceAll('"item":"https://www.11tik.com/"', `"item":"${loc.host}/"`);
  return out;
}

for (const loc of Object.values(locales)) {
  const dir = join(root, loc.dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "blogger-theme.xml"), localize(source, loc));
  console.log("wrote", loc.dir);
}
