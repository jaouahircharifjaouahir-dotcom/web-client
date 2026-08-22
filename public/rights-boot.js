(function () {
  var HOME = "https://www.11tik.com/";
  var host = (location.hostname || "").toLowerCase();
  var local = host === "localhost" || host === "127.0.0.1";
  var ours = host === "11tik.com" || host.slice(-10) === ".11tik.com";
  window.__yteRights = 1;
  if (!local && !ours) {
    location.replace(HOME + "p/terms-of-use.html");
    return;
  }
  document.addEventListener("copy", function (event) {
    var selected = (window.getSelection() && window.getSelection().toString()) || "";
    var notice =
      "\n\n© 11tik — https://www.11tik.com/  Content is protected. See https://www.11tik.com/p/terms-of-use.html";
    try {
      if (event.clipboardData) {
        event.clipboardData.setData("text/plain", selected + notice);
        event.preventDefault();
      }
    } catch (e) {}
    var old = document.getElementById("yte-copy-notice");
    if (old) old.remove();
    var el = document.createElement("div");
    el.id = "yte-copy-notice";
    el.setAttribute("role", "status");
    el.style.cssText =
      "position:fixed;z-index:2147483646;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(92vw,420px);padding:10px 14px;border-radius:12px;background:#17141c;color:#f6f1ea;font:14px/1.4 system-ui,sans-serif";
    el.textContent = "© 11tik — this content is protected. https://www.11tik.com/";
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 4000);
  });
})();
