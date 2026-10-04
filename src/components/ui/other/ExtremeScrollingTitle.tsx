"use client";

import { useEffect, useRef, useState } from "react";

interface ExtremeScrollingTitleProps {
  title: string;
}

const NORMAL_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10.5;
const PIXELS_PER_SECOND = 28;

const ExtremeScrollingTitle: React.FC<
  ExtremeScrollingTitleProps
> = ({ title }) => {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const textRef =
    useRef<HTMLDivElement | null>(null);

  const [fontSize, setFontSize] =
    useState(NORMAL_FONT_SIZE);

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

      if (availableWidth <= 0) return;

      /*
       * Always measure the title at its natural
       * normal size first.
       *
       * This is critical: we never measure the
       * already-shrunk title to decide whether
       * it should shrink.
       */
      const previousFontSize =
        text.style.fontSize;

      const previousWidth =
        text.style.width;

      text.style.fontSize =
        `${NORMAL_FONT_SIZE}px`;

      text.style.width = "max-content";

      const naturalWidth =
        text.scrollWidth;

      /*
       * Restore the element before React updates
       * the actual display state.
       */
      text.style.fontSize =
        previousFontSize;

      text.style.width =
        previousWidth;

      if (naturalWidth <= availableWidth) {
        /*
         * STATE 1:
         * Completely normal title.
         */
        setFontSize(NORMAL_FONT_SIZE);
        setScrollDistance(0);
        setIsExtreme(false);

        return;
      }

      /*
       * Calculate exactly how small the title
       * needs to become to fit.
       */
      const fittedFontSize =
        NORMAL_FONT_SIZE *
        (availableWidth / naturalWidth);

      if (fittedFontSize >= MIN_FONT_SIZE) {
        /*
         * STATE 2:
         * Slightly long title.
         *
         * Shrink it just enough to fit.
         */
        setFontSize(
          Math.max(
            MIN_FONT_SIZE,
            fittedFontSize,
          ),
        );

        setScrollDistance(0);
        setIsExtreme(false);

        return;
      }

      /*
       * STATE 3:
       * Even the minimum readable size
       * cannot fit.
       *
       * NOW, and only now, use the marquee.
       */
      const scaledWidth =
        naturalWidth *
        (MIN_FONT_SIZE / NORMAL_FONT_SIZE);

      const distance =
        Math.max(
          0,
          scaledWidth - availableWidth,
        );

      setFontSize(MIN_FONT_SIZE);
      setScrollDistance(distance);
      setIsExtreme(distance > 0);
    };

    const frame =
      window.requestAnimationFrame(measure);

    const resizeObserver =
      new ResizeObserver(() => {
        window.requestAnimationFrame(measure);
      });

    if (containerRef.current) {
      resizeObserver.observe(
        containerRef.current,
      );
    }

    document.fonts?.ready.then(() => {
      window.requestAnimationFrame(measure);
    });

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
        className="font-semibold"
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          width: isExtreme
            ? "max-content"
            : "100%",
          textAlign: "center",

          ...(isExtreme
            ? {
                "--scroll-distance": `-${scrollDistance}px`,
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
