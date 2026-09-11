import { NextResponse } from "next/server";
import { env } from "@/utils/env";

export async function GET() {
  try {
    const redirectUri = env.TMDB_PERSONALIZATION_REDIRECT_URI;

    const response = await fetch(
      "https://api.themoviedb.org/4/auth/request_token",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redirect_to: redirectUri,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("TMDB request token failed:", errorText);

      return NextResponse.json(
        { error: "Failed to start TMDB authorization." },
        { status: 502 },
      );
    }

    const data = await response.json();

    if (!data.request_token) {
      return NextResponse.json(
        { error: "TMDB did not return a request token." },
        { status: 502 },
      );
    }

    const approvalUrl =
      `https://www.themoviedb.org/auth/access?request_token=` +
      encodeURIComponent(data.request_token);

    return NextResponse.redirect(approvalUrl);
  } catch (error) {
    console.error("TMDB connect error:", error);

    return NextResponse.json(
      { error: "Unable to connect to TMDB." },
      { status: 500 },
    );
  }
        }
