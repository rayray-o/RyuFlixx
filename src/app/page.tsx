import CinematicHome from "@/components/sections/Home/CinematicHome";
import { siteConfig } from "@/config/site";

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Ryuflix",
  alternateName: ["RyuFlix", "RyuFlixx"],
  url: "https://ryuflix.vercel.app/",
  description: siteConfig.description,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteStructuredData).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />

      <CinematicHome />
    </>
  );
}
