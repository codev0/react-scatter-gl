import { FC, useMemo } from "react";
import { Points } from "@react-three/drei";
import {
  BufferGeometry,
  BufferAttribute,
  ShaderChunk,
  ShaderMaterial,
  LessDepth,
  NormalBlending,
  Points as ThreePoints,
} from "three";
import {
  INDEX_NUM_ELEMENTS,
  RGBA_NUM_ELEMENTS,
  XYZ_NUM_ELEMENTS,
} from "./constants";
import * as utils from "./utils";
import { Label3DStyles } from "./styles";
import { parseColor } from "./color";
import { Dataset, generatePointPositionArray } from "./scatter";

function createUniforms(): any {
  return {
    spriteTexture: { type: "t" },
    spritesPerRow: { type: "f" },
    spritesPerColumn: { type: "f" },
    fogColor: { type: "c" },
    fogNear: { type: "f" },
    fogFar: { type: "f" },
    isImage: { type: "bool" },
    sizeAttenuation: { type: "bool" },
    pointSize: { type: "f" },
  };
}

const FRAGMENT_SHADER_POINT_TEST_CHUNK = `
    bool point_in_unit_circle(vec2 spriteCoord) {
      vec2 centerToP = spriteCoord - vec2(0.5, 0.5);
      return dot(centerToP, centerToP) < (0.5 * 0.5);
    }

    bool point_in_unit_equilateral_triangle(vec2 spriteCoord) {
      vec3 v0 = vec3(0, 1, 0);
      vec3 v1 = vec3(0.5, 0, 0);
      vec3 v2 = vec3(1, 1, 0);
      vec3 p = vec3(spriteCoord, 0);
      float p_in_v0_v1 = cross(v1 - v0, p - v0).z;
      float p_in_v1_v2 = cross(v2 - v1, p - v1).z;
      return (p_in_v0_v1 > 0.0) && (p_in_v1_v2 > 0.0);
    }

    bool point_in_unit_square(vec2 spriteCoord) {
      return true;
    }
  `;

const FRAGMENT_SHADER = `
    varying vec2 xyIndex;
    varying vec4 vColor;

    uniform sampler2D spriteTexture;
    uniform float spritesPerRow;
    uniform float spritesPerColumn;
    uniform bool isImage;

    ${ShaderChunk["common"]}
    ${FRAGMENT_SHADER_POINT_TEST_CHUNK}
    uniform vec3 fogColor;
    varying float fogDepth;
		uniform float fogNear;
    uniform float fogFar;

    void main() {
      if (isImage) {
        // Coordinates of the vertex within the entire sprite image.
        vec2 coords =
          (gl_PointCoord + xyIndex) / vec2(spritesPerRow, spritesPerColumn);
        gl_FragColor = vColor * texture(spriteTexture, coords);
      } else {
        bool inside = point_in_unit_circle(gl_PointCoord);
        if (!inside) {
          discard;
        }
        gl_FragColor = vColor;
      }
      float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
    }`;

const makeVertexShader = (minPointSize: number) => `
    // Index of the specific vertex (passed in as bufferAttribute), and the
    // variable that will be used to pass it to the fragment shader.
    attribute float spriteIndex;
    attribute vec4 color;
    attribute float scaleFactor;

    varying vec2 xyIndex;
    varying vec4 vColor;

    uniform bool sizeAttenuation;
    uniform float pointSize;
    uniform float spritesPerRow;
    uniform float spritesPerColumn;

    varying float fogDepth;

    void main() {
      // Pass index and color values to fragment shader.
      vColor = color;
      xyIndex = vec2(mod(spriteIndex, spritesPerRow),
                floor(spriteIndex / spritesPerColumn));

      // Transform current vertex by modelViewMatrix (model world position and
      // camera world position matrix).
      vec4 cameraSpacePos = modelViewMatrix * vec4(position, 1.0);

      // Project vertex in camera-space to screen coordinates using the camera's
      // projection matrix.
      gl_Position = projectionMatrix * cameraSpacePos;

      // Create size attenuation (if we're in 3D mode) by making the size of
      // each point inversly proportional to its distance to the camera.
      float outputPointSize = pointSize;
      if (sizeAttenuation) {
        outputPointSize = -pointSize / cameraSpacePos.z;
        fogDepth = pointSize / outputPointSize * 1.2;
      } else {  // Create size attenuation (if we're in 2D mode)
        const float PI = 3.1415926535897932384626433832795;
        const float minScale = 0.1;  // minimum scaling factor
        const float outSpeed = 2.0;  // shrink speed when zooming out
        const float outNorm = (1. - minScale) / atan(outSpeed);
        const float maxScale = 15.0;  // maximum scaling factor
        const float inSpeed = 0.02;  // enlarge speed when zooming in
        const float zoomOffset = 0.3;  // offset zoom pivot
        float zoom = projectionMatrix[0][0] + zoomOffset;  // zoom pivot
        float scale = zoom < 1. ? 1. + outNorm * atan(outSpeed * (zoom - 1.)) :
                      1. + 2. / PI * (maxScale - 1.) * atan(inSpeed * (zoom - 1.));
        outputPointSize = pointSize * scale;
      }

      gl_PointSize =
        max(outputPointSize * scaleFactor, ${minPointSize.toFixed(1)});
    }`;

