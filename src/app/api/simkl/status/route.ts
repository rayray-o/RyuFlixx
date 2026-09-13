import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    "ryuflix_simkl_access_token",
  )?.value;

  return NextResponse.json(
    {
      connected: Boolean(token),
    },
    {
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    },
  );
}
