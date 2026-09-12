"use client";

import React from "react";

interface AdFreeIframeProps {
  src: string;
  title: string;
  className?: string;
  height?: number | string;
  width?: number | string;
  loading?: "eager" | "lazy";
  onLoad?: React.ReactEventHandler<HTMLIFrameElement>;
}

function proxiedSource(
  source: string,
) {
  if (!source) {
    return source;
  }

  /*
   * Already proxied.
   */
  if (
    source.startsWith(
      "/api/adproxy",
    )
  ) {
    return source;
  }

  try {
    const url = new URL(
      source,
      window.location.href,
    );

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return source;
    }

    return `/api/adproxy?url=${encodeURIComponent(
      url.href,
    )}`;
  } catch {
    return source;
  }
}

const AdFreeIframe =
  React.forwardRef<
    HTMLIFrameElement,
    AdFreeIframeProps
  >(function AdFreeIframe(
    {
      src,
      title,
      className,
      height = "100%",
      width = "100%",
      loading = "eager",
      onLoad,
    },
    ref,
  ) {
    const finalSrc =
      proxiedSource(src);

    return (
      <iframe
        ref={ref}
        src={finalSrc}
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
        onLoad={onLoad}
      />
    );
  });

AdFreeIframe.displayName =
  "AdFreeIframe";

export default AdFreeIframe;
