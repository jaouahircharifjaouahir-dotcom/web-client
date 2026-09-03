import { ISO6391 } from "../../workers/iso6391.js";
import { THUMB_LOCALE_PACKS } from "./thumb-locale-packs";
import { uiFoot, uiHeroIntro } from "./uiCatalog";

export type PageKey =
  | "trendingTags"
  | "guidePillar"
  | "statsTitle"
  | "trustAbout"
  | "trustPrivacy"
  | "trustTerms"
  | "trustContact"
  | "legalTitle"
  | "legalQ1"
  | "legalA1"
  | "legalQ2"
  | "legalA2"
  | "legalQ3"
  | "legalA3"
  | "aboutTitle"
  | "aboutBody"
  | "privacyTitle"
  | "privacyBody"
  | "termsTitle"
  | "termsBody"
  | "contactTitle"
  | "contactBody"
  | "statsBody"
  | "guideTitle"
  | "guideBody"
  | "trendingIntro"
  | "embedTitle"
  | "embedBody"
  | "keywordsTitle"
  | "keywordsBody"
  | "thumbHeading"
  | "thumbLead"
  | "thumbBody"
  | "thumbRights"
  | "thumbSizes"
  | "thumbCta"
  | "thumbImgAlt";

type Pack = Partial<Record<PageKey, string>>;

const EN: Record<PageKey, string> = {
  trendingTags: "Trending tags",
  guidePillar: "YouTube thumbnails guide",
  statsTitle: "Thumbnail statistics",
  trustAbout: "About",
  trustPrivacy: "Privacy",
  trustTerms: "Terms",
  trustContact: "Contact",
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
  aboutTitle: "About 11tik",
  aboutBody:
    "11tik is a free YouTube thumbnail extractor. Paste a public video URL to preview real public stills and download the highest file that exists. Nothing is uploaded to an 11tik server.",
  privacyTitle: "Privacy",
  privacyBody:
    "Pasted URLs are processed in your browser. 11tik does not require an account and does not store the original thumbnail files. Optional local history stays on your device until you clear it. Analytics, when loaded, use the 11tik.com cookie domain.",
  termsTitle: "Terms of use",
  termsBody:
    "Use 11tik only with public URLs you are allowed to open. You are responsible for how you reuse any thumbnail. 11tik provides a browser tool, not a license to the image. See Copyright & Usage for creator rights.",
  contactTitle: "Contact",
  contactBody: "Email 11tik at jaouahircharifjaouahir@gmail.com for product questions, privacy requests, or rights notices.",
  statsBody:
    "These counts grow only from real extractions and capped trending seeds that pass the quality gate: a complete title, tags, and a live public thumbnail.",
  guideTitle: "The complete YouTube thumbnails guide",
  guideBody:
    "A YouTube thumbnail is the public still viewers see before they press play. 11tik only reads files YouTube already hosts on i.ytimg.com. Start with a public watch, Shorts, live, or youtu.be link. The tool keeps files that are real images and ranks the highest published size. Bulk mode accepts one public video URL per line (up to 50).",
  trendingIntro: "Tags collected from public extractions that passed the quality gate.",
  embedTitle: "Embed the 11tik Thumbnail Extractor",
  embedBody:
    "Add a free YouTube thumbnail extractor to your blog, docs, or creator toolkit. The widget loads from 11tik and resizes itself. No API key.\n\nKeep id=\"yte-app\" on the iframe so height sync works. Do not wrap the iframe in a fixed height that clips the download buttons. Linking back to the 11tik homepage helps users open the full tool.\n\nShare a ready extraction with /?v=VIDEO_ID.",
  keywordsTitle: "Keyword tools",
  keywordsBody: "Each link opens the YouTube Thumbnail Extractor with an intro for that topic.",
  thumbHeading: "{title} thumbnail",
  thumbLead:
    "Public still for “{title}”. 11tik only lists image files the host already publishes. Nothing is ripped from the video stream and the original upload is not stored on 11tik.",
  thumbBody:
    "Use the extractor on this page to preview every public size that actually returns an image, then download the largest valid file. Typical YouTube names are maxresdefault, hq720, sddefault, hqdefault, mqdefault, and default.",
  thumbRights:
    "The thumbnail stays the copyrighted work of the uploader. Personal reference, research, and fair study are typical uses. Do not republish it as your own cover art or merchandise.",
  thumbSizes: "Checked public sizes: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
  thumbCta: "Extract another thumbnail",
  thumbImgAlt: "{title} thumbnail | 11tik",
};

