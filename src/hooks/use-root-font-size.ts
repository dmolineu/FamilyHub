import { useEffect, useState } from "react";

const BROWSER_DEFAULT_PX = 16;

function readRootFontSize(): number {
  const size = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  return Number.isFinite(size) && size > 0 ? size : BROWSER_DEFAULT_PX;
}

/**
 * The page's base text size (1rem) in pixels. The wall display mode ties it to the
 * screen's width, so a layout that has to fit text into a pixel-sized box (an event in
 * an hour grid) reads it here and follows it on resize.
 */
export function useRootFontSize(): number {
  const [size, setSize] = useState(readRootFontSize);

  useEffect(() => {
    const update = () => setSize(readRootFontSize());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}
