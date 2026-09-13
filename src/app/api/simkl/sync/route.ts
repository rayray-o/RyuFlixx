import { NextRequest, NextResponse } from "next/server";
import {
  getInitialSimklLibrary,
  getSimklActivities,
  getSimklDelta,
} from "@/utils/personalization/simkl";

const TOKEN_COOKIE =
  "ryuflix_simkl_access_token";

const ACTIVITY_COOKIE =
  "ryuflix_simkl_activity";

type SavedActivities = Record<
  string,
  string
>;

function parseActivities(
  value: string | undefined,
): SavedActivities {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      typeof parsed === "object"
    ) {
      return parsed as SavedActivities;
    }
  } catch {
    // Ignore malformed saved state.
  }

  return {};
}

function normalizeActivities(
  activities: Record<
    string,
    unknown
  >,
): SavedActivities {
  const result: SavedActivities = {};

  for (const [
    key,
    value,
  ] of Object.entries(activities)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }

  return result;
}

function activitiesChanged(
  previous: SavedActivities,
  current: SavedActivities,
) {
  const keys = new Set([
    ...Object.keys(previous),
    ...Object.keys(current),
  ]);

  for (const key of keys) {
    if (
      previous[key] !==
      current[key]
    ) {
      return true;
    }
  }

  return false;
}

export async function POST(
  request: NextRequest,
) {
  const token =
    request.cookies.get(
      TOKEN_COOKIE,
    )?.value;

  if (!token) {
    return NextResponse.json(
      {
        error:
          "Simkl is not connected.",
      },
      { status: 401 },
    );
  }

  try {
    const previousActivities =
      parseActivities(
        request.cookies.get(
          ACTIVITY_COOKIE,
        )?.value,
      );

    /*
     * Always check activities first.
     */
    const activities =
      await getSimklActivities(
        token,
      );

    const currentActivities =
      normalizeActivities(
        activities,
      );

    /*
     * No saved timestamp means
     * this is the first synchronization.
     */
    const hasPreviousSync =
      Object.keys(
        previousActivities,
      ).length > 0;

    let syncType:
      | "initial"
      | "delta"
      | "unchanged";

    let data: unknown;

    if (!hasPreviousSync) {
      /*
       * Initial sync:
       * Simkl explicitly recommends
       * pulling shows, movies and anime
       * separately and sequentially.
       */
      syncType = "initial";

      data =
        await getInitialSimklLibrary(
          token,
        );
    } else if (
      activitiesChanged(
        previousActivities,
        currentActivities,
      )
    ) {
      /*
       * Something changed since the
       * previous synchronization.
       */
      const dateFrom =
        Object.values(
          previousActivities,
        )
          .filter(Boolean)
          .sort()[0];

      if (!dateFrom) {
        syncType = "initial";

        data =
          await getInitialSimklLibrary(
            token,
          );
      } else {
        syncType = "delta";

        data =
          await getSimklDelta(
            token,
            dateFrom,
          );
      }
    } else {
      /*
       * Nothing changed.
       * Do not download the library again.
       */
      syncType = "unchanged";
      data = null;
    }

    const response =
      NextResponse.json({
        ok: true,
        syncType,
        activities:
          currentActivities,
        data,
      });

    /*
     * Save the exact activity snapshot
     * returned by Simkl.
     */
    response.cookies.set({
      name: ACTIVITY_COOKIE,
      value:
        JSON.stringify(
          currentActivities,
        ),
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge:
        60 * 60 * 24 * 365,
    });

    return response;
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status ===
        "number"
        ? error.status
        : 500;

    if (status === 401) {
      return NextResponse.json(
        {
          error:
            "Simkl authorization expired. Please reconnect.",
        },
        { status: 401 },
      );
    }

    console.error(
      "Simkl sync failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Simkl synchronization failed.",
      },
      { status: 500 },
    );
  }
        }
