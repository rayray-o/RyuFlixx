import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const TMDB_COOKIE = "ryuflix_tmdb_access_token";
const TMDB_ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get(TMDB_COOKIE)?.value;

    const storedAccountId =
      cookieStore.get(TMDB_ACCOUNT_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json({
        connected: false,
      });
    }

    /*
     * Validate the user token against TMDB.
     *
     * The bearer token works across TMDB v3
     * and v4 APIs.
     */
    const response = await fetch(
      "https://api.themoviedb.org/3/account",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      cookieStore.delete(TMDB_COOKIE);
      cookieStore.delete(TMDB_ACCOUNT_COOKIE);

      return NextResponse.json({
        connected: false,
      });
    }

    const account = await response.json();

    /*
     * If the v4 flow returned an account object ID,
     * preserve it. Otherwise keep the existing
     * account identifier as a fallback.
     */
    const accountObjectId =
      storedAccountId ??
      account.account_object_id ??
      null;

    return NextResponse.json({
      connected: true,

      account: {
        id: account.id,
        objectId: accountObjectId,
        username:
          account.username ?? null,
        name:
          account.name ?? null,
        avatar:
          account.avatar ?? null,
      },
    });
  } catch (error) {
    console.error(
      "TMDB status error:",
      error,
    );

    return NextResponse.json(
      {
        connected: false,
      },
      { status: 500 },
    );
  }
        }
