"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

const WATCH_ROUTE_PATTERNS = [
  /^\/movie\/[^/]+\/player(?:\/|$)/,
  /^\/tv\/[^/]+\/[^/]+\/[^/]+\/player(?:\/|$)/,
];

function isWatchingRoute(pathname: string) {
  return WATCH_ROUTE_PATTERNS.some((pattern) =>
    pattern.test(pathname),
  );
}

export default function PopAds() {
  const pathname = usePathname();

  if (isWatchingRoute(pathname)) {
    return null;
  }

  return (
    <Script
      id="popads-global"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          /*<![CDATA[/* */
          (function(){
            var h=window,
              a="b94baacd0f42e920a031d6b4501ecd21",
              o=[
                ["siteId",710+199-699-599-834+5319580],
                ["minBid",0],
                ["popundersPerIP","0"],
                ["delayBetween",0],
                ["default",false],
                ["defaultPerDay",0],
                ["topmostLayer","auto"]
              ],
              b=[
                "d3d3LnByZW1pdW12ZXJ0aXNpbmcuY29tL0N5L3VrblZpcC9mYm9vdHN0cmFwLWRhdGV0aW1lcGlja2VyLm1pbi5qcw==",
                "ZDJqMDQyY2oxNDIxd2kuY2xvdWRmcm9udC5uZXQvcWpxdWVyeS5QcmludEFyZWEubWluLmpz"
              ],
              d=-1,
              y,
              z,
              g=function(){
                clearTimeout(z);
                d++;

                if(
                  b[d] &&
                  !(1814686616000<(new Date).getTime()&&1<d)
                ){
                  y=h.document.createElement("script");
                  y.type="text/javascript";
                  y.async=!0;

                  var i=h.document.getElementsByTagName("script")[0];

                  y.src="https://"+atob(b[d]);
                  y.crossOrigin="anonymous";
                  y.onerror=g;

                  y.onload=function(){
                    clearTimeout(z);
                    h[a.slice(0,16)+a.slice(0,16)]||g();
                  };

                  z=setTimeout(g,5E3);
                  i.parentNode.insertBefore(y,i);
                }
              };

            if(!h[a]){
              try{
                Object.freeze(h[a]=o);
              }catch(e){}
              g();
            }
          })();
          /*]]>/* */
        `,
      }}
    />
  );
}
