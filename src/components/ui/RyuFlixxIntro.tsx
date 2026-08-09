"use client";

import { useEffect, useState } from "react";

const INTRO_KEY = "ryuflixx-intro-played";

export default function RyuFlixxIntro() {
  const [visible, setVisible] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const [logoFading, setLogoFading] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(INTRO_KEY)) {
        return;
      }

      sessionStorage.setItem(INTRO_KEY, "true");
    } catch {
      // Continue normally if sessionStorage is unavailable.
    }

    setVisible(true);

    // Let the wallpaper establish itself before revealing the title.
    const logoIn = window.setTimeout(() => {
      setLogoVisible(true);
    }, 800);

    // Hold RYUFLIXX for roughly 3 seconds.
    const logoOut = window.setTimeout(() => {
      setLogoFading(true);
    }, 5200);

    // Begin revealing the actual website.
    const reveal = window.setTimeout(() => {
      setRevealing(true);
    }, 6500);

    // Remove the intro completely.
    const finish = window.setTimeout(() => {
      setVisible(false);
    }, 8200);

    return () => {
      window.clearTimeout(logoIn);
      window.clearTimeout(logoOut);
      window.clearTimeout(reveal);
      window.clearTimeout(finish);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
      style={{
        background: "transparent",
      }}
    >
      {/* Cinematic veil.
          The wallpaper remains visible underneath instead of being
          completely covered by an opaque black screen. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.72) 100%)",
          opacity: revealing ? 0 : 1,
          transition:
            "opacity 1.7s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />

      {/* RYUFLIXX title */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity:
            logoVisible && !logoFading ? 1 : 0,

          transform:
            logoVisible && !logoFading
              ? "translate3d(0, 0, 0) scale(1)"
              : "translate3d(0, 8px, 0) scale(0.985)",

          transition: logoFading
            ? "opacity 1.25s cubic-bezier(0.22, 1, 0.36, 1), transform 1.25s cubic-bezier(0.22, 1, 0.36, 1)"
            : "opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1), transform 1.8s cubic-bezier(0.16, 1, 0.3, 1)",

          willChange: "opacity, transform",
        }}
      >
        <div className="flex flex-col items-center">
          <div
            className="font-sans font-semibold tracking-[0.38em] text-white"
            style={{
              fontSize: "clamp(2.2rem, 7vw, 6rem)",
              paddingLeft: "0.38em",
              lineHeight: 1,
              textShadow:
                "0 2px 30px rgba(0,0,0,0.65)",
            }}
          >
            RYUFLIXX
          </div>

          {/* Minimal cinematic line */}
          <div
            className="mt-5 h-px bg-white/70"
            style={{
              width: "clamp(40px, 8vw, 100px)",
              opacity: 0.65,
            }}
          />
        </div>
      </div>
    </div>
  );
}
