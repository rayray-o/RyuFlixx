
"use client";

export const DEFAULT_PROFILE_ID = "default";
export const PROFILES_STORAGE_KEY = "ryuflix_profiles_v1";
export const ACTIVE_PROFILE_STORAGE_KEY = "ryuflix_active_profile_v1";
export const PROFILE_UPDATED_EVENT = "ryuflix-profile-updated";
export const MAX_PROFILES = 6;

export interface RyuProfile {
  id: string;
  name: string;
  avatar: string;
  createdAt: string;
  isDefault?: boolean;
}

export const PROFILE_AVATARS = [
  "🎬", "🍿", "🌙", "🦊", "🐈", "🐉",
  "👾", "🎭", "🦇", "🌸", "⚡", "🪐",
];

const BEHAVIOR_MEMORY_KEY = "ryuflix_behavioral_memory_v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function parseProfiles(value: string | null): RyuProfile[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (profile): profile is RyuProfile =>
        profile &&
        typeof profile.id === "string" &&
        typeof profile.name === "string" &&
        typeof profile.avatar === "string" &&
        typeof profile.createdAt === "string",
    );
  } catch {
    return [];
  }
}

export function getProfiles(): RyuProfile[] {
  if (!isBrowser()) {
    return [{
      id: DEFAULT_PROFILE_ID,
      name: "Default",
      avatar: "🎬",
      createdAt: new Date(0).toISOString(),
      isDefault: true,
    }];
  }

  const stored = parseProfiles(
    window.localStorage.getItem(PROFILES_STORAGE_KEY),
  );

  const defaultProfile: RyuProfile = {
    id: DEFAULT_PROFILE_ID,
    name: "Default",
    avatar: "🎬",
    createdAt: new Date(0).toISOString(),
    isDefault: true,
  };

  return [
    defaultProfile,
    ...stored.filter((profile) => profile.id !== DEFAULT_PROFILE_ID),
  ];
}

export function getActiveProfileId(): string {
  if (!isBrowser()) return DEFAULT_PROFILE_ID;

  const id = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);

  if (!id) return DEFAULT_PROFILE_ID;

  return getProfiles().some((profile) => profile.id === id)
    ? id
    : DEFAULT_PROFILE_ID;
}

export function getActiveProfile(): RyuProfile {
  const id = getActiveProfileId();

  return (
    getProfiles().find((profile) => profile.id === id) ?? {
      id: DEFAULT_PROFILE_ID,
      name: "Default",
      avatar: "🎬",
      createdAt: new Date(0).toISOString(),
      isDefault: true,
    }
  );
}

/**
 * The Default profile deliberately uses the original storage keys.
 * Existing history and watchlist data therefore remain untouched.
 */
export function getProfileStorageKey(baseKey: string): string {
  const profileId = getActiveProfileId();

  if (profileId === DEFAULT_PROFILE_ID) return baseKey;

  return `${baseKey}__profile_${profileId}`;
}

function saveProfiles(profiles: RyuProfile[]) {
  if (!isBrowser()) return;

  window.localStorage.setItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify(
      profiles.filter((profile) => profile.id !== DEFAULT_PROFILE_ID),
    ),
  );
}

function profileStorageKey(profileId: string, baseKey: string) {
  return profileId === DEFAULT_PROFILE_ID
    ? baseKey
    : `${baseKey}__profile_${profileId}`;
}

/**
 * Behavioral memory currently uses one legacy global key.
 * Preserve that existing implementation by parking the outgoing
 * profile's memory and restoring the incoming profile's memory.
 */
function saveOutgoingBehaviorMemory(profileId: string) {
  if (!isBrowser()) return;

  const current = window.localStorage.getItem(BEHAVIOR_MEMORY_KEY);
  const destination = profileStorageKey(profileId, BEHAVIOR_MEMORY_KEY);

  if (current !== null) {
    window.localStorage.setItem(destination, current);
  } else {
    window.localStorage.removeItem(destination);
  }
}

