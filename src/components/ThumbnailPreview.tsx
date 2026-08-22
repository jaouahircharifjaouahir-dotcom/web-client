function cssSafeUrl(url: string): string {
  return url.replace(/[)"'\\]/g, "");
}

export function ThumbnailPreview({
  url,
  alt,
  title,
  priority = false,
}: {
  url: string;
  alt: string;
  title?: string;
  priority?: boolean;
}) {
  return (
    <div className="yte-thumb" role="img" aria-label={alt}>
      <img
        alt={alt}
        title={title || alt}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        src={cssSafeUrl(url)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