const PACKS: Record<string, Pack> = {
  ar: {
    trendingTags: "الوسوم الرائجة",
    guidePillar: "دليل صور يوتيوب المصغرة",
    statsTitle: "إحصاءات الصور المصغرة",
    trustAbout: "من نحن",
    trustPrivacy: "الخصوصية",
    trustTerms: "الشروط",
    trustContact: "تواصل",
    legalTitle: "حقوق الاستخدام",
    legalQ1: "هل تحميل صور يوتيوب المصغرة قانوني؟",
    legalA1:
      "يمكنك تنزيل الصور المصغرة العامة للمرجع الشخصي أو البحث أو التحليل التعليمي. تبقى حقوق الصورة لصاحبها الأصلي. اطلب إذنا قبل الاستخدام التجاري أو النشر أو اتخاذها غلافا لفيديوك.",
    legalQ2: "هل هناك مخاطر حقوق؟",
    legalA2: "نعم عند إعادة النشر بلا إذن. الدراسة الخاصة منخفضة المخاطر. إعادة النشر كما هي قد تؤدي لمطالبة حقوق.",
    legalQ3: "هل 11tik يخزن الصور أو يدعي ملكيتها؟",
    legalA3: "لا. لا نخزن الصور ولا ندعي ملكيتها. تُجلب من شبكة يوتيوب العامة في متصفحك.",
    aboutTitle: "عن 11tik",
    aboutBody:
      "11tik أداة مجانية لاستخراج صور يوتيوب  المصغرة. الصق رابط فيديو عام لمعاينة الملفات العامة الحقيقية وتنزيل أعلى جودة متاحة. لا يُرفع شيء إلى خادم 11tik.",
    privacyTitle: "الخصوصية",
    privacyBody:
      "الروابط تُعالج في متصفحك. لا حساب مطلوب ولا نخزن ملفات الصور الأصلية. السجل الاختياري يبقى على جهازك. التحليلات تستخدم نطاق 11tik.com.",
    termsTitle: "شروط الاستخدام",
    termsBody:
      "استخدم 11tik فقط مع الروابط العامة المسموح لك فتحها. أنت مسؤول عن إعادة استخدام أي صورة. 11tik أداة متصفح وليست ترخيصا للصورة.",
    contactTitle: "تواصل",
    contactBody: "راسل 11tik على jaouahircharifjaouahir@gmail.com للأسئلة أو الخصوصية أو إشعارات الحقوق.",
    statsBody: "هذه الأرقام تزيد فقط من عمليات استخراج حقيقية وبذور محدودة تجتاز بوابة الجودة: عنوان ووسوم وصورة عامة حية.",
    guideTitle: "دليل صور يوتيوب المصغرة الكامل",
    guideBody:
      "الصورة المصغرة هي اللقطة العامة التي يراها المشاهد قبل التشغيل. 11tik يقرأ فقط الملفات التي يستضيفها يوتيوب على i.ytimg.com. ابدأ برابط عام ثم تُرتّب أعلى جودة منشورة فعلا.",
    trendingIntro: "وسوم جُمعت من استخراجات عامة اجتازت بوابة الجودة.",
    embedTitle: "تضمين مستخرج الصور المصغرة 11tik",
    embedBody:
      "أضف مستخرج صور يوتيوب المصغرة إلى مدونتك أو أدواتك. الويدجت يُحمَّل من 11tik ويضبط ارتفاعه. لا مفتاح API.\n\nأبقِ id=\"yte-app\" على الإطار. لا تحصره بارتفاع ثابت يقطع أزرار التنزيل.\n\nشارك استخراجا جاهزا عبر /?v=VIDEO_ID.",
    keywordsTitle: "أدوات الكلمات المفتاحية",
    keywordsBody: "كل رابط يفتح المستخرج بمقدمة عن ذلك الموضوع.",
    thumbHeading: "صورة «{title}» المصغرة",
    thumbLead:
      "الصورة العامة المنشورة لـ «{title}». 11tik يعرض ملفات يستضيفها المنصة مسبقاً. لا يُستخرج إطار من الفيديو ولا تُخزَّن النسخة الأصلية هنا.",
    thumbBody:
      "استخدم المستخرج في هذه الصفحة لمعاينة كل حجم عام يعيد صورة حقيقية، ثم نزّل أكبر ملف صالح.",
    thumbRights: "حقوق الصورة تبقى لصاحبها. للاطلاع والبحث عادة. لا تعِد نشرها كغلافك.",
    thumbSizes: "الأحجام العامة: maxresdefault وhq720 وsddefault وhqdefault وmqdefault وdefault.",
    thumbCta: "استخرج صورة أخرى",
    thumbImgAlt: "صورة «{title}» المصغرة | 11tik",
  },
  fr: {
    trendingTags: "Tags tendance",
    guidePillar: "Guide des miniatures YouTube",
    statsTitle: "Statistiques des miniatures",
    trustAbout: "À propos",
    trustPrivacy: "Confidentialité",
    trustTerms: "Conditions",
    trustContact: "Contact",
    legalTitle: "Droits d’auteur et usage",
    legalQ1: "Télécharger des miniatures YouTube est-il légal ?",
    legalA1:
      "Vous pouvez télécharger des miniatures publiques pour usage personnel, recherche ou analyse. Les droits restent aux créateurs. Demandez une autorisation avant un usage commercial ou une republication.",
    legalQ2: "Y a-t-il un risque de droit d’auteur ?",
    legalA2:
      "Oui, en cas de republication sans permission. L’étude privée est à faible risque. Republier la miniature telle quelle peut entraîner une réclamation.",
    legalQ3: "11tik stocke-t-il ou revendique-t-il les miniatures ?",
    legalA3: "Non. Les images viennent du CDN public YouTube dans votre navigateur. 11tik ne les héberge pas.",
    aboutTitle: "À propos de 11tik",
    aboutBody:
      "11tik est un extracteur gratuit de miniatures YouTube. Collez une URL publique pour prévisualiser les fichiers réels et télécharger la plus haute qualité disponible. Rien n’est envoyé sur un serveur 11tik.",
    privacyTitle: "Confidentialité",
    privacyBody:
      "Les URL sont traitées dans votre navigateur. Pas de compte. L’historique local reste sur votre appareil. L’analytics utilise le domaine 11tik.com.",
    termsTitle: "Conditions d’utilisation",
    termsBody:
      "Utilisez 11tik uniquement avec des URL publiques que vous avez le droit d’ouvrir. Vous restez responsable de la réutilisation. 11tik n’accorde aucune licence sur l’image.",
    contactTitle: "Contact",
    contactBody: "Écrivez à jaouahircharifjaouahir@gmail.com pour le produit, la vie privée ou les droits.",
    statsBody:
      "Ces chiffres n’augmentent qu’avec de vraies extractions et des graines limitées qui passent le filtre qualité : titre, tags et miniature publique.",
    guideTitle: "Le guide complet des miniatures YouTube",
    guideBody:
      "La miniature est l’image publique avant lecture. 11tik ne lit que les fichiers déjà hébergés sur i.ytimg.com. Collez un lien public ; l’outil conserve les images réelles et classe la plus grande taille publiée.",
    trendingIntro: "Tags issus d’extractions publiques validées.",
    embedTitle: "Intégrer l’extracteur de miniatures 11tik",
    embedBody:
      "Ajoutez un extracteur YouTube gratuit à votre blog ou vos docs. Le widget se charge depuis 11tik et s’ajuste. Pas de clé API.\n\nGardez id=\"yte-app\" sur l’iframe. N’imposez pas une hauteur fixe qui coupe les boutons.\n\nPartagez une extraction avec /?v=VIDEO_ID.",
    keywordsTitle: "Outils de mots-clés",
    keywordsBody: "Chaque lien ouvre l’extracteur avec une intro pour ce sujet.",
    thumbHeading: "Miniature de {title}",
    thumbLead:
      "Image publique de « {title} ». 11tik liste seulement les fichiers déjà hébergés. Aucune image n’est extraite du flux vidéo ni stockée sur 11tik.",
    thumbBody:
      "Utilisez l’extracteur sur cette page pour prévisualiser chaque taille publique valide, puis télécharger le plus grand fichier réel.",
    thumbRights:
      "La miniature reste l’œuvre de l’auteur. Usage typique : référence et recherche. Ne la republiez pas comme votre propre miniature.",
    thumbSizes: "Tailles publiques : maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Extraire une autre miniature",
    thumbImgAlt: "Miniature de {title} | 11tik",
  },
  es: {
    trendingTags: "Etiquetas en tendencia",
    guidePillar: "Guía de miniaturas de YouTube",
    statsTitle: "Estadísticas de miniaturas",
    trustAbout: "Acerca de",
    trustPrivacy: "Privacidad",
    trustTerms: "Términos",
    trustContact: "Contacto",
    legalTitle: "Derechos de autor y uso",
    legalQ1: "¿Es legal descargar miniaturas de YouTube?",
    legalA1:
      "Puedes descargar miniaturas públicas para referencia, investigación o análisis. Los derechos siguen siendo del creador. Pide permiso antes de un uso comercial.",
    legalQ2: "¿Hay riesgos de copyright?",
    legalA2: "Sí, si se republica sin permiso. El estudio privado tiene poco riesgo. Publicarla tal cual puede generar una reclamación.",
    legalQ3: "¿11tik almacena o reclama las miniaturas?",
    legalA3: "No. Se obtienen del CDN público de YouTube en tu navegador.",
    aboutTitle: "Acerca de 11tik",
    aboutBody:
      "11tik es un extractor gratuito de miniaturas de YouTube. Pega una URL pública para ver los archivos reales y descargar la mayor calidad disponible. Nada se sube a un servidor de 11tik.",
    privacyTitle: "Privacidad",
    privacyBody:
      "Las URL se procesan en el navegador. No hace falta cuenta. El historial local permanece en tu dispositivo. Analytics usa el dominio 11tik.com.",
    termsTitle: "Términos de uso",
    termsBody:
      "Usa 11tik solo con URL públicas que puedas abrir. Eres responsable de reutilizar la imagen. 11tik no otorga licencia sobre el archivo.",
    contactTitle: "Contacto",
    contactBody: "Escribe a jaouahircharifjaouahir@gmail.com para producto, privacidad o derechos.",
    statsBody: "Estas cifras crecen solo con extracciones reales y semillas limitadas que superan el filtro de calidad.",
    guideTitle: "Guía completa de miniaturas de YouTube",
    guideBody:
      "La miniatura es la imagen pública antes de reproducir. 11tik solo lee archivos que YouTube ya publica en i.ytimg.com. Empieza con un enlace público; se conserva el tamaño más alto publicado.",
    trendingIntro: "Etiquetas de extracciones públicas validadas.",
    embedTitle: "Insertar el extractor de miniaturas 11tik",
    embedBody:
      "Añade un extractor de miniaturas YouTube a tu blog o herramientas. El widget carga desde 11tik y se redimensiona. Sin clave API.\n\nMantén id=\"yte-app\" en el iframe. No uses una altura fija que recorte los botones.\n\nComparte una extracción con /?v=VIDEO_ID.",
    keywordsTitle: "Herramientas de palabras clave",
    keywordsBody: "Cada enlace abre el extractor con una intro de ese tema.",
    thumbHeading: "Miniatura de {title}",
    thumbLead:
      "Imagen pública de “{title}”. 11tik solo lista archivos que el host ya publica. No extrae fotogramas ni guarda el original.",
    thumbBody:
      "Usa el extractor en esta página para ver cada tamaño público real y descargar el archivo más grande que exista.",
    thumbRights:
      "La miniatura sigue siendo del autor. Uso típico: consulta e investigación. No la republices como tu propia portada.",
    thumbSizes: "Tamaños públicos: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Extraer otra miniatura",
    thumbImgAlt: "Miniatura de {title} | 11tik",
  },
  de: {
    trendingTags: "Trending-Tags",
    guidePillar: "YouTube-Thumbnail-Leitfaden",
    statsTitle: "Thumbnail-Statistiken",
    trustAbout: "Über uns",
    trustPrivacy: "Datenschutz",
    trustTerms: "Nutzungsbedingungen",
    trustContact: "Kontakt",
    legalTitle: "Urheberrecht und Nutzung",
    legalQ1: "Ist das Herunterladen von YouTube-Thumbnails legal?",
    legalA1:
      "Öffentliche Thumbnails dürfen für private Referenz, Forschung oder Analyse gespeichert werden. Die Rechte bleiben beim Urheber. Vor kommerzieller Nutzung ist eine Erlaubnis nötig.",
    legalQ2: "Gibt es Urheberrechtsrisiken?",
    legalA2: "Ja, bei Veröffentlichung ohne Erlaubnis. Privates Lernen ist risikoarm. Ein 1:1-Reuse kann eine Beschwerde auslösen.",
    legalQ3: "Speichert 11tik Thumbnails oder beansprucht Rechte?",
    legalA3: "Nein. Dateien kommen vom öffentlichen YouTube-CDN in Ihrem Browser.",
    aboutTitle: "Über 11tik",
    aboutBody:
      "11tik ist ein kostenloser YouTube-Thumbnail-Extractor. Fügen Sie eine öffentliche URL ein, um echte Dateien zu prüfen und die höchste vorhandene Qualität zu laden. Nichts wird auf einen 11tik-Server hochgeladen.",
    privacyTitle: "Datenschutz",
    privacyBody:
      "URLs werden im Browser verarbeitet. Kein Konto. Die lokale Historie bleibt auf Ihrem Gerät. Analytics nutzt die Domain 11tik.com.",
    termsTitle: "Nutzungsbedingungen",
    termsBody:
      "Nutzen Sie 11tik nur mit öffentlichen URLs, die Sie öffnen dürfen. Sie haften für die Weiterverwendung. 11tik erteilt keine Bildlizenz.",
    contactTitle: "Kontakt",
    contactBody: "E-Mail: jaouahircharifjaouahir@gmail.com für Produkt, Datenschutz oder Rechte.",
    statsBody: "Die Zahlen steigen nur durch echte Extraktionen und begrenzte Seeds, die Titel, Tags und ein öffentliches Bild haben.",
    guideTitle: "Der vollständige YouTube-Thumbnail-Leitfaden",
    guideBody:
      "Ein Thumbnail ist das öffentliche Vorschaubild. 11tik liest nur Dateien auf i.ytimg.com. Öffentlichen Link einfügen; das größte wirklich veröffentlichte Bild wird gewählt.",
    trendingIntro: "Tags aus geprüften öffentlichen Extraktionen.",
  },
  pt: {
    trendingTags: "Tags em tendência",
    guidePillar: "Guia de miniaturas do YouTube",
    statsTitle: "Estatísticas de miniaturas",
    trustAbout: "Sobre",
    trustPrivacy: "Privacidade",
    trustTerms: "Termos",
    trustContact: "Contacto",
    legalTitle: "Direitos de autor e uso",
    legalQ1: "É legal transferir miniaturas do YouTube?",
    legalA1:
      "Pode transferir miniaturas públicas para referência, investigação ou análise. Os direitos ficam com o criador. Peça autorização antes de uso comercial.",
    legalQ2: "Há riscos de direitos de autor?",
    legalA2: "Sim, se republicar sem autorização. O estudo privado tem baixo risco.",
    legalQ3: "A 11tik armazena ou reivindica as miniaturas?",
    legalA3: "Não. Vêm do CDN público do YouTube no seu browser.",
    aboutTitle: "Sobre a 11tik",
    aboutBody:
      "A 11tik é um extrator gratuito de miniaturas YouTube. Cole um URL público para ver os ficheiros reais e transferir a maior qualidade disponível. Nada é enviado para um servidor 11tik.",
    privacyTitle: "Privacidade",
    privacyBody: "Os URLs são processados no browser. Sem conta. O histórico local fica no dispositivo. A analytics usa o domínio 11tik.com.",
    termsTitle: "Termos de utilização",
    termsBody: "Use a 11tik só com URLs públicos que pode abrir. É responsável pela reutilização. A 11tik não licencia a imagem.",
    contactTitle: "Contacto",
    contactBody: "E-mail jaouahircharifjaouahir@gmail.com para produto, privacidade ou direitos.",
    statsBody: "Estes números crescem só com extrações reais e sementes limitadas que passam o filtro de qualidade.",
    guideTitle: "Guia completo das miniaturas do YouTube",
    guideBody:
      "A miniatura é a imagem pública antes de reproduzir. A 11tik só lê ficheiros no i.ytimg.com. Comece com um link público; fica o maior tamanho realmente publicado.",
    trendingIntro: "Tags de extrações públicas validadas.",
  },
  ru: {
    trendingTags: "Популярные теги",
    guidePillar: "Гид по превью YouTube",
    statsTitle: "Статистика превью",
    trustAbout: "О проекте",
    trustPrivacy: "Конфиденциальность",
    trustTerms: "Условия",
    trustContact: "Контакты",
    legalTitle: "Авторские права и использование",
    legalQ1: "Законно ли скачивать превью YouTube?",
    legalA1:
      "Публичные превью можно сохранять для справки, исследования или учёбы. Права остаются у автора. Для коммерции нужно разрешение.",
    legalQ2: "Есть ли риск нарушения прав?",
    legalA2: "Да, при публикации без разрешения. Личное изучение менее рискованно.",
    legalQ3: "Хранит ли 11tik превью или заявляет права?",
    legalA3: "Нет. Файлы берутся с публичного CDN YouTube в браузере.",
    aboutTitle: "О 11tik",
    aboutBody:
      "11tik — бесплатный экстрактор превью YouTube. Вставьте публичную ссылку, чтобы увидеть настоящие файлы и скачать максимальный размер. На сервер 11tik ничего не загружается.",
    privacyTitle: "Конфиденциальность",
    privacyBody: "Ссылки обрабатываются в браузере. Аккаунт не нужен. Локальная история остаётся на устройстве.",
    termsTitle: "Условия использования",
    termsBody: "Используйте только публичные ссылки, которые вам разрешено открывать. 11tik не выдаёт лицензию на изображение.",
    contactTitle: "Контакты",
    contactBody: "Пишите jaouahircharifjaouahir@gmail.com по продукту, приватности или правам.",
    statsBody: "Счётчики растут только от реальных извлечений и ограниченных семян, прошедших проверку качества.",
    guideTitle: "Полный гид по превью YouTube",
    guideBody:
      "Превью — публичный кадр до воспроизведения. 11tik читает только файлы на i.ytimg.com. Вставьте публичную ссылку; выбирается наибольший опубликованный размер.",
    trendingIntro: "Теги из проверенных публичных извлечений.",
  },
  it: {
    trendingTags: "Tag di tendenza",
    guidePillar: "Guida alle miniature YouTube",
    statsTitle: "Statistiche miniature",
    trustAbout: "Chi siamo",
    trustPrivacy: "Privacy",
    trustTerms: "Termini",
    trustContact: "Contatti",
    legalTitle: "Copyright e uso",
    aboutTitle: "Informazioni su 11tik",
    aboutBody:
      "11tik è un estrattore gratuito di miniature YouTube. Incolla un URL pubblico per vedere i file reali e scaricare la qualità più alta disponibile.",
    privacyTitle: "Privacy",
    privacyBody: "Gli URL sono elaborati nel browser. Nessun account. La cronologia locale resta sul dispositivo.",
    termsTitle: "Termini di utilizzo",
    termsBody: "Usa 11tik solo con URL pubblici che puoi aprire. 11tik non concede una licenza sull’immagine.",
    contactTitle: "Contatti",
    contactBody: "Scrivi a jaouahircharifjaouahir@gmail.com.",
    statsBody: "I conteggi crescono solo con estrazioni reali che superano il filtro qualità.",
    guideTitle: "Guida completa alle miniature YouTube",
    guideBody: "La miniatura è l’immagine pubblica prima della riproduzione. 11tik legge solo i file su i.ytimg.com.",
    trendingIntro: "Tag da estrazioni pubbliche convalidate.",
    legalQ1: "È legale scaricare le miniature YouTube?",
    legalA1: "Puoi scaricare miniature pubbliche per studio o ricerca. I diritti restano all’autore.",
    legalQ2: "Ci sono rischi di copyright?",
    legalA2: "Sì, se ripubblichi senza permesso.",
    legalQ3: "11tik archivia le miniature?",
    legalA3: "No. Arrivano dal CDN pubblico YouTube nel browser.",
  },
  tr: {
    trendingTags: "Trend etiketler",
    guidePillar: "YouTube küçük resim rehberi",
    statsTitle: "Küçük resim istatistikleri",
    trustAbout: "Hakkında",
    trustPrivacy: "Gizlilik",
    trustTerms: "Şartlar",
    trustContact: "İletişim",
    legalTitle: "Telif ve kullanım",
    aboutTitle: "11tik hakkında",
    aboutBody: "11tik ücretsiz bir YouTube küçük resim çıkarıcıdır. Genel bir URL yapıştırın; en yüksek gerçek dosyayı indirin.",
    privacyTitle: "Gizlilik",
    privacyBody: "URL’ler tarayıcıda işlenir. Hesap gerekmez. Yerel geçmiş cihazınızda kalır.",
    termsTitle: "Kullanım şartları",
    termsBody: "Yalnızca açmaya yetkili olduğunuz genel URL’leri kullanın. 11tik görsel lisansı vermez.",
    contactTitle: "İletişim",
    contactBody: "jaouahircharifjaouahir@gmail.com",
    statsBody: "Sayılar yalnızca kalite kapısından geçen gerçek çıkarımlarla artar.",
    guideTitle: "YouTube küçük resimleri için tam rehber",
    guideBody: "Küçük resim, oynatmadan önce görünen genel karedir. 11tik yalnızca i.ytimg.com dosyalarını okur.",
    trendingIntro: "Kalite kapısından geçen genel çıkarımların etiketleri.",
    legalQ1: "YouTube küçük resim indirmek yasal mı?",
    legalA1: "Genel küçük resimleri kişisel veya eğitim amaçlı indirebilirsiniz. Haklar yaratıcıdadır.",
    legalQ2: "Telif riski var mı?",
    legalA2: "İzinsiz yeniden yayınlarsanız evet.",
    legalQ3: "11tik görselleri saklar mı?",
    legalA3: "Hayır. Dosyalar tarayıcıda YouTube CDN’den gelir.",
  },
  zh: {
    trendingTags: "热门标签",
    guidePillar: "YouTube 缩略图指南",
    statsTitle: "缩略图统计",
    trustAbout: "关于",
    trustPrivacy: "隐私",
    trustTerms: "条款",
    trustContact: "联系",
    legalTitle: "版权与使用",
    aboutTitle: "关于 11tik",
    aboutBody: "11tik 是免费的 YouTube 缩略图提取工具。粘贴公开链接即可预览真实文件并下载最高可用清晰度。文件不会上传到 11tik 服务器。",
    privacyTitle: "隐私",
    privacyBody: "链接在浏览器中处理。无需账户。本地历史保留在您的设备上。",
    termsTitle: "使用条款",
    termsBody: "仅可对您有权打开的公开链接使用 11tik。本工具不授予图片许可。",
    contactTitle: "联系",
    contactBody: "邮箱 jaouahircharifjaouahir@gmail.com",
    statsBody: "统计仅统计通过质量门槛的真实提取。",
    guideTitle: "完整的 YouTube 缩略图指南",
    guideBody: "缩略图是播放前的公开预览图。11tik 只读取 i.ytimg.com 上已有的文件。",
    trendingIntro: "来自已通过质量门槛的公开提取的标签。",
    legalQ1: "下载 YouTube 缩略图合法吗？",
    legalA1: "可以下载公开缩略图供个人、研究或学习。版权仍归创作者。",
    legalQ2: "有版权风险吗？",
    legalA2: "未经许可转载则有。",
    legalQ3: "11tik 会保存或主张缩略图权利吗？",
    legalA3: "不会。图片来自 YouTube 公共 CDN。",
  },
  ja: {
    trendingTags: "トレンドタグ",
    guidePillar: "YouTubeサムネイルガイド",
    statsTitle: "サムネイル統計",
    trustAbout: "概要",
    trustPrivacy: "プライバシー",
    trustTerms: "利用規約",
    trustContact: "お問い合わせ",
    legalTitle: "著作権と利用",
    aboutTitle: "11tikについて",
    aboutBody: "11tikは無料のYouTubeサムネイル抽出ツールです。公開URLを貼ると実在する画像を確認し、最も高い公開解像度を保存できます。",
    privacyTitle: "プライバシー",
    privacyBody: "URLはブラウザ内で処理されます。アカウントは不要です。",
    termsTitle: "利用規約",
    termsBody: "開ける権限のある公開URLにのみ使ってください。画像のライセンスは付与しません。",
    contactTitle: "お問い合わせ",
    contactBody: "jaouahircharifjaouahir@gmail.com",
    statsBody: "件数は品質ゲートを通った実際の抽出だけが増えます。",
    guideTitle: "YouTubeサムネイル完全ガイド",
    guideBody: "サムネイルは再生前の公開画像です。11tikはi.ytimg.com上のファイルだけを読みます。",
    trendingIntro: "品質ゲートを通った公開抽出のタグです。",
    legalQ1: "YouTubeサムネイルの保存は合法ですか？",
    legalA1: "公開サムネイルは個人・研究・学習目的で保存できます。権利は作者に残ります。",
    legalQ2: "著作権リスクは？",
    legalA2: "無断転載にはリスクがあります。",
    legalQ3: "11tikは画像を保存しますか？",
    legalA3: "いいえ。YouTubeの公開CDNからブラウザで取得します。",
  },
  ko: {
    trendingTags: "인기 태그",
    guidePillar: "YouTube 썸네일 가이드",
    statsTitle: "썸네일 통계",
    trustAbout: "소개",
    trustPrivacy: "개인정보",
    trustTerms: "약관",
    trustContact: "문의",
    legalTitle: "저작권과 이용",
    aboutTitle: "11tik 소개",
    aboutBody: "11tik은 무료 YouTube 썸네일 추출기입니다. 공개 URL을 붙여 실제 파일을 확인하고 가장 높은 공개 화질을 저장하세요.",
    privacyTitle: "개인정보",
    privacyBody: "URL은 브라우저에서 처리됩니다. 계정이 필요 없습니다.",
    termsTitle: "이용약관",
    termsBody: "열 권한이 있는 공개 URL만 사용하세요. 이미지 라이선스는 제공하지 않습니다.",
    contactTitle: "문의",
    contactBody: "jaouahircharifjaouahir@gmail.com",
    statsBody: "수치는 품질 게이트를 통과한 실제 추출만 반영합니다.",
    guideTitle: "YouTube 썸네일 완전 가이드",
    guideBody: "썸네일은 재생 전 공개 이미지입니다. 11tik은 i.ytimg.com 파일만 읽습니다.",
    trendingIntro: "품질 게이트를 통과한 공개 추출의 태그입니다.",
    legalQ1: "YouTube 썸네일 다운로드는 합법인가요?",
    legalA1: "공개 썸네일은 개인·연구·학습 용도로 받을 수 있습니다. 권리는 창작자에게 있습니다.",
    legalQ2: "저작권 위험이 있나요?",
    legalA2: "허가 없이 다시 올리면 있습니다.",
    legalQ3: "11tik이 이미지를 저장하나요?",
    legalA3: "아니요. 브라우저에서 YouTube 공개 CDN을 읽습니다.",
  },
  hi: {
    trendingTags: "ट्रेंडिंग टैग",
    guidePillar: "YouTube थंबनेल गाइड",
    statsTitle: "थंबनेल आँकड़े",
    trustAbout: "परिचय",
    trustPrivacy: "गोपनीयता",
    trustTerms: "नियम",
    trustContact: "संपर्क",
    legalTitle: "कॉपीराइट और उपयोग",
    aboutTitle: "11tik के बारे में",
    aboutBody: "11tik मुफ़्त YouTube थंबनेल निकालने वाला उपकरण है। सार्वजनिक लिंक चिपकाएँ और सबसे ऊँची उपलब्ध फ़ाइल डाउनलोड करें।",
    privacyTitle: "गोपनीयता",
    privacyBody: "लिंक ब्राउज़र में प्रोसेस होते हैं। खाता नहीं चाहिए।",
    termsTitle: "उपयोग की शर्तें",
    termsBody: "केवल वे सार्वजनिक लिंक उपयोग करें जिन्हें आप खोल सकते हैं। 11tik छवि का लाइसेंस नहीं देता।",
    contactTitle: "संपर्क",
    contactBody: "jaouahircharifjaouahir@gmail.com",
    statsBody: "आँकड़े केवल गुणवत्ता जाँच पास करने वाले वास्तविक निष्कर्षों से बढ़ते हैं।",
    guideTitle: "YouTube थंबनेल की पूरी गाइड",
    guideBody: "थंबनेल चलाने से पहले दिखने वाली सार्वजनिक छवि है। 11tik केवल i.ytimg.com की फ़ाइलें पढ़ता है।",
    trendingIntro: "गुणवत्ता जाँच पास करने वाले सार्वजनिक निष्कर्षों के टैग।",
    legalQ1: "क्या YouTube थंबनेल डाउनलोड करना कानूनी है?",
    legalA1: "सार्वजनिक थंबनेल व्यक्तिगत या शैक्षिक उपयोग के लिए डाउनलोड कर सकते हैं। अधिकार निर्माता के रहते हैं।",
    legalQ2: "कॉपीराइट जोखिम?",
    legalA2: "बिना अनुमति दोबारा प्रकाशित करने पर हाँ।",
    legalQ3: "क्या 11tik थंबनेल रखता है?",
    legalA3: "नहीं। फ़ाइलें ब्राउज़र में YouTube CDN से आती हैं।",
  },
  nl: {
    trendingTags: "Trending tags",
    guidePillar: "YouTube-thumbnailgids",
    statsTitle: "Thumbnailstatistieken",
    trustAbout: "Over",
    trustPrivacy: "Privacy",
    trustTerms: "Voorwaarden",
    trustContact: "Contact",
    legalTitle: "Auteursrecht en gebruik",
    aboutTitle: "Over 11tik",
    aboutBody: "11tik is een gratis YouTube- en-thumbnailextractor. Plak een openbare URL en download het hoogste echte bestand.",
    privacyTitle: "Privacy",
    privacyBody: "URL’s worden in de browser verwerkt. Geen account nodig.",
    termsTitle: "Gebruiksvoorwaarden",
    termsBody: "Gebruik alleen openbare URL’s die u mag openen. 11tik geeft geen licentie op de afbeelding.",
    contactTitle: "Contact",
    contactBody: "jaouahircharifjaouahir@gmail.com",
    statsBody: "Cijfers groeien alleen door echte extracties die de kwaliteitspoort passeren.",
    guideTitle: "De complete YouTube-thumbnailgids",
    guideBody: "Een thumbnail is het openbare beeld vóór afspelen. 11tik leest alleen bestanden op i.ytimg.com.",
    trendingIntro: "Tags van goedgekeurde openbare extracties.",
    legalQ1: "Is YouTube-thumbnails downloaden legaal?",
    legalA1: "Openbare thumbnails mag u voor studie of onderzoek bewaren. Rechten blijven bij de maker.",
    legalQ2: "Auteursrechtrisico?",
    legalA2: "Ja bij herpublicatie zonder toestemming.",
    legalQ3: "Slaat 11tik thumbnails op?",
    legalA3: "Nee. Ze komen van de openbare YouTube-CDN in de browser.",
  },
};

