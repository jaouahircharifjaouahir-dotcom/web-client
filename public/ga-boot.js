window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
function loadGtag() {
  if (window.__yteGtag) return;
  window.__yteGtag = 1;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=G-FW7B8NDZZ5";
  s.onload = function () {
    gtag("js", new Date());
    gtag("config", "G-FW7B8NDZZ5", { cookie_domain: "11tik.com" });
  };
  document.head.appendChild(s);
}
["pointerdown", "keydown"].forEach(function (ev) {
  window.addEventListener(ev, loadGtag, { once: true, passive: true });
});
window.setTimeout(loadGtag, 8000);
