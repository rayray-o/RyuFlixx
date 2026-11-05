import type { Metadata } from "next";
import dynamic from "next/dynamic";

const LibraryList = dynamic(
  () => import("@/components/sections/Library/List"),
);

export const metadata: Metadata = {
  title: "My Library",
  description:
    "Explore your saved movies and TV shows in your personal Ryuflix library.",
};

const LibraryPage = () => {
  return <LibraryList />;
};

export default LibraryPage;
