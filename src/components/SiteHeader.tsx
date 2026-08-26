import type { MouseEvent } from "react";
import { config } from "../config";
import { languageOptions, localeHomeUrl, switchLocale, t } from "../i18n/ui";
import { homeViewHref, type HomeView } from "../routing/homeView";
import type { ThemeMode } from "../hooks/theme";

type SiteHeaderProps = {
  homeView: HomeView;
  theme: ThemeMode;
  themeLabel: string;
  onCycleTheme: () => void;
  onNavigateView?: (view: HomeView) => void;
  locale: string;
};

/** Shared SPA header — Posts/Bulk are URL links (?posts=1 / ?bulk=1). */
export function SiteHeader({
  homeView,
  themeLabel,
  onCycleTheme,
  onNavigateView,
  locale,
}: SiteHeaderProps) {
  const home = localeHomeUrl();
  const postsHref = homeViewHref("posts", home);
  const bulkHref = homeViewHref("bulk", home);
  const postsActive = homeView === "posts";
  const bulkActive = homeView === "bulk";

  const onViewClick = (view: HomeView, event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigateView) return;
    event.preventDefault();
    onNavigateView(view);
  };

  return (
    <header className="yte-top" role="banner">
      <a className="yte-brand" href={home}>
        <span className="yte-mark" aria-hidden="true">
          11
        </span>
        <span>{config.siteName}</span>
      </a>
      <nav className="yte-actions" aria-label="Site">
        <a
          className="yte-chip"
          href={postsHref}
          aria-pressed={postsActive}
          aria-current={postsActive ? "page" : undefined}
          onClick={(event) => onViewClick("posts", event)}
        >
          {t("posts")}
        </a>
        <a
          className="yte-chip"
          href={bulkHref}
          aria-pressed={bulkActive}
          aria-current={bulkActive ? "page" : undefined}
          onClick={(event) => onViewClick("bulk", event)}
        >
          {t("bulk")}
        </a>
        <button className="yte-chip" type="button" onClick={onCycleTheme} aria-label={t("theme")}>
          {t("theme")}: {themeLabel}
        </button>
        <label className="yte-chip yte-lang">
          <span className="yte-sr">{t("language")}</span>
          <select aria-label={t("language")} value={locale} onChange={(event) => switchLocale(event.target.value)}>
            {languageOptions().map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </nav>
    </header>
  );
}
