export const config = {
  productName: "YouTube Thumbnail Extractor",
  siteName: "11tik",
  publicSiteUrl: "https://www.11tik.com",
  appPath: "/",
  get publicAppUrl() {
    return "https://www.11tik.com/";
  },
  allowedImageHosts: [
    "i.ytimg.com",
    "i1.ytimg.com",
    "i2.ytimg.com",
    "i3.ytimg.com",
    "i9.ytimg.com",
    "img.youtube.com",
    "i.vimeocdn.com",
  ],
  gaMeasurementId: "G-FW7B8NDZZ5",
  requestTimeoutMs: 8000,
  maxBulkUrls: 50,
} as const;

export function isEmbedMode(): boolean {
  return new URLSearchParams(window.location.search).get("embed") === "1";
}
