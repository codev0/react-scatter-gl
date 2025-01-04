import { RGBA_NUM_ELEMENTS, SCATTER_PLOT_CUBE_LENGTH } from "./constants";
import * as utils from "./utils";
import { parseColor } from "./color";
import { Label3DStyles } from "./styles";
import {
  Camera,
  Raycaster,
  Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

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

export interface ScatterBoundingBox {
  // The bounding box (x, y) position refers to the bottom left corner of the
  // rect.
  x: number;
  y: number;
  width: number;
  height: number;
}

export function generatePointColorArray(
  dataset: Dataset,
  selectedPointIndices: Set<number>,
  hoverPointIndex: number | null,
  styles: {
    colorHover: string;
    colorNoSelection: string;
    colorSelected: string;
    colorUnselected: string;
    label3D: Label3DStyles;
  }
): Float32Array {
  const colors = new Float32Array(dataset.points.length * RGBA_NUM_ELEMENTS);

  const { colorUnselected, colorNoSelection, colorHover, colorSelected } =
    styles;

  const n = dataset.points.length;
  const selectedPointCount = selectedPointIndices.size;

  // First color all unselected / non-selected points
  let dst = 0;
  let c =
    selectedPointCount > 0
      ? parseColor(colorUnselected)
      : parseColor(colorNoSelection);
  for (let i = 0; i < n; ++i) {
    colors[dst++] = c.r;
    colors[dst++] = c.g;
    colors[dst++] = c.b;
    colors[dst++] = c.opacity;
  }

  // Then, color selected points
  c = parseColor(colorSelected);
  if (selectedPointIndices.size > 0) {
    for (const selectedPointIndex of selectedPointIndices.values()) {
      let dst = selectedPointIndex * RGBA_NUM_ELEMENTS;
      colors[dst++] = c.r;
      colors[dst++] = c.g;
      colors[dst++] = c.b;
      colors[dst++] = c.opacity;
    }
  }

  // Last, color the hover point.
  if (hoverPointIndex != null) {
    const c = parseColor(colorHover);
    let dst = hoverPointIndex * RGBA_NUM_ELEMENTS;
    colors[dst++] = c.r;
    colors[dst++] = c.g;
    colors[dst++] = c.b;
    colors[dst++] = c.opacity;
  }

  return colors;
}

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

  dataset.points.forEach((_, i) => {
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

// export function setNearestPointToMouse(
//   mousePosition: { x: number; y: number },
//   worldSpacePointPositions: Float32Array,
//   gl: WebGLRenderingContext,
//   pickingTexture: WebGLRenderTarget,
//   camera: Camera
// ): number[] {
//   // Convert mouse position to normalized device coordinates (NDC)
//   const ndcX = (mousePosition.x / window.innerWidth) * 2 - 1;
//   const ndcY = -(mousePosition.y / window.innerHeight) * 2 + 1;

//   // Create a raycaster and set its origin and direction
//   const raycaster = new Raycaster();
//   raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

//   // Create a buffer to read the pixel data from the picking texture
//   const pixelBuffer = new Uint8Array(4);
//   gl.readPixels(
//     mousePosition.x,
//     window.innerHeight - mousePosition.y,
//     1,
//     1,
//     gl.RGBA,
//     gl.UNSIGNED_BYTE,
//     pixelBuffer
//   );

//   // Decode the ID from the pixel buffer
//   const id = utils.decodeIdFromRgb(
//     pixelBuffer[0],
//     pixelBuffer[1],
//     pixelBuffer[2]
//   );
//   console.log("Decoded ID:", id);

//   // Check if the ID is valid
//   if (id !== 0xffffff && id < worldSpacePointPositions.length / 3) {
//     return [id];
//   }

//   return [0];
// }

export function setNearestPointToMouse(
  e: {
    offsetX: number;
    offsetY: number;
  },
  worldSpacePointPositions: Float32Array,
  renderer: WebGLRenderer,
  pickingTexture: WebGLRenderTarget
) {
  const boundingBox: ScatterBoundingBox = {
    x: e.offsetX,
    y: e.offsetY,
    width: 1,
    height: 1,
  };

  const pointIndices = getPointIndicesFromBoundingBoxPickingTexture(
    boundingBox,
    worldSpacePointPositions,
    renderer,
    pickingTexture
  );

  return pointIndices.length ? pointIndices[0] : null;
}

export function getPointIndicesFromBoundingBoxPickingTexture(
  boundingBox: ScatterBoundingBox,
  worldSpacePointPositions: Float32Array,
  renderer: WebGLRenderer,
  pickingTexture: WebGLRenderTarget
): number[] {
  if (worldSpacePointPositions == null) {
    return [];
  }
  const pointCount = worldSpacePointPositions.length / 3;
  const dpr = window.devicePixelRatio || 1;
  const x = Math.floor(boundingBox.x * dpr);
  const y = Math.floor(boundingBox.y * dpr);
  const width = Math.max(Math.floor(boundingBox.width * dpr), 1);
  const height = Math.max(Math.floor(boundingBox.height * dpr), 1);

  // Create buffer for reading all of the pixels from the texture.
  const pixelBuffer = new Uint8Array(width * height * 4);

  // Read the pixels from the bounding box.
  renderer.readRenderTargetPixels(
    pickingTexture,
    x,
    pickingTexture.height - y,
    width,
    height,
    pixelBuffer
  );

  // Keep a flat list of each point and whether they are selected or not. This
  // approach is more efficient than using an object keyed by the index.
  const pointIndicesSelection = new Uint8Array(worldSpacePointPositions.length);

  for (let i = 0; i < width * height; i++) {
    const id = utils.decodeIdFromRgb(
      pixelBuffer[i * 4],
      pixelBuffer[i * 4 + 1],
      pixelBuffer[i * 4 + 2]
    );

    // bg color
    if (id != 0x000000 && id < pointCount) {
      console.log(
        "pixelBuffer",
        pointCount,
        pixelBuffer[i * 4],
        pixelBuffer[i * 4 + 1],
        pixelBuffer[i * 4 + 2],
        id
      );
      pointIndicesSelection[id] = 1;
    }
  }
  const pointIndices: number[] = [];

  for (let i = 0; i < pointIndicesSelection.length; i++) {
    if (pointIndicesSelection[i] === 1) {
      pointIndices.push(i);
    }
  }

  return pointIndices;
}
