"use client";

import { siteConfig } from "@/config/site";
import clsx from "clsx";
import { Link } from "@heroui/link";
import { usePathname } from "next/navigation";
import { Chip } from "@heroui/chip";

const BottomNavbar = () => {
  const pathName = usePathname();

  const hrefs = siteConfig.navItems.map(
    (item) => item.href,
  );

  const show = hrefs.includes(pathName);

  if (!show) {
    return null;
  }

  return (
    <>
      {/* Reserve space so page content isn't hidden behind the navbar. */}
      <div
        className="md:hidden"
        style={{
          height:
            "calc(5rem + env(safe-area-inset-bottom, 0px))",
        }}
      />

      <nav
        className="fixed bottom-0 left-0 z-50 block w-full border-t border-secondary-background bg-background md:hidden"
        style={{
          paddingTop: "0.5rem",
          paddingBottom:
            "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto grid h-full max-w-lg grid-cols-5">
          {siteConfig.navItems.map((item) => {
            const isActive =
              pathName === item.href;

            return (
              <Link
                href={item.href}
                key={item.href}
                className="flex min-w-0 items-center justify-center text-foreground"
              >
                <div className="flex max-h-[50px] min-w-0 flex-col items-center justify-center">
                  <Chip
                    size="lg"
                    variant={
                      isActive ? "solid" : "light"
                    }
                    classNames={{
                      base: "py-[2px] transition-all",
                      content: "size-full",
                    }}
                  >
                    {isActive
                      ? item.activeIcon
                      : item.icon}
                  </Chip>

                  <p
                    className={clsx(
                      "text-[10px] leading-tight",
                      {
                        "font-bold": isActive,
                      },
                    )}
                  >
                    {item.label}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default BottomNavbar;
