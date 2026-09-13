import { NextRequest, NextResponse } from "next/server";

const SIMKL_TOKEN_URL =
  "https://api.simkl.com/oauth/token";

export async function GET(
  request: NextRequest,
) {
  const code =
    request.nextUrl.searchParams.get(
      "code",
    );

  const returnedState =
    request.nextUrl.searchParams.get(
      "state",
    );

  const savedState =
    request.cookies.get(
      "ryuflix_simkl_oauth_state",
    )?.value;

  if (!code) {
    return NextResponse.json(
      {
        error:
          "Simkl authorization code missing.",
      },
      { status: 400 },
    );
  }

  if (
    !returnedState ||
    !savedState ||
    returnedState !== savedState
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid Simkl OAuth state.",
      },
      { status: 400 },
    );
  }

  const clientId =
    process.env.SIMKL_CLIENT_ID;

  const clientSecret =
    process.env.SIMKL_CLIENT_SECRET;

  const redirectUri =
    process.env.SIMKL_REDIRECT_URI;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    return NextResponse.json(
      {
        error:
          "Simkl OAuth environment variables are missing.",
      },
      { status: 500 },
    );
  }

  const response = await fetch(
    SIMKL_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Accept:
          "application/json",
        "User-Agent":
          "RyuFlix/1.0",
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret:
          clientSecret,
        redirect_uri:
          redirectUri,
        grant_type:
          "authorization_code",
      }),
      cache: "no-store",
    },
  );

  const data =
    await response.json().catch(
      () => null,
    );

  if (
    !response.ok ||
    !data ||
    typeof data.access_token !==
      "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Simkl token exchange failed.",
      },
      { status: 502 },
    );
  }

  const result =
    NextResponse.redirect(
      new URL(
        "/personalize?simkl=connected",
        request.url,
      ),
    );

  result.cookies.set({
    name:
      "ryuflix_simkl_access_token",
    value: data.access_token,
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "lax",
    path: "/",
    maxAge:
      typeof data.expires_in ===
      "number"
        ? data.expires_in
        : 157680000,
  });

  result.cookies.delete(
    "ryuflix_simkl_oauth_state",
  );

  return result;
      }
