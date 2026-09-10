"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Point = {
  x: number;
  y: number;
};

export default function RyuFlixCursor() {
  const pathname = usePathname();

  const targetRef = useRef<Point>({
    x: -100,
    y: -100,
  });

  const dotRef = useRef<Point>({
    x: -100,
    y: -100,
  });

  const ringRef = useRef<Point>({
    x: -100,
    y: -100,
  });

  const animationFrameRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const isTv = pathname.includes("/tv/");

  const accent = isTv ? "#FFD400" : "#1683FF";

  useEffect(() => {
    const coarse =
      window.matchMedia("(pointer: coarse)").matches ||
      "ontouchstart" in window;

    setIsTouchDevice(coarse);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const updateTarget = (x: number, y: number) => {
      targetRef.current.x = x;
      targetRef.current.y = y;

      setVisible(true);

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      if (coarse) {
        hideTimeoutRef.current = setTimeout(() => {
          setVisible(false);
        }, 900);
      }
    };

    const checkInteractive = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        setHovering(false);
        return;
      }

      const interactive = target.closest(
        "a, button, input, select, textarea, [role='button'], [data-cursor-hover]",
      );

      setHovering(Boolean(interactive));
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (coarse) {
        return;
      }

      updateTarget(event.clientX, event.clientY);
      checkInteractive(event.target);
    };

    const handleMouseLeave = () => {
      if (!coarse) {
        setVisible(false);
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      updateTarget(touch.clientX, touch.clientY);
      checkInteractive(event.target);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      updateTarget(touch.clientX, touch.clientY);
      checkInteractive(event.target);
    };

    const handleTouchEnd = () => {
      setHovering(false);

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 500);
    };

    const handlePointerDown = () => {
      setPressed(true);

      window.setTimeout(() => {
        setPressed(false);
      }, 180);
    };

    const animate = () => {
      const target = targetRef.current;

      const dot = dotRef.current;
      const ring = ringRef.current;

      const dotEase = coarse ? 0.32 : 0.42;
      const ringEase = coarse ? 0.12 : 0.14;

      dot.x += (target.x - dot.x) * dotEase;
      dot.y += (target.y - dot.y) * dotEase;

      ring.x += (target.x - ring.x) * ringEase;
      ring.y += (target.y - ring.y) * ringEase;

      const dotElement = document.getElementById(
        "ryuflix-cursor-dot",
      );

      const ringElement = document.getElementById(
        "ryuflix-cursor-ring",
      );

      if (dotElement) {
        dotElement.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) translate(-50%, -50%)`;
      }

      if (ringElement) {
        ringElement.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)`;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    window.addEventListener("touchmove", handleTouchMove, {
      passive: true,
    });
    window.addEventListener("touchend", handleTouchEnd, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown);

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("pointerdown", handlePointerDown);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  if (isTouchDevice && !visible) {
    return null;
  }

  return (
    <>
      <div
        id="ryuflix-cursor-ring"
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[99999] hidden h-10 w-10 rounded-full md:block"
        style={{
          border: `1px solid ${accent}`,
          boxShadow: `0 0 18px ${accent}55, inset 0 0 12px ${accent}15`,
          opacity: visible ? 0.75 : 0,
          scale: hovering || pressed ? "1.45" : "1",
          transition: [
            "opacity 180ms ease",
            "scale 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            "border-color 300ms ease",
            "box-shadow 300ms ease",
          ].join(", "),
          willChange: "transform",
        }}
      />

      <div
        id="ryuflix-cursor-dot"
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[100000] h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: accent,
          boxShadow: `0 0 10px ${accent}, 0 0 22px ${accent}99`,
          opacity: visible ? 1 : 0,
          scale: pressed ? "1.8" : hovering ? "1.25" : "1",
          transition: [
            "opacity 120ms ease",
            "scale 140ms cubic-bezier(0.22, 1, 0.36, 1)",
            "background-color 300ms ease",
            "box-shadow 300ms ease",
          ].join(", "),
          willChange: "transform",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[99998] hidden md:block"
        style={{
          cursor: "none",
        }}
      />
    </>
  );
            }
