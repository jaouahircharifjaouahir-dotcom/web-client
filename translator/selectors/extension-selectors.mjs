/**
 * Documented selectors / messages from the Google Translate Chrome extension UI.
 * Used for analysis and optional future browser automation (not required for GTX API path).
 */
export const EXTENSION_SELECTORS = Object.freeze({
  popupTextInput: "#text-input",
  popupTranslation: "#translation",
  popupTranslatePageInfo: "#translate-page-info",
  popupOptionsLink: "#options-link",
  popupTranslateLink: "#translate-link",
  optionsPrimaryLanguage: "select, #lang-select, [name='targetLang']",
  bubbleClass: ".gtx-bubble",
  languageSelectorClass: ".gtx-lang-selector",
});

export const EXTENSION_STORAGE_KEYS = Object.freeze({
  targetLang: "gtx.targetLang",
  showBubble: "gtx.showBubble",
  detectLanguage: "gtx.detectLanguage",
});

export const EXTENSION_ENDPOINTS = Object.freeze({
  onePlatformTranslate: "https://translate-pa.googleapis.com/v1/translate",
  onePlatformSupportedLanguages: "https://translate-pa.googleapis.com/v1/supportedLanguages",
  ajaxSingle: "https://translate.googleapis.com/translate_a/single",
  ajaxBatch: "https://translate.googleapis.com/translate_a/t",
  websiteTranslate: "https://translate.google.com/translate",
});
