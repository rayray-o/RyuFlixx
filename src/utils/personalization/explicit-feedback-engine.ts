
"use client";

import type { ContentType } from "@/types";
import { getProfileStorageKey } from "@/utils/profiles";

export type ExplicitFeedbackValue =
  | "like"
  | "dislike"
  | "not_interested";

export interface ExplicitFeedback {
  id: number;
  mediaType: ContentType;
  value: ExplicitFeedbackValue;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "ryuflix_explicit_feedback_v1";
export const EXPLICIT_FEEDBACK_UPDATED_EVENT =
  "ryuflix-explicit-feedback-updated";

const MAX_FEEDBACK_ITEMS = 2000;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isContentType(
  value: unknown,
): value is ContentType {
  return value === "movie" || value === "tv";
}

function isFeedbackValue(
  value: unknown,
): value is ExplicitFeedbackValue {
  return (
    value === "like" ||
    value === "dislike" ||
    value === "not_interested"
  );
}

function itemKey(
  id: number,
  mediaType: ContentType,
): string {
  return `${mediaType}:${id}`;
}

function storageKey(): string {
  return getProfileStorageKey(STORAGE_KEY);
}

function isValidFeedback(
  value: unknown,
): value is ExplicitFeedback {
  if (!value || typeof value !== "object") {
    return false;
  }

  const feedback = value as Partial<ExplicitFeedback>;

  return (
    Number.isInteger(feedback.id) &&
    Number(feedback.id) > 0 &&
    isContentType(feedback.mediaType) &&
    isFeedbackValue(feedback.value) &&
    typeof feedback.createdAt === "string" &&
    Number.isFinite(new Date(feedback.createdAt).getTime()) &&
    typeof feedback.updatedAt === "string" &&
    Number.isFinite(new Date(feedback.updatedAt).getTime())
  );
}

function readAll(): ExplicitFeedback[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey());

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const unique = new Map<string, ExplicitFeedback>();

    for (const entry of parsed) {
      if (!isValidFeedback(entry)) {
        continue;
      }

      unique.set(
        itemKey(entry.id, entry.mediaType),
        entry,
      );
    }

    return [...unique.values()]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime(),
      )
      .slice(0, MAX_FEEDBACK_ITEMS);
  } catch {
    return [];
  }
}

function writeAll(
  feedback: ExplicitFeedback[],
): boolean {
  if (!isBrowser()) {
    return false;
  }

  try {
    const normalized = feedback
      .filter(isValidFeedback)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime(),
      )
      .slice(0, MAX_FEEDBACK_ITEMS);

    window.localStorage.setItem(
      storageKey(),
      JSON.stringify(normalized),
    );

    window.dispatchEvent(
      new CustomEvent(EXPLICIT_FEEDBACK_UPDATED_EVENT),
    );

    return true;
  } catch {
    // Feedback is optional; recommendations must remain usable
    // if browser storage is unavailable or full.
    return false;
  }
}

/**
 * Returns all explicit feedback belonging to the active profile.
 */
export function getAllExplicitFeedback(): ExplicitFeedback[] {
  return readAll();
}

/**
 * Returns a profile's explicit opinion about one title.
 */
export function getExplicitFeedback(
  id: number,
  mediaType: ContentType,
): ExplicitFeedback | null {
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return (
    readAll().find(
      (entry) =>
        entry.id === id &&
        entry.mediaType === mediaType,
    ) ?? null
  );
}

/**
 * Saves or changes an explicit opinion.
 *
 * Selecting a different opinion replaces the previous one.
 * Selecting the same opinion again does not create duplicate data.
 */
export function setExplicitFeedback(
  id: number,
  mediaType: ContentType,
  value: ExplicitFeedbackValue,
): ExplicitFeedback | null {
  if (
    !isBrowser() ||
    !Number.isInteger(id) ||
    id <= 0 ||
    !isContentType(mediaType) ||
    !isFeedbackValue(value)
  ) {
    return null;
  }

  const current = readAll();
  const existing = current.find(
    (entry) =>
      entry.id === id &&
      entry.mediaType === mediaType,
  );

  const now = new Date().toISOString();

  const next: ExplicitFeedback = {
    id,
    mediaType,
    value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const updated = [
    next,
    ...current.filter(
      (entry) =>
        !(
          entry.id === id &&
          entry.mediaType === mediaType
        ),
    ),
  ];

  return writeAll(updated) ? next : null;
}

/**
 * Removes an explicit opinion without creating a negative signal.
 */
export function removeExplicitFeedback(
  id: number,
  mediaType: ContentType,
): boolean {
  if (
    !isBrowser() ||
    !Number.isInteger(id) ||
    id <= 0 ||
    !isContentType(mediaType)
  ) {
    return false;
  }

  const current = readAll();

  const updated = current.filter(
    (entry) =>
      !(
        entry.id === id &&
        entry.mediaType === mediaType
      ),
  );

  if (updated.length === current.length) {
    return true;
  }

  return writeAll(updated);
}

/**
 * Titles marked not interested are excluded from recommendation
 * candidates for the active profile.
 */
export function isNotInterested(
  id: number,
  mediaType: ContentType,
): boolean {
  return (
    getExplicitFeedback(id, mediaType)?.value ===
    "not_interested"
  );
}

/**
 * Clears explicit feedback for the active profile only.
 */
export function clearExplicitFeedback(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey());

    window.dispatchEvent(
      new CustomEvent(EXPLICIT_FEEDBACK_UPDATED_EVENT),
    );
  } catch {
    // Ignore unavailable browser storage.
  }
}
