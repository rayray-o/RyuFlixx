"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  BsBookmarkCheckFill,
  BsBookmarkFill,
} from "react-icons/bs";
import {
  addToast,
} from "@heroui/react";
import IconButton from "./IconButton";
import { Trash } from "@/utils/icons";
import useDeviceVibration from "@/hooks/useDeviceVibration";
import {
  SavedMovieDetails,
} from "@/types/movie";
import {
  addToLocalWatchlist,
  isInLocalWatchlist,
  removeFromLocalWatchlist,
} from "@/utils/localStorage";

interface BookmarkButtonProps {
  data: SavedMovieDetails;
  isTooltipDisabled?: boolean;
}

const BookmarkButton: React.FC<
  BookmarkButtonProps
> = ({
  data,
  isTooltipDisabled,
}) => {
  const {
    startVibration,
  } = useDeviceVibration();

  const [isSaved, setIsSaved] =
    useState(false);

  useEffect(() => {
    const refresh = () => {
      setIsSaved(
        isInLocalWatchlist(
          data.id,
          data.type,
        ),
      );
    };

    refresh();

    window.addEventListener(
      "ryuflix-watchlist-updated",
      refresh,
    );

    window.addEventListener(
      "storage",
      refresh,
    );

    return () => {
      window.removeEventListener(
        "ryuflix-watchlist-updated",
        refresh,
      );

      window.removeEventListener(
        "storage",
        refresh,
      );
    };
  }, [
    data.id,
    data.type,
  ]);

  const handleBookmark =
    () => {
      if (isSaved) {
        removeFromLocalWatchlist(
          data.id,
          data.type,
        );

        setIsSaved(false);

        addToast({
          title: `${data.title} removed from your watchlist!`,
          color: "danger",
          icon: <Trash />,
        });

        return;
      }

      addToLocalWatchlist({
        id: data.id,
        type: data.type,

        adult: data.adult,

        backdrop_path:
          data.backdrop_path,

        poster_path:
          data.poster_path,

        release_date:
          data.release_date,

        title: data.title,

        vote_average:
          data.vote_average,
      });

      setIsSaved(true);

      startVibration([100]);

      addToast({
        title: `${data.title} added to your watchlist!`,
        color: "success",
      });
    };

  return (
    <IconButton
      onPress={handleBookmark}
      icon={
        isSaved ? (
          <BsBookmarkCheckFill
            size={20}
          />
        ) : (
          <BsBookmarkFill
            size={20}
          />
        )
      }
      variant={
        isSaved
          ? "shadow"
          : "faded"
      }
      color="warning"
      tooltip={
        isTooltipDisabled
          ? undefined
          : isSaved
            ? "Remove from Watchlist"
            : "Add to Watchlist"
      }
    />
  );
};

export default BookmarkButton;
