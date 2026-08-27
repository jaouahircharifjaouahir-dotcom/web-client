type ThumbKey =
  | "thumbHeading"
  | "thumbLead"
  | "thumbBody"
  | "thumbRights"
  | "thumbSizes"
  | "thumbCta"
  | "thumbImgAlt";

type ThumbPack = Partial<Record<ThumbKey, string>>;

/** Thumb page copy for locales not already covered in pages.ts PACKS (ar, fr, es). */
export const THUMB_LOCALE_PACKS: Record<string, ThumbPack> = {
  de: {
    thumbHeading: "Miniaturbild von {title}",
    thumbLead:
      "Öffentliches Vorschaubild für „{title}“. 11tik listet nur Bilddateien, die der Host bereits veröffentlicht. Nichts wird aus dem Videostream gerippt und das Original wird nicht auf 11tik gespeichert.",
    thumbBody:
      "Nutzen Sie den Extractor auf dieser Seite, um jede öffentliche Größe zu prüfen, die ein echtes Bild liefert, und laden Sie dann die größte gültige Datei herunter. Typische YouTube-Namen sind maxresdefault, hq720, sddefault, hqdefault, mqdefault und default.",
    thumbRights:
      "Das Miniaturbild bleibt urheberrechtlich geschütztes Werk des Uploaders. Typische Nutzung: private Referenz und Recherche. Veröffentlichen Sie es nicht als eigenes Cover oder Merchandise.",
    thumbSizes: "Geprüfte öffentliche Größen: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Weiteres Miniaturbild extrahieren",
    thumbImgAlt: "Miniaturbild von {title} | 11tik",
  },
  pt: {
    thumbHeading: "Miniatura de {title}",
    thumbLead:
      "Imagem pública de “{title}”. A 11tik lista apenas ficheiros que o anfitrião já publica. Nada é extraído do fluxo de vídeo e o original não fica guardado na 11tik.",
    thumbBody:
      "Use o extrator nesta página para pré-visualizar cada tamanho público que devolve uma imagem real e transferir o maior ficheiro válido. Nomes típicos do YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault e default.",
    thumbRights:
      "A miniatura continua a ser obra protegida do autor. Uso típico: referência e investigação. Não a publique como capa ou merchandise próprios.",
    thumbSizes: "Tamanhos públicos verificados: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Extrair outra miniatura",
    thumbImgAlt: "Miniatura de {title} | 11tik",
  },
  ru: {
    thumbHeading: "Превью «{title}»",
    thumbLead:
      "Публичное превью для «{title}». 11tik показывает только файлы, которые хост уже публикует. Кадры из видеопотока не извлекаются, оригинал на 11tik не хранится.",
    thumbBody:
      "Используйте экстрактор на этой странице, чтобы просмотреть каждый публичный размер с реальным изображением, и скачайте наибольший действительный файл. Типичные имена YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault и default.",
    thumbRights:
      "Превью остаётся объектом авторского права загрузившего. Типичное использование — личная справка и исследование. Не публикуйте его как свою обложку или товар.",
    thumbSizes: "Проверенные публичные размеры: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Извлечь другое превью",
    thumbImgAlt: "Превью «{title}» | 11tik",
  },
  it: {
    thumbHeading: "Miniatura di {title}",
    thumbLead:
      "Immagine pubblica di “{title}”. 11tik elenca solo i file già pubblicati dall’host. Nulla viene estratto dal flusso video e l’originale non è archiviato su 11tik.",
    thumbBody:
      "Usa l’estrattore in questa pagina per anteprima ogni dimensione pubblica che restituisce un’immagine reale, poi scarica il file valido più grande. Nomi tipici YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault e default.",
    thumbRights:
      "La miniatura resta opera protetta dell’autore. Uso tipico: riferimento e ricerca. Non ripubblicarla come copertina o merchandise tuoi.",
    thumbSizes: "Dimensioni pubbliche verificate: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Estrai un’altra miniatura",
    thumbImgAlt: "Miniatura di {title} | 11tik",
  },
  tr: {
    thumbHeading: "{title} küçük resmi",
    thumbLead:
      "“{title}” için genel küçük resim. 11tik yalnızca sunucunun zaten yayınladığı görsel dosyalarını listeler. Video akışından kare alınmaz ve orijinal 11tik’te saklanmaz.",
    thumbBody:
      "Bu sayfadaki çıkarıcıyla gerçek görüntü döndüren her genel boyutu önizleyin, ardından en büyük geçerli dosyayı indirin. Tipik YouTube adları: maxresdefault, hq720, sddefault, hqdefault, mqdefault ve default.",
    thumbRights:
      "Küçük resim yükleyenin telifli eseri olarak kalır. Tipik kullanım: kişisel referans ve araştırma. Kendi kapak veya ürününüz olarak yeniden yayınlamayın.",
    thumbSizes: "Kontrol edilen genel boyutlar: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Başka bir küçük resim çıkar",
    thumbImgAlt: "{title} küçük resmi | 11tik",
  },
  zh: {
    thumbHeading: "{title} 缩略图",
    thumbLead:
      "“{title}” 的公开缩略图。11tik 仅列出托管方已发布的图片文件。不会从视频流截取，也不会在 11tik 存储原图。",
    thumbBody:
      "使用本页提取器预览每个返回真实图片的公开尺寸，然后下载最大的有效文件。常见 YouTube 名称：maxresdefault、hq720、sddefault、hqdefault、mqdefault 和 default。",
    thumbRights:
      "缩略图仍属于上传者的版权作品。典型用途是个人参考与研究。请勿将其作为你的封面或商品重新发布。",
    thumbSizes: "已检查的公开尺寸：maxresdefault, hq720, sddefault, hqdefault, mqdefault, default。",
    thumbCta: "提取另一张缩略图",
    thumbImgAlt: "{title} 缩略图 | 11tik",
  },
  ja: {
    thumbHeading: "{title}のサムネイル",
    thumbLead:
      "「{title}」の公開サムネイル。11tikはホストが既に公開している画像ファイルのみを表示します。動画ストリームから切り出したものではなく、元のアップロードも11tikに保存されません。",
    thumbBody:
      "このページの抽出ツールですべての公開サイズをプレビューし、有効な最大ファイルをダウンロードしてください。一般的なYouTube名は maxresdefault、hq720、sddefault、hqdefault、mqdefault、default です。",
    thumbRights:
      "サムネイルの著作権は投稿者に帰属します。個人的な参照、研究、学習が一般的な用途です。自分のカバーアートや商品として再公開しないでください。",
    thumbSizes: "確認した公開サイズ: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default。",
    thumbCta: "別のサムネイルを抽出",
    thumbImgAlt: "{title}のサムネイル | 11tik",
  },
  ko: {
    thumbHeading: "{title} 썸네일",
    thumbLead:
      "“{title}”의 공개 썸네일입니다. 11tik은 호스트가 이미 게시한 이미지 파일만 나열합니다. 동영상 스트림에서 추출하지 않으며 원본은 11tik에 저장되지 않습니다.",
    thumbBody:
      "이 페이지의 추출기로 실제 이미지를 반환하는 모든 공개 크기를 미리 보고, 가장 큰 유효 파일을 다운로드하세요. 일반적인 YouTube 이름: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "썸네일은 업로더의 저작물입니다. 일반적인 용도는 개인 참고와 연구입니다. 자신의 커버 아트나 상품으로 재게시하지 마세요.",
    thumbSizes: "확인한 공개 크기: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "다른 썸네일 추출",
    thumbImgAlt: "{title} 썸네일 | 11tik",
  },
  hi: {
    thumbHeading: "{title} थंबनेल",
    thumbLead:
      "“{title}” के लिए सार्वजनिक थंबनेल। 11tik केवल वे छवि फ़ाइलें दिखाता है जो होस्ट पहले से प्रकाशित करता है। वीडियो स्ट्रीम से कुछ नहीं निकाला जाता और मूल 11tik पर संग्रहीत नहीं होता।",
    thumbBody:
      "इस पृष्ठ पर एक्सट्रैक्टर से हर सार्वजनिक आकार का पूर्वावलोकन करें जो वास्तविक छवि लौटाता है, फिर सबसे बड़ी वैध फ़ाइल डाउनलोड करें। सामान्य YouTube नाम: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "थंबनेल अपलोडर की कॉपीराइट सामग्री रहता है। सामान्य उपयोग: व्यक्तिगत संदर्भ और शोध। इसे अपने कवर या merchandise के रूप में पुनः प्रकाशित न करें।",
    thumbSizes: "जाँचे गए सार्वजनिक आकार: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "दूसरा थंबनेल निकालें",
    thumbImgAlt: "{title} थंबनेल | 11tik",
  },
  nl: {
    thumbHeading: "Thumbnail van {title}",
    thumbLead:
      "Openbaar beeld voor “{title}”. 11tik toont alleen afbeeldingsbestanden die de host al publiceert. Er wordt niets uit de videostream gehaald en het origineel wordt niet op 11tik opgeslagen.",
    thumbBody:
      "Gebruik de extractor op deze pagina om elke openbare grootte te bekijken die een echt beeld teruggeeft, en download daarna het grootste geldige bestand. Typische YouTube-namen: maxresdefault, hq720, sddefault, hqdefault, mqdefault en default.",
    thumbRights:
      "De thumbnail blijft het auteursrechtelijk werk van de uploader. Typisch gebruik: persoonlijke referentie en onderzoek. Publiceer het niet als je eigen cover of merchandise.",
    thumbSizes: "Gecontroleerde openbare formaten: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Nog een thumbnail extraheren",
    thumbImgAlt: "Thumbnail van {title} | 11tik",
  },
  bn: {
    thumbHeading: "{title} থাম্বনেইল",
    thumbLead:
      "“{title}”-এর জন্য সর্বজনীন থাম্বনেইল। 11tik শুধু সেই ইমেজ ফাইল তালিকাভুক্ত করে যা হোস্ট ইতিমধ্যে প্রকাশ করেছে। ভিডিও স্ট্রিম থেকে কিছু নেওয়া হয় না এবং মূল ফাইল 11tik-এ সংরক্ষিত হয় না।",
    thumbBody:
      "এই পৃষ্ঠার এক্সট্র্যাক্টর দিয়ে প্রতিটি সর্বজনীন সাইজ প্রিভিউ করুন যা প্রকৃত ছবি ফেরত দেয়, তারপর সবচেয়ে বড় বৈধ ফাইল ডাউনলোড করুন। সাধারণ YouTube নাম: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default।",
    thumbRights:
      "থাম্বনেইল আপলোডারের কপিরাইটকৃত কাজ হিসেবে থাকে। সাধারণ ব্যবহার: ব্যক্তিগত রেফারেন্স ও গবেষণা। নিজের কভার বা merchandise হিসেবে পুনঃপ্রকাশ করবেন না।",
    thumbSizes: "যাচাইকৃত সর্বজনীন সাইজ: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default।",
    thumbCta: "আরেকটি থাম্বনেইল বের করুন",
    thumbImgAlt: "{title} থাম্বনেইল | 11tik",
  },
  fa: {
    thumbHeading: "بندانگشتی {title}",
    thumbLead:
      "تصویر عمومی «{title}». 11tik فقط فایل‌های تصویری را فهرست می‌کند که میزبان از قبل منتشر کرده است. چیزی از جریان ویدیو استخراج نمی‌شود و نسخه اصلی در 11tik ذخیره نمی‌شود.",
    thumbBody:
      "از استخراج‌کننده در این صفحه برای پیش‌نمایش هر اندازه عمومی که تصویر واقعی برمی‌گرداند استفاده کنید، سپس بزرگ‌ترین فایل معتبر را دانلود کنید. نام‌های معمول YouTube: maxresdefault، hq720، sddefault، hqdefault، mqdefault و default.",
    thumbRights:
      "بندانگشتی همچنان اثر دارای حق نشر بارگذارکننده است. استفاده معمول: مرجع شخصی و پژوهش. آن را به‌عنوان کاور یا merchandise خود منتشر نکنید.",
    thumbSizes: "اندازه‌های عمومی بررسی‌شده: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "استخراج بندانگشتی دیگر",
    thumbImgAlt: "بندانگشتی {title} | 11tik",
  },
  he: {
    thumbHeading: "תמונה ממוזערת של {title}",
    thumbLead:
      "תמונה ציבורית עבור «{title}». 11tik מציגה רק קבצי תמונה שהמארח כבר פרסם. לא נלקח פריים מזרם הווידאו והמקור לא נשמר ב-11tik.",
    thumbBody:
      "השתמשו במחלץ בעמוד זה כדי להציג כל גודל ציבורי שמחזיר תמונה אמיתית, ואז הורידו את הקובץ התקף הגדול ביותר. שמות YouTube נפוצים: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "התמונה הממוזערת נשארת יצירה בזכויות יוצרים של המעלה. שימוש טיפוסי: עיון אישי ומחקר. אל תפרסמו אותה כעטיפה או merchandise משלכם.",
    thumbSizes: "גדלים ציבוריים שנבדקו: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "חלצו תמונה ממוזערת נוספת",
    thumbImgAlt: "תמונה ממוזערת של {title} | 11tik",
  },
  id: {
    thumbHeading: "Thumbnail {title}",
    thumbLead:
      "Gambar publik untuk “{title}”. 11tik hanya menampilkan file gambar yang sudah dipublikasikan host. Tidak ada yang diambil dari aliran video dan unggahan asli tidak disimpan di 11tik.",
    thumbBody:
      "Gunakan ekstraktor di halaman ini untuk melihat pratinjau setiap ukuran publik yang mengembalikan gambar nyata, lalu unduh file valid terbesar. Nama YouTube umum: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Thumbnail tetap karya berhak cipta pengunggah. Penggunaan umum: referensi pribadi dan riset. Jangan terbitkan ulang sebagai sampul atau merchandise Anda.",
    thumbSizes: "Ukuran publik yang diperiksa: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Ekstrak thumbnail lain",
    thumbImgAlt: "Thumbnail {title} | 11tik",
  },
  pl: {
    thumbHeading: "Miniatura {title}",
    thumbLead:
      "Publiczny podgląd dla „{title}”. 11tik pokazuje tylko pliki obrazów, które host już opublikował. Nic nie jest pobierane ze strumienia wideo, a oryginał nie jest przechowywany w 11tik.",
    thumbBody:
      "Użyj ekstraktora na tej stronie, aby podejrzeć każdy publiczny rozmiar zwracający prawdziwy obraz, a następnie pobierz największy prawidłowy plik. Typowe nazwy YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Miniatura pozostaje utworem chronionym prawem autorskim autora. Typowe użycie: odniesienie osobiste i badania. Nie publikuj jej jako własnej okładki ani merchandise.",
    thumbSizes: "Sprawdzone publiczne rozmiary: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Wyodrębnij inną miniaturę",
    thumbImgAlt: "Miniatura {title} | 11tik",
  },
  th: {
    thumbHeading: "ภาพขนาดย่อของ {title}",
    thumbLead:
      "ภาพสาธารณะสำหรับ “{title}” 11tik แสดงเฉพาะไฟล์ภาพที่โฮสต์เผยแพร่แล้ว ไม่ดึงจากสตรีมวิดีโอและไม่เก็บต้นฉบับบน 11tik",
    thumbBody:
      "ใช้ตัวแยกในหน้านี้เพื่อดูตัวอย่างทุกขนาดสาธารณะที่คืนภาพจริง จากนั้นดาวน์โหลดไฟล์ที่ถูกต้องที่ใหญ่ที่สุด ชื่อ YouTube ทั่วไป: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default",
    thumbRights:
      "ภาพขนาดย่อยังคงเป็นงานลิขสิทธิ์ของผู้อัปโหลด การใช้ทั่วไป: อ้างอิงส่วนตัวและการศึกษา อย่าเผยแพร่ซ้ำเป็นปกหรือสินค้าของคุณ",
    thumbSizes: "ขนาดสาธารณะที่ตรวจแล้ว: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default",
    thumbCta: "แยกภาพขนาดย่ออื่น",
    thumbImgAlt: "ภาพขนาดย่อของ {title} | 11tik",
  },
  uk: {
    thumbHeading: "Прев’ю «{title}»",
    thumbLead:
      "Публічне прев’ю для «{title}». 11tik показує лише файли зображень, які хост уже опублікував. Кадри з відеопотоку не витягуються, оригінал не зберігається на 11tik.",
    thumbBody:
      "Скористайтеся екстрактором на цій сторінці, щоб переглянути кожен публічний розмір із справжнім зображенням, і завантажте найбільший дійсний файл. Типові назви YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Прев’ю залишається об’єктом авторського права завантажувача. Типове використання — особиста довідка та дослідження. Не публікуйте його як власну обкладинку чи merchandise.",
    thumbSizes: "Перевірені публічні розміри: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Витягнути інше прев’ю",
    thumbImgAlt: "Прев’ю «{title}» | 11tik",
  },
  ur: {
    thumbHeading: "{title} تھمب نیل",
    thumbLead:
      "“{title}” کے لیے عوامی تھمب نیل۔ 11tik صرف وہ تصویری فائلیں دکھاتا ہے جو میزبان پہلے سے شائع کر چکا ہے۔ ویڈیو سٹریم سے کچھ نہیں نکالا جاتا اور اصل 11tik پر محفوظ نہیں ہوتا۔",
    thumbBody:
      "اس صفحے پر ایکسٹریکٹر سے ہر عوامی سائز کا پیش نظارہ کریں جو حقیقی تصویر لوٹاتا ہے، پھر سب سے بڑی درست فائل ڈاؤن لوڈ کریں۔ عام YouTube نام: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default۔",
    thumbRights:
      "تھمب نیل اپ لوڈر کا حقوقِ اشاعت والا کام رہتا ہے۔ عام استعمال: ذاتی حوالہ اور تحقیق۔ اسے اپنی کور یا merchandise کے طور پر دوبارہ شائع نہ کریں۔",
    thumbSizes: "جانچی گئی عوامی سائزیں: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default۔",
    thumbCta: "ایک اور تھمب نیل نکالیں",
    thumbImgAlt: "{title} تھمب نیل | 11tik",
  },
  vi: {
    thumbHeading: "Ảnh thu nhỏ của {title}",
    thumbLead:
      "Ảnh công khai cho “{title}”. 11tik chỉ liệt kê các tệp hình ảnh mà máy chủ đã công bố. Không lấy khung hình từ luồng video và bản gốc không được lưu trên 11tik.",
    thumbBody:
      "Dùng trình trích xuất trên trang này để xem trước mọi kích thước công khai trả về ảnh thật, rồi tải tệp hợp lệ lớn nhất. Tên YouTube thường gặp: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Ảnh thu nhỏ vẫn là tác phẩm có bản quyền của người tải lên. Dùng thường gặp: tham khảo cá nhân và nghiên cứu. Đừng tái xuất bản như ảnh bìa hoặc hàng hóa của bạn.",
    thumbSizes: "Kích thước công khai đã kiểm tra: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Trích xuất ảnh thu nhỏ khác",
    thumbImgAlt: "Ảnh thu nhỏ của {title} | 11tik",
  },
  bg: {
    thumbHeading: "Миниатюра на {title}",
    thumbLead:
      "Публично изображение за „{title}“. 11tik показва само файлове, които хостът вече е публикувал. Нищо не се извлича от видеопотока и оригиналът не се съхранява в 11tik.",
    thumbBody:
      "Използвайте екстрактора на тази страница, за да прегледате всеки публичен размер с реално изображение, след което изтеглете най-големия валиден файл. Типични YouTube имена: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Миниатюрата остава обект на авторско право на качващия. Типична употреба: лична справка и изследване. Не я публикувайте като собствена корица или merchandise.",
    thumbSizes: "Проверени публични размери: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Извлечи друга миниатюра",
    thumbImgAlt: "Миниатюра на {title} | 11tik",
  },
  cs: {
    thumbHeading: "Miniatura {title}",
    thumbLead:
      "Veřejný náhled pro „{title}“. 11tik zobrazuje pouze soubory obrázků, které hostitel již publikoval. Nic se nebere z video streamu a originál se na 11tik neukládá.",
    thumbBody:
      "Použijte extraktor na této stránce k náhledu každé veřejné velikosti, která vrátí skutečný obrázek, a stáhněte největší platný soubor. Typická jména YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Miniatura zůstává autorsky chráněným dílem nahrávajícího. Typické použití: osobní reference a výzkum. Nepublikujte ji jako vlastní obálku nebo merchandise.",
    thumbSizes: "Ověřené veřejné velikosti: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Extrahovat další miniaturu",
    thumbImgAlt: "Miniatura {title} | 11tik",
  },
  da: {
    thumbHeading: "Miniature af {title}",
    thumbLead:
      "Offentligt billede for “{title}”. 11tik viser kun billedfiler, som værten allerede har udgivet. Intet hentes fra videostrømmen, og originalen gemmes ikke på 11tik.",
    thumbBody:
      "Brug extractoren på denne side til at forhåndsvise hver offentlig størrelse, der returnerer et rigtigt billede, og download derefter den største gyldige fil. Typiske YouTube-navne: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Miniaturen forbliver uploaders ophavsretlige værk. Typisk brug: personlig reference og research. Genudgiv den ikke som dit eget cover eller merchandise.",
    thumbSizes: "Kontrollerede offentlige størrelser: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Udtræk endnu en miniature",
    thumbImgAlt: "Miniature af {title} | 11tik",
  },
  el: {
    thumbHeading: "Μικρογραφία {title}",
    thumbLead:
      "Δημόσια εικόνα για «{title}». Το 11tik εμφανίζει μόνο αρχεία εικόνας που ο host έχει ήδη δημοσιεύσει. Τίποτα δεν αποσπάται από τη ροή βίντεο και το πρωτότυπο δεν αποθηκεύεται στο 11tik.",
    thumbBody:
      "Χρησιμοποιήστε τον εξαγωγέα σε αυτή τη σελίδα για να δείτε κάθε δημόσιο μέγεθος που επιστρέφει πραγματική εικόνα, στη συνέχεια κατεβάστε το μεγαλύτερο έγκυρο αρχείο. Τυπικά ονόματα YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Η μικρογραφία παραμένει έργο με πνευματικά δικαιώματα του ανεβάσματος. Τυπική χρήση: προσωπική αναφορά και έρευνα. Μην την ξαναδημοσιεύσετε ως δικό σας εξώφυλλο ή merchandise.",
    thumbSizes: "Ελεγμένα δημόσια μεγέθη: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Εξαγωγή άλλης μικρογραφίας",
    thumbImgAlt: "Μικρογραφία {title} | 11tik",
  },
  fi: {
    thumbHeading: "{title} -pikkukuva",
    thumbLead:
      "Julkinen kuva kohteelle “{title}”. 11tik näyttää vain kuvatiedostot, jotka isäntä on jo julkaissut. Mitään ei poimita videovirasta eikä alkuperäistä tallenneta 11tikissä.",
    thumbBody:
      "Esikatsele tällä sivulla jokainen julkinen koko, joka palauttaa oikean kuvan, ja lataa suurin kelvollinen tiedosto. Tyypilliset YouTube-nimet: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Pikkukuva pysyy lataajan tekijänoikeudellisena teoksena. Tyypillinen käyttö: henkilökohtainen viite ja tutkimus. Älä julkaise sitä uudelleen omana kansikuvana tai merchandise-tuotteena.",
    thumbSizes: "Tarkistetut julkiset koot: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Poimi toinen pikkukuva",
    thumbImgAlt: "{title} -pikkukuva | 11tik",
  },
  hr: {
    thumbHeading: "Sličica {title}",
    thumbLead:
      "Javna slika za “{title}”. 11tik prikazuje samo datoteke slika koje host već objavljuje. Ništa se ne izvlači iz video streama, a original se ne pohranjuje na 11tik.",
    thumbBody:
      "Koristite ekstraktor na ovoj stranici za pregled svake javne veličine koja vraća stvarnu sliku, zatim preuzmite najveću valjanu datoteku. Tipična YouTube imena: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Sličica ostaje autorsko djelo uploadera. Tipična upotreba: osobna referenca i istraživanje. Ne objavljujte je kao vlastitu naslovnicu ili merchandise.",
    thumbSizes: "Provjerene javne veličine: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Izdvoji drugu sličicu",
    thumbImgAlt: "Sličica {title} | 11tik",
  },
  hu: {
    thumbHeading: "{title} miniatűr",
    thumbLead:
      "Nyilvános kép a(z) „{title}” videóhoz. Az 11tik csak a már közzétett képfájlokat listázza. Semmit nem vág ki a videófolyamból, az eredeti nem kerül tárolásra az 11tiken.",
    thumbBody:
      "Az oldalon lévő kivonóval tekintse meg az összes nyilvános méretet, amely valódi képet ad vissza, majd töltse le a legnagyobb érvényes fájlt. Tipikus YouTube-nevek: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "A miniatűr továbbra is a feltöltő szerzői műve. Tipikus használat: személyes hivatkozás és kutatás. Ne tegye közzé saját borítóként vagy merchandise-ként.",
    thumbSizes: "Ellenőrzött nyilvános méretek: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Másik miniatűr kivonása",
    thumbImgAlt: "{title} miniatűr | 11tik",
  },
  ro: {
    thumbHeading: "Miniatura {title}",
    thumbLead:
      "Imagine publică pentru „{title}”. 11tik listează doar fișierele de imagine pe care gazda le-a publicat deja. Nimic nu este extras din fluxul video, iar originalul nu este stocat pe 11tik.",
    thumbBody:
      "Folosiți extractorul de pe această pagină pentru a previzualiza fiecare dimensiune publică care returnează o imagine reală, apoi descărcați cel mai mare fișier valid. Nume YouTube tipice: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Miniatura rămâne opera protejată a autorului. Utilizare tipică: referință personală și cercetare. Nu o republicați ca copertă sau merchandise propriu.",
    thumbSizes: "Dimensiuni publice verificate: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Extrage altă miniatură",
    thumbImgAlt: "Miniatura {title} | 11tik",
  },
  sv: {
    thumbHeading: "Miniatyr för {title}",
    thumbLead:
      "Offentlig bild för “{title}”. 11tik visar bara bildfiler som värden redan publicerat. Inget tas från videoströmmen och originalet lagras inte på 11tik.",
    thumbBody:
      "Använd extraktorn på den här sidan för att förhandsgranska varje offentlig storlek som returnerar en riktig bild och ladda sedan ner den största giltiga filen. Typiska YouTube-namn: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Miniatyren förblir uppladdarens upphovsrättsskyddade verk. Typisk användning: personlig referens och research. Publicera den inte som ditt eget omslag eller merchandise.",
    thumbSizes: "Kontrollerade offentliga storlekar: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Extrahera en annan miniatyr",
    thumbImgAlt: "Miniatyr för {title} | 11tik",
  },
  ms: {
    thumbHeading: "Imej kecil {title}",
    thumbLead:
      "Imej awam untuk “{title}”. 11tik hanya menyenaraikan fail imej yang hos sudah terbitkan. Tiada yang diambil dari strim video dan asal tidak disimpan di 11tik.",
    thumbBody:
      "Gunakan pengekstrak di halaman ini untuk pratonton setiap saiz awam yang memulangkan imej sebenar, kemudian muat turun fail sah yang terbesar. Nama YouTube biasa: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Imej kecil kekal karya hak cipta pemuat naik. Kegunaan biasa: rujukan peribadi dan penyelidikan. Jangan terbitkan semula sebagai kulit atau merchandise anda.",
    thumbSizes: "Saiz awam disemak: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Ekstrak imej kecil lain",
    thumbImgAlt: "Imej kecil {title} | 11tik",
  },
  tl: {
    thumbHeading: "Thumbnail ng {title}",
    thumbLead:
      "Pampublikong larawan para sa “{title}”. Ilista lang ng 11tik ang mga file ng larawang nai-publish na ng host. Walang kinukuha mula sa video stream at hindi iniimbak ang orihinal sa 11tik.",
    thumbBody:
      "Gamitin ang extractor sa pahinang ito para i-preview ang bawat pampublikong sukat na nagbabalik ng tunay na larawan, pagkatapos i-download ang pinakamalaking valid na file. Karaniwang pangalan ng YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Mananatiling copyrighted work ng uploader ang thumbnail. Karaniwang gamit: personal na sanggunian at pananaliksik. Huwag i-republish bilang sariling cover o merchandise.",
    thumbSizes: "Sinuriang pampublikong sukat: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Mag-extract ng ibang thumbnail",
    thumbImgAlt: "Thumbnail ng {title} | 11tik",
  },
  no: {
    thumbHeading: "Miniatyrbilde av {title}",
    thumbLead:
      "Offentlig bilde for «{title}». 11tik viser bare bildefiler verten allerede har publisert. Ingenting hentes fra videostrømmen, og originalen lagres ikke på 11tik.",
    thumbBody:
      "Bruk extractoren på denne siden for å forhåndsvise hver offentlig størrelse som returnerer et ekte bilde, og last ned den største gyldige filen. Typiske YouTube-navn: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Miniatyrbildet forblir opphavsbeskyttet verk av opplasteren. Typisk bruk: personlig referanse og research. Ikke publiser det som ditt eget cover eller merchandise.",
    thumbSizes: "Kontrollerte offentlige størrelser: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Trekk ut et annet miniatyrbilde",
    thumbImgAlt: "Miniatyrbilde av {title} | 11tik",
  },
  sk: {
    thumbHeading: "Miniatúra {title}",
    thumbLead:
      "Verejný náhľad pre „{title}“. 11tik zobrazuje len súbory obrázkov, ktoré hostiteľ už publikoval. Nič sa neberie z video streamu a originál sa na 11tik neukladá.",
    thumbBody:
      "Použite extraktor na tejto stránke na náhľad každej verejnej veľkosti, ktorá vráti skutočný obrázok, a stiahnite najväčší platný súbor. Typické názvy YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Miniatúra zostáva autorsky chráneným dielom nahrávajúceho. Typické použitie: osobná referencia a výskum. Nepublikujte ju ako vlastnú obálku alebo merchandise.",
    thumbSizes: "Overené verejné veľkosti: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Extrahovať ďalšiu miniatúru",
    thumbImgAlt: "Miniatúra {title} | 11tik",
  },
  sr: {
    thumbHeading: "Сличица {title}",
    thumbLead:
      "Јавна слика за „{title}“. 11tik приказује само датотеке слика које домаћин већ објављује. Ништа се не извлачи из видео стрима, а оригинал се не чува на 11tik.",
    thumbBody:
      "Користите екстрактор на овој страници да прегледате сваку јавну величину која враћа stvarnu sliku, затим preuzmite najveću važeću datoteku. Tipična imena na YouTube-u: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Сличица остаје ауторско дело отпремљача. Типична употреба: лична референца и истраживање. Не објављујте је као сопствену насловницу или merchandise.",
    thumbSizes: "Проверене javne veličine: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Изdvojite još jednu sličicu",
    thumbImgAlt: "Сличица {title} | 11tik",
  },
  sw: {
    thumbHeading: "Kijipicha cha {title}",
    thumbLead:
      "Picha ya umma kwa “{title}”. 11tik huorodhesha faili za picha ambazo mwenyeji tayari amechapisha. Hakuna kinachotolewa kutoka kwenye mkondo wa video na asili haihifadhiwi kwenye 11tik.",
    thumbBody:
      "Tumia kichujio kwenye ukurasa huu kuona kila ukubwa wa umma unaorudisha picha halisi, kisha pakua faili halali kubwa zaidi. Majina ya kawaida ya YouTube: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbRights:
      "Kijipicha kinabaki kama kazi iliyo na hakimiliki ya mpakiaji. Matumizi ya kawaida: marejeo ya kibinafsi na utafiti. Usichapishe tena kama jalada lako au bidhaa.",
    thumbSizes: "Ukubwa wa umma uliokaguliwa: maxresdefault, hq720, sddefault, hqdefault, mqdefault, default.",
    thumbCta: "Chukua kijipicha kingine",
    thumbImgAlt: "Kijipicha cha {title} | 11tik",
  },
};
