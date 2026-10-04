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

      const textWidth =
        text.scrollWidth;

      if (availableWidth <= 0 || textWidth <= 0) {
        return;
      }

      const overflowRatio =
        textWidth / availableWidth;

      /*
       * First priority:
       * keep the normal title size whenever it fits.
       */
      if (overflowRatio <= 1.01) {
        setIsExtreme(false);
        setScrollDistance(0);

        if (fontSize !== NORMAL_FONT_SIZE) {
          setFontSize(NORMAL_FONT_SIZE);
        }

        return;
      }

      /*
       * Second priority:
       * shrink the title just enough to fit.
       *
       * This handles titles like:
       * "Drishyam: The Conclusion"
       *
       * without resorting to a marquee.
       */
      const fittedFontSize =
        NORMAL_FONT_SIZE / overflowRatio;

      if (
        fittedFontSize >=
        MIN_FONT_SIZE
      ) {
        setIsExtreme(false);
        setScrollDistance(0);

        const nextFontSize = Math.min(
          NORMAL_FONT_SIZE,
          Math.max(
            MIN_FONT_SIZE,
            fittedFontSize,
          ),
        );

        if (
          Math.abs(
            nextFontSize - fontSize,
          ) > 0.05
        ) {
          setFontSize(nextFontSize);
        }

        return;
      }

      /*
       * Third priority:
       * the title is genuinely too long to fit
       * even at the minimum readable size.
       *
       * Only now do we activate the marquee.
       */
      const distance =
        Math.max(
          0,
          textWidth - availableWidth,
        );

      setFontSize(MIN_FONT_SIZE);
      setIsExtreme(distance > 0);
      setScrollDistance(distance);
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
  }, [title, fontSize]);

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
