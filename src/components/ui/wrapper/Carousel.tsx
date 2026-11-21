
"use client";

import { useCustomCarousel } from "@/hooks/useCustomCarousel";
import { ScrollShadow } from "@heroui/react";
import IconButton from "../button/IconButton";
import type {
  EmblaOptionsType,
  EmblaPluginType,
} from "embla-carousel";
import { cn } from "@/utils/helpers";
import styles from "@/styles/embla-carousel.module.css";
import { ChevronLeft, ChevronRight } from "@/utils/icons";

export interface CarouselProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  withScrollShadow?: boolean;
  isButtonDisabled?: boolean;
  autoHideButton?: boolean;
  options?: EmblaOptionsType;
  plugins?: EmblaPluginType[];
  classNames?: {
    container?: string;
    viewport?: string;
    wrapper?: string;
  };
}

const Carousel = ({
  children,
  withScrollShadow = true,
  isButtonDisabled = false,
  autoHideButton = true,
  options = { dragFree: true, slidesToScroll: "auto" },
  plugins,
  classNames,
  ...props
}: CarouselProps) => {
  const c = useCustomCarousel(options, plugins);

  const getVisibility = () => {
    if (c.canScrollPrev && c.canScrollNext) return "both";
    if (c.canScrollPrev) return "left";
    if (c.canScrollNext) return "right";
    return "none";
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(
        "input, textarea, select, [contenteditable='true']",
      )
    ) {
      return;
    }

    if (event.key === "ArrowRight" && c.canScrollNext) {
      event.preventDefault();
      c.scrollNext();
    } else if (
      event.key === "ArrowLeft" &&
      c.canScrollPrev
    ) {
      event.preventDefault();
      c.scrollPrev();
    }
  };

  return (
    <ScrollShadow
      isEnabled={withScrollShadow}
      orientation="horizontal"
      visibility={getVisibility()}
      size={40}
      hideScrollBar
    >
      <div
        {...props}
        className={cn(styles.wrapper, classNames?.wrapper, {
          "relative flex w-full flex-col justify-center":
            !isButtonDisabled,
        })}
      >
        {!isButtonDisabled && (
          <>
            <div
              className={cn("absolute z-10 h-full", {
                "hidden md:block": autoHideButton,
              })}
            >
              <IconButton
                onPress={c.scrollPrev}
                size="lg"
                radius="none"
                disableRipple
                icon={<ChevronLeft size={24} />}
                className={cn("h-full bg-transparent", {
                  hidden: !c.canScrollPrev,
                })}
              />
            </div>

            <div
              className={cn(
                "absolute z-10 h-full place-self-end",
                {
                  "hidden md:block": autoHideButton,
                },
              )}
            >
              <IconButton
                onPress={c.scrollNext}
                size="lg"
                radius="none"
                disableRipple
                icon={<ChevronRight size={24} />}
                className={cn("h-full bg-transparent", {
                  hidden: !c.canScrollNext,
                })}
              />
            </div>
          </>
        )}

        <div
          ref={c.emblaRef}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Media carousel"
          onKeyDown={handleKeyDown}
          className={cn(
            styles.viewport,
            "outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            classNames?.viewport,
          )}
        >
          <div
            className={cn(
              styles.container,
              classNames?.container,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </ScrollShadow>
  );
};

export default Carousel;
