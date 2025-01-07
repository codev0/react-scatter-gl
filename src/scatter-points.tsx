import { useState, useMemo, useRef, useEffect } from "react";
import {
  WebGLRenderTarget,
  RGBAFormat,
  UnsignedByteType,
  Scene,
  Vector2,
  Color,
  Points,
  BufferAttribute,
} from "three";
import {
  createPortal,
  ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useAppContext } from "./use-app-context";
import { createRenderMaterial } from "./points-utils";
import { parseColor } from "./color";

const purpleColor = "rgba(128, 0, 128, 0.7)";
const greenColor = "rgba(0, 128, 0, 1)";

function calculatePointSize(pointsLength: number): number {
  const n = pointsLength / 3;
  const SCALE = 200;
  const LOG_BASE = 8;
  // Scale point size inverse-logarithmically to the number of points.
  const pointSize = SCALE / Math.log(n) / Math.log(LOG_BASE);
  return pointSize;
}

function generatePointScaleFactorArray(
  size: number,
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

  const scale = new Float32Array(size);
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

export const ScatterPoints = () => {
  const { size, camera, gl } = useThree();
  const { points } = useAppContext();
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const pointsRef = useRef<Points | null>(null);
  const controlsRef = useRef(null);
  const mouseRef = useRef(new Vector2());
  const pickingSceneRef = useRef(new Scene());
  const prevHover = useRef<number | null>(null);

  const renderMaterialRef = useRef(createRenderMaterial(5.0));
  const pickingMaterialRef = useRef(createRenderMaterial(5.0));

  useEffect(() => {
    if (!pointsRef.current) return;

    const visibleColors = new Float32Array(points.length * 4).fill(0);
    const pickingColors = new Float32Array(points.length * 4);
    const scaleFactor = generatePointScaleFactorArray(
      points.length,
      hoveredPoint,
      new Set(),
      {
        point: {
          scaleDefault: 1,
          scaleSelected: 1.5,
          scaleHover: 2,
        },
      }
    );
    const pc = parseColor(purpleColor);
    Array.from({ length: points.length }).forEach((_, i) => {
      // Generate unique color for picking
      const id = i + 1;
      const r = (id & 0xff) / 255;
      const g = ((id >> 8) & 0xff) / 255;
      const b = ((id >> 16) & 0xff) / 255;

      pickingColors[i * 4] = r;
      pickingColors[i * 4 + 1] = g;
      pickingColors[i * 4 + 2] = b;
      pickingColors[i * 4 + 3] = 1;

      // Set visible color (purple)
      visibleColors[i * 4] = pc.r;
      visibleColors[i * 4 + 1] = pc.g;
      visibleColors[i * 4 + 2] = pc.b;
      visibleColors[i * 4 + 3] = pc.opacity;
    });

    const geometry = pointsRef.current.geometry;
    geometry.setAttribute("position", new BufferAttribute(points.positions, 3));
    geometry.setAttribute("color", new BufferAttribute(visibleColors, 4));
    geometry.setAttribute("scaleFactor", new BufferAttribute(scaleFactor, 1));
    pickingMaterialRef.current.uniforms.pointSize.value = calculatePointSize(
      points.length
    );
    renderMaterialRef.current.uniforms.pointSize.value = calculatePointSize(
      points.length
    );

    const pickingGeometry = pickingSceneRef.current.children[0].geometry;
    pickingGeometry.setAttribute(
      "position",
      new BufferAttribute(points.positions, 3)
    );
    pickingGeometry.setAttribute(
      "color",
      new BufferAttribute(pickingColors, 4)
    );
    pickingGeometry.setAttribute(
      "scaleFactor",
      new BufferAttribute(scaleFactor, 1)
    );
  }, [points.positions, points.length, hoveredPoint]);

  // Create picking render target
  const pickingTarget = useMemo(() => {
    return new WebGLRenderTarget(size.width, size.height, {
      format: RGBAFormat,
      type: UnsignedByteType,
    });
  }, [size.width, size.height]);

  const pixelBuffer = useMemo(() => new Uint8Array(4), []);
  useFrame(() => {
    // Auto-rotation
    if (!controlsRef.current?.isDragging) {
      // Clear previous render target
      gl.setRenderTarget(pickingTarget);
      gl.clear();

      // Render picking scene
      gl.render(pickingSceneRef.current, camera);

      // Read pixel under mouse
      const x = (mouseRef.current.x * 0.5 + 0.5) * pickingTarget.width;
      const y = (mouseRef.current.y * 0.5 + 0.5) * pickingTarget.height;

      // Check if coordinates are within bounds
      if (x >= 0 && x < size.width && y >= 0 && y < size.height) {
        gl.readRenderTargetPixels(pickingTarget, x, y, 1, 1, pixelBuffer);
        const pc = parseColor(purpleColor);
        const gc = parseColor(greenColor);
        const colors = pointsRef.current?.geometry.getAttribute(
          "color"
        ) as BufferAttribute;

        // Only process if alpha channel indicates a point was hit
        if (pixelBuffer[3] > 0) {
          const id =
            pixelBuffer[0] + (pixelBuffer[1] << 8) + (pixelBuffer[2] << 16) - 1;
          if (id >= 0 && id < points.length) {
            console.log("hovered: ", id);
            colors.setXYZW(id, gc.r, gc.g, gc.b, gc.opacity);
            if (prevHover.current && prevHover.current !== id) {
              colors.setXYZW(prevHover.current, pc.r, pc.g, pc.b, pc.opacity);
            }
            prevHover.current = id;

            setHoveredPoint(id);
          } else {
            setHoveredPoint(null);
          }
        } else {
          if (prevHover.current !== null) {
            colors.setXYZW(prevHover.current, pc.r, pc.g, pc.b, pc.opacity);
          }

          setHoveredPoint(null);
        }
        colors.needsUpdate = true;
      }
    }

    // Reset render target
    gl.setRenderTarget(null);
  });

  const handlePointerMove = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    mouseRef.current.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
    mouseRef.current.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;
  };

  return (
    <group>
      <OrbitControls
        ref={controlsRef}
        autoRotate={true}
        autoRotateSpeed={0.5}
        enableDamping={true}
        dampingFactor={0.05}
      />
      {/* Visible points */}
      <points
        ref={pointsRef}
        onPointerMove={handlePointerMove}
        material={renderMaterialRef.current}
        frustumCulled={false}
      >
        <bufferGeometry />
      </points>

      {/* Picking scene rendered to offscreen target */}
      {createPortal(
        <points material={pickingMaterialRef.current} frustumCulled={false}>
          <bufferGeometry />
        </points>,
        pickingSceneRef.current
      )}
    </group>
  );
};
