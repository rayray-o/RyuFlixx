
"use client";

import { useEffect, useState } from "react";
import type { ContentType } from "@/types";
import {
  EXPLICIT_FEEDBACK_UPDATED_EVENT,
  getExplicitFeedback,
  removeExplicitFeedback,
  setExplicitFeedback,
  type ExplicitFeedbackValue,
} from "@/utils/personalization/explicit-feedback-engine";

type Props = {
  id: number;
  mediaType: ContentType;
};

const OPTIONS: {
  value: ExplicitFeedbackValue;
  label: string;
  activeLabel: string;
}[] = [
  {
    value: "like",
    label: "Like",
    activeLabel: "Liked",
  },
  {
    value: "dislike",
    label: "Dislike",
    activeLabel: "Disliked",
  },
  {
    value: "not_interested",
    label: "Not interested",
    activeLabel: "Hidden",
  },
];

export default function RecommendationFeedback({
  id,
  mediaType,
}: Props) {
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
      const removed = removeExplicitFeedback(
        id,
        mediaType,
      );

      if (removed) {
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

  return (
    <div
      className="mt-2 flex items-center gap-1.5"
      aria-label="Recommendation feedback"
    >
      {OPTIONS.map((option) => {
        const active = selected === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={active}
            title={
              active
                ? `Remove ${option.label.toLowerCase()} feedback`
                : option.label
            }
            className={[
              "min-w-0 rounded-full border px-2.5 py-1",
              "text-[10px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-white/60",
              active
                ? "border-white/35 bg-white/15 text-white"
                : "border-white/[0.09] bg-white/[0.035] text-white/55 hover:border-white/25 hover:bg-white/[0.09] hover:text-white/90",
            ].join(" ")}
          >
            {active ? option.activeLabel : option.label}
          </button>
        );
      })}
    </div>
  );
}
