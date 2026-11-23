
"use client";

import ContentTypeSelection from "@/components/ui/other/ContentTypeSelection";
import dynamic from "next/dynamic";
import {
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";

const ForYou = dynamic(
  () => import("@/components/sections/Home/ForYou"),
);

const GeneratedRows = dynamic(
  () => import("@/components/sections/Home/GeneratedRows"),
);

const HomePageList: React.FC = () => {
  const [content] = useQueryState(
    "content",
    parseAsStringLiteral([
      "movie",
      "tv",
    ]).withDefault("movie"),
  );

  return (
    <div className="flex flex-col gap-12">
      <ContentTypeSelection
        className="justify-center"
      />

      <div
        className={`relative flex min-h-32 flex-col ${
          content === "tv"
            ? "gap-4"
            : "gap-12"
        }`}
      >
        <ForYou type={content} />

        <GeneratedRows type={content} />
      </div>
    </div>
  );
};

export default HomePageList;
