import { NextResponse } from "next/server";

import {
  getAniListAnimeByMalId,
} from "@/api/anilist";

export const dynamic =
  "force-dynamic";

export const revalidate = 300;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  _request: Request,
  {
    params,
  }: RouteContext,
) {
  const { id } =
    await params;

  const malId =
    Number(id);

  if (
    !Number.isInteger(
      malId,
    ) ||
    malId <= 0
  ) {
    return NextResponse.json(
      {
        airingAt: null,
        episode: null,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const anime =
      await getAniListAnimeByMalId(
        malId,
      );

    const next =
      anime?.nextAiringEpisode;

    if (
      next?.airingAt &&
      next?.episode &&
      Number.isFinite(
        next.airingAt,
      ) &&
      Number.isFinite(
        next.episode,
      )
    ) {
      return NextResponse.json({
        airingAt:
          next.airingAt,

        episode:
          next.episode,
      });
    }

    return NextResponse.json({
      airingAt: null,
      episode: null,
    });
  } catch (error) {
    console.error(
      "[RyuFlix] Airing endpoint failed:",
      error,
    );

    return NextResponse.json(
      {
        airingAt: null,
        episode: null,
      },
      {
        status: 502,
      },
    );
  }
}
