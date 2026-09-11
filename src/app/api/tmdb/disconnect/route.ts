import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const SESSION_COOKIE = "ryuflix_tmdb_session_id";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";
const REQUEST_COOKIE = "ryuflix_tmdb_request_token";
const USERNAME_COOKIE = "ryuflix_tmdb_username";
const NAME_COOKIE = "ryuflix_tmdb_name";

export async function POST() {
  const cookieStore = await cookies();

  const accessToken =
    cookieStore.get(
      ACCESS_COOKIE,
    )?.value ?? null;

  const sessionId =
    cookieStore.get(
      SESSION_COOKIE,
    )?.value ?? null;

  try {
    if (sessionId && accessToken) {
      try {
        await fetch(
          "https://api.themoviedb.org/3/authentication/session",
          {
            method: "DELETE",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify({
              session_id:
                sessionId,
            }),
            cache: "no-store",
          },
        );
      } catch {
        // Local cleanup below is still performed.
      }
    }

    if (accessToken) {
      try {
        await fetch(
          "https://api.themoviedb.org/4/auth/access_token",
          {
            method: "DELETE",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify({
              access_token:
                accessToken,
            }),
            cache: "no-store",
          },
        );
      } catch {
        // Local cleanup below is still performed.
      }
    }
  } finally {
    cookieStore.delete(ACCESS_COOKIE);
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(ACCOUNT_COOKIE);
    cookieStore.delete(REQUEST_COOKIE);
    cookieStore.delete(USERNAME_COOKIE);
    cookieStore.delete(NAME_COOKIE);
  }

  return NextResponse.json({
    connected: false,
  });
}
