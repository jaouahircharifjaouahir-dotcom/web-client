/** True when static HTML already injected #yte-site-header (locale/index shells). */
export function hasStaticSiteHeader(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.getElementById("yte-site-header"));
}
