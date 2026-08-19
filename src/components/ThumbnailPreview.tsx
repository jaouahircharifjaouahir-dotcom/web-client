function cssSafeUrl(url: string): string {
  return url.replace(/[)"'\\]/g, "");
}

export function ThumbnailPreview({ url, label, priority = false }: { url: string; label: string; priority?: boolean }) {
  return (
    <div className="yte-thumb" role="img" aria-label={label}>
      <img
        alt={label}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        src={cssSafeUrl(url)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
