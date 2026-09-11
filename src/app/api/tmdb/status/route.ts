import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const TMDB_ACCESS_COOKIE =
  "ryuflix_tmdb_access_token";

const TMDB_ACCOUNT_COOKIE =
  "ryuflix_tmdb_account_id";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get(
        TMDB_ACCESS_COOKIE,
      )?.value;

    const accountObjectId =
      cookieStore.get(
        TMDB_ACCOUNT_COOKIE,
      )?.value;

    if (!accessToken) {
      return NextResponse.json({
        connected: false,
      });
    }

    /*
     * The v4 OAuth flow gives us the account_object_id.
     *
     * That ID is what the authenticated v4 account
     * collection endpoints require.
     *
     * We deliberately do NOT call:
     *
     *   /3/account
     *
     * here because that endpoint expects the numeric
     * v3 account_id in its path.
     */

    if (!accountObjectId) {
      return NextResponse.json({
        connected: false,
        reason:
          "TMDB access token exists but account_object_id is missing.",
      });
    }

    /*
     * Validate the actual authenticated token by
     * requesting the user's rated movies collection.
     *
     * This is the same endpoint the importer uses.
     */
    const response = await fetch(
      `https://api.themoviedb.org/4/account/${encodeURIComponent(
        accountObjectId,
      )}/movie/rated?page=1&language=en-US&sort_by=created_at.desc`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          Accept:
            "application/json",
        },

        cache: "no-store",
      },
    );

    const rawText =
      await response.text();

    if (!response.ok) {
      console.error(
        "TMDB status validation failed:",
        response.status,
        rawText,
      );

      const errorResponse =
        NextResponse.json(
          {
            connected: false,

            reason:
              `TMDB validation failed (${response.status}).`,
          },
        );

      errorResponse.cookies.delete(
        TMDB_ACCESS_COOKIE,
      );

      errorResponse.cookies.delete(
        TMDB_ACCOUNT_COOKIE,
      );

      return errorResponse;
    }

    let data: {
      total_results?: number;
      results?: unknown[];
    } = {};

    try {
      data = rawText
        ? JSON.parse(rawText)
        : {};
    } catch {
      console.error(
        "TMDB status returned invalid JSON:",
        rawText,
      );

      return NextResponse.json({
        connected: false,

        reason:
          "TMDB returned invalid JSON.",
      });
    }

    return NextResponse.json({
      connected: true,

      account: {
        id:
          null,

        objectId:
          accountObjectId,

        username:
          null,

        name:
          null,
      },

      validation: {
        ratedMovies:
          data.total_results ??
          data.results?.length ??
          0,
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

        reason:
          error instanceof Error
            ? error.message
            : "TMDB status check failed.",
      },
      {
        status: 500,
      },
    );
  }
}
