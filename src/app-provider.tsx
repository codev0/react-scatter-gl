import { createContext, useMemo, useState } from "react";
import { Dataset, generatePointPositionArray } from "./scatter";
import { Color } from "three";

export const AppContext = createContext<
  | {
      hoverPointIndex: number | null;
      setHoverPointIndex: (index: number | null) => void;
      points: {
        positions: Float32Array;
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

    return {
      positions,
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