const NAV: Record<string, Pack> = {
  af: { trendingTags: "Trending-etikette", guidePillar: "YouTube-duimnaelgids", statsTitle: "Duimnaelstatistiek", trustAbout: "Oor", trustPrivacy: "Privaatheid", trustTerms: "Voorwaardes", trustContact: "Kontak", legalTitle: "Kopiereg en gebruik" },
  az: { trendingTags: "Trend teqlər", guidePillar: "YouTube kiçik şəkil bələdçisi", statsTitle: "Kiçik şəkil statistikası", trustAbout: "Haqqında", trustPrivacy: "Məxfilik", trustTerms: "Şərtlər", trustContact: "Əlaqə", legalTitle: "Müəllif hüququ" },
  bg: { trendingTags: "Трендинг тагове", guidePillar: "Ръководство за миниатюри в YouTube", statsTitle: "Статистика на миниатюрите", trustAbout: "За нас", trustPrivacy: "Поверителност", trustTerms: "Условия", trustContact: "Контакт", legalTitle: "Авторски права" },
  bn: { trendingTags: "ট্রেন্ডিং ট্যাগ", guidePillar: "YouTube থাম্বনেইল গাইড", statsTitle: "থাম্বনেইল পরিসংখ্যান", trustAbout: "সম্পর্কে", trustPrivacy: "গোপনীয়তা", trustTerms: "শর্তাবলী", trustContact: "যোগাযোগ", legalTitle: "কপিরাইট ও ব্যবহার" },
  ca: { trendingTags: "Etiquetes en tendència", guidePillar: "Guia de miniatures de YouTube", statsTitle: "Estadístiques de miniatures", trustAbout: "Quant a", trustPrivacy: "Privadesa", trustTerms: "Termes", trustContact: "Contacte", legalTitle: "Drets d’autor" },
  cs: { trendingTags: "Trendové štítky", guidePillar: "Průvodce náhledy YouTube", statsTitle: "Statistiky náhledů", trustAbout: "O nás", trustPrivacy: "Soukromí", trustTerms: "Podmínky", trustContact: "Kontakt", legalTitle: "Autorská práva" },
  da: { trendingTags: "Populære tags", guidePillar: "YouTube-miniatureguide", statsTitle: "Miniaturestatistik", trustAbout: "Om", trustPrivacy: "Privatliv", trustTerms: "Vilkår", trustContact: "Kontakt", legalTitle: "Ophavsret" },
  el: { trendingTags: "Τάσεις ετικετών", guidePillar: "Οδηγός μικρογραφιών YouTube", statsTitle: "Στατιστικά μικρογραφιών", trustAbout: "Σχετικά", trustPrivacy: "Απόρρητο", trustTerms: "Όροι", trustContact: "Επικοινωνία", legalTitle: "Πνευματικά δικαιώματα" },
  fa: { trendingTags: "برچسب‌های پرطرفدار", guidePillar: "راهنمای بندانگشتی یوتیوب", statsTitle: "آمار بندانگشتی", trustAbout: "درباره", trustPrivacy: "حریم خصوصی", trustTerms: "شرایط", trustContact: "تماس", legalTitle: "حق نشر و استفاده" },
  fi: { trendingTags: "Nousussa olevat tunnisteet", guidePillar: "YouTube-pikkukuvien opas", statsTitle: "Pikkukuvatilastot", trustAbout: "Tietoa", trustPrivacy: "Tietosuoja", trustTerms: "Ehdot", trustContact: "Yhteys", legalTitle: "Tekijänoikeus" },
  he: { trendingTags: "תגיות חמות", guidePillar: "מדריך תמונות ממוזערות ב-YouTube", statsTitle: "סטטיסטיקת תמונות ממוזערות", trustAbout: "אודות", trustPrivacy: "פרטיות", trustTerms: "תנאים", trustContact: "יצירת קשר", legalTitle: "זכויות יוצרים" },
  hr: { trendingTags: "Popularne oznake", guidePillar: "Vodič za YouTube sličice", statsTitle: "Statistika sličica", trustAbout: "O nama", trustPrivacy: "Privatnost", trustTerms: "Uvjeti", trustContact: "Kontakt", legalTitle: "Autorska prava" },
  hu: { trendingTags: "Népszerű címkék", guidePillar: "YouTube-miniatűr útmutató", statsTitle: "Miniatűr-statisztika", trustAbout: "Névjegy", trustPrivacy: "Adatvédelem", trustTerms: "Feltételek", trustContact: "Kapcsolat", legalTitle: "Szerzői jog" },
  id: { trendingTags: "Tag tren", guidePillar: "Panduan thumbnail YouTube", statsTitle: "Statistik thumbnail", trustAbout: "Tentang", trustPrivacy: "Privasi", trustTerms: "Ketentuan", trustContact: "Kontak", legalTitle: "Hak cipta & penggunaan" },
  pl: { trendingTags: "Popularne tagi", guidePillar: "Przewodnik po miniaturach YouTube", statsTitle: "Statystyki miniatur", trustAbout: "O nas", trustPrivacy: "Prywatność", trustTerms: "Regulamin", trustContact: "Kontakt", legalTitle: "Prawa autorskie" },
  ro: { trendingTags: "Etichete în tendințe", guidePillar: "Ghid miniaturi YouTube", statsTitle: "Statistici miniaturi", trustAbout: "Despre", trustPrivacy: "Confidențialitate", trustTerms: "Termeni", trustContact: "Contact", legalTitle: "Drepturi de autor" },
  sv: { trendingTags: "Trendande taggar", guidePillar: "Guide till YouTube-miniatyrer", statsTitle: "Miniatyrstatistik", trustAbout: "Om", trustPrivacy: "Integritet", trustTerms: "Villkor", trustContact: "Kontakt", legalTitle: "Upphovsrätt" },
  th: { trendingTags: "แท็กยอดนิยม", guidePillar: "คู่มือภาพขนาดย่อ YouTube", statsTitle: "สถิติภาพขนาดย่อ", trustAbout: "เกี่ยวกับ", trustPrivacy: "ความเป็นส่วนตัว", trustTerms: "ข้อกำหนด", trustContact: "ติดต่อ", legalTitle: "ลิขสิทธิ์และการใช้งาน" },
  uk: { trendingTags: "Популярні теги", guidePillar: "Гід з прев’ю YouTube", statsTitle: "Статистика прев’ю", trustAbout: "Про нас", trustPrivacy: "Приватність", trustTerms: "Умови", trustContact: "Контакт", legalTitle: "Авторське право" },
  ur: { trendingTags: "رجحان پذیر ٹیگز", guidePillar: "یوٹیوب تھمب نیل گائیڈ", statsTitle: "تھمب نیل اعدادوشمار", trustAbout: "تعارف", trustPrivacy: "رازداری", trustTerms: "شرائط", trustContact: "رابطہ", legalTitle: "کاپی رائٹ اور استعمال" },
  vi: { trendingTags: "Thẻ thịnh hành", guidePillar: "Hướng dẫn ảnh thu nhỏ YouTube", statsTitle: "Thống kê ảnh thu nhỏ", trustAbout: "Giới thiệu", trustPrivacy: "Quyền riêng tư", trustTerms: "Điều khoản", trustContact: "Liên hệ", legalTitle: "Bản quyền và sử dụng" },
};

