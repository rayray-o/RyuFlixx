import { NextResponse } from "next/server";
import { env } from "@/utils/env";

const REQUEST_COOKIE = "ryuflix_tmdb_request_token";

const OLD_COOKIES = [
  "ryuflix_tmdb_access_token",
  "ryuflix_tmdb_session_id",
  "ryuflix_tmdb_account_id",
  "ryuflix_tmdb_account_object_id",
  "ryuflix_tmdb_username",
  "ryuflix_tmdb_name",
];

export async function GET() {
  try {
    const applicationToken = env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
    const redirectUri = env.TMDB_PERSONALIZATION_REDIRECT_URI;

    if (!applicationToken) {
      return NextResponse.json({ error: "TMDB application access token is missing." }, { status: 500 });
    }

    if (!redirectUri) {
      return NextResponse.json({ error: "TMDB personalization redirect URI is missing." }, { status: 500 });
    }

    const response = await fetch("https://api.themoviedb.org/4/auth/request_token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${applicationToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ redirect_to: redirectUri }),
      cache: "no-store",
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return NextResponse.json(
        { error: typeof data.status_message === "string" ? data.status_message : "TMDB authorization failed." },
        { status: 502 },
      );
    }

    const requestToken = typeof data.request_token === "string" ? data.request_token : null;

    if (!requestToken) {
      return NextResponse.json({ error: "TMDB did not return a request token." }, { status: 502 });
    }

    const redirect = NextResponse.redirect(
      `https://www.themoviedb.org/auth/access?request_token=${encodeURIComponent(requestToken)}`,
    );

    for (const cookie of OLD_COOKIES) redirect.cookies.delete(cookie);

    redirect.cookies.set({
      name: REQUEST_COOKIE,
      value: requestToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    return redirect;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start TMDB authorization." },
      { status: 500 },
    );
  }
}
