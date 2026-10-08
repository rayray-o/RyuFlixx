"use client";

import BackButton from "@/components/ui/button/BackButton";
import { siteConfig } from "@/config/site";
import { cn } from "@/utils/helpers";
import {
  Button,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/react";
import { useWindowScroll } from "@mantine/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import FullscreenToggleButton from "../button/FullscreenToggleButton";
import SearchInput from "../input/SearchInput";
import ThemeSwitchDropdown from "../input/ThemeSwitchDropdown";
import BrandLogo from "../other/BrandLogo";

const TopNavbar = () => {
  const pathName = usePathname();
  const [{ y }] = useWindowScroll();

  const hrefs = siteConfig.navItems.map(
    (item) => item.href,
  );

  const show =
    hrefs.includes(pathName) ||
    pathName === "/personalize";

  const home = pathName === "/";
  const tv = pathName.includes("/tv/");
  const player = pathName.includes("/player");

  const personalizeItem =
    siteConfig.navItems.find(
      (item) => item.href === "/personalize",
    );

  const personalizeActive =
    pathName === "/personalize";

  if (player) {
    return null;
  }

  const pageOpacity = Math.min(
    (y / 700) * 2.5,
    1,
  );

  return (
    <Navbar
      disableScrollHandler
      isBlurred={false}
      position="sticky"
      maxWidth="full"
      classNames={{
        wrapper: "px-3 md:px-5",
      }}
      className={cn(
        "z-50 h-min bg-transparent transition-colors duration-500",
        home
          ? "absolute inset-x-0 top-0"
          : "inset-0",
        !home &&
          show &&
          "bg-background",
      )}
    >
      {!home && !show && (
        <div
          className="absolute inset-0 -z-10 border-b border-background bg-background"
          style={{
            opacity: pageOpacity,
          }}
        />
      )}

      <NavbarBrand>
        {show || home ? (
          <BrandLogo />
        ) : (
          <BackButton
            href={
              tv
                ? "/?content=tv"
                : "/"
            }
          />
        )}
      </NavbarBrand>

      {!home &&
        show &&
        !pathName.startsWith("/search") && (
          <NavbarContent
            className="hidden w-full max-w-lg gap-2 md:flex"
            justify="center"
          >
            <NavbarItem className="w-full">
              <Link
                href="/search"
                className="w-full"
              >
                <SearchInput
                  className="pointer-events-none"
                  placeholder="Search your favorite movies..."
                />
              </Link>
            </NavbarItem>
          </NavbarContent>
        )}

      <NavbarContent justify="end">
        <NavbarItem className="flex gap-1">
          {personalizeItem && (
            <Link
              href={personalizeItem.href}
              aria-label="Personalize RyuFlix"
            >
              <Button
                isIconOnly
                variant="light"
                className={cn(
                  "p-2 text-white hover:bg-white/10",
                  personalizeActive &&
                    "text-primary",
                )}
              >
                {personalizeActive
                  ? personalizeItem.activeIcon
                  : personalizeItem.icon}
              </Button>
            </Link>
          )}

          <div className="text-white [&_button]:text-white [&_button:hover]:bg-white/10">
            <ThemeSwitchDropdown />
          </div>

          <div className="text-white [&_button]:text-white [&_button:hover]:bg-white/10">
            <FullscreenToggleButton />
          </div>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};

export default TopNavbar;
