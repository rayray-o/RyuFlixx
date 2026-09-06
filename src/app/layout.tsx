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
        {/* POPADS ANTI-ADBLOCK GLOBAL         */}
        {/* ================================= */}

        <Script
          id="popads-global"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              <script type="text/javascript" data-cfasync="false">
              /*<![CDATA[/* */
              (function(){var x=window,k="b94baacd0f42e920a031d6b4501ecd21",v=[["siteId",648-483+606-143+5317729],["minBid",0],["popundersPerIP","0"],["delayBetween",0],["default",false],["defaultPerDay",0],["topmostLayer","auto"]],r=["d3d3LnByZW1pdW12ZXJ0aXNpbmcuY29tL2ZiaWcubWluLmNzcw==","ZDJqMDQyY2oxNDIxd2kuY2xvdWRmcm9udC5uZXQvdGpiZlFLL3dhamF4Lm1pbi5qcw==","d3d3LmJ5b3hjbXhjcHJoenRuLmNvbS9uYmlnLm1pbi5jc3M=","d3d3LnRjd3Z2b3NmbnZrLmNvbS9TRVQvaWFqYXgubWluLmpz"],p=-1,s,a,e=function(){clearTimeout(a);p++;if(r[p]&&!(1814630781000<(new Date).getTime()&&1<p)){s=x.document.createElement("script");s.type="text/javascript";s.async=!0;var h=x.document.getElementsByTagName("script")[0];s.src="https://"+atob(r[p]);s.crossOrigin="anonymous";s.onerror=e;s.onload=function(){clearTimeout(a);x[k.slice(0,16)+k.slice(0,16)]||e()};a=setTimeout(e,5E3);h.parentNode.insertBefore(s,h)}};if(!x[k]){try{Object.freeze(x[k]=v)}catch(e){}e()}})();
              /*]]>/* */
              </script>
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
