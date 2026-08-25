/**
 * ISO 639-1 → NLLB FLORES-200 code mapping + coverage helpers.
 * Only codes present in FLORES_200 are considered model-supported.
 */
import { ISO6391, RTL_CODES } from "../../workers/iso6391.js";
import { NON_EN_LOCALES } from "./translation-store.mjs";

/** Authoritative FLORES-200 codes supported by NLLB-200 (200 languages). */
export const FLORES_200 = new Set([
  "ace_Latn", "acm_Arab", "acq_Arab", "aeb_Arab", "afr_Latn", "ajp_Arab", "aka_Latn", "amh_Ethi",
  "apc_Arab", "arb_Arab", "ars_Arab", "ary_Arab", "arz_Arab", "asm_Beng", "ast_Latn", "awa_Deva",
  "ayr_Latn", "azb_Arab", "azj_Latn", "bak_Cyrl", "bam_Latn", "ban_Latn", "bel_Cyrl", "bem_Latn",
  "ben_Beng", "bho_Deva", "bjn_Arab", "bjn_Latn", "bod_Tibt", "bos_Latn", "bug_Latn", "bul_Cyrl",
  "cat_Latn", "ceb_Latn", "ces_Latn", "cjk_Latn", "ckb_Arab", "crh_Latn", "cym_Latn", "dan_Latn",
  "deu_Latn", "dik_Latn", "dyu_Latn", "dzo_Tibt", "ell_Grek", "eng_Latn", "epo_Latn", "est_Latn",
  "eus_Latn", "ewe_Latn", "fao_Latn", "fij_Latn", "fin_Latn", "fon_Latn", "fra_Latn", "fur_Latn",
  "fuv_Latn", "gaz_Latn", "gla_Latn", "gle_Latn", "glg_Latn", "grn_Latn", "guj_Gujr", "hat_Latn",
  "hau_Latn", "heb_Hebr", "hin_Deva", "hne_Deva", "hrv_Latn", "hun_Latn", "hye_Armn", "ibo_Latn",
  "ilo_Latn", "ind_Latn", "isl_Latn", "ita_Latn", "jav_Latn", "jpn_Jpan", "kab_Latn", "kac_Latn",
  "kam_Latn", "kan_Knda", "kas_Arab", "kas_Deva", "kat_Geor", "kaz_Cyrl", "kbp_Latn", "kea_Latn",
  "khk_Cyrl", "khm_Khmr", "kik_Latn", "kin_Latn", "kir_Cyrl", "kmb_Latn", "kmr_Latn", "kon_Latn",
  "kor_Hang", "lao_Laoo", "lij_Latn", "lim_Latn", "lin_Latn", "lit_Latn", "lmo_Latn", "ltg_Latn",
  "ltz_Latn", "lug_Latn", "luo_Latn", "lus_Latn", "lvs_Latn", "mag_Deva", "mai_Deva", "mal_Mlym",
  "mar_Deva", "min_Arab", "min_Latn", "mkd_Cyrl", "mlt_Latn", "mni_Beng", "mos_Latn", "mri_Latn",
  "mya_Mymr", "nld_Latn", "nno_Latn", "nob_Latn", "npi_Deva", "nso_Latn", "nus_Latn", "nya_Latn",
  "oci_Latn", "ory_Orya", "pag_Latn", "pan_Guru", "pap_Latn", "pes_Arab", "plt_Latn", "pol_Latn",
  "por_Latn", "prs_Arab", "pbt_Arab", "quy_Latn", "ron_Latn", "run_Latn", "rus_Cyrl", "sag_Latn",
  "san_Deva", "sat_Beng", "scn_Latn", "shn_Mymr", "sin_Sinh", "slk_Latn", "slv_Latn", "smo_Latn",
  "sna_Latn", "snd_Arab", "som_Latn", "sot_Latn", "spa_Latn", "als_Latn", "srd_Latn", "srp_Cyrl",
  "ssw_Latn", "sun_Latn", "swe_Latn", "swh_Latn", "szl_Latn", "tam_Taml", "tat_Cyrl", "tel_Telu",
  "tgk_Cyrl", "tgl_Latn", "tha_Thai", "tir_Ethi", "taq_Latn", "taq_Tfng", "tpi_Latn", "tsn_Latn",
  "tso_Latn", "tuk_Latn", "tum_Latn", "tur_Latn", "twi_Latn", "tzm_Tfng", "uig_Arab", "ukr_Cyrl",
  "umb_Latn", "urd_Arab", "uzn_Latn", "vec_Latn", "vie_Latn", "war_Latn", "wol_Latn", "xho_Latn",
  "ydd_Hebr", "yor_Latn", "yue_Hant", "zho_Hans", "zho_Hant", "zsm_Latn", "zul_Latn",
]);

