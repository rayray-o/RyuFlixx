import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/utils/env";

const REQUEST_COOKIE = "ryuflix_tmdb_request_token";
const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const ACCOUNT_OBJECT_COOKIE = "ryuflix_tmdb_account_object_id";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";
const USERNAME_COOKIE = "ryuflix_tmdb_username";
const NAME_COOKIE = "ryuflix_tmdb_name";

async function readJSON(response: Response) {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();

  try {
    const requestToken =
      url.searchParams.get("request_token") ??
      url.searchParams.get("requestToken") ??
      cookieStore.get(REQUEST_COOKIE)?.value ??
      null;

    if (!requestToken) {
      return NextResponse.redirect(new URL("/personalize?tmdb=error&reason=missing_request_token", request.url));
    }

    const applicationToken = env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;

    if (!applicationToken) {
      return NextResponse.redirect(new URL("/personalize?tmdb=error&reason=missing_application_token", request.url));
    }

    const accessResponse = await fetch("https://api.themoviedb.org/4/auth/access_token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${applicationToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ request_token: requestToken }),
      cache: "no-store",
    });

    const accessData = await readJSON(accessResponse);

    if (!accessResponse.ok) {
      return NextResponse.redirect(
        new URL(`/personalize?tmdb=error&reason=access_exchange_${accessResponse.status}`, request.url),
      );
    }

    const accessToken = typeof accessData.access_token === "string" ? accessData.access_token : null;
    const accountObjectId = typeof accessData.account_id === "string" ? accessData.account_id : null;

    if (!accessToken || !accountObjectId) {
      return NextResponse.redirect(new URL("/personalize?tmdb=error&reason=missing_account_data", request.url));
    }

    const accountResponse = await fetch(
      `https://api.themoviedb.org/4/account/${encodeURIComponent(accountObjectId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const accountData = await readJSON(accountResponse);

    if (!accountResponse.ok) {
      return NextResponse.redirect(
        new URL(`/personalize?tmdb=error&reason=account_${accountResponse.status}`, request.url),
      );
    }

    const numericAccountId =
      typeof accountData.id === "number" && accountData.id > 0 ? accountData.id : null;

    const username = typeof accountData.username === "string" ? accountData.username : "";
    const name = typeof accountData.name === "string" ? accountData.name : "";

    const validationResponse = await fetch(
      `https://api.themoviedb.org/4/account/${encodeURIComponent(accountObjectId)}/movie/rated?page=1&language=en-US&sort_by=created_at.desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!validationResponse.ok) {
      return NextResponse.redirect(
        new URL(`/personalize?tmdb=error&reason=collection_${validationResponse.status}`, request.url),
      );
    }

    const response = NextResponse.redirect(new URL("/personalize?tmdb=connected", request.url));

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    };

    response.cookies.set({ ...cookieOptions, name: ACCESS_COOKIE, value: accessToken });
    response.cookies.set({ ...cookieOptions, name: ACCOUNT_OBJECT_COOKIE, value: accountObjectId });

    if (numericAccountId !== null) {
      response.cookies.set({ ...cookieOptions, name: ACCOUNT_COOKIE, value: String(numericAccountId) });
    }

    response.cookies.set({ ...cookieOptions, name: USERNAME_COOKIE, value: username });
    response.cookies.set({ ...cookieOptions, name: NAME_COOKIE, value: name });

    response.cookies.delete(REQUEST_COOKIE);
    response.cookies.delete("ryuflix_tmdb_session_id");

    return response;
  } catch {
    return NextResponse.redirect(new URL("/personalize?tmdb=error&reason=callback_exception", request.url));
  }
}