function createRenderMaterial(minPointSize: number): ShaderMaterial {
  const uniforms = createUniforms();
  return new ShaderMaterial({
    uniforms: uniforms,
    vertexShader: makeVertexShader(minPointSize),
    // fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthFunc: LessDepth,
    fog: false,
    blending: NormalBlending,
  });
}

function generatePointColorArray(
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

  let unselectedColor = styles.colorUnselected;
  let noSelectionColor = styles.colorNoSelection;
  let hoverColor = styles.colorHover;

  unselectedColor = styles.label3D.colorUnselected;
  noSelectionColor = styles.label3D.colorNoSelection;
  hoverColor = styles.label3D.colorHover;

  const n = dataset.points.length;
  const selectedPointCount = selectedPointIndices.size;

  // First color all unselected / non-selected points
  let dst = 0;
  let c =
    selectedPointCount > 0
      ? parseColor(unselectedColor)
      : parseColor(noSelectionColor);
  for (let i = 0; i < n; ++i) {
    colors[dst++] = c.r;
    colors[dst++] = c.g;
    colors[dst++] = c.b;
    colors[dst++] = c.opacity;
  }

  // Then, color selected points
  c = parseColor(styles.colorSelected);
  // if (selectedPointIndices.size > 0) {
  //   for (const selectedPointIndex of selectedPointIndices.values()) {
  //     let dst = selectedPointIndex * RGBA_NUM_ELEMENTS;
  //     colors[dst++] = c.r;
  //     colors[dst++] = c.g;
  //     colors[dst++] = c.b;
  //     colors[dst++] = c.opacity;
  //   }
  // }

  // Last, color the hover point.
  if (hoverPointIndex != null) {
    const c = parseColor(hoverColor);
    let dst = hoverPointIndex * RGBA_NUM_ELEMENTS;
    colors[dst++] = c.r;
    colors[dst++] = c.g;
    colors[dst++] = c.b;
    colors[dst++] = c.opacity;
  }

  return colors;
}

function generatePointScaleFactorArray(
  dataset: Dataset,
  hoverPointIndex: number | null,
  selectedPointIndices: Set<number>,
  styles: {
    point: {
      scaleDefault: number;
      scaleSelected: number;
      scaleHover: number;
    };
  }
): Float32Array {
  const { scaleDefault, scaleSelected, scaleHover } = styles.point;

  const scale = new Float32Array(dataset.points.length);
  scale.fill(scaleDefault);

  const selectedPointCount = selectedPointIndices.size;

  // Scale up all selected points.
  {
    for (const p of selectedPointIndices.values()) {
      scale[p] = scaleSelected;
    }
  }

  // Scale up the hover point.
  if (hoverPointIndex != null) {
    scale[hoverPointIndex] = scaleHover;
  }

  return scale;
}

function createGeometry(pointCount: number): BufferGeometry {
  const n = pointCount;

  // Fill pickingColors with each point's unique id as its color.
  const pickingColors = new Float32Array(n * RGBA_NUM_ELEMENTS);
  {
    for (let i = 0; i < n; i++) {
      const encodedId = utils.encodeIdToRgb(i);

      pickingColors[i * 4] = encodedId.r;
      pickingColors[i * 4 + 1] = encodedId.g;
      pickingColors[i * 4 + 2] = encodedId.b;
      pickingColors[i * 4 + 3] = 1; // Alpha
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([]), XYZ_NUM_ELEMENTS)
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array([]), RGBA_NUM_ELEMENTS)
  );
  geometry.setAttribute(
    "scaleFactor",
    new BufferAttribute(new Float32Array([]), INDEX_NUM_ELEMENTS)
  );
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Create points, set their locations and actually instantiate the
 * geometry.
 */
function createPointSprites(
  positions: Float32Array,
  renderMaterial: ShaderMaterial
) {
  const pointCount =
    positions != null ? positions.length / XYZ_NUM_ELEMENTS : 0;
  const geometry = createGeometry(pointCount);
  const points = new ThreePoints(geometry, renderMaterial);
  points.frustumCulled = false;
  // scene.add(points);
  return {
    points,
    geometry,
  };
}

export const PlotPoints: FC<{
  dataset: Dataset;
}> = ({ dataset }) => {
  const renderMaterial = createRenderMaterial(5.0);
  const points = generatePointPositionArray(dataset);
  const geometry = createGeometry(points.length / XYZ_NUM_ELEMENTS);
  // const points = useMemo(() => {
  //   // const { points, geometry } = createPointSprites(positions, renderMaterial);
  //   // const colors = geometry.getAttribute("color");
  //   // colors.array = generatePointColorArray(dataset, new Set(), null, {
  //   //   colorHover: "red",
  //   //   colorNoSelection: "blue",
  //   //   colorSelected: "green",
  //   //   colorUnselected: "purple",
  //   //   label3D: {
  //   //     backgroundColor: "black",
  //   //     color: "white",
  //   //     colorHover: "red",
  //   //     colorNoSelection: "blue",
  //   //     colorUnselected: "purple",
  //   //     fontSize: 12,
  //   //     scale: 1,
  //   //   },
  //   // });
  //   // colors.needsUpdate = true;
  //   // const scaleFactor = geometry.getAttribute("scaleFactor");
  //   // return geometry;
  // }, [dataset]);

  return (
    <Points positions={points} geometry={geometry} material={renderMaterial} />
  );
};
