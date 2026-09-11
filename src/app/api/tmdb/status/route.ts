import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const SESSION_COOKIE = "ryuflix_tmdb_session_id";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";
const USERNAME_COOKIE = "ryuflix_tmdb_username";
const NAME_COOKIE = "ryuflix_tmdb_name";

async function readJSON(response: Response) {
  const raw = await response.text();

  try {
    return raw
      ? (JSON.parse(raw) as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function GET() {
  const cookieStore = await cookies();

  const accessToken =
    cookieStore.get(ACCESS_COOKIE)?.value ?? null;

  const sessionId =
    cookieStore.get(SESSION_COOKIE)?.value ?? null;

  const accountId =
    cookieStore.get(ACCOUNT_COOKIE)?.value ?? null;

  if (
    !accessToken ||
    !sessionId ||
    !accountId
  ) {
    return NextResponse.json({
      connected: false,
    });
  }

  try {
    const accountResponse = await fetch(
      `https://api.themoviedb.org/3/account/${encodeURIComponent(
        accountId,
      )}?session_id=${encodeURIComponent(
        sessionId,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const accountData =
      await readJSON(accountResponse);

    if (!accountResponse.ok) {
      const response = NextResponse.json({
        connected: false,
      });

      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(SESSION_COOKIE);
      response.cookies.delete(ACCOUNT_COOKIE);
      response.cookies.delete(USERNAME_COOKIE);
      response.cookies.delete(NAME_COOKIE);

      return response;
    }

    const username =
      typeof accountData.username === "string"
        ? accountData.username
        : cookieStore.get(USERNAME_COOKIE)?.value ?? "";

    const name =
      typeof accountData.name === "string"
        ? accountData.name
        : cookieStore.get(NAME_COOKIE)?.value ?? "";

    const realAccountId =
      typeof accountData.id === "number"
        ? accountData.id
        : Number(accountId);

    const ratedResponse = await fetch(
      `https://api.themoviedb.org/3/account/${encodeURIComponent(
        String(realAccountId),
      )}/rated/movies?session_id=${encodeURIComponent(
        sessionId,
      )}&page=1&language=en-US&sort_by=created_at.desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const ratedData =
      await readJSON(ratedResponse);

    return NextResponse.json({
      connected: true,

      account: {
        id: realAccountId,
        username: username || null,
        name: name || null,
      },

      validation: {
        ratedMovies:
          typeof ratedData.total_results === "number"
            ? ratedData.total_results
            : 0,
      },
    });
  } catch {
    return NextResponse.json({
      connected: false,
    });
  }
}
