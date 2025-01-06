import { FC, useLayoutEffect, useMemo, useRef, useState } from "react";
import { makeStyles } from "./styles";
import { Dataset, generatePointColorArray } from "./scatter";
import {
  Points,
  WebGLRenderTarget,
  LinearFilter,
  RGBAFormat,
  UnsignedByteType,
  Scene,
  Vector2,
} from "three";
import {
  createPortal,
  ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { useAppContext } from "./use-app-context";
import { parseColor } from "./color";
import {
  createPickingMaterial,
  createRenderMaterial,
  generatePointScaleFactorArray,
} from "./points-utils";
import { RGBA_NUM_ELEMENTS } from "./constants";
import * as utils from "./utils";

export const PlotPoints: FC<{
  dataset: Dataset | null;
}> = ({ dataset }) => {
  const { gl, size, camera } = useThree();
  const { hoverPointIndex, worldSpacePointPositions } = useAppContext();
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const renderMaterialRef = useRef(createRenderMaterial(5.0));
  const pickingMaterialRef = useRef(createPickingMaterial(5.0));
  const pickingScene = useMemo(() => new Scene(), []);
  const pickingTarget = useMemo(() => {
    return new WebGLRenderTarget(size.width, size.height, {
      format: RGBAFormat,
      type: UnsignedByteType,
    });
  }, [size.width, size.height]);
  const mouse = useRef(new Vector2());

  const points = useMemo(() => {
    if (!dataset) return null;
    const scaleFactor = generatePointScaleFactorArray(
      dataset,
      null,
      new Set(),
      {
        point: {
          scaleDefault: 1,
          scaleSelected: 1.5,
          scaleHover: 2,
        },
      }
    );
    const n = dataset.points.length / 3;
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
    const styles = makeStyles({});
    const visibleColors = generatePointColorArray(
      dataset,
      new Set(),
      hoverPointIndex,
      {
        colorHover: styles.point.colorHover,
        colorNoSelection: styles.point.colorNoSelection,
        colorSelected: styles.point.colorSelected,
        colorUnselected: styles.point.colorUnselected,
        label3D: {
          backgroundColor: "black",
          color: "white",
          colorHover: "red",
          colorNoSelection: "blue",
          colorUnselected: "purple",
          fontSize: 12,
          scale: 1,
        },
      }
    );
    return {
      scaleFactor,
      pickingColors,
      visibleColors,
    };
  }, [dataset]);

  const pointsRef = useRef<Points | null>(null);

  const pixelBuffer = useMemo(() => new Uint8Array(4), []);
  useFrame(() => {
    // Clear previous render target
    gl.setRenderTarget(pickingTarget);
    gl.clear();

    // Render picking scene
    gl.render(pickingScene, camera);

    // Read pixel under mouse
    const x = (mouse.current.x * 0.5 + 0.5) * pickingTarget.width;
    const y = (mouse.current.y * 0.5 + 0.5) * pickingTarget.height;

    // Check if coordinates are within bounds
    if (x >= 0 && x < size.width && y >= 0 && y < size.height) {
      gl.readRenderTargetPixels(pickingTarget, x, y, 1, 1, pixelBuffer);

      // Only process if alpha channel indicates a point was hit
      if (pixelBuffer[3] > 0) {
        const id =
          pixelBuffer[0] + (pixelBuffer[1] << 8) + (pixelBuffer[2] << 16) - 1;
        if (dataset && id >= 0 && id < dataset.points.length) {
          console.log("hovered point", id);

          setHoveredPoint(id);
        } else {
          setHoveredPoint(null);
        }
      } else {
        setHoveredPoint(null);
      }
    }
    // Reset render target
    gl.setRenderTarget(null);
  });

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    mouse.current.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;
  };

  const currentMaterial = pickingMaterialRef.current;

  return points && dataset ? (
    <>
      <points ref={pointsRef} onPointerMove={handlePointerMove}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={worldSpacePointPositions}
            count={dataset.points.length}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={points.visibleColors}
            count={dataset.points.length}
            itemSize={4}
            needsUpdate={true}
          />
          <bufferAttribute
            attach="attributes-scaleFactor"
            array={points.scaleFactor}
            count={dataset.points.length}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial size={5} color="#800080" sizeAttenuation={false} />
      </points>

      {/* Render the picking texture */}
      {createPortal(
        <points material={pickingMaterialRef.current}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={dataset.points.length}
              array={worldSpacePointPositions}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              count={dataset.points.length}
              array={points.pickingColors}
              itemSize={4}
            />
          </bufferGeometry>
          <pointsMaterial size={5} vertexColors sizeAttenuation={false} />
        </points>,
        pickingScene
      )}
      {/* 
      {hoveredPoint !== null && (
        <mesh
          position={[
            dataset.points[hoveredPoint][0],
            dataset.points[hoveredPoint][1],
            dataset.points[hoveredPoint][2],
          ]}
        >
          <sphereGeometry args={[0.1]} />
          <meshBasicMaterial color="yellow" />
        </mesh>
      )} */}
    </>
  ) : null;
};
