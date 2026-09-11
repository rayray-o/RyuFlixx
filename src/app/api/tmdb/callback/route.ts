import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/utils/env";

const REQUEST_COOKIE = "ryuflix_tmdb_request_token";
const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const SESSION_COOKIE = "ryuflix_tmdb_session_id";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";
const USERNAME_COOKIE = "ryuflix_tmdb_username";
const NAME_COOKIE = "ryuflix_tmdb_name";

type TMDBResponse = Record<string, unknown>;

async function parseResponse(
  response: Response,
): Promise<TMDBResponse> {
  const raw = await response.text();

  try {
    return raw ? (JSON.parse(raw) as TMDBResponse) : {};
  } catch {
    return {};
  }
}

async function tmdbRequest(
  url: string,
  accessToken: string,
  init: RequestInit = {},
) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();

  try {
    const requestToken =
      requestUrl.searchParams.get("request_token") ??
      requestUrl.searchParams.get("requestToken") ??
      requestUrl.searchParams.get("token") ??
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

    const applicationToken =
      env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;

    if (!applicationToken) {
      return NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error&reason=missing_application_token",
          request.url,
        ),
      );
    }

    /*
     * STEP 1
     *
     * Exchange the approved request token for
     * the actual authenticated TMDB v4 user token.
     */
    const accessResponse = await fetch(
      "https://api.themoviedb.org/4/auth/access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${applicationToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          request_token: requestToken,
        }),
        cache: "no-store",
      },
    );

    const accessData =
      await parseResponse(accessResponse);

    if (!accessResponse.ok) {
      console.error(
        "TMDB v4 access-token exchange failed:",
        accessResponse.status,
        accessData,
      );

      return NextResponse.redirect(
        new URL(
          `/personalize?tmdb=error&reason=access_exchange_${accessResponse.status}`,
          request.url,
        ),
      );
    }

    const accessToken =
      typeof accessData.access_token === "string"
        ? accessData.access_token
        : null;

    if (!accessToken) {
      return NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error&reason=missing_access_token",
          request.url,
        ),
      );
    }

    /*
     * STEP 2
     *
     * Convert the authenticated v4 user token into
     * a v3 session ID.
     *
     * TMDB specifically documents this endpoint for
     * converting an authenticated v4 token into a
     * v3 session.
     */
    const sessionResponse = await tmdbRequest(
      "https://api.themoviedb.org/3/authentication/session/convert/4",
      accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: accessToken,
        }),
      },
    );

    const sessionData =
      await parseResponse(sessionResponse);

    if (!sessionResponse.ok) {
      console.error(
        "TMDB v4-to-v3 session conversion failed:",
        sessionResponse.status,
        sessionData,
      );

      return NextResponse.redirect(
        new URL(
          `/personalize?tmdb=error&reason=session_conversion_${sessionResponse.status}`,
          request.url,
        ),
      );
    }

    const sessionId =
      typeof sessionData.session_id === "string"
        ? sessionData.session_id
        : null;

    if (!sessionId) {
      return NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error&reason=missing_session_id",
          request.url,
        ),
      );
    }

    /*
     * STEP 3
     *
     * Get the REAL TMDB account object:
     *
     * - numeric account ID
     * - username
     * - name
     *
     * This is what the UI should display.
     */
    const accountResponse = await tmdbRequest(
      `https://api.themoviedb.org/3/account?session_id=${encodeURIComponent(
        sessionId,
      )}`,
      accessToken,
    );

    const accountData =
      await parseResponse(accountResponse);

    if (!accountResponse.ok) {
      console.error(
        "TMDB account lookup failed:",
        accountResponse.status,
        accountData,
      );

      return NextResponse.redirect(
        new URL(
          `/personalize?tmdb=error&reason=account_lookup_${accountResponse.status}`,
          request.url,
        ),
      );
    }

    const accountId =
      typeof accountData.id === "number"
        ? accountData.id
        : typeof accountData.id === "string" &&
            /^\d+$/.test(accountData.id)
          ? Number(accountData.id)
          : null;

    const username =
      typeof accountData.username === "string"
        ? accountData.username
        : "";

    const name =
      typeof accountData.name === "string"
        ? accountData.name
        : "";

    if (!accountId) {
      return NextResponse.redirect(
        new URL(
          "/personalize?tmdb=error&reason=missing_numeric_account_id",
          request.url,
        ),
      );
    }

    /*
     * STEP 4
     *
     * Validate that this exact authenticated account
     * can actually access its rated movies.
     */
    const validationResponse = await tmdbRequest(
      `https://api.themoviedb.org/3/account/${accountId}/rated/movies?session_id=${encodeURIComponent(
        sessionId,
      )}&page=1&language=en-US&sort_by=created_at.desc`,
      accessToken,
    );

    if (!validationResponse.ok) {
      const validationData =
        await parseResponse(validationResponse);

      console.error(
        "TMDB authenticated account validation failed:",
        validationResponse.status,
        validationData,
      );

      return NextResponse.redirect(
        new URL(
          `/personalize?tmdb=error&reason=account_validation_${validationResponse.status}`,
          request.url,
        ),
      );
    }

    /*
     * Everything is valid.
     *
     * Store:
     * - v4 user token
     * - v3 session ID
     * - numeric account ID
     * - username
     * - display name
     */
    const response = NextResponse.redirect(
      new URL(
        "/personalize?tmdb=connected",
        request.url,
      ),
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    };

    response.cookies.set({
      ...cookieOptions,
      name: ACCESS_COOKIE,
      value: accessToken,
    });

    response.cookies.set({
      ...cookieOptions,
      name: SESSION_COOKIE,
      value: sessionId,
    });

    response.cookies.set({
      ...cookieOptions,
      name: ACCOUNT_COOKIE,
      value: String(accountId),
    });

    response.cookies.set({
      ...cookieOptions,
      name: USERNAME_COOKIE,
      value: username,
    });

    response.cookies.set({
      ...cookieOptions,
      name: NAME_COOKIE,
      value: name,
    });

    response.cookies.delete(REQUEST_COOKIE);

    return response;
  } catch (error) {
    console.error(
      "TMDB callback failed:",
      error,
    );

    return NextResponse.redirect(
      new URL(
        "/personalize?tmdb=error&reason=callback_exception",
        request.url,
      ),
    );
  }
}
