import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const DiscoverListGroup = dynamic(
  () => import("@/components/sections/Discover/ListGroup"),
);

export const metadata: Metadata = {
  title: "Discover Movies and TV Shows",
  description:
    "Discover trending, popular, upcoming and top-rated movies and TV shows on Ryuflix.",
};

const DiscoverPage = () => {
  return (
    <Suspense>
      <DiscoverListGroup />
    </Suspense>
  );
};

export default DiscoverPage;
