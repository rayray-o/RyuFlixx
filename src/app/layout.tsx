import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import { Poppins } from "@/utils/fonts";
import "../styles/globals.css";
import "../styles/lightbox.css";
import Providers from "./providers";
import TopNavbar from "@/components/ui/layout/TopNavbar";
import BottomNavbar from "@/components/ui/layout/BottomNavbar";
import Sidebar from "@/components/ui/layout/Sidebar";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/utils/helpers";
import MangaParallaxBackground from "@/components/ui/background/MangaParallaxBackground";
import RyuFlixxIntro from "@/components/ui/RyuFlixxIntro";
import RyuFlixxShell from "@/components/ui/RyuFlixxShell";
import {
  IS_PRODUCTION,
  SpacingClasses,
} from "@/utils/constants";
import dynamic from "next/dynamic";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import Script from "next/script";

const Disclaimer = dynamic(
  () => import("@/components/ui/overlay/Disclaimer")
);

export const metadata: Metadata = {
  title: siteConfig.name,
  applicationName: siteConfig.name,
  description: siteConfig.description,

  // PopCash website verification
  other: {
    "ppck-ver": "613a3e2816304fb4feddee393bc97d67",
  },

  manifest: "/manifest.json",

  icons: {
    icon: siteConfig.favicon,
  },

  twitter: {
    card: "summary",
    title: {
      default: siteConfig.name,
      template: siteConfig.name,
    },
    description: siteConfig.description,
  },

  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: {
      default: siteConfig.name,
      template: siteConfig.name,
    },
    description: siteConfig.description,
  },

  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#FFFFFF",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#0D0C0F",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
    >
      <body
        className={cn(
          "antialiased select-none",
          Poppins.className
        )}
      >
        {/* ================================= */}
        {/* POPCASH GLOBAL POPUNDER           */}
        {/* ================================= */}

        <Script
          id="popcash-ad-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              var uid = '504751';
              var wid = '757325';
              var pop_tag = document.createElement('script');
              pop_tag.src = '//cdn.popcash.net/show.js';
              document.body.appendChild(pop_tag);

              pop_tag.onerror = function() {
                pop_tag = document.createElement('script');
                pop_tag.src = '//cdn2.popcash.net/show.js';
                document.body.appendChild(pop_tag);
              };
            `,
          }}
        />

        <Suspense>
          <NuqsAdapter>
            <Providers>
              <MangaParallaxBackground />

              <RyuFlixxIntro />

              <RyuFlixxShell>
                {IS_PRODUCTION && (
                  <Disclaimer />
                )}

                <TopNavbar />

                {/* ================================= */}
                {/* AADS GLOBAL AD UNIT 2453236       */}
                {/* ================================= */}

                <div
                  id="aads-2453236"
                  style={{
                    width: "100%",
                    margin: "10px auto",
                    position: "relative",
                    zIndex: 99998,
                  }}
                >
                  <iframe
                    data-aa="2453236"
                    src="https://acceptable.a-ads.com/2453236/?size=Adaptive"
                    style={{
                      border: 0,
                      padding: 0,
                      width: "70%",
                      height: "auto",
                      minHeight: "90px",
                      overflow: "hidden",
                      display: "block",
                      margin: "auto",
                    }}
                    title="Advertisement"
                    loading="lazy"
                  />
                </div>

                {/* ================================= */}

                <Sidebar>
                  <main
                    className={cn(
                      "relative z-10 container mx-auto max-w-full",
                      SpacingClasses.main
                    )}
                  >
                    {children}
                  </main>
                </Sidebar>

                <BottomNavbar />
              </RyuFlixxShell>
            </Providers>
          </NuqsAdapter>
        </Suspense>

        <SpeedInsights debug={false} />

        <Analytics debug={false} />
      </body>
    </html>
  );
  }
