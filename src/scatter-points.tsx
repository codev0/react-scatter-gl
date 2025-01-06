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

const purpleColor = new Color("#800080");
const greenColor = new Color("#008000");

export function generatePointScaleFactorArray(
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

  useEffect(() => {
    if (!pointsRef.current) return;

    const pickingColors = new Float32Array(points.length * 3);
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
    const visibleColors = new Float32Array(points.length * 3).fill(0);
    Array.from({ length: points.length }).forEach((_, i) => {
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

    const geometry = pointsRef.current.geometry;
    geometry.setAttribute("position", new BufferAttribute(points.positions, 3));
    geometry.setAttribute("color", new BufferAttribute(visibleColors, 3));
    geometry.setAttribute("scale", new BufferAttribute(scaleFactor, 1));

    const pickingGeometry = pickingSceneRef.current.children[0].geometry;
    pickingGeometry.setAttribute(
      "position",
      new BufferAttribute(points.positions, 3)
    );
    pickingGeometry.setAttribute(
      "color",
      new BufferAttribute(pickingColors, 3)
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
        const colors = pointsRef.current?.geometry.getAttribute(
          "color"
        ) as BufferAttribute;

        // Only process if alpha channel indicates a point was hit
        if (pixelBuffer[3] > 0) {
          const id =
            pixelBuffer[0] + (pixelBuffer[1] << 8) + (pixelBuffer[2] << 16) - 1;
          if (id >= 0 && id < points.length) {
            console.log("hovered: ", id);

            colors.setXYZ(id, greenColor.r, greenColor.g, greenColor.b);
            if (prevHover.current && prevHover.current !== id) {
              colors.setXYZ(
                prevHover.current,
                purpleColor.r,
                purpleColor.g,
                purpleColor.b
              );
            }
            prevHover.current = id;

            setHoveredPoint(id);
          } else {
            setHoveredPoint(null);
          }
        } else {
          if (prevHover.current !== null) {
            colors.setXYZ(
              prevHover.current,
              purpleColor.r,
              purpleColor.g,
              purpleColor.b
            );
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
      <points ref={pointsRef} onPointerMove={handlePointerMove}>
        <bufferGeometry />
        <pointsMaterial size={5} vertexColors sizeAttenuation={false} />
      </points>

      {/* Picking scene rendered to offscreen target */}
      {createPortal(
        <points>
          <bufferGeometry />
          <pointsMaterial size={5} vertexColors sizeAttenuation={false} />
        </points>,
        pickingSceneRef.current
      )}
    </group>
  );
};
