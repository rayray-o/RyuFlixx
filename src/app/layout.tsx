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
import { SpacingClasses } from "@/utils/constants";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import Script from "next/script";

export const metadata: Metadata = {
  title: siteConfig.name,
  applicationName: siteConfig.name,
  description: siteConfig.description,

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
        {/* 1POP GLOBAL POPUNDER               */}
        {/* ================================= */}

        <Script
          id="1pop-global"
          src="https://1pop.online/ad/serve?zone=ZONE_CA9496D6DAB1774A"
          strategy="afterInteractive"
          type="text/javascript"
          async
          defer
        />

        <Suspense>
          <NuqsAdapter>
            <Providers>
              <MangaParallaxBackground />

              <RyuFlixxIntro />

              <RyuFlixxShell>
                <TopNavbar />

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
