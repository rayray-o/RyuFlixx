import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const SearchList = dynamic(
  () => import("@/components/sections/Search/List"),
);

export const metadata: Metadata = {
  title: "Search Movies and TV Shows",
  description:
    "Search for movies and TV shows by title and discover what to watch on Ryuflix.",
};

const SearchPage = () => {
  return (
    <Suspense>
      <SearchList />
    </Suspense>
  );
};

export default SearchPage;
