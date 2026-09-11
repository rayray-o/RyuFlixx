import { NextResponse } from "next/server";
import { env } from "@/utils/env";

const TMDB_COOKIE = "ryuflix_tmdb_access_token";
const TMDB_ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const requestToken =
      url.searchParams.get("request_token") ??
      url.searchParams.get("requestToken") ??
      url.searchParams.get("token");

    const approved =
      url.searchParams.get("approved") ??
      url.searchParams.get("allow");

    if (!requestToken) {
      console.error(
        "TMDB callback did not contain a request token.",
        url.search,
      );

      return NextResponse.redirect(
        new URL("/personalize?tmdb=error", request.url),
      );
    }

    if (
      approved === "false" ||
      approved === "0"
    ) {
      return NextResponse.redirect(
        new URL("/personalize?tmdb=denied", request.url),
      );
    }

    const response = await fetch(
      "https://api.themoviedb.org/4/auth/access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          request_token: requestToken,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "TMDB access token exchange failed:",
        response.status,
        errorText,
      );

      return NextResponse.redirect(
        new URL("/personalize?tmdb=error", request.url),
      );
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error(
        "TMDB access token missing:",
        data,
      );

      return NextResponse.redirect(
        new URL("/personalize?tmdb=error", request.url),
      );
    }

    const accessToken = data.access_token;

    /*
     * The v4 authentication response includes the
     * account object ID. Keep it when available so
     * later personalization requests can use the
     * v4 account endpoints directly.
     */
    const accountObjectId =
      data.account_object_id ??
      data.account_id ??
      null;

    const redirectUrl = new URL(
      "/personalize?tmdb=connected",
      request.url,
    );

    const nextResponse =
      NextResponse.redirect(redirectUrl);

    nextResponse.cookies.set({
      name: TMDB_COOKIE,
      value: accessToken,
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    if (accountObjectId) {
      nextResponse.cookies.set({
        name: TMDB_ACCOUNT_COOKIE,
        value: String(accountObjectId),
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return nextResponse;
  } catch (error) {
    console.error(
      "TMDB callback error:",
      error,
    );

    return NextResponse.redirect(
      new URL("/personalize?tmdb=error", request.url),
    );
  }
}
