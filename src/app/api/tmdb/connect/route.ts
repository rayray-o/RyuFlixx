import { NextResponse } from "next/server";
import { env } from "@/utils/env";

const REQUEST_COOKIE = "ryuflix_tmdb_request_token";
const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const SESSION_COOKIE = "ryuflix_tmdb_session_id";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";
const USERNAME_COOKIE = "ryuflix_tmdb_username";
const NAME_COOKIE = "ryuflix_tmdb_name";

function errorMessage(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;

    for (const candidate of [
      object.status_message,
      object.message,
      object.error,
      object.status,
    ]) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return "TMDB authorization failed.";
}

export async function GET() {
  try {
    const apiToken = env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
    const redirectUri = env.TMDB_PERSONALIZATION_REDIRECT_URI;

    if (!apiToken) {
      return NextResponse.json(
        {
          error:
            "TMDB API access token is missing on the server.",
        },
        { status: 500 },
      );
    }

    if (!redirectUri) {
      return NextResponse.json(
        {
          error:
            "TMDB personalization redirect URI is missing.",
        },
        { status: 500 },
      );
    }

    const response = await fetch(
      "https://api.themoviedb.org/4/auth/request_token",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          redirect_to: redirectUri,
        }),
        cache: "no-store",
      },
    );

    const raw = await response.text();

    let data: Record<string, unknown> = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      // handled below
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `TMDB authorization failed: ${errorMessage(data)}`,
        },
        { status: 502 },
      );
    }

    const requestToken = data.request_token;

    if (typeof requestToken !== "string" || !requestToken) {
      return NextResponse.json(
        {
          error:
            "TMDB did not return an authorization request token.",
        },
        { status: 502 },
      );
    }

    const responseRedirect = NextResponse.redirect(
      `https://www.themoviedb.org/auth/access?request_token=${encodeURIComponent(
        requestToken,
      )}`,
    );

    // Clear every previous connection before starting a fresh one.
    responseRedirect.cookies.delete(ACCESS_COOKIE);
    responseRedirect.cookies.delete(SESSION_COOKIE);
    responseRedirect.cookies.delete(ACCOUNT_COOKIE);
    responseRedirect.cookies.delete(USERNAME_COOKIE);
    responseRedirect.cookies.delete(NAME_COOKIE);

    responseRedirect.cookies.set({
      name: REQUEST_COOKIE,
      value: requestToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    return responseRedirect;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `TMDB authorization could not start: ${error.message}`
            : "TMDB authorization could not start.",
      },
      { status: 500 },
    );
  }
        }
