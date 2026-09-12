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

const AdFreeIframe = React.forwardRef<
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
  /*
   * IMPORTANT:
   *
   * Providers are loaded directly.
   *
   * Do NOT send them through /api/adproxy.
   * The providers are cross-origin applications and
   * changing their origin breaks their player/runtime.
   */
  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      className={
        className ??
        "absolute inset-0 block h-full w-full border-0"
      }
      height={height}
      width={width}
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; web-share"
      allowFullScreen
      loading={loading}
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={onLoad}
    />
  );
});

AdFreeIframe.displayName = "AdFreeIframe";

export default AdFreeIframe;