/** ISO 639-1 → ISO 639-3 (partial standard table for project locales). */
const ISO1_TO_ISO3 = Object.freeze({
  aa: "aar", ab: "abk", ae: "ave", af: "afr", ak: "aka", am: "amh", an: "arg", ar: "arb", as: "asm",
  av: "ava", ay: "ayr", az: "azj", ba: "bak", be: "bel", bg: "bul", bi: "bis", bm: "bam", bn: "ben",
  bo: "bod", br: "bre", bs: "bos", ca: "cat", ce: "che", ch: "cha", co: "cos", cr: "cre", cs: "ces",
  cu: "chu", cv: "chv", cy: "cym", da: "dan", de: "deu", dv: "div", dz: "dzo", ee: "ewe", el: "ell",
  en: "eng", eo: "epo", es: "spa", et: "est", eu: "eus", fa: "pes", ff: "fuv", fi: "fin", fj: "fij",
  fo: "fao", fr: "fra", fy: "fry", ga: "gle", gd: "gla", gl: "glg", gn: "grn", gu: "guj", gv: "glv",
  ha: "hau", he: "heb", hi: "hin", ho: "hmo", hr: "hrv", ht: "hat", hu: "hun", hy: "hye", hz: "her",
  ia: "ina", id: "ind", ie: "ile", ig: "ibo", ii: "iii", ik: "ipk", io: "ido", is: "isl", it: "ita",
  iu: "iku", ja: "jpn", jv: "jav", ka: "kat", kg: "kon", ki: "kik", kj: "kua", kk: "kaz", kl: "kal",
  km: "khm", kn: "kan", ko: "kor", kr: "kau", ks: "kas", ku: "kmr", kv: "kom", kw: "cor", ky: "kir",
  la: "lat", lb: "ltz", lg: "lug", li: "lim", ln: "lin", lo: "lao", lt: "lit", lu: "lub", lv: "lvs",
  mg: "plt", mh: "mah", mi: "mri", mk: "mkd", ml: "mal", mn: "khk", mr: "mar", ms: "zsm", mt: "mlt",
  my: "mya", na: "nau", nb: "nob", nd: "nde", ne: "npi", ng: "ndo", nl: "nld", nn: "nno", no: "nob",
  nr: "nbl", nv: "nav", ny: "nya", oc: "oci", oj: "oji", om: "gaz", or: "ory", os: "oss", pa: "pan",
  pi: "pli", pl: "pol", ps: "pbt", pt: "por", qu: "quy", rm: "roh", rn: "run", ro: "ron", ru: "rus",
  rw: "kin", sa: "san", sc: "srd", sd: "snd", se: "sme", sg: "sag", si: "sin", sk: "slk", sl: "slv",
  sm: "smo", sn: "sna", so: "som", sq: "als", sr: "srp", ss: "ssw", st: "sot", su: "sun", sv: "swe",
  sw: "swh", ta: "tam", te: "tel", tg: "tgk", th: "tha", ti: "tir", tk: "tuk", tl: "tgl", tn: "tsn",
  to: "ton", tr: "tur", ts: "tso", tt: "tat", tw: "twi", ty: "tah", ug: "uig", uk: "ukr", ur: "urd",
  uz: "uzn", ve: "ven", vi: "vie", vo: "vol", wa: "wln", wo: "wol", xh: "xho", yi: "ydd", yo: "yor",
  za: "zha", zh: "zho", zu: "zul",
});

