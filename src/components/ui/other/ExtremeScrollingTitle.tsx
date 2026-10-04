"use client";

import { useEffect, useRef, useState } from "react";

interface ExtremeScrollingTitleProps {
  title: string;
}

const EXTREME_OVERFLOW_RATIO = 1.35;

const ExtremeScrollingTitle: React.FC<
  ExtremeScrollingTitleProps
> = ({ title }) => {
  const containerRef =
    useRef<HTMLDivElement | null>(null);
  const textRef =
    useRef<HTMLDivElement | null>(null);

  const [extreme, setExtreme] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      const container = containerRef.current;
      const text = textRef.current;

      if (!container || !text) return;

      const availableWidth = container.clientWidth;
      const textWidth = text.scrollWidth;

      setExtreme(
        availableWidth > 0 &&
          textWidth > availableWidth * EXTREME_OVERFLOW_RATIO,
      );
    };

    const frame = window.requestAnimationFrame(
      checkOverflow,
    );

    const resizeObserver =
      new ResizeObserver(checkOverflow);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    document.fonts?.ready.then(checkOverflow);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [title]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{
        maskImage: extreme
          ? "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)"
          : undefined,
        WebkitMaskImage: extreme
          ? "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)"
          : undefined,
      }}
    >
      <div
        ref={textRef}
        className="max-w-full whitespace-nowrap text-center text-sm font-semibold"
        style={
          extreme
            ? {
                width: "max-content",
                animation:
                  "ryuflix-extreme-title-scroll 11s cubic-bezier(0.22, 1, 0.36, 1) infinite",
                willChange: "transform",
              }
            : undefined
        }
      >
        {title}
      </div>

      {extreme && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-6"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.35), transparent)",
            }}
          />

          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-6"
            style={{
              background:
                "linear-gradient(to left, rgba(0,0,0,0.35), transparent)",
            }}
          />
        </>
      )}

      <style jsx>{`
        @keyframes ryuflix-extreme-title-scroll {
          0% {
            transform: translateX(0);
          }

          18% {
            transform: translateX(0);
          }

          68% {
            transform: translateX(
              calc(-100% + 100% / ${EXTREME_OVERFLOW_RATIO})
            );
          }

          84% {
            transform: translateX(
              calc(-100% + 100% / ${EXTREME_OVERFLOW_RATIO})
            );
          }

          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ExtremeScrollingTitle;
