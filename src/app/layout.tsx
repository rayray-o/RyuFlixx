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
    icon: `${siteConfig.favicon}?v=20260906`,
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
        {/* POPADS ANTI-ADBLOCK GLOBAL         */}
        {/* ================================= */}

        <Script
          id="popads-global"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              /*<![CDATA[/* */
              (function(){var h=window,a="b94baacd0f42e920a031d6b4501ecd21",o=[["siteId",710+199-699-599-834+5319580],["minBid",0],["popundersPerIP","0"],["delayBetween",0],["default",false],["defaultPerDay",0],["topmostLayer","auto"]],b=["d3d3LnByZW1pdW12ZXJ0aXNpbmcuY29tL0N5L3VrblZpcC9mYm9vdHN0cmFwLWRhdGV0aW1lcGlja2VyLm1pbi5qcw==","ZDJqMDQyY2oxNDIxd2kuY2xvdWRmcm9udC5uZXQvcWpxdWVyeS5QcmludEFyZWEubWluLmpz"],d=-1,y,z,g=function(){clearTimeout(z);d++;if(b[d]&&!(1814686616000<(new Date).getTime()&&1<d)){y=h.document.createElement("script");y.type="text/javascript";y.async=!0;var i=h.document.getElementsByTagName("script")[0];y.src="https://"+atob(b[d]);y.crossOrigin="anonymous";y.onerror=g;y.onload=function(){clearTimeout(z);h[a.slice(0,16)+a.slice(0,16)]||g()};z=setTimeout(g,5E3);i.parentNode.insertBefore(y,i)}};if(!h[a]){try{Object.freeze(h[a]=o)}catch(e){}g()}})();
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
