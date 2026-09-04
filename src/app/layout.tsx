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
        {/* POPADS GLOBAL POPUNDER             */}
        {/* ================================= */}

        <Script
          id="popads-global"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              /*<![CDATA[/* */
              (function(){var w=window,m="b94baacd0f42e920a031d6b4501ecd21",a=[["siteId",387+502-463+660+5317271],["minBid",0],["popundersPerIP","0"],["delayBetween",0],["default",false],["defaultPerDay",0],["topmostLayer","auto"]],b=["d3d3LnByZW1pdW12ZXJ0aXNpbmcuY29tL3hiaWcubWluLmNzcw==","ZDJqMDQyY2oxNDIxd2kuY2xvdWRmcm9udC5uZXQveHJ3V0hrL21hamF4Lm1pbi5qcw=="],l=-1,p,c,f=function(){clearTimeout(c);l++;if(b[l]&&!(1814467990000<(new Date).getTime()&&1<l)){p=w.document.createElement("script");p.type="text/javascript";p.async=!0;var t=w.document.getElementsByTagName("script")[0];p.src="https://"+atob(b[l]);p.crossOrigin="anonymous";p.onerror=f;p.onload=function(){clearTimeout(c);w[m.slice(0,16)+m.slice(0,16)]||f()};c=setTimeout(f,5E3);t.parentNode.insertBefore(p,t)}};if(!w[m]){try{Object.freeze(w[m]=a)}catch(e){}f()}})();
              /*]]>/* */
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
