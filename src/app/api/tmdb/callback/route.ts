import { NextResponse } from "next/server";
import { env } from "@/utils/env";

const TMDB_COOKIE = "ryuflix_tmdb_access_token";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestToken = url.searchParams.get("request_token");

    if (!requestToken) {
      return NextResponse.redirect(
        new URL("/personalize?tmdb=error", request.url),
      );
    }

    const response = await fetch(
      "https://api.themoviedb.org/4/auth/access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_token: requestToken,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("TMDB access token failed:", errorText);

      return NextResponse.redirect(
        new URL("/personalize?tmdb=error", request.url),
      );
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error("TMDB access token missing:", data);

      return NextResponse.redirect(
        new URL("/personalize?tmdb=error", request.url),
      );
    }

    const redirectUrl = new URL("/personalize?tmdb=connected", request.url);

    const nextResponse = NextResponse.redirect(redirectUrl);

    nextResponse.cookies.set({
      name: TMDB_COOKIE,
      value: data.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return nextResponse;
  } catch (error) {
    console.error("TMDB callback error:", error);

    return NextResponse.redirect(
      new URL("/personalize?tmdb=error", request.url),
    );
  }
}
