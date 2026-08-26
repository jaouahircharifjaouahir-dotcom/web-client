import { config } from "../config";
import { languageOptions, localeHomeUrl, switchLocale, t } from "../i18n/ui";
import type { ThemeMode } from "../hooks/theme";

type SiteHeaderProps = {
  postsOpen: boolean;
  bulk: boolean;
  theme: ThemeMode;
  themeLabel: string;
  onTogglePosts: () => void;
  onToggleBulk: () => void;
  onCycleTheme: () => void;
  locale: string;
};

/** Shared SPA header — same chrome as scripts/i18n/site-header.mjs static markup. */
export function SiteHeader({
  postsOpen,
  bulk,
  themeLabel,
  onTogglePosts,
  onToggleBulk,
  onCycleTheme,
  locale,
}: SiteHeaderProps) {
  return (
    <header className="yte-top" role="banner">
      <a className="yte-brand" href={localeHomeUrl()}>
        <span className="yte-mark" aria-hidden="true">
          11
        </span>
        <span>{config.siteName}</span>
      </a>
      <nav className="yte-actions" aria-label="Site">
        <button
          className="yte-chip"
          type="button"
          aria-expanded={postsOpen}
          aria-pressed={postsOpen}
          onClick={onTogglePosts}
        >
          {t("posts")}
        </button>
        <button className="yte-chip" type="button" aria-pressed={bulk} onClick={onToggleBulk}>
          {t("bulk")}
        </button>
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
