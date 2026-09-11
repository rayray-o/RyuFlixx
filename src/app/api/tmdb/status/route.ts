import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "ryuflix_tmdb_access_token";
const ACCOUNT_OBJECT_COOKIE = "ryuflix_tmdb_account_object_id";
const ACCOUNT_COOKIE = "ryuflix_tmdb_account_id";
const USERNAME_COOKIE = "ryuflix_tmdb_username";
const NAME_COOKIE = "ryuflix_tmdb_name";

function clearConnection(response: NextResponse) {
  for (const cookie of [
    ACCESS_COOKIE,
    ACCOUNT_OBJECT_COOKIE,
    ACCOUNT_COOKIE,
    USERNAME_COOKIE,
    NAME_COOKIE,
    "ryuflix_tmdb_session_id",
  ]) {
    response.cookies.delete(cookie);
  }
}

export async function GET() {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value ?? null;
  const accountObjectId = cookieStore.get(ACCOUNT_OBJECT_COOKIE)?.value ?? null;

  if (!accessToken || !accountObjectId) {
    return NextResponse.json({ connected: false });
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/4/account/${encodeURIComponent(accountObjectId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const result = NextResponse.json({ connected: false });
      clearConnection(result);
      return result;
    }

    const account = (await response.json()) as {
      id?: number;
      username?: string;
      name?: string;
    };

    const ratedResponse = await fetch(
      `https://api.themoviedb.org/4/account/${encodeURIComponent(accountObjectId)}/movie/rated?page=1&language=en-US&sort_by=created_at.desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!ratedResponse.ok) {
      const result = NextResponse.json({ connected: false });
      clearConnection(result);
      return result;
    }

    const rated = (await ratedResponse.json()) as { total_results?: number };
    const storedId = Number(cookieStore.get(ACCOUNT_COOKIE)?.value ?? 0);
    const numericId =
      typeof account.id === "number" && account.id > 0
        ? account.id
        : storedId > 0
          ? storedId
          : null;

    return NextResponse.json({
      connected: true,
      account: {
        id: numericId,
        objectId: accountObjectId,
        username: account.username ?? cookieStore.get(USERNAME_COOKIE)?.value ?? null,
        name: account.name ?? cookieStore.get(NAME_COOKIE)?.value ?? null,
      },
      validation: {
        ratedMovies: typeof rated.total_results === "number" ? rated.total_results : 0,
      },
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
