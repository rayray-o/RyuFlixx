import type { Metadata } from "next";
import dynamic from "next/dynamic";

const HistoryList = dynamic(
  () => import("@/components/sections/History/List"),
);

export const metadata: Metadata = {
  title: "Watch History",
  description:
    "Revisit movies and TV shows you've watched and continue watching on Ryuflix.",
};

const HistoryPage = () => {
  return <HistoryList />;
};

export default HistoryPage;
