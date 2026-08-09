"use client";

import { ReactNode, useEffect, useState } from "react";

const INTRO_KEY = "ryuflixx-intro-played";

interface RyuFlixxShellProps {
  children: ReactNode;
}

export default function RyuFlixxShell({
  children,
}: RyuFlixxShellProps) {
  const [introActive, setIntroActive] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(INTRO_KEY)) {
        return;
      }

      sessionStorage.setItem(INTRO_KEY, "true");
    } catch {
      // Continue with the intro if storage isn't available.
    }

    setIntroActive(true);

    const revealTimer = window.setTimeout(() => {
      setRevealing(true);
    }, 6500);

    const finishTimer = window.setTimeout(() => {
      setIntroActive(false);
    }, 8200);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  return (
    <div
      style={{
        opacity: introActive && !revealing ? 0 : 1,
        transition:
          introActive && revealing
            ? "opacity 1.7s cubic-bezier(0.22, 1, 0.36, 1)"
            : "none",
        pointerEvents:
          introActive && !revealing ? "none" : "auto",
      }}
    >
      {children}
    </div>
  );
}
