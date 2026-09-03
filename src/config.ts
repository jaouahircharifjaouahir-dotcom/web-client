import productIdentity from "./content/product-identity.json" with { type: "json" };

export const config = {
  productName: productIdentity.productName,
  siteName: productIdentity.brand,
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
  ],
  gaMeasurementId: "G-FW7B8NDZZ5",
  requestTimeoutMs: 8000,
  maxBulkUrls: productIdentity.bulkLimit,
} as const;

export { productIdentity };

export function isEmbedMode(): boolean {
  return new URLSearchParams(window.location.search).get("embed") === "1";
}
