export const config = {
  productName: "YouTube Thumbnail Extractor",
  siteName: "11tik",
  publicSiteUrl: "https://11tik.com",
  appPath: "/p/youtube-thumbnail-extractor.html",
  get publicAppUrl() {
    return `${this.publicSiteUrl}${this.appPath}`;
  },
  staticAppUrl:
    "https://jaouahircharifjaouahir-dotcom.github.io/youtube-thumbnail-extractor/",
  repoUrl:
    "https://github.com/jaouahircharifjaouahir-dotcom/youtube-thumbnail-extractor",
  allowedImageHosts: ["i.ytimg.com", "i1.ytimg.com", "i2.ytimg.com", "i3.ytimg.com", "i9.ytimg.com", "img.youtube.com"],
  requestTimeoutMs: 8000,
  maxBulkUrls: 25,
} as const;

export function isEmbedMode(): boolean {
  return new URLSearchParams(window.location.search).get("embed") === "1";
}
