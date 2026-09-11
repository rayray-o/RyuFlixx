import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/utils/env";

const REQUEST_COOKIE = "ryuflix_tmdb_request_token";
const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cookieStore = await cookies();

    const requestToken =
      url.searchParams.get("request_token") ??
      url.searchParams.get("requestToken") ??
      url.searchParams.get("token") ??
      cookieStore.get(REQUEST_COOKIE)?.value ??
      null;

    if (!requestToken) {
      return NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error&reason=missing_request_token",
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

    const raw = await response.text();

    let data: Record<string, unknown> = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      console.error(
        "TMDB access-token response was not JSON:",
        raw,
      );
    }

    if (!response.ok) {
      console.error(
        "TMDB access-token exchange failed:",
        response.status,
        raw,
      );

      const result = NextResponse.redirect(
        new URL(
          `/personalize?tmdb=error&reason=exchange_${response.status}`,
          request.url,
        ),
      );

      result.cookies.delete(REQUEST_COOKIE);

      return result;
    }

    const accessToken =
      typeof data.access_token === "string"
        ? data.access_token
        : null;

    /*
     * TMDB's v4 access-token response uses
     * account_id for the authenticated account.
     *
     * Keep account_object_id as a compatibility
     * fallback in case TMDB returns that field.
     */
    const accountId =
      typeof data.account_id === "string"
        ? data.account_id
        : typeof data.account_id === "number"
          ? String(data.account_id)
          : typeof data.account_object_id === "string"
            ? data.account_object_id
            : null;

    if (!accessToken || !accountId) {
      console.error(
        "TMDB authentication response did not contain the required account data.",
        {
          hasAccessToken: Boolean(accessToken),
          accountId,
          fields: Object.keys(data),
        },
      );

      const result = NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error&reason=missing_account_data",
          request.url,
        ),
      );

      result.cookies.delete(REQUEST_COOKIE);
      result.cookies.delete(ACCESS_COOKIE);
      result.cookies.delete(ACCOUNT_COOKIE);

      return result;
    }

    const result = NextResponse.redirect(
      new URL(
        "/personalize?tmdb=connected",
        request.url,
      ),
    );

    result.cookies.set({
      name: ACCESS_COOKIE,
      value: accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    result.cookies.set({
      name: ACCOUNT_COOKIE,
      value: accountId,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    result.cookies.delete(REQUEST_COOKIE);

    return result;
  } catch (error) {
    console.error(
      "TMDB callback crashed:",
      error,
    );

    const result = NextResponse.redirect(
      new URL(
        "/personalize?tmdb=error&reason=callback_exception",
        request.url,
      ),
    );

    result.cookies.delete(REQUEST_COOKIE);

    return result;
  }
}
