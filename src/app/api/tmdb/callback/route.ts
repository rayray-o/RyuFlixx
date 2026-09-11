import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/utils/env";

const TMDB_REQUEST_COOKIE =
  "ryuflix_tmdb_request_token";

const TMDB_ACCESS_COOKIE =
  "ryuflix_tmdb_access_token";

const TMDB_ACCOUNT_COOKIE =
  "ryuflix_tmdb_account_id";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cookieStore = await cookies();

    /*
     * Prefer a request token supplied by TMDB if one
     * exists, but fall back to the token RyuFlix
     * stored before sending the user to TMDB.
     */
    const callbackRequestToken =
      url.searchParams.get("request_token") ??
      url.searchParams.get("requestToken") ??
      url.searchParams.get("token");

    const storedRequestToken =
      cookieStore.get(
        TMDB_REQUEST_COOKIE,
      )?.value;

    const requestToken =
      callbackRequestToken ??
      storedRequestToken;

    if (!requestToken) {
      console.error(
        "TMDB callback: no request token was available.",
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
     * Step 3 of TMDB's v4 user-authentication flow:
     * exchange the approved request token for the
     * user's official TMDB access token.
     */
    const response = await fetch(
      "https://api.themoviedb.org/4/auth/access_token",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
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
        "TMDB access-token exchange failed:",
        response.status,
        errorText,
      );

      const errorResponse =
        NextResponse.redirect(
          new URL(
            "/personalize?tmdb=error",
            request.url,
          ),
        );

      /*
       * The request token has failed/expired/been
       * rejected, so don't leave it around.
       */
      errorResponse.cookies.delete(
        TMDB_REQUEST_COOKIE,
      );

      return errorResponse;
    }

    const data = await response.json();

    if (!data.access_token) {
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

    const accessToken =
      data.access_token;

    /*
     * TMDB's v4 response may provide the account
     * object identifier. Keep it for Stage 3.
     */
    const accountObjectId =
      data.account_object_id ??
      data.account_id ??
      null;

    const redirectUrl =
      new URL(
        "/personalize?tmdb=connected",
        request.url,
      );

    const nextResponse =
      NextResponse.redirect(
        redirectUrl,
      );

    /*
     * Store the actual user access token securely.
     */
    nextResponse.cookies.set({
      name: TMDB_ACCESS_COOKIE,
      value: accessToken,
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    /*
     * Store the TMDB account object ID when
     * available.
     */
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

    /*
     * The temporary request token has done its job.
     * Remove it immediately.
     */
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
