"use client";

import { useEffect, useRef, useState } from "react";

interface ExtremeScrollingTitleProps {
  title: string;
}

const EXTREME_OVERFLOW_RATIO = 1.35;
const PIXELS_PER_SECOND = 28;

const ExtremeScrollingTitle: React.FC<
  ExtremeScrollingTitleProps
> = ({ title }) => {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const textRef =
    useRef<HTMLDivElement | null>(null);

  const [scrollDistance, setScrollDistance] =
    useState(0);

  const [isExtreme, setIsExtreme] =
    useState(false);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const text = textRef.current;

      if (!container || !text) return;

      const availableWidth =
        container.clientWidth;

      const textWidth =
        text.scrollWidth;

      const overflow =
        Math.max(
          0,
          textWidth - availableWidth,
        );

      const extreme =
        availableWidth > 0 &&
        textWidth >
          availableWidth *
            EXTREME_OVERFLOW_RATIO;

      setIsExtreme(extreme);
      setScrollDistance(
        extreme ? overflow : 0,
      );
    };

    const frame =
      window.requestAnimationFrame(measure);

    const resizeObserver =
      new ResizeObserver(measure);

    if (containerRef.current) {
      resizeObserver.observe(
        containerRef.current,
      );
    }

    if (textRef.current) {
      resizeObserver.observe(
        textRef.current,
      );
    }

    document.fonts?.ready.then(measure);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [title]);

  const scrollDuration =
    scrollDistance > 0
      ? Math.max(
          7,
          scrollDistance /
            PIXELS_PER_SECOND,
        )
      : 0;

  const totalDuration =
    scrollDuration + 7;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
      }}
    >
      <div
        ref={textRef}
        className="whitespace-nowrap text-center text-sm font-semibold"
        style={{
          width: isExtreme
            ? "max-content"
            : "100%",

          ...(isExtreme
            ? {
                "--scroll-distance": `-${scrollDistance}px`,
                "--scroll-duration": `${scrollDuration}s`,
                "--total-duration": `${totalDuration}s`,
                animation:
                  "ryuflix-extreme-title-scroll var(--total-duration) linear infinite",
              }
            : {}),
        } as React.CSSProperties}
      >
        {title}
      </div>

      {isExtreme && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-8"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.42), transparent)",
            }}
          />

          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-8"
            style={{
              background:
                "linear-gradient(to left, rgba(0,0,0,0.42), transparent)",
            }}
          />
        </>
      )}

      <style jsx>{`
        @keyframes ryuflix-extreme-title-scroll {
          0% {
            transform: translateX(0);
            opacity: 1;
          }

          8% {
            transform: translateX(0);
            opacity: 1;
          }

          12% {
            transform: translateX(0);
            opacity: 1;
          }

          72% {
            transform: translateX(var(--scroll-distance));
            opacity: 1;
          }

          82% {
            transform: translateX(var(--scroll-distance));
            opacity: 1;
          }

          92% {
            transform: translateX(var(--scroll-distance));
            opacity: 0;
          }

          94% {
            transform: translateX(0);
            opacity: 0;
          }

          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default ExtremeScrollingTitle;
