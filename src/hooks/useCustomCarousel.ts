
"use client";

import useEmblaCarousel from "embla-carousel-react";
import type {
  EmblaOptionsType,
  EmblaPluginType,
} from "embla-carousel";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

export const useCustomCarousel = (
  options?: EmblaOptionsType,
  plugins?: EmblaPluginType[],
) => {
  const [emblaRef, embla] = useEmblaCarousel(
    options,
    plugins,
  );

  const [canScrollNext, setCanScrollNext] = useState(false);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const updateState = useCallback(() => {
    if (!embla) return;

    setCanScrollPrev(embla.canScrollPrev());
    setCanScrollNext(embla.canScrollNext());
    setSelectedIndex(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;

    updateState();

    embla.on("select", updateState);
    embla.on("reInit", updateState);

    return () => {
      embla.off("select", updateState);
      embla.off("reInit", updateState);
    };
  }, [embla, updateState]);

  const scrollTo = useCallback(
    (index: number) => embla?.scrollTo(index),
    [embla],
  );

  const scrollPrev = useCallback(
    () => embla?.scrollPrev(),
    [embla],
  );

  const scrollNext = useCallback(
    () => embla?.scrollNext(),
    [embla],
  );

  return {
    emblaRef,
    scrollTo,
    scrollNext,
    scrollPrev,
    selectedIndex,
    canScrollNext,
    canScrollPrev,
  };
};