/** Explicit overrides where heuristic script choice is wrong. */
const ISO1_NLLB_OVERRIDE = Object.freeze({
  ar: "arb_Arab", fa: "pes_Arab", ps: "pbt_Arab", ur: "urd_Arab", sd: "snd_Arab", ug: "uig_Arab",
  dv: "div_Arab", he: "heb_Hebr", yi: "ydd_Hebr", ru: "rus_Cyrl", uk: "ukr_Cyrl", bg: "bul_Cyrl",
  sr: "srp_Cyrl", mk: "mkd_Cyrl", be: "bel_Cyrl", kk: "kaz_Cyrl", ky: "kir_Cyrl", mn: "khk_Cyrl",
  tt: "tat_Cyrl", ba: "bak_Cyrl", cv: "chv_Cyrl", tg: "tgk_Cyrl", zh: "zho_Hans", ja: "jpn_Jpan",
  ko: "kor_Hang", hi: "hin_Deva", mr: "mar_Deva", ne: "npi_Deva", bn: "ben_Beng", as: "asm_Beng",
  pa: "pan_Guru", gu: "guj_Gujr", ta: "tam_Taml", te: "tel_Telu", kn: "kan_Knda", ml: "mal_Mlym",
  or: "ory_Orya", si: "sin_Sinh", th: "tha_Thai", lo: "lao_Laoo", km: "khm_Khmr", my: "mya_Mymr",
  dz: "dzo_Tibt", am: "amh_Ethi", ti: "tir_Ethi", ka: "kat_Geor",
  hy: "hye_Armn", ms: "zsm_Latn", no: "nob_Latn", nb: "nob_Latn",
  nn: "nno_Latn", sq: "als_Latn", hr: "hrv_Latn", bs: "bos_Latn", sw: "swh_Latn", ff: "fuv_Latn",
  om: "gaz_Latn", ku: "kmr_Latn", ks: "kas_Deva", mg: "plt_Latn", qu: "quy_Latn", tl: "tgl_Latn",
  jv: "jav_Latn", su: "sun_Latn", min: "min_Latn", ceb: "ceb_Latn", fil: "tgl_Latn",
});

const SCRIPT_SUFFIX = Object.freeze({
  ara: "_Arab", heb: "_Hebr", ydd: "_Hebr", div: "_Arab", pes: "_Arab", pbt: "_Arab", urd: "_Arab",
  snd: "_Arab", uig: "_Arab", rus: "_Cyrl", ukr: "_Cyrl", bul: "_Cyrl", srp: "_Cyrl", mkd: "_Cyrl",
  bel: "_Cyrl", kaz: "_Cyrl", kir: "_Cyrl", khk: "_Cyrl", tat: "_Cyrl", bak: "_Cyrl", chv: "_Cyrl",
  tgk: "_Cyrl", hin: "_Deva", mar: "_Deva", npi: "_Deva", ben: "_Beng", asm: "_Beng", pan: "_Guru",
  guj: "_Gujr", tam: "_Taml", tel: "_Telu", kan: "_Knda", mal: "_Mlym", ory: "_Orya", sin: "_Sinh",
  tha: "_Thai", lao: "_Laoo", khm: "_Khmr", mya: "_Mymr", bod: "_Tibt", dzo: "_Tibt", amh: "_Ethi",
  tir: "_Ethi", kat: "_Geor", hye: "_Armn", ell: "_Grek", jpn: "_Jpan", kor: "_Hang", zho: "_Hans",
});

function scriptSuffix(iso3) {
  for (const [prefix, suffix] of Object.entries(SCRIPT_SUFFIX)) {
    if (iso3.startsWith(prefix.slice(0, 3))) return suffix;
  }
  return "_Latn";
}

export function candidateNllbCode(iso6391) {
  if (ISO1_NLLB_OVERRIDE[iso6391]) return ISO1_NLLB_OVERRIDE[iso6391];
  const iso3 = ISO1_TO_ISO3[iso6391];
  if (!iso3) return null;
  const code = `${iso3}${scriptSuffix(iso3)}`;
  if (FLORES_200.has(code)) return code;
  const latn = `${iso3}_Latn`;
  if (FLORES_200.has(latn)) return latn;
  return null;
}

export function buildLocaleCoverage() {
  const supported = [];
  const unsupported = [];
  for (const locale of NON_EN_LOCALES) {
    const nllb = candidateNllbCode(locale);
    if (nllb && FLORES_200.has(nllb)) supported.push({ locale, nllb });
    else unsupported.push({ locale, candidate: nllb, name: ISO6391.find(([c]) => c === locale)?.[1] });
  }
  return { supported, unsupported, supportedCount: supported.length, unsupportedCount: unsupported.length };
}

export function nllbCodeForLocale(locale) {
  const row = buildLocaleCoverage().supported.find((r) => r.locale === locale);
  return row?.nllb || null;
}

export function isRtlLocale(locale) {
  return RTL_CODES.has(locale);
}

export const NLLB_SOURCE = "eng_Latn";
