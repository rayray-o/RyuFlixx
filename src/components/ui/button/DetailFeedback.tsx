
"use client";

import { useEffect, useState } from "react";
import { FaThumbsDown, FaThumbsUp } from "react-icons/fa6";
import type { ContentType } from "@/types";
import {
  EXPLICIT_FEEDBACK_UPDATED_EVENT,
  getExplicitFeedback,
  removeExplicitFeedback,
  setExplicitFeedback,
  type ExplicitFeedbackValue,
} from "@/utils/personalization/explicit-feedback-engine";

interface DetailFeedbackProps {
  id: number;
  mediaType: ContentType;
}

export default function DetailFeedback({
  id,
  mediaType,
}: DetailFeedbackProps) {
  const [selected, setSelected] =
    useState<ExplicitFeedbackValue | null>(null);

  useEffect(() => {
    const sync = () => {
      setSelected(
        getExplicitFeedback(id, mediaType)?.value ?? null,
      );
    };

    sync();

    window.addEventListener(
      EXPLICIT_FEEDBACK_UPDATED_EVENT,
      sync,
    );

    return () => {
      window.removeEventListener(
        EXPLICIT_FEEDBACK_UPDATED_EVENT,
        sync,
      );
    };
  }, [id, mediaType]);

  function choose(value: ExplicitFeedbackValue) {
    if (selected === value) {
      if (removeExplicitFeedback(id, mediaType)) {
        setSelected(null);
      }

      return;
    }

    const saved = setExplicitFeedback(
      id,
      mediaType,
      value,
    );

    if (saved) {
      setSelected(value);
    }
  }

  const buttons = [
    {
      value: "like" as const,
      label: "Like",
      activeLabel: "Liked",
      Icon: FaThumbsUp,
    },
    {
      value: "not_interested" as const,
      label: "Not for me",
      activeLabel: "Not for me",
      Icon: FaThumbsDown,
    },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      role="group"
      aria-label="Personal recommendation feedback"
    >
      {buttons.map(({ value, label, activeLabel, Icon }) => {
        const active = selected === value;

        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={active}
            className={[
              "group flex min-w-[88px] flex-col items-center justify-center gap-2",
              "rounded-xl border px-4 py-3 transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-white/70",
              active
                ? "border-white/35 bg-white/15 text-white"
                : "border-white/10 bg-white/[0.035] text-foreground-500 hover:border-white/25 hover:bg-white/[0.09] hover:text-white",
            ].join(" ")}
          >
            <Icon
              size={21}
              className={
                active
                  ? "text-white"
                  : "transition-transform duration-200 group-hover:scale-110"
              }
            />

            <span className="text-xs font-semibold">
              {active ? activeLabel : label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