function restoreBehaviorMemory(profileId: string) {
  if (!isBrowser()) return;

  const source = profileStorageKey(profileId, BEHAVIOR_MEMORY_KEY);
  const memory = window.localStorage.getItem(source);

  if (memory === null) {
    window.localStorage.removeItem(BEHAVIOR_MEMORY_KEY);
  } else {
    window.localStorage.setItem(BEHAVIOR_MEMORY_KEY, memory);
  }
}

function notifyProfileChanged() {
  if (!isBrowser()) return;

  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));

  // Refresh existing components that listen to these events.
  window.dispatchEvent(new CustomEvent("ryuflix-history-updated"));
  window.dispatchEvent(new CustomEvent("ryuflix-watchlist-updated"));
  window.dispatchEvent(new CustomEvent("ryuflix-tv-continuation-updated"));
}

export function createProfile(
  name: string,
  avatar = "🎬",
): RyuProfile | null {
  if (!isBrowser()) return null;

  const cleanName = name.trim().slice(0, 24);

  if (!cleanName) return null;

  const profiles = getProfiles();

  if (profiles.length >= MAX_PROFILES) return null;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const profile: RyuProfile = {
    id,
    name: cleanName,
    avatar: PROFILE_AVATARS.includes(avatar) ? avatar : "🎬",
    createdAt: new Date().toISOString(),
  };

  saveProfiles([...profiles, profile]);

  return profile;
}

export function renameProfile(
  profileId: string,
  name: string,
): boolean {
  if (!isBrowser() || profileId === DEFAULT_PROFILE_ID) return false;

  const cleanName = name.trim().slice(0, 24);
  if (!cleanName) return false;

  const profiles = getProfiles();

  if (!profiles.some((profile) => profile.id === profileId)) {
    return false;
  }

  saveProfiles(
    profiles.map((profile) =>
      profile.id === profileId
        ? { ...profile, name: cleanName }
        : profile,
    ),
  );

  notifyProfileChanged();
  return true;
}

export function updateProfileAvatar(
  profileId: string,
  avatar: string,
): boolean {
  if (!isBrowser() || profileId === DEFAULT_PROFILE_ID) return false;
  if (!PROFILE_AVATARS.includes(avatar)) return false;

  const profiles = getProfiles();

  if (!profiles.some((profile) => profile.id === profileId)) {
    return false;
  }

  saveProfiles(
    profiles.map((profile) =>
      profile.id === profileId ? { ...profile, avatar } : profile,
    ),
  );

  notifyProfileChanged();
  return true;
}

export function switchProfile(profileId: string): boolean {
  if (!isBrowser()) return false;

  const profiles = getProfiles();

  if (!profiles.some((profile) => profile.id === profileId)) {
    return false;
  }

  const currentId = getActiveProfileId();

  if (currentId === profileId) return true;

  saveOutgoingBehaviorMemory(currentId);

  window.localStorage.setItem(
    ACTIVE_PROFILE_STORAGE_KEY,
    profileId,
  );

  restoreBehaviorMemory(profileId);
  notifyProfileChanged();

  return true;
}

export function deleteProfile(profileId: string): boolean {
  if (!isBrowser() || profileId === DEFAULT_PROFILE_ID) {
    return false;
  }

  const profiles = getProfiles();
  const target = profiles.find((profile) => profile.id === profileId);

  if (!target) return false;

  const activeId = getActiveProfileId();

  if (activeId === profileId) {
    saveOutgoingBehaviorMemory(profileId);

    window.localStorage.setItem(
      ACTIVE_PROFILE_STORAGE_KEY,
      DEFAULT_PROFILE_ID,
    );

    restoreBehaviorMemory(DEFAULT_PROFILE_ID);
  }

  // Remove only this profile's namespaced data.
  const suffix = `__profile_${profileId}`;

  for (let index = window.localStorage.length - 1; index >= 0; index--) {
    const key = window.localStorage.key(index);

    if (key?.endsWith(suffix)) {
      window.localStorage.removeItem(key);
    }
  }

  // Behavioral memory is stored separately while inactive.
  window.localStorage.removeItem(
    profileStorageKey(profileId, BEHAVIOR_MEMORY_KEY),
  );

  saveProfiles(profiles.filter((profile) => profile.id !== profileId));
  notifyProfileChanged();

  return true;
}
