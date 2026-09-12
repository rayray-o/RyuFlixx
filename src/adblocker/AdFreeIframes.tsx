'use client';

interface AdFreeIframeProps {
  src: string;
  title: string;
  className?: string;
  height?: number | string;
  width?: number | string;
}

export default function AdFreeIframe({ src, title, className, height = 500, width = '100%' }: AdFreeIframeProps) {
  const proxied = `/api/adproxy?url=${encodeURIComponent(src)}`;
  return (
    <iframe
      src={proxied}
      title={title}
      className={className}
      height={height}
      width={width}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
      loading="lazy"
    />
  );
}
