
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  createProfile,
  deleteProfile,
  getActiveProfileId,
  getProfiles,
  PROFILE_AVATARS,
  renameProfile,
  RyuProfile,
  switchProfile,
  updateProfileAvatar,
} from "@/utils/profiles";

const DEFAULT_AVATAR = PROFILE_AVATARS[0];

function getAvatar(profile: RyuProfile) {
  return PROFILE_AVATARS.includes(profile.avatar)
    ? profile.avatar
    : DEFAULT_AVATAR;
}

function AvatarPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (avatar: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {PROFILE_AVATARS.map((avatar) => {
        const active = selected === avatar;

        return (
          <button
            key={avatar}
            type="button"
            onClick={() => onSelect(avatar)}
            aria-label={`Choose avatar ${PROFILE_AVATARS.indexOf(avatar) + 1}`}
            aria-pressed={active}
            className={`relative aspect-square w-full max-w-12 overflow-hidden rounded-xl border-2 transition-all ${
              active
                ? "scale-[1.04] border-primary shadow-[0_0_15px_rgba(0,120,255,0.25)]"
                : "border-transparent opacity-75 hover:scale-105 hover:opacity-100"
            }`}
          >
            <Image
              src={avatar}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />

            {active && (
              <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/40" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function SwitchProfilePage() {
  const [profiles, setProfiles] = useState<RyuProfile[]>([]);
  const [activeId, setActiveId] = useState("default");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingAvatar, setEditingAvatar] = useState(DEFAULT_AVATAR);
  const [notice, setNotice] = useState("");

  function refresh() {
    setProfiles(getProfiles());
    setActiveId(getActiveProfileId());
  }

  useEffect(() => {
    refresh();

    window.addEventListener("ryuflix-profile-updated", refresh);

    return () => {
      window.removeEventListener("ryuflix-profile-updated", refresh);
    };
  }, []);

  function handleCreate() {
    const profile = createProfile(name, avatar);

    if (!profile) {
      setNotice(
        profiles.length >= 6
          ? "You've reached the 6-profile limit."
          : "Enter a profile name first.",
      );
      return;
    }

    setName("");
    setAvatar(DEFAULT_AVATAR);
    setNotice("Profile created.");
    refresh();
  }

  function handleSwitch(id: string) {
    if (!switchProfile(id)) {
      setNotice("Couldn't switch profiles.");
      return;
    }

    refresh();
    setNotice("Switched to your selected profile.");
  }

  function startEditing(profile: RyuProfile) {
    setEditingId(profile.id);
    setEditingName(profile.name);
    setEditingAvatar(getAvatar(profile));
  }

  function handleSaveEdit(id: string) {
    if (!renameProfile(id, editingName)) {
      setNotice("Enter a valid profile name.");
      return;
    }

    updateProfileAvatar(id, editingAvatar);

    setEditingId(null);
    setEditingName("");
    setNotice("Profile updated.");
    refresh();
  }

  function handleDelete(id: string) {
    const profile = profiles.find((item) => item.id === id);

    if (!profile || profile.isDefault) return;

    const confirmed = window.confirm(
      `Delete "${profile.name}" and its local profile data? This cannot be undone.`,
    );

    if (!confirmed) return;

    deleteProfile(id);
    refresh();
    setNotice("Profile deleted.");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:py-12">
      <header className="mb-7 sm:mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
          RyuFlixx
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Who's watching?
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-default-500 sm:text-base">
          Your own watch history, saved titles, and recommendations.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {profiles.map((profile) => {
          const active = activeId === profile.id;
          const editing = editingId === profile.id;

          return (
            <section
              key={profile.id}
              className={`min-w-0 rounded-2xl border p-3 transition-colors sm:p-4 ${
                active
                  ? "border-primary/60 bg-primary/[0.06]"
                  : "border-default-200 bg-background/50"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSwitch(profile.id)}
                className="flex w-full flex-col items-center text-center"
                aria-label={`Switch to ${profile.name}`}
              >
                <span className="relative size-[76px] overflow-hidden rounded-2xl bg-default-100 shadow-lg sm:size-24">
                  <Image
                    src={getAvatar(profile)}
                    alt={`${profile.name} avatar`}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </span>

                <span className="mt-3 max-w-full truncate text-sm font-semibold sm:text-base">
                  {profile.name}
                </span>

                <span className="mt-1 min-h-4 text-[11px] text-default-500 sm:text-xs">
                  {active ? "Currently active" : "Select profile"}
                </span>
              </button>

              {!profile.isDefault && (
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      editing
                        ? setEditingId(null)
                        : startEditing(profile)
                    }
                    className="rounded-lg bg-default-100 px-3 py-2 text-xs font-medium transition-colors hover:bg-default-200"
                  >
                    {editing ? "Cancel" : "Edit"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(profile.id)}
                    className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
                  >
                    Delete
                  </button>
                </div>
              )}

              {editing && (
                <div className="mt-4 space-y-3 border-t border-default-200 pt-3">
                  <input
                    value={editingName}
                    onChange={(event) =>
                      setEditingName(event.target.value)
                    }
                    maxLength={24}
                    placeholder="Profile name"
                    className="h-10 w-full min-w-0 rounded-xl border border-default-200 bg-background px-3 text-sm outline-none focus:border-primary"
                  />

                  <p className="text-[10px] font-semibold uppercase tracking-wider text-default-500">
                    Choose portrait
                  </p>

                  <AvatarPicker
                    selected={editingAvatar}
                    onSelect={setEditingAvatar}
                  />

                  <button
                    type="button"
                    onClick={() => handleSaveEdit(profile.id)}
                    className="h-10 w-full rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Save changes
                  </button>
                </div>
              )}
            </section>
          );
        })}

        {profiles.length < 6 && (
          <section className="min-w-0 rounded-2xl border border-dashed border-default-300 bg-background/30 p-3 sm:p-4">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-[76px] items-center justify-center rounded-2xl bg-default-100 text-3xl text-default-500 sm:size-24">
                +
              </span>

              <h2 className="mt-3 text-sm font-semibold sm:text-base">
                Add profile
              </h2>

              <p className="mt-1 text-[11px] text-default-500 sm:text-xs">
                Create another space
              </p>
            </div>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={24}
              placeholder="Profile name"
              className="mt-4 h-10 w-full min-w-0 rounded-xl border border-default-200 bg-background px-3 text-sm outline-none focus:border-primary"
            />

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-default-500">
                Choose portrait
              </p>

              <AvatarPicker
                selected={avatar}
                onSelect={setAvatar}
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim()}
              className="mt-4 h-10 w-full rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create profile
            </button>
          </section>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="mt-5 text-center text-sm text-default-500"
        >
          {notice}
        </p>
      )}

      <section className="mt-9 rounded-2xl border border-default-200 bg-background/40 p-4 sm:p-5">
        <h2 className="font-semibold">Local profiles</h2>

        <p className="mt-2 text-sm leading-6 text-default-500">
          Profiles are stored in this browser on this device. They
          don't sync between devices. Your existing Default profile
          keeps its original watch history and watchlist.
        </p>
      </section>
    </div>
  );
}
