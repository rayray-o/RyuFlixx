
"use client";

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

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<RyuProfile[]>([]);
  const [activeId, setActiveId] = useState("default");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🎬");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
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
    setAvatar("🎬");
    setNotice("Profile created.");
    refresh();
  }

  function handleSwitch(id: string) {
    if (!switchProfile(id)) {
      setNotice("Couldn't switch profiles.");
      return;
    }

    refresh();
    setNotice("Profile switched.");
  }

  function handleRename(id: string) {
    if (!renameProfile(id, editingName)) {
      setNotice("Enter a valid profile name.");
      return;
    }

    setEditingId(null);
    setEditingName("");
    refresh();
    setNotice("Profile renamed.");
  }

  function handleAvatar(id: string, nextAvatar: string) {
    updateProfileAvatar(id, nextAvatar);
    refresh();
  }

  function handleDelete(id: string) {
    const profile = profiles.find((item) => item.id === id);
    if (!profile || profile.isDefault) return;

    const confirmed = window.confirm(
      `Delete "${profile.name}" and its local watch history, watchlist, and profile data? This cannot be undone.`,
    );

    if (!confirmed) return;

    deleteProfile(id);
    refresh();
    setNotice("Profile deleted.");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-9">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          RyuFlixx
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Who's watching?
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-default-500">
          Separate watch history, saved titles, and viewing activity
          for everyone using this browser.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {profiles.map((profile) => {
          const active = activeId === profile.id;
          const editing = editingId === profile.id;

          return (
            <section
              key={profile.id}
              className={`rounded-2xl border p-4 transition-colors ${
                active
                  ? "border-primary/60 bg-primary/5"
                  : "border-default-200 bg-background/60"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSwitch(profile.id)}
                className="flex w-full flex-col items-center text-center"
                aria-label={`Switch to ${profile.name}`}
              >
                <span className="flex size-20 items-center justify-center rounded-2xl bg-default-100 text-4xl">
                  {profile.avatar}
                </span>

                <span className="mt-3 max-w-full truncate font-semibold">
                  {profile.name}
                </span>

                <span className="mt-1 text-xs text-default-500">
                  {active ? "Currently active" : "Select profile"}
                </span>
              </button>

              {!profile.isDefault && (
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(editing ? null : profile.id);
                      setEditingName(profile.name);
                    }}
                    className="rounded-lg bg-default-100 px-3 py-2 text-xs font-medium hover:bg-default-200"
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(profile.id)}
                    className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/20"
                  >
                    Delete
                  </button>
                </div>
              )}

              {editing && (
                <div className="mt-4 space-y-3">
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    maxLength={24}
                    placeholder="Profile name"
                    className="h-10 w-full rounded-xl border border-default-200 bg-background px-3 text-sm outline-none focus:border-primary"
                  />

                  <div className="grid grid-cols-6 gap-1">
                    {PROFILE_AVATARS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleAvatar(profile.id, item)}
                        className={`rounded-lg p-1 text-lg ${
                          profile.avatar === item
                            ? "bg-primary/15 ring-1 ring-primary"
                            : "bg-default-100"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRename(profile.id)}
                    className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    Save changes
                  </button>
                </div>
              )}
            </section>
          );
        })}

        {profiles.length < 6 && (
          <section className="rounded-2xl border border-dashed border-default-300 bg-background/30 p-4">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-20 items-center justify-center rounded-2xl bg-default-100 text-3xl text-default-500">
                +
              </span>

              <h2 className="mt-3 font-semibold">Add profile</h2>
              <p className="mt-1 text-xs text-default-500">
                Create another space
              </p>
            </div>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={24}
              placeholder="Profile name"
              className="mt-4 h-10 w-full rounded-xl border border-default-200 bg-background px-3 text-sm outline-none focus:border-primary"
            />

            <div className="mt-3 grid grid-cols-6 gap-1">
              {PROFILE_AVATARS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAvatar(item)}
                  aria-label={`Choose ${item} avatar`}
                  className={`rounded-lg p-1 text-lg ${
                    avatar === item
                      ? "bg-primary/15 ring-1 ring-primary"
                      : "bg-default-100"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim()}
              className="mt-3 h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create profile
            </button>
          </section>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-5 text-sm text-default-500">
          {notice}
        </p>
      )}

      <div className="mt-10 rounded-2xl border border-default-200 bg-background/50 p-5">
        <h2 className="font-semibold">A note about local profiles</h2>
        <p className="mt-2 text-sm leading-6 text-default-500">
          Profiles are saved in this browser on this device. They do not
          sync between devices or browsers. Your existing Default profile
          keeps using your original Ryuflix watch history and watchlist.
          Deleting a profile removes its locally stored profile data.
        </p>
      </div>
    </div>
  );
}
