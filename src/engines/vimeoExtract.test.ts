import { describe, expect, it } from "vitest";
import { expandVimeoThumbs, withVimeoSize } from "./vimeoExtract";

describe("Vimeo thumbnail sizes", () => {
  const oembed =
    "https://i.vimeocdn.com/video/145027281-cf3e3e047a52e2210b26bbcf42fcde909a80a7dd023a757b95af01936d065ec0-d_295x166?region=us";

  it("rewrites -d_WxH to 1920x1080", () => {
    expect(withVimeoSize(oembed, "1920x1080")).toContain("-d_1920x1080");
    expect(withVimeoSize(oembed, "1920x1080")).not.toContain("295x166");
  });

  it("lists X-Large 1920x1080 first", () => {
    const urls = expandVimeoThumbs(oembed);
    expect(urls[0]?.quality).toBe("x-large");
    expect(urls[0]?.expectedWidth).toBe(1920);
    expect(urls[0]?.expectedHeight).toBe(1080);
    expect(urls[0]?.url).toContain("1920x1080");
  });

  it("rewrites -d_1280 oEmbed URLs to 1920x1080", () => {
    const wide =
      "https://i.vimeocdn.com/video/2189541441-20a90d556c11a0b72149fee4254fdd21b7a74b7eaaacc20c603d2ec42f42147f-d_1280?region=us";
    expect(withVimeoSize(wide, "1920x1080")).toContain("-d_1920x1080");
  });
});
