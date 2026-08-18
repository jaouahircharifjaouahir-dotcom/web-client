function cssSafeUrl(url: string): string {
  return url.replace(/[)"'\\]/g, "");
}

export function ThumbnailPreview({ url, label }: { url: string; label: string }) {
  return (
    <div
      className="yte-thumb"
      role="img"
      aria-label={label}
      style={{ backgroundImage: `url("${cssSafeUrl(url)}")` }}
    />
  );
}
