import { NextResponse } from "next/server";
import { env } from "@/utils/env";

const TMDB_REQUEST_COOKIE = "ryuflix_tmdb_request_token";

export async function GET() {
  try {
    const redirectUri =
      env.TMDB_PERSONALIZATION_REDIRECT_URI;

    const response = await fetch(
      "https://api.themoviedb.org/4/auth/request_token",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          redirect_to: redirectUri,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "TMDB request token failed:",
        response.status,
        errorText,
      );

      return NextResponse.json(
        {
          error:
            "Failed to start TMDB authorization.",
        },
        { status: 502 },
      );
    }

    const data = await response.json();

    if (!data.request_token) {
      console.error(
        "TMDB request token missing:",
        data,
      );

      return NextResponse.json(
        {
          error:
            "TMDB did not return a request token.",
        },
        { status: 502 },
      );
    }

    const approvalUrl =
      "https://www.themoviedb.org/auth/access" +
      `?request_token=${encodeURIComponent(
        data.request_token,
      )}`;

    const nextResponse =
      NextResponse.redirect(approvalUrl);

    /*
     * Keep the request token on the RyuFlix side.
     *
     * TMDB may redirect back to our callback without
     * putting the request token in the callback URL.
     * Keeping it here means we always know which
     * request token must be exchanged after approval.
     */
    nextResponse.cookies.set({
      name: TMDB_REQUEST_COOKIE,
      value: data.request_token,
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    return nextResponse;
  } catch (error) {
    console.error(
      "TMDB connect error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to connect to TMDB.",
      },
      { status: 500 },
    );
  }
}
