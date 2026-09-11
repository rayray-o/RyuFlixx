import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const TMDB_COOKIE = "ryuflix_tmdb_access_token";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(TMDB_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json({
        connected: false,
      });
    }

    const response = await fetch("https://api.themoviedb.org/3/account", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      cookieStore.delete(TMDB_COOKIE);

      return NextResponse.json({
        connected: false,
      });
    }

    const account = await response.json();

    return NextResponse.json({
      connected: true,
      account: {
        id: account.id,
        username: account.username ?? null,
        name: account.name ?? null,
        avatar: account.avatar ?? null,
      },
    });
  } catch (error) {
    console.error("TMDB status error:", error);

    return NextResponse.json(
      {
        connected: false,
      },
      { status: 500 },
    );
  }
}
