import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const TMDB_COOKIE = "ryuflix_tmdb_access_token";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(TMDB_COOKIE)?.value;

    if (accessToken) {
      try {
        await fetch("https://api.themoviedb.org/4/auth/access_token", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: accessToken,
          }),
          cache: "no-store",
        });
      } catch (error) {
        console.error("TMDB logout request failed:", error);
      }
    }

    cookieStore.delete(TMDB_COOKIE);

    return NextResponse.json({
      connected: false,
    });
  } catch (error) {
    console.error("TMDB disconnect error:", error);

    return NextResponse.json(
      {
        error: "Failed to disconnect TMDB.",
      },
      { status: 500 },
    );
  }
}
