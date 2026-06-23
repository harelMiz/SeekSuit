import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { fetchColors, addColor, type CustomColor } from "../services/color.service";
import { COLOR_LABELS, colorDisplay as staticDisplay } from "../lib/colorMap";

// Hex values for the built-in static colors (used for swatches).
const STATIC_HEX: Record<string, string> = {
  BLACK: "#1a1a1a",       LIGHT_BLACK: "#3d3d3d",  DARK_BLACK: "#000000",
  WHITE: "#f5f5f5",       LIGHT_WHITE: "#ffffff",   DARK_WHITE: "#e0e0e0",
  BROWN: "#795548",       LIGHT_BROWN: "#a1887f",   DARK_BROWN: "#4e342e",
  RED: "#e53935",         LIGHT_RED: "#ef9a9a",     DARK_RED: "#b71c1c",
  GRAY: "#9e9e9e",        LIGHT_GRAY: "#e0e0e0",    DARK_GRAY: "#424242",
  SKY_BLUE: "#81d4fa",    LIGHT_SKY_BLUE: "#b3e5fc",DARK_SKY_BLUE: "#0288d1",
  YELLOW: "#fdd835",      LIGHT_YELLOW: "#fff176",  DARK_YELLOW: "#f9a825",
  CREAM: "#f5e6c8",       LIGHT_CREAM: "#fdf6e3",   DARK_CREAM: "#e8d5a3",
  IVORY: "#fffff0",       LIGHT_IVORY: "#fffff5",   DARK_IVORY: "#f5f5dc",
  PURPLE: "#7b1fa2",      LIGHT_PURPLE: "#ba68c8",  DARK_PURPLE: "#4a148c",
  NAVY: "#1565c0",        LIGHT_NAVY: "#64b5f6",    DARK_NAVY: "#0d47a1",
  ORANGE: "#fb8c00",      LIGHT_ORANGE: "#ffcc80",  DARK_ORANGE: "#e65100",
  GREEN: "#43a047",       LIGHT_GREEN: "#a5d6a7",   DARK_GREEN: "#1b5e20",
  OLIVE: "#827717",       LIGHT_OLIVE: "#c5e1a5",   DARK_OLIVE: "#33691e",
  PINK: "#ec407a",        LIGHT_PINK: "#f48fb1",    DARK_PINK: "#c2185b",
  BURGUNDY: "#880e4f",    LIGHT_BURGUNDY: "#f06292",DARK_BURGUNDY: "#560027",
  TURQUOISE: "#00acc1",   LIGHT_TURQUOISE: "#80deea",DARK_TURQUOISE:"#006064",
  BEIGE: "#d7ccc8",       LIGHT_BEIGE: "#efebe9",   DARK_BEIGE: "#bcaaa4",
};

interface ColorsContextValue {
  customColors: CustomColor[];
  allColorKeys: string[];
  colorDisplay: (key: string | null | undefined, lang: "he" | "en") => string;
  colorLabel: (key: string | null | undefined) => string;
  hexForKey: (key: string) => string | null;
  addCustomColor: (payload: Omit<CustomColor, "id" | "createdAt">) => Promise<CustomColor>;
}

const ColorsContext = createContext<ColorsContextValue | null>(null);

export function ColorProvider({ children }: { children: ReactNode }) {
  const [customColors, setCustomColors] = useState<CustomColor[]>([]);

  useEffect(() => {
    fetchColors().then(setCustomColors).catch(() => {});
  }, []);

  const colorDisplay = useCallback(
    (key: string | null | undefined, lang: "he" | "en"): string => {
      if (!key) return "";
      const custom = customColors.find((c) => c.key === key);
      if (custom) return lang === "he" ? custom.labelHe : custom.labelEn;
      return staticDisplay(key, lang);
    },
    [customColors],
  );

  const colorLabel = useCallback(
    (key: string | null | undefined): string => {
      if (!key) return "";
      const custom = customColors.find((c) => c.key === key);
      if (custom) return custom.labelHe;
      return COLOR_LABELS[key] ?? key;
    },
    [customColors],
  );

  const hexForKey = useCallback(
    (key: string): string | null => {
      const custom = customColors.find((c) => c.key === key);
      if (custom) return custom.hex;
      return STATIC_HEX[key] ?? null;
    },
    [customColors],
  );

  const addCustomColor = useCallback(
    async (payload: Omit<CustomColor, "id" | "createdAt">): Promise<CustomColor> => {
      const color = await addColor(payload);
      setCustomColors((prev) => [...prev, color]);
      return color;
    },
    [],
  );

  const allColorKeys: string[] = [
    ...Object.keys(COLOR_LABELS),
    ...customColors.filter((c) => !(c.key in COLOR_LABELS)).map((c) => c.key),
  ];

  return (
    <ColorsContext.Provider
      value={{ customColors, allColorKeys, colorDisplay, colorLabel, hexForKey, addCustomColor }}
    >
      {children}
    </ColorsContext.Provider>
  );
}

export function useColors(): ColorsContextValue {
  const ctx = useContext(ColorsContext);
  if (!ctx) throw new Error("useColors must be used inside ColorProvider");
  return ctx;
}
