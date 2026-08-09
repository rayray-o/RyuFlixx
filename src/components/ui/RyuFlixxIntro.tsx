"use client";

import { useEffect, useState } from "react";

const INTRO_KEY = "ryuflixx-intro-played";

export default function RyuFlixxIntro() {
  const [visible, setVisible] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const [logoFading, setLogoFading] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    // Only play once per browser session.
    try {
      if (sessionStorage.getItem(INTRO_KEY)) {
        return;
      }

      sessionStorage.setItem(INTRO_KEY, "true");
    } catch {
      // If sessionStorage is unavailable, still allow the intro.
    }

    setVisible(true);

    // Give the wallpaper a moment to establish itself first.
    const logoIn = window.setTimeout(() => {
      setLogoVisible(true);
    }, 800);

    // Start fading the logo after it has held for roughly 3 seconds.
    const logoOut = window.setTimeout(() => {
      setLogoFading(true);
    }, 5200);

    // Remove the intro veil and reveal the actual site.
    const reveal = window.setTimeout(() => {
      setRevealing(true);
    }, 6500);

    // Completely remove the overlay.
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
      className={`fixed inset-0 z-[9999] pointer-events-none overflow-hidden ${
        revealing ? "intro-revealing" : ""
      }`}
      style={{
        background: "transparent",
      }}
    >
      {/* Cinematic veil.
          This starts completely opaque, then slowly disappears,
          revealing the already-playing wallpaper underneath. */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: revealing ? 0 : 1,
          transition:
            "opacity 1.7s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />

      {/* RyuFlixx title */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity:
            logoVisible && !logoFading
              ? 1
              : 0,

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
              fontSize:
                "clamp(2.2rem, 7vw, 6rem)",
              paddingLeft: "0.38em",
              lineHeight: 1,
              textShadow:
                "0 2px 30px rgba(0,0,0,0.65)",
            }}
          >
            RYUFLIXX
          </div>

          {/* Tiny cinematic line underneath */}
          <div
            className="mt-5 h-px bg-white/70"
            style={{
              width: "clamp(40px, 8vw, 100px)",
              opacity: 0.65,
            }}
          />
        </div>
      </div>

      {/* Subtle final black fade at the very end.
          Prevents the overlay from feeling like it simply disappears. */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: revealing ? 0 : 0,
          transition: "opacity 0.8s ease",
        }}
      />
    </div>
  );
            }
