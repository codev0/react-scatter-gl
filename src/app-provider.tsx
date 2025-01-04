import { createContext, useMemo, useState } from "react";
import { Dataset, generatePointPositionArray } from "./scatter";
import { Color } from "three";

export const AppContext = createContext<
  | {
      hoverPointIndex: number | null;
      setHoverPointIndex: (index: number | null) => void;
      points: {
        positions: Float32Array;
        pickingColors: Float32Array;
        visibleColors: Float32Array;
        length: number;
      };
      dataset: Dataset | null;
    }
  | undefined
>(undefined);

export const AppProvider = ({
  children,
  dataset,
}: {
  children: React.ReactNode;
  dataset: Dataset | null;
}) => {
  const [hoverPointIndex, setHoverPointIndex] = useState<number | null>(null);
  const points = useMemo(() => {
    if (!dataset) return null;

    const positions = generatePointPositionArray(dataset);

    const pickingColors = new Float32Array(dataset?.points.length * 3);
    const visibleColors = new Float32Array(dataset?.points.length * 3).fill(0);

    // Set purple color for all visible points
    const purpleColor = new Color("#800080");

    dataset?.points.forEach((point, i) => {
      // Generate unique color for picking
      const id = i + 1;
      const r = (id & 0xff) / 255;
      const g = ((id >> 8) & 0xff) / 255;
      const b = ((id >> 16) & 0xff) / 255;

      pickingColors[i * 3] = r;
      pickingColors[i * 3 + 1] = g;
      pickingColors[i * 3 + 2] = b;

      // Set visible color (purple)
      visibleColors[i * 3] = purpleColor.r;
      visibleColors[i * 3 + 1] = purpleColor.g;
      visibleColors[i * 3 + 2] = purpleColor.b;
    });

    return {
      positions,
      pickingColors,
      visibleColors,
      length: dataset.points.length,
    };
  }, [dataset]);
  return (
    <AppContext.Provider
      value={{
        hoverPointIndex,
        setHoverPointIndex,
        points,
        dataset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
