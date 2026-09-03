import { readLocale } from "../i18n/ui";

/** EN-only hub + capability blocks matching the crawlable homepage shell. */
export function HomeHubsCaps() {
  if (readLocale() !== "en") return null;

  return (
    <>
      <section className="yte-panel yte-home-caps" aria-labelledby="yte-home-caps-heading">
        <h2 id="yte-home-caps-heading">What this extractor covers</h2>
        <ul>
          <li>
            Download or grab public YouTube thumbnail stills from a supported video URL (one
            product—not separate downloader or grabber tools).
          </li>
          <li>
            Bulk mode for up to <strong>50</strong> URLs per run, with ZIP of highest-quality
            stills and CSV export — see the{" "}
            <a href="https://www.11tik.com/how-to-batch-download-youtube">batch download guide</a>.
          </li>
          <li>
            Validates which public sizes actually load for watch links and Shorts, including honest
            maxres when YouTube publishes it.
          </li>
          <li>
            Optional{" "}
            <a href="https://addons.mozilla.org/en-US/firefox/addon/11tik-youtube-thumbnails/">
              11tik for Firefox
            </a>{" "}
            for the current YouTube tab; the website tool stays at{" "}
            <a href="https://www.11tik.com/">www.11tik.com</a>.
          </li>
        </ul>
      </section>
      <section className="yte-panel yte-home-hubs" aria-labelledby="yte-home-hubs-heading">
        <h2 id="yte-home-hubs-heading">Guides that support this tool</h2>
        <ul>
          <li>
            <a href="https://www.11tik.com/how-to-download-youtube-thumbnail">
              Save a public YouTube thumbnail step by step
            </a>{" "}
            — Single-URL walkthrough, then return here to extract.
          </li>
          <li>
            <a href="https://www.11tik.com/how-to-batch-download-youtube">
              Work through multiple thumbnail URLs
            </a>{" "}
            — Up to 50 public links with ZIP and CSV export in Bulk mode.
          </li>
          <li>
            <a href="https://www.11tik.com/youtube-thumbnail-sizes-resolutions-study">
              Measured sizes across 300 videos
            </a>{" "}
            — Sample-based evidence on dimensions and maxres availability.
          </li>
        </ul>
      </section>
    </>
  );
}
