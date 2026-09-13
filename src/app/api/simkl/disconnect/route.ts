import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAMES = [
  "ryuflix_simkl_access_token",
  "ryuflix_simkl_oauth_state",
  "ryuflix_simkl_activity",
];

export async function POST() {
  const cookieStore = await cookies();

  for (const name of COOKIE_NAMES) {
    cookieStore.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return NextResponse.json({
    success: true,
    connected: false,
  });
}
