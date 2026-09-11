import { NextResponse } from "next/server";
import { env } from "@/utils/env";

const TMDB_REQUEST_COOKIE =
  "ryuflix_tmdb_request_token";

function getErrorMessage(
  value: unknown,
) {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const object =
      value as Record<
        string,
        unknown
      >;

    const candidates = [
      object.status_message,
      object.message,
      object.error,
      object.status,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === "string" &&
        candidate.trim()
      ) {
        return candidate.trim();
      }
    }
  }

  return "TMDB rejected the authorization request.";
}

export async function GET(
  request: Request,
) {
  try {
    const apiToken =
      env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;

    const configuredRedirect =
      env.TMDB_PERSONALIZATION_REDIRECT_URI;

    if (!apiToken) {
      return NextResponse.json(
        {
          error:
            "TMDB API access token is missing on the server.",
        },
        { status: 500 },
      );
    }

    if (!configuredRedirect) {
      return NextResponse.json(
        {
          error:
            "TMDB personalization redirect URI is missing.",
        },
        { status: 500 },
      );
    }

    /*
     * TMDB v4 user authentication:
     *
     * 1. Create request token
     * 2. Send user to TMDB for approval
     * 3. Exchange approved request token
     *    for the user's access token.
     *
     * The request token expires after 15 minutes.
     */

    const response =
      await fetch(
        "https://api.themoviedb.org/4/auth/request_token",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiToken}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            redirect_to:
              configuredRedirect,
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
      data =
        rawText
          ? JSON.parse(rawText)
          : {};
    } catch {
      /*
       * TMDB should return JSON, but keep
       * the raw response available for
       * diagnostics if it doesn't.
       */
    }

    if (!response.ok) {
      const message =
        getErrorMessage(
          data,
        );

      console.error(
        "TMDB request token failed:",
        {
          status:
            response.status,

          statusText:
            response.statusText,

          message,

          response:
            rawText.slice(
              0,
              1000,
            ),

          redirectUri:
            configuredRedirect,
        },
      );

      /*
       * IMPORTANT:
       * Don't hide the real TMDB error.
       *
       * This lets us immediately tell
       * whether the problem is the API
       * token, redirect URI, permissions,
       * or something else.
       */
      return NextResponse.json(
        {
          error:
            `TMDB authorization failed: ${message}`,

          status:
            response.status,
        },
        {
          status: 502,
        },
      );
    }

    const requestToken =
      data.request_token;

    if (
      typeof requestToken !==
        "string" ||
      !requestToken
    ) {
      console.error(
        "TMDB request token missing:",
        data,
      );

      return NextResponse.json(
        {
          error:
            "TMDB responded successfully but did not provide a request token.",
        },
        {
          status: 502,
        },
      );
    }

    /*
     * Keep the temporary request token
     * on the RyuFlix side.
     *
     * This is NOT a RyuFlix account.
     * It only survives the TMDB OAuth
     * redirect for 15 minutes.
     */
    const nextResponse =
      NextResponse.redirect(
        "https://www.themoviedb.org/auth/access" +
          `?request_token=${encodeURIComponent(
            requestToken,
          )}`,
      );

    nextResponse.cookies.set({
      name:
        TMDB_REQUEST_COOKIE,

      value:
        requestToken,

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
        60 * 15,
    });

    return nextResponse;
  } catch (error) {
    console.error(
      "TMDB connect route crashed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `TMDB authorization could not start: ${error.message}`
            : "TMDB authorization could not start.",
      },
      {
        status: 500,
      },
    );
  }
}
