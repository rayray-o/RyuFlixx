import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get(ACCESS_COOKIE)?.value ?? null;

    const accountId =
      cookieStore.get(ACCOUNT_COOKIE)?.value ?? null;

    if (!accessToken || !accountId) {
      return NextResponse.json({
        connected: false,
      });
    }

    /*
     * Validate the actual user connection against
     * the v4 account collection endpoint.
     *
     * TMDB documents this endpoint as:
     * /4/account/{account_object_id}/movie/rated
     */
    const response = await fetch(
      `https://api.themoviedb.org/4/account/${encodeURIComponent(
        accountId,
      )}/movie/rated?page=1&language=en-US&sort_by=created_at.desc`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const raw = await response.text();

      console.error(
        "TMDB connection validation failed:",
        response.status,
        raw,
      );

      const result = NextResponse.json({
        connected: false,
      });

      result.cookies.delete(ACCESS_COOKIE);
      result.cookies.delete(ACCOUNT_COOKIE);

      return result;
    }

    const data = await response.json();

    /*
     * Account details are optional here.
     * The important part is that the authenticated
     * user token + account object ID actually work.
     */
    return NextResponse.json({
      connected: true,

      account: {
        id: accountId,
        objectId: accountId,
        username: null,
        name: null,
      },

      validation: {
        ratedMovies:
          typeof data.total_results === "number"
            ? data.total_results
            : Array.isArray(data.results)
              ? data.results.length
              : 0,
      },
    });
  } catch (error) {
    console.error(
      "TMDB status route crashed:",
      error,
    );

    return NextResponse.json({
      connected: false,
    });
  }
}
