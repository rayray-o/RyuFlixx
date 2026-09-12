"use client";

interface AdFreeIframeProps {
  src: string;
  title: string;
  className?: string;
  height?: number | string;
  width?: number | string;
  loading?: "eager" | "lazy";
}

export default function AdFreeIframe({
  src,
  title,
  className,
  height = "100%",
  width = "100%",
  loading = "eager",
}: AdFreeIframeProps) {
  const proxied = `/api/adproxy?url=${encodeURIComponent(src)}`;

  return (
    <iframe
      src={proxied}
      title={title}
      className={
        className ??
        "absolute inset-0 block h-full w-full border-0"
      }
      height={height}
      width={width}
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
      allowFullScreen
      loading={loading}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
