/**
 * Client enhancements for the shared static site header (#yte-site-header).
 * Theme + language use the same keys / publishability rules as the SPA.
 */
(function () {
  "use strict";

  var THEME_KEY = "yte-theme";
  var LANG_KEY = "yte-lang";
  var PUBLISHABILITY_PATH = "/web-client/i18n/publishability.json";
  function readTheme() {
    try {
      var value = localStorage.getItem(THEME_KEY);
      return value === "light" || value === "dark" || value === "system" ? value : "system";
    } catch (_) {
      return "system";
    }
  }

  function saveTheme(mode) {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (_) {
      /* ignore */
    }
  }

  function resolvedTheme(mode) {
    if (mode === "light" || mode === "dark") return mode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(mode) {
    var resolved = resolvedTheme(mode);
    document.documentElement.setAttribute("data-yte-theme", resolved);
    var root = document.getElementById("yte-root");
    if (root) root.setAttribute("data-yte-theme", resolved);
  }

  function nextTheme(mode) {
    if (mode === "dark") return "light";
    if (mode === "light") return "system";
    return "dark";
  }

  function themeWord(btn, mode) {
    if (!btn) return mode;
    if (mode === "light") return btn.getAttribute("data-yte-label-light") || "light";
    if (mode === "dark") return btn.getAttribute("data-yte-label-dark") || "dark";
    return btn.getAttribute("data-yte-label-system") || "system";
  }

  function updateThemeButton(mode) {
    var btn = document.getElementById("yte-theme-btn");
    if (!btn) return;
    var label = btn.querySelector("[data-yte-theme-label]");
    var prefix = btn.getAttribute("data-yte-theme-prefix") || "Theme";
    var word = themeWord(btn, mode);
    if (label) label.textContent = prefix + ": " + word;
    else btn.textContent = prefix + ": " + word;
  }

  function localeHomeUrl(code) {
    if (code === "en") return "https://www.11tik.com/";
    return "https://" + code + ".11tik.com/l/" + code + "/";
  }

  function normalizeContentPath(pathname) {
    var path = String(pathname || "").replace(/\/+$/, "") || "/";
    var localePrefixed = path.match(/^\/l\/([a-z]{2})(\/.*)?$/i);
    if (localePrefixed) path = localePrefixed[2] || "/";
    if (path !== "/" && !/\.html$/i.test(path) && /^\/(2026|p)\//i.test(path)) {
      path = path + ".html";
    }
    return path;
  }

  function findEntry(doc, pathname) {
    if (!doc || !doc.contents) return null;
    var path = normalizeContentPath(pathname);
    var keys = Object.keys(doc.contents);
    for (var i = 0; i < keys.length; i++) {
      var entry = doc.contents[keys[i]];
      if (entry && entry.path === path) return entry;
    }
    return null;
  }

  function localizedUrlForLocale(entry, locale) {
    if (locale === "en") return entry.en || null;
    return (entry.locales && entry.locales[locale]) || null;
  }

  function withSearchAndHash(dest, from) {
    var out = new URL(dest);
    out.search = from.search;
    out.hash = from.hash;
    out.searchParams.delete("lang");
    return out.href;
  }

  function resolveLocaleDestination(currentHref, targetLocale, doc) {
    var here = new URL(currentHref);
    var home = localeHomeUrl(targetLocale);
    var entry = findEntry(doc, here.pathname);
    if (!entry) return withSearchAndHash(home, here);
    var ready = localizedUrlForLocale(entry, targetLocale);
    var dest = ready || entry.en || home;
    return withSearchAndHash(dest, here);
  }

  var publishabilityCache = null;
  var publishabilityInflight = null;

  function loadPublishability() {
    if (publishabilityCache) return Promise.resolve(publishabilityCache);
    if (publishabilityInflight) return publishabilityInflight;
    publishabilityInflight = fetch(PUBLISHABILITY_PATH, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (doc) {
        publishabilityCache = doc;
        return doc;
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        publishabilityInflight = null;
      });
    return publishabilityInflight;
  }

  function onProductHost() {
    return /(^|\.)11tik\.com$/i.test(window.location.hostname);
  }

  function switchLocale(code) {
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch (_) {
      /* ignore */
    }
    var here = new URL(window.location.href);
    if (!onProductHost()) {
      here.searchParams.set("lang", code);
      window.location.assign(here.href);
      return;
    }
    loadPublishability().then(function (doc) {
      var dest = resolveLocaleDestination(here.href, code, doc);
      window.location.assign(dest);
    });
  }

  function dispatchApp(name) {
    window.dispatchEvent(new CustomEvent(name));
  }

  function isSpaHomeContext() {
    var header = document.getElementById("yte-site-header");
    if (header && header.getAttribute("data-yte-variant") === "spa-shell") return true;
    return Boolean(document.getElementById("yte-root") && window.__yteAppReady);
  }

  function wireHeader() {
    var header = document.getElementById("yte-site-header");
    if (!header || header.getAttribute("data-yte-wired") === "1") return;
    header.setAttribute("data-yte-wired", "1");

    var mode = readTheme();
    applyTheme(mode);
    updateThemeButton(mode);

    var themeBtn = document.getElementById("yte-theme-btn");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        mode = nextTheme(readTheme());
        saveTheme(mode);
        applyTheme(mode);
        updateThemeButton(mode);
        dispatchApp("yte:theme-change");
      });
    }

    var lang = document.getElementById("yte-lang-select");
    if (lang) {
      lang.addEventListener("change", function () {
        var code = lang.value;
        if (code) switchLocale(code);
      });
    }

    var posts = document.getElementById("yte-posts-btn");
    if (posts) {
      posts.addEventListener("click", function (event) {
        if (isSpaHomeContext() || window.__yteAppReady) {
          event.preventDefault();
          dispatchApp("yte:toggle-posts");
        }
      });
    }

    var bulk = document.getElementById("yte-bulk-btn");
    if (bulk) {
      bulk.addEventListener("click", function (event) {
        if (isSpaHomeContext() || window.__yteAppReady) {
          event.preventDefault();
          dispatchApp("yte:toggle-bulk");
        }
      });
    }

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (readTheme() === "system") applyTheme("system");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireHeader);
  } else {
    wireHeader();
  }

  window.__yteWireSiteHeader = wireHeader;
})();
