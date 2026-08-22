export type ExtraKey =
  | "language"
  | "legalTitle"
  | "legalQ1"
  | "legalA1"
  | "legalQ2"
  | "legalA2"
  | "legalQ3"
  | "legalA3"
  | "shareFacebook"
  | "shareTwitter"
  | "shareWhatsapp"
  | "shareTelegram"
  | "shareEmail"
  | "brandScore"
  | "compare"
  | "exportJson"
  | "channelHint"
  | "trustAbout"
  | "trustPrivacy"
  | "trustTerms"
  | "trustContact"
  | "trendingTags"
  | "relatedAlso"
  | "tagTranslate"
  | "holdQueue"
  | "statsTitle"
  | "guidePillar"
  | "packagingScore"
  | "socialShare";

const EN: Record<ExtraKey, string> = {
  language: "Language",
  legalTitle: "Copyright & Usage",
  legalQ1: "Is it legal to download YouTube thumbnails?",
  legalA1:
    "You may download publicly available thumbnails for personal reference, research, or educational analysis. Thumbnails remain the copyrighted property of their original creators. Obtain permission before reusing a thumbnail commercially, publishing it elsewhere, or using it as your own video's cover art.",
  legalQ2: "Are there copyright risks?",
  legalA2:
    "Yes, if reused without permission. Using a thumbnail as inspiration or for private study carries minimal risk. Republishing it as-is (on another channel, a blog, or merchandise) can trigger a copyright claim from the original creator or YouTube.",
  legalQ3: "Does 11tik store or claim ownership of thumbnails?",
  legalA3:
    "No. 11tik does not store, host, or claim rights to any thumbnail. Images are fetched directly from YouTube's public CDN in your browser and are never uploaded to or cached on 11tik servers as original media files.",
  shareFacebook: "Facebook",
  shareTwitter: "X",
  shareWhatsapp: "WhatsApp",
  shareTelegram: "Telegram",
  shareEmail: "Email",
  brandScore: "Brand consistency",
  compare: "Compare",
  exportJson: "Export JSON",
  channelHint: "Paste a channel URL to extract the latest public uploads.",
  trustAbout: "About",
  trustPrivacy: "Privacy",
  trustTerms: "Terms",
  trustContact: "Contact",
  trendingTags: "Trending tags",
  relatedAlso: "You may also like",
  tagTranslate: "Arabic",
  holdQueue: "Hold queue",
  statsTitle: "Thumbnail statistics",
  guidePillar: "YouTube thumbnails guide",
  packagingScore: "Packaging score",
  socialShare: "Share this page",
};

const AR: Partial<Record<ExtraKey, string>> = {
  language: "اللغة",
  legalTitle: "حقوق الاستخدام",
  legalQ1: "هل تحميل صور يوتيوب المصغرة قانوني؟",
  legalA1:
    "يمكنك تنزيل الصور المصغرة العامة للمرجع الشخصي أو البحث أو التحليل التعليمي. تبقى حقوق الصورة لصاحبها الأصلي. اطلب إذنا قبل الاستخدام التجاري أو النشر أو اتخاذها غلافا لفيديوك.",
  legalQ2: "هل هناك مخاطر حقوق؟",
  legalA2: "نعم عند إعادة النشر بلا إذن. الدراسة الخاصة منخفضة المخاطر. إعادة النشر كما هي قد تؤدي لمطالبة حقوق.",
  legalQ3: "هل 11tik يخزن الصور أو يدعي ملكيتها؟",
  legalA3: "لا. لا نخزن الصور ولا ندعي ملكيتها. تُجلب من شبكة يوتيوب العامة في متصفحك.",
  brandScore: "اتساق العلامة",
  compare: "مقارنة",
  exportJson: "تصدير JSON",
  channelHint: "الصق رابط قناة لاستخراج آخر الفيديوهات العامة.",
  trustAbout: "من نحن",
  trustPrivacy: "الخصوصية",
  trustTerms: "الشروط",
  trustContact: "تواصل",
  trendingTags: "الوسوم الرائجة",
  relatedAlso: "قد يعجبك أيضا",
  socialShare: "شارك الصفحة",
  packagingScore: "درجة التغليف",
  guidePillar: "دليل صور يوتيوب",
};

const FR: Partial<Record<ExtraKey, string>> = {
  language: "Langue",
  legalTitle: "Droits d’auteur",
  legalQ1: "Télécharger des miniatures YouTube est-il légal ?",
  legalA1:
    "Vous pouvez télécharger des miniatures publiques pour usage personnel, recherche ou analyse. Les droits restent aux créateurs. Demandez une autorisation avant un usage commercial.",
  shareFacebook: "Facebook",
  brandScore: "Cohérence de marque",
  compare: "Comparer",
  channelHint: "Collez l’URL d’une chaîne pour extraire les dernières vidéos publiques.",
  trustAbout: "À propos",
  trendingTags: "Tags tendance",
  relatedAlso: "Vous aimerez aussi",
  socialShare: "Partager",
};

const ES: Partial<Record<ExtraKey, string>> = {
  language: "Idioma",
  legalTitle: "Derechos de autor",
  legalQ1: "¿Es legal descargar miniaturas de YouTube?",
  legalA1:
    "Puedes descargar miniaturas públicas para referencia, investigación o análisis. Los derechos siguen siendo del creador. Pide permiso antes de un uso comercial.",
  brandScore: "Consistencia de marca",
  compare: "Comparar",
  channelHint: "Pega la URL de un canal para extraer los últimos vídeos públicos.",
  trustAbout: "Acerca de",
  trendingTags: "Etiquetas en tendencia",
  relatedAlso: "También te puede gustar",
  socialShare: "Compartir",
};

const DE: Partial<Record<ExtraKey, string>> = {
  language: "Sprache",
  legalTitle: "Urheberrecht",
  brandScore: "Markenkonsistenz",
  compare: "Vergleichen",
  channelHint: "Kanal-URL einfügen, um die neuesten öffentlichen Uploads zu extrahieren.",
  trustAbout: "Über uns",
  trendingTags: "Trending-Tags",
  relatedAlso: "Das könnte Ihnen auch gefallen",
  socialShare: "Teilen",
};

const PT: Partial<Record<ExtraKey, string>> = {
  language: "Idioma",
  legalTitle: "Direitos de autor",
  brandScore: "Consistência da marca",
  compare: "Comparar",
  channelHint: "Cole o URL de um canal para extrair os últimos vídeos públicos.",
  trustAbout: "Sobre",
  trendingTags: "Tags em tendência",
  relatedAlso: "Também pode gostar",
  socialShare: "Partilhar",
};

const RU: Partial<Record<ExtraKey, string>> = {
  language: "Язык",
  legalTitle: "Авторские права",
  brandScore: "Единство бренда",
  compare: "Сравнить",
  channelHint: "Вставьте ссылку на канал, чтобы извлечь последние публичные ролики.",
  trustAbout: "О проекте",
  trendingTags: "Популярные теги",
  relatedAlso: "Вам также может понравиться",
  socialShare: "Поделиться",
};

const PACKS: Record<string, Partial<Record<ExtraKey, string>>> = {
  en: EN,
  ar: AR,
  fr: FR,
  es: ES,
  de: DE,
  pt: PT,
  ru: RU,
};

export function tx(locale: string, key: ExtraKey): string {
  return PACKS[locale]?.[key] || EN[key];
}
