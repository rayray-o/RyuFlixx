import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/utils/env";

const TMDB_REQUEST_COOKIE =
  "ryuflix_tmdb_request_token";

const TMDB_ACCESS_COOKIE =
  "ryuflix_tmdb_access_token";

const TMDB_ACCOUNT_COOKIE =
  "ryuflix_tmdb_account_id";

export async function GET(
  request: Request,
) {
  try {
    const url =
      new URL(request.url);

    const cookieStore =
      await cookies();

    /*
     * TMDB may return the request token through
     * the callback URL. Otherwise use the temporary
     * token that RyuFlix stored before redirecting.
     */
    const callbackRequestToken =
      url.searchParams.get(
        "request_token",
      ) ??
      url.searchParams.get(
        "requestToken",
      ) ??
      url.searchParams.get(
        "token",
      );

    const storedRequestToken =
      cookieStore.get(
        TMDB_REQUEST_COOKIE,
      )?.value;

    const requestToken =
      callbackRequestToken ??
      storedRequestToken;

    if (!requestToken) {
      console.error(
        "TMDB callback: no request token.",
        url.search,
      );

      return NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error",
          request.url,
        ),
      );
    }

    /*
     * Exchange the approved request token
     * for the user's v4 access token.
     */
    const response =
      await fetch(
        "https://api.themoviedb.org/4/auth/access_token",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            request_token:
              requestToken,
          }),

          cache: "no-store",
        },
      );

    const rawText =
      await response.text();

    let data: Record<
      string,
      unknown
    > = {};

    try {
      data = rawText
        ? JSON.parse(rawText)
        : {};
    } catch {
      console.error(
        "TMDB callback returned invalid JSON:",
        rawText,
      );
    }

    if (!response.ok) {
      console.error(
        "TMDB access-token exchange failed:",
        response.status,
        rawText,
      );

      const errorResponse =
        NextResponse.redirect(
          new URL(
            "/personalize?tmdb=error",
            request.url,
          ),
        );

      errorResponse.cookies.delete(
        TMDB_REQUEST_COOKIE,
      );

      return errorResponse;
    }

    const accessToken =
      typeof data.access_token ===
      "string"
        ? data.access_token
        : null;

    if (!accessToken) {
      console.error(
        "TMDB access token missing:",
        data,
      );

      const errorResponse =
        NextResponse.redirect(
          new URL(
            "/personalize?tmdb=error",
            request.url,
          ),
        );

      errorResponse.cookies.delete(
        TMDB_REQUEST_COOKIE,
      );

      return errorResponse;
    }

    /*
     * TMDB's v4 auth response normally contains
     * account_object_id.
     *
     * Keep the fallback fields because TMDB has
     * returned slightly different response shapes
     * across versions of the authentication flow.
     */
    const accountObjectId =
      typeof data.account_object_id ===
      "string"
        ? data.account_object_id
        : typeof data.account_id ===
            "string"
          ? data.account_id
          : typeof data.account_id ===
              "number"
            ? String(
                data.account_id,
              )
            : null;

    if (!accountObjectId) {
      console.error(
        "TMDB callback: account object ID missing.",
        data,
      );

      const errorResponse =
        NextResponse.redirect(
          new URL(
            "/personalize?tmdb=error",
            request.url,
          ),
        );

      errorResponse.cookies.delete(
        TMDB_REQUEST_COOKIE,
      );

      return errorResponse;
    }

    /*
     * CRITICAL VALIDATION
     *
     * Before saving the account object ID,
     * make the exact request that Stage 3 will
     * later use.
     */
    const validationResponse =
      await fetch(
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

    const validationText =
      await validationResponse.text();

    if (!validationResponse.ok) {
      console.error(
        "TMDB account object validation failed:",
        {
          status:
            validationResponse.status,

          accountObjectId,

          response:
            validationText.slice(
              0,
              1000,
            ),
        },
      );

      const errorResponse =
        NextResponse.redirect(
          new URL(
            "/personalize?tmdb=error",
            request.url,
          ),
        );

      errorResponse.cookies.delete(
        TMDB_REQUEST_COOKIE,
      );

      return errorResponse;
    }

    let validationData: {
      total_results?: number;
      results?: unknown[];
    } = {};

    try {
      validationData =
        validationText
          ? JSON.parse(
              validationText,
            )
          : {};
    } catch {
      console.error(
        "TMDB account validation returned invalid JSON.",
      );
    }

    console.log(
      "TMDB account successfully validated:",
      {
        accountObjectId,

        ratedMovies:
          validationData.total_results ??
          validationData.results?.length ??
          0,
      },
    );

    /*
     * Everything has now been validated.
     *
     * Store the real user token and the exact
     * account_object_id that successfully worked.
     */
    const redirectUrl =
      new URL(
        "/personalize?tmdb=connected",
        request.url,
      );

    const nextResponse =
      NextResponse.redirect(
        redirectUrl,
      );

    nextResponse.cookies.set({
      name:
        TMDB_ACCESS_COOKIE,

      value:
        accessToken,

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        60 * 60 * 24 * 365,
    });

    nextResponse.cookies.set({
      name:
        TMDB_ACCOUNT_COOKIE,

      value:
        accountObjectId,

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        60 * 60 * 24 * 365,
    });

    nextResponse.cookies.delete(
      TMDB_REQUEST_COOKIE,
    );

    return nextResponse;
  } catch (error) {
    console.error(
      "TMDB callback error:",
      error,
    );

    const errorResponse =
      NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error",
          request.url,
        ),
      );

    errorResponse.cookies.delete(
      TMDB_REQUEST_COOKIE,
    );

    return errorResponse;
  }
}
