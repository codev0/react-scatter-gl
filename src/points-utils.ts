import {
  BufferGeometry,
  Color,
  LessDepth,
  NormalBlending,
  ShaderChunk,
  ShaderMaterial,
} from "three";
import { RGBA_NUM_ELEMENTS } from "./constants";
import * as utils from "./utils";
import { Dataset } from "./scatter";

interface IUniform<TValue = unknown> {
  value: TValue;
}

function createUniforms(): Record<string, IUniform> {
  return {
    fogColor: { value: new Color(0xffffff) }, // Initialize with a default color
    fogNear: { value: 1.0 }, // Initialize with a default near value
    fogFar: { value: 1000.0 }, // Initialize with a default far value
    sizeAttenuation: { value: true }, // Boolean for size attenuation
    pointSize: { value: 10.0 }, // Default point size
  };
}

const FRAGMENT_SHADER_POINT_TEST_CHUNK = `
    bool point_in_unit_circle(vec2 spriteCoord) {
      vec2 centerToP = spriteCoord - vec2(0.5, 0.5);
      return dot(centerToP, centerToP) < (0.5 * 0.5);
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

    ${ShaderChunk["common"]}
    ${FRAGMENT_SHADER_POINT_TEST_CHUNK}
    uniform vec3 fogColor;
    varying float fogDepth;
        uniform float fogNear;
    uniform float fogFar;

    void main() {
      bool inside = point_in_unit_circle(gl_PointCoord);
      if (!inside) {
        discard;
      }
      gl_FragColor = vColor;
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

export function createRenderMaterial(minPointSize: number): ShaderMaterial {
  const uniforms = createUniforms();
  return new ShaderMaterial({
    uniforms: uniforms,
    vertexShader: makeVertexShader(minPointSize),
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthFunc: LessDepth,
    fog: false,
    blending: NormalBlending,
  });
}

const FRAGMENT_SHADER_PICKING = `
    varying vec2 xyIndex;
    varying vec4 vColor;
    uniform bool isImage;

    ${FRAGMENT_SHADER_POINT_TEST_CHUNK}

    varying float fogDepth;

    void main() {
      xyIndex; // Silence 'unused variable' warning.
      fogDepth; // Silence 'unused variable' warning.
      if (isImage) {
        gl_FragColor = vColor;
      } else {
        bool inside = point_in_unit_circle(gl_PointCoord);
        if (!inside) {
          discard;
        }
        gl_FragColor = vColor;
      }
    }`;

export function createPickingMaterial(minPointSize: number): ShaderMaterial {
  const uniforms = createUniforms();
  return new ShaderMaterial({
    uniforms: uniforms,
    vertexShader: makeVertexShader(minPointSize),
    fragmentShader: FRAGMENT_SHADER_PICKING,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    fog: false,
    blending: NormalBlending,
  });
}

export function generatePointScaleFactorArray(
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

  // const selectedPointCount = selectedPointIndices.size;

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

export function createGeometry(pointCount: number): BufferGeometry {
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
  geometry.computeVertexNormals();
  return geometry;
}
