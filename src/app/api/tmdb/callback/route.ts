import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/utils/env";

const TMDB_REQUEST_COOKIE = "ryuflix_tmdb_request_token";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cookieStore = await cookies();

    const callbackRequestToken =
      url.searchParams.get("request_token") ??
      url.searchParams.get("requestToken") ??
      url.searchParams.get("token");

    const storedRequestToken =
      cookieStore.get(TMDB_REQUEST_COOKIE)?.value;

    const requestToken =
      callbackRequestToken ?? storedRequestToken;

    if (!requestToken) {
      console.error(
        "TMDB DIAGNOSTIC: no request token.",
        url.search,
      );

      return NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error&reason=no_request_token",
          request.url,
        ),
      );
    }

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

    const rawText = await response.text();

    let data: Record<string, unknown> = {};

    try {
      data = rawText
        ? JSON.parse(rawText)
        : {};
    } catch {
      console.error(
        "TMDB DIAGNOSTIC: invalid JSON:",
        rawText,
      );
    }

    /*
     * IMPORTANT:
     *
     * Never log the actual access token.
     * We only log the names/types of fields
     * TMDB returned.
     */
    const safeDiagnostic = Object.fromEntries(
      Object.entries(data).map(
        ([key, value]) => {
          if (
            key.toLowerCase().includes("token")
          ) {
            return [
              key,
              "[REDACTED]",
            ];
          }

          if (
            typeof value === "string"
          ) {
            return [
              key,
              {
                type: "string",
                length: value.length,
                preview:
                  value.length > 80
                    ? `${value.slice(0, 80)}...`
                    : value,
              },
            ];
          }

          if (
            typeof value === "number"
          ) {
            return [
              key,
              {
                type: "number",
                value,
              },
            ];
          }

          if (
            typeof value === "boolean"
          ) {
            return [
              key,
              {
                type: "boolean",
                value,
              },
            ];
          }

          if (
            value === null
          ) {
            return [
              key,
              {
                type: "null",
              },
            ];
          }

          if (
            Array.isArray(value)
          ) {
            return [
              key,
              {
                type: "array",
                length: value.length,
              },
            ];
          }

          if (
            typeof value === "object"
          ) {
            return [
              key,
              {
                type: "object",
                keys: Object.keys(
                  value as Record<
                    string,
                    unknown
                  >,
                ),
              },
            ];
          }

          return [
            key,
            {
              type: typeof value,
            },
          ];
        },
      ),
    );

    console.log(
      "================ TMDB AUTH DIAGNOSTIC ================",
    );

    console.log(
      "HTTP STATUS:",
      response.status,
    );

    console.log(
      "RETURNED FIELDS:",
      JSON.stringify(
        safeDiagnostic,
        null,
        2,
      ),
    );

    console.log(
      "=======================================================",
    );

    if (!response.ok) {
      console.error(
        "TMDB access-token exchange failed:",
        response.status,
        rawText,
      );

      const errorResponse =
        NextResponse.redirect(
          new URL(
            "/personalize?tmdb=error&reason=access_token_exchange",
            request.url,
          ),
        );

      errorResponse.cookies.delete(
        TMDB_REQUEST_COOKIE,
      );

      return errorResponse;
    }

    /*
     * Diagnostic mode deliberately DOES NOT
     * save the access token or account ID.
     *
     * This prevents another potentially wrong
     * account identifier from being persisted.
     */
    const diagnosticResponse =
      NextResponse.redirect(
        new URL(
          "/personalize?tmdb=diagnostic",
          request.url,
        ),
      );

    diagnosticResponse.cookies.delete(
      TMDB_REQUEST_COOKIE,
    );

    return diagnosticResponse;
  } catch (error) {
    console.error(
      "TMDB diagnostic callback error:",
      error,
    );

    const errorResponse =
      NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error&reason=callback_exception",
          request.url,
        ),
      );

    errorResponse.cookies.delete(
      TMDB_REQUEST_COOKIE,
    );

    return errorResponse;
  }
}
