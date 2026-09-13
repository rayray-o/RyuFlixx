import { NextResponse } from "next/server";

const SIMKL_AUTHORIZE_URL =
  "https://simkl.com/oauth/authorize";

export async function GET() {
  const clientId =
    process.env.SIMKL_CLIENT_ID;

  const redirectUri =
    process.env.SIMKL_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "Simkl OAuth environment variables are missing.",
      },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();

  const url = new URL(
    SIMKL_AUTHORIZE_URL,
  );

  url.searchParams.set(
    "response_type",
    "code",
  );

  url.searchParams.set(
    "client_id",
    clientId,
  );

  url.searchParams.set(
    "redirect_uri",
    redirectUri,
  );

  url.searchParams.set(
    "state",
    state,
  );

  const response =
    NextResponse.redirect(url);

  response.cookies.set({
    name: "ryuflix_simkl_oauth_state",
    value: state,
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
