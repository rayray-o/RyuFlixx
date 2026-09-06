import { siteConfig } from "@/config/site";
import { Metadata, NextPage } from "next/types";
import dynamic from "next/dynamic";

const HistoryList = dynamic(
  () => import("@/components/sections/History/List"),
);

export const metadata: Metadata = {
  title: `History | ${siteConfig.name}`,
};

const HistoryPage: NextPage = () => {
  return <HistoryList />;
};

export default HistoryPage;
