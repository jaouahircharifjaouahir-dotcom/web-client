export type UiLocale = "en" | "fr" | "es";

export function readLocale(): UiLocale {
  if (typeof window === "undefined") return "en";
  const host = window.location.hostname;
  if (host === "fr.11tik.com") return "fr";
  if (host === "es.11tik.com") return "es";
  return "en";
}

export function localeHomeUrl(): string {
  const locale = readLocale();
  if (locale === "fr") return "https://fr.11tik.com/";
  if (locale === "es") return "https://es.11tik.com/";
  return "https://www.11tik.com/";
}

export function publicOrigin(): string {
  return localeHomeUrl().replace(/\/$/, "");
}

const UI = {
  en: {
    posts: "Posts",
    bulk: "Bulk",
    theme: "Theme",
    pasteOne: "Paste a YouTube or Vimeo URL (Shorts, live, youtu.be, and vimeo.com).",
    pasteBulk: "Paste one YouTube or Vimeo URL per line.",
    pasteBulkPh: "Paste one YouTube or Vimeo URL per line",
    pasteOnePh: "Paste YouTube or Vimeo URL",
    finding: "Finding thumbnail…",
    extractAll: "Extract all",
    getThumb: "Get Thumbnail Image",
    copyShare: "Copy share link",
    share: "Share",
    extracting: "Extracting thumbnails",
    ready: "Thumbnail ready",
    download: "Download",
    copyImage: "Copy image URL",
    openFull: "Open full resolution",
    unknownSize: "Unknown size",
    best: "BEST · ",
    shareLink: "SHARE LINK",
    idsOk: "valid video ID",
    idsOkPlural: "valid video IDs",
    noIds: "No video IDs found yet.",
    validId: "Valid",
    noId: "No supported video ID found in that text.",
    foot: "Public YouTube thumbnails only. No accounts, no video download, no tracking of pasted URLs.",
    heroTitle: "YouTube Thumbnail Extractor",
    heroIntro:
      "Download YouTube and Vimeo thumbnails instantly in the highest available quality, completely free. Extract and save HD thumbnail images from any public YouTube video, Shorts, or Vimeo URL with one click. Paste a link below, click Get Thumbnail Image, then download or share a ready link.",
    INVALID_URL: "Paste a public YouTube or Vimeo URL (TikTok/Instagram thumbnails are not supported yet).",
    UNSUPPORTED_HOST: "Only YouTube and Vimeo public URLs are supported right now.",
    INVALID_VIDEO_ID: "Could not find a valid video ID in that link.",
    THUMBNAIL_NOT_FOUND: "No public thumbnail was found for this video.",
    NETWORK_ERROR: "A network error stopped thumbnail discovery. Try again.",
    TIMEOUT: "Thumbnail discovery timed out. Try again.",
    IMAGE_VALIDATION_FAILED: "The thumbnail could not be verified as a valid image.",
    DOWNLOAD_FAILED: "The file could not be downloaded. Try opening the image instead.",
    CHANNEL_OR_PLAYLIST:
      "Paste video URLs, not a channel or playlist link. The browser cannot list a channel’s videos without a YouTube API.",
  },
  fr: {
    posts: "Articles",
    bulk: "Lot",
    theme: "Thème",
    pasteOne: "Collez une URL YouTube ou Vimeo (Shorts, live, youtu.be et vimeo.com).",
    pasteBulk: "Collez une URL YouTube ou Vimeo par ligne.",
    pasteBulkPh: "Une URL YouTube ou Vimeo par ligne",
    pasteOnePh: "Collez une URL YouTube ou Vimeo",
    finding: "Recherche de la miniature…",
    extractAll: "Tout extraire",
    getThumb: "Obtenir la miniature",
    copyShare: "Copier le lien de partage",
    share: "Partager",
    extracting: "Extraction des miniatures",
    ready: "Miniature prête",
    download: "Télécharger",
    copyImage: "Copier l’URL de l’image",
    openFull: "Ouvrir en pleine résolution",
    unknownSize: "Taille inconnue",
    best: "MEILLEURE · ",
    shareLink: "LIEN DE PARTAGE",
    idsOk: "ID vidéo valide",
    idsOkPlural: "ID vidéo valides",
    noIds: "Aucun ID vidéo pour l’instant.",
    validId: "ID",
    noId: "Aucun ID vidéo pris en charge dans ce texte.",
    foot: "Miniatures YouTube publiques uniquement. Pas de compte, pas de téléchargement vidéo, pas de suivi des URL collées.",
    heroTitle: "Extracteur de miniatures YouTube",
    heroIntro:
      "Téléchargez gratuitement la miniature YouTube ou Vimeo publique de plus haute qualité disponible. Collez un lien, cliquez sur Obtenir la miniature, puis enregistrez ou partagez.",
    INVALID_URL: "Collez une URL YouTube ou Vimeo publique (TikTok et Instagram ne sont pas pris en charge).",
    UNSUPPORTED_HOST: "Seules les URL publiques YouTube et Vimeo sont prises en charge.",
    INVALID_VIDEO_ID: "Impossible de trouver un ID vidéo valide dans ce lien.",
    THUMBNAIL_NOT_FOUND: "Aucune miniature publique n’a été trouvée pour cette vidéo.",
    NETWORK_ERROR: "Une erreur réseau a interrompu la découverte. Réessayez.",
    TIMEOUT: "Délai dépassé. Réessayez.",
    IMAGE_VALIDATION_FAILED: "L’image n’a pas pu être vérifiée.",
    DOWNLOAD_FAILED: "Le fichier n’a pas pu être téléchargé. Ouvrez l’image à la place.",
    CHANNEL_OR_PLAYLIST: "Collez des URL de vidéos, pas une chaîne ou une playlist.",
  },
  es: {
    posts: "Artículos",
    bulk: "Lote",
    theme: "Tema",
    pasteOne: "Pega una URL de YouTube o Vimeo (Shorts, en directo, youtu.be y vimeo.com).",
    pasteBulk: "Pega una URL de YouTube o Vimeo por línea.",
    pasteBulkPh: "Una URL de YouTube o Vimeo por línea",
    pasteOnePh: "Pega una URL de YouTube o Vimeo",
    finding: "Buscando la miniatura…",
    extractAll: "Extraer todo",
    getThumb: "Obtener miniatura",
    copyShare: "Copiar enlace para compartir",
    share: "Compartir",
    extracting: "Extrayendo miniaturas",
    ready: "Miniatura lista",
    download: "Descargar",
    copyImage: "Copiar URL de la imagen",
    openFull: "Abrir a resolución completa",
    unknownSize: "Tamaño desconocido",
    best: "MEJOR · ",
    shareLink: "ENLACE PARA COMPARTIR",
    idsOk: "ID de vídeo válido",
    idsOkPlural: "IDs de vídeo válidos",
    noIds: "Aún no hay IDs de vídeo.",
    validId: "ID",
    noId: "No hay un ID de vídeo compatible en ese texto.",
    foot: "Solo miniaturas públicas de YouTube. Sin cuentas, sin descarga de vídeo y sin seguimiento de las URL pegadas.",
    heroTitle: "Extractor de miniaturas de YouTube",
    heroIntro:
      "Descarga gratis la miniatura pública de YouTube o Vimeo de mayor calidad disponible. Pega un enlace, pulsa Obtener miniatura y guarda o comparte.",
    INVALID_URL: "Pega una URL pública de YouTube o Vimeo (TikTok e Instagram no están admitidos).",
    UNSUPPORTED_HOST: "Ahora mismo solo se admiten URL públicas de YouTube y Vimeo.",
    INVALID_VIDEO_ID: "No se encontró un ID de vídeo válido en ese enlace.",
    THUMBNAIL_NOT_FOUND: "No se encontró una miniatura pública para este vídeo.",
    NETWORK_ERROR: "Un error de red detuvo la búsqueda. Inténtalo de nuevo.",
    TIMEOUT: "Se agotó el tiempo. Inténtalo de nuevo.",
    IMAGE_VALIDATION_FAILED: "No se pudo comprobar la imagen.",
    DOWNLOAD_FAILED: "No se pudo descargar el archivo. Abre la imagen en su lugar.",
    CHANNEL_OR_PLAYLIST: "Pega URL de vídeos, no un canal o una lista.",
  },
} as const;

export type UiKey = keyof typeof UI.en;

export function t(key: UiKey): string {
  const locale = readLocale();
  return UI[locale][key] || UI.en[key];
}
