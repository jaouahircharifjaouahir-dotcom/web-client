(function () {
  var frame = document.getElementById("yte-app");
  if (!frame) return;
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "yte" || data.type !== "resize") return;
    if (typeof data.height === "number" && data.height > 400) {
      frame.style.height = data.height + "px";
    }
  });
})();