function catalogBits(locale: string): { intro: string; foot: string } {
  return { intro: uiHeroIntro(locale), foot: uiFoot(locale) };
}

function thumbPackString(locale: string, key: PageKey): string | undefined {
  const pack = THUMB_LOCALE_PACKS[locale];
  if (!pack) return undefined;
  return (pack as Partial<Record<PageKey, string>>)[key];
}

export function pageString(locale: string, key: PageKey): string {
  const direct = PACKS[locale]?.[key] || NAV[locale]?.[key] || thumbPackString(locale, key);
  if (direct) return direct;
  if (key === "aboutBody" || key === "privacyBody" || key === "termsBody" || key === "guideBody" || key === "statsBody") {
    const { intro, foot } = catalogBits(locale);
    if (key === "aboutBody") return `${intro}\n\n${foot}`;
    if (key === "guideBody") return intro;
    if (key === "statsBody") return foot;
    if (key === "privacyBody") return foot;
    if (key === "termsBody") return `${foot}\n\n${EN.termsBody}`;
  }
  const titles: Partial<Record<PageKey, PageKey>> = {
    aboutTitle: "trustAbout",
    privacyTitle: "trustPrivacy",
    termsTitle: "trustTerms",
    contactTitle: "trustContact",
    guideTitle: "guidePillar",
    embedTitle: "embedTitle",
    keywordsTitle: "keywordsTitle",
  };
  const alias = titles[key];
  if (alias) {
    const nav = PACKS[locale]?.[alias] || NAV[locale]?.[alias];
    if (nav) return nav;
  }
  return EN[key];
}

export function pageFill(locale: string, key: PageKey, vars: Record<string, string>): string {
  let text = pageString(locale, key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}

export function legalHrefs(locale: string): {
  about: string;
  privacy: string;
  terms: string;
  contact: string;
  embed: string;
  keywords: string;
  copyright: string;
  trending: string;
  guide: string;
  stats: string;
} {
  const code = String(locale || "en").toLowerCase();
  const utility = (slug: string) =>
    code === "en"
      ? `https://www.11tik.com/${slug}`
      : `https://${code}.11tik.com/l/${code}/${slug}`;
  return {
    about: utility("about"),
    privacy: utility("privacy"),
    terms: utility("terms-of-use"),
    contact: utility("contact"),
    embed: utility("embed"),
    keywords: utility("keyword-tools"),
    copyright: "https://www.11tik.com/copyright",
    trending: "/trending-tags",
    guide: "/guide/youtube-thumbnails",
    stats: "/stats",
  };
}

export const ALL_PAGE_LOCALES = ISO6391.map(([code]) => code);
