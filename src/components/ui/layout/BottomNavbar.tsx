
"use client";

import { siteConfig } from "@/config/site";
import clsx from "clsx";
import { Link } from "@heroui/link";
import { usePathname } from "next/navigation";
import { Chip } from "@heroui/chip";

const BottomNavbar = () => {
  const pathName = usePathname();

  const hrefs = siteConfig.navItems.map((item) => item.href);
  const show = hrefs.includes(pathName);

  if (!show) return null;

  const bottomNavItems = siteConfig.navItems.filter(
    (item) => item.href !== "/personalize",
  );

  return (
    <>
      {/* Reserve space for the fixed navbar on every screen size. */}
      <div
        aria-hidden="true"
        className="h-[calc(5rem+env(safe-area-inset-bottom,0px))] md:h-24 2xl:h-28"
      />

      <nav
        aria-label="Main navigation"
        className={clsx(
          "fixed inset-x-0 bottom-0 z-[60] w-full",
          "border-t border-white/[0.08]",
          "bg-black/85 text-white backdrop-blur-2xl",
          "shadow-[0_-12px_40px_rgba(0,0,0,0.28)]",
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="mx-auto flex h-20 w-full max-w-5xl items-center justify-around px-2 md:h-24 md:px-8 2xl:h-28 2xl:max-w-7xl 2xl:px-12">
          {bottomNavItems.map((item) => {
            const isActive = pathName === item.href;

            return (
              <Link
                href={item.href}
                key={item.href}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "group flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1",
                  "rounded-xl text-white/50 transition-all duration-200",
                  "hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive && "text-white",
                )}
              >
                <span
                  className={clsx(
                    "flex size-10 items-center justify-center rounded-xl transition-all duration-200",
                    "md:size-12 2xl:size-14",
                    isActive
                      ? "bg-white/[0.12] text-white"
                      : "group-hover:bg-white/[0.07]",
                  )}
                >
                  <span className="size-[21px] md:size-6 2xl:size-7">
                    {isActive ? item.activeIcon : item.icon}
                  </span>
                </span>

                <span
                  className={clsx(
                    "text-[10px] leading-none transition-colors md:text-xs 2xl:text-sm",
                    isActive
                      ? "font-semibold text-white"
                      : "font-medium text-white/50 group-hover:text-white/85",
                  )}
                >
                  {item.label}
                </span>

                {isActive && (
                  <span className="absolute bottom-0 h-[2px] w-8 rounded-full bg-primary md:w-10" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default BottomNavbar;
