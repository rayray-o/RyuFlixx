import { siteConfig } from "@/config/site";
import { Metadata, NextPage } from "next/types";
import dynamic from "next/dynamic";

const LibraryList = dynamic(
  () => import("@/components/sections/Library/List"),
);

export const metadata: Metadata = {
  title: `Library | ${siteConfig.name}`,
};

const LibraryPage: NextPage = () => {
  return <LibraryList />;
};

export default LibraryPage;
