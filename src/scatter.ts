import { SCATTER_PLOT_CUBE_LENGTH } from "./constants";
import * as utils from "./utils";

export type Point2D = [number, number];
export type Point3D = [number, number, number];
export type Points = Array<Point2D | Point3D>;

export interface PointMetadata {
  label?: string;
  group?: string;
  [key: string]: number | string | undefined;
}

const DIMENSIONALITY_ERROR_MESSAGE =
  "Points must be an array of either 2 or 3 dimensional number arrays";

// export class Dataset {
//   public dimensions: number;

//   /**
//    *
//    * @param points the data as an array of 2d or 3d number arrays
//    * @param metadata an array of point metadata, corresponding to each point
//    * @param sequences a collection of points that make up a sequence
//    */
//   constructor(public points: Points, public metadata: PointMetadata[] = []) {
//     const dimensions = points[0].length;
//     if (dimensions !== 2 && dimensions !== 3) {
//       throw new Error(DIMENSIONALITY_ERROR_MESSAGE);
//     }
//     for (const point of points) {
//       if (dimensions !== point.length) {
//         throw new Error(DIMENSIONALITY_ERROR_MESSAGE);
//       }
//     }
//     this.dimensions = dimensions;
//   }
// }

export interface Sequence {
  /** Indices into the DataPoints array in the Data object. */
  indices: number[];
}

export type Dataset = {
  points: Points;
  metadata: PointMetadata[];
  dimensions: 2 | 3;
};

export function createDataset(
  points: Points,
  metadata: PointMetadata[] = []
): Dataset {
  const dimensions = points[0].length;
  if (dimensions !== 2 && dimensions !== 3) {
    throw new Error(DIMENSIONALITY_ERROR_MESSAGE);
  }
  for (const point of points) {
    if (dimensions !== point.length) {
      throw new Error(DIMENSIONALITY_ERROR_MESSAGE);
    }
  }
  return { points, metadata, dimensions };
}

export function generatePointPositionArray(dataset: Dataset): Float32Array {
  let xExtent = [0, 0];
  let yExtent = [0, 0];
  let zExtent = [0, 0];

  // Determine max and min of each axis of our data.
  xExtent = utils.extent(dataset.points.map((p) => p[0]));
  yExtent = utils.extent(dataset.points.map((p) => p[1]));

  if (dataset.dimensions === 3) {
    zExtent = utils.extent(dataset.points.map((p) => p[2]!));
  }

  const getRange = (extent: number[]) => Math.abs(extent[1] - extent[0]);
  const xRange = getRange(xExtent);
  const yRange = getRange(yExtent);
  const zRange = getRange(zExtent);
  const maxRange = Math.max(xRange, yRange, zRange);

  const halfCube = SCATTER_PLOT_CUBE_LENGTH / 2;
  const makeScaleRange = (range: number, base: number) => [
    -base * (range / maxRange),
    base * (range / maxRange),
  ];
  const xScale = makeScaleRange(xRange, halfCube);
  const yScale = makeScaleRange(yRange, halfCube);
  const zScale = makeScaleRange(zRange, halfCube);

  const positions = new Float32Array(dataset.points.length * 3);
  let dst = 0;

  dataset.points.forEach((d, i) => {
    const vector = dataset.points[i];

    positions[dst++] = utils.scaleLinear(vector[0], xExtent, xScale);
    positions[dst++] = utils.scaleLinear(vector[1], yExtent, yScale);

    if (dataset.dimensions === 3) {
      positions[dst++] = utils.scaleLinear(vector[2]!, zExtent, zScale);
    } else {
      positions[dst++] = 0.0;
    }
  });
  return positions;
}
