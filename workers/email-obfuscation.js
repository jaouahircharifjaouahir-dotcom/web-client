/**
 * Cloudflare Email Address Obfuscation rewrites mailto → /cdn-cgi/l/email-protection
 * (often 404 for crawlers). Keep real mailto for users; block the rewrite.
 * @see https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/
 */

export function decodeCfEmail(encoded) {
  const hex = String(encoded || "").replace(/^.*#/, "").trim();
  if (hex.length < 4 || hex.length % 2 !== 0) return "";
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    if (Number.isNaN(key)) return "";
    let email = "";
    for (let n = 2; n < hex.length; n += 2) {
      const code = parseInt(hex.slice(n, n + 2), 16) ^ key;
      if (Number.isNaN(code)) return "";
      email += String.fromCharCode(code);
    }
    return email.includes("@") ? email : "";
  } catch {
    return "";
  }
}

/**
 * Wrap mailto anchors with CF email_off markers (idempotent).
 */
export function wrapMailtoWithEmailOff(html) {
  return String(html || "").replace(
    /(?:<!--\s*email_off\s*-->\s*)?<a\b([^>]*\bhref\s*=\s*["']mailto:[^"']*["'][^>]*)>([\s\S]*?)<\/a>(?:\s*<!--\s*\/email_off\s*-->)?/gi,
    "<!--email_off--><a$1>$2</a><!--/email_off-->",
  );
}

/**
 * Convert any leftover /cdn-cgi/l/email-protection links back to mailto (or contact).
 */
export function rewriteEmailProtectionLinks(
  html,
  fallbackHref = "https://www.11tik.com/p/contact.html",
) {
  return String(html || "").replace(
    /<a\b([^>]*?)\bhref\s*=\s*["']([^"']*\/cdn-cgi\/l\/email-protection[^"']*)["']([^>]*)>([\s\S]*?)<\/a>/gi,
    (_full, pre, href, post, inner) => {
      const email = decodeCfEmail(href);
      if (email) {
        return `<!--email_off--><a${pre}href="mailto:${email}"${post}>${inner}</a><!--/email_off-->`;
      }
      return `<a${pre}href="${fallbackHref}"${post}>${inner}</a>`;
    },
  );
}

/** Full guard used by Worker + static HTML emitters. */
export function protectEmailsInHtml(html) {
  return rewriteEmailProtectionLinks(wrapMailtoWithEmailOff(html));
}
