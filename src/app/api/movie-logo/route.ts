import { NextRequest, NextResponse } from "next/server";
import { env } from "@/utils/env";

export async function GET(request: NextRequest) {
  const movieId = request.nextUrl.searchParams.get("id");

  if (!movieId || !/^\d+$/.test(movieId)) {
    return NextResponse.json({ logo: null }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/images?include_image_language=en,null`,
      {
        headers: {
          Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
          accept: "application/json",
        },
        next: {
          revalidate: 86400,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json({ logo: null });
    }

    const data = await response.json();

    const logos = Array.isArray(data.logos) ? data.logos : [];

    const englishLogo =
      logos.find((logo: { iso_639_1?: string | null }) => logo.iso_639_1 === "en") ??
      logos.find((logo: { iso_639_1?: string | null }) => logo.iso_639_1 === null) ??
      logos[0];

    if (!englishLogo?.file_path) {
      return NextResponse.json({ logo: null });
    }

    return NextResponse.json({
      logo: `https://image.tmdb.org/t/p/original${englishLogo.file_path}`,
    });
  } catch {
    return NextResponse.json({ logo: null });
  }
}
