import { useState, useMemo, useRef } from "react";
import {
  WebGLRenderTarget,
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
import { OrbitControls } from "@react-three/drei";
import { useAppContext } from "./use-app-context";

export const ScatterPoints = () => {
  const { size, camera, gl } = useThree();
  const { points } = useAppContext();
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const controlsRef = useRef(null);
  const mouseRef = useRef(new Vector2());

  // Create picking scene
  const pickingScene = useMemo(() => new Scene(), []);

  // Create picking render target
  const pickingTarget = useMemo(() => {
    return new WebGLRenderTarget(size.width, size.height, {
      format: RGBAFormat,
      type: UnsignedByteType,
    });
  }, [size.width, size.height]);

  const pointsRef = useRef(null);
  const pixelBuffer = useMemo(() => new Uint8Array(4), []);

  useFrame(() => {
    // Auto-rotation
    if (!controlsRef.current?.isDragging) {
      // Clear previous render target
      gl.setRenderTarget(pickingTarget);
      gl.clear();

      // Render picking scene
      gl.render(pickingScene, camera);

      // Read pixel under mouse
      const x = (mouseRef.current.x * 0.5 + 0.5) * pickingTarget.width;
      const y = (mouseRef.current.y * 0.5 + 0.5) * pickingTarget.height;

      // Check if coordinates are within bounds
      if (x >= 0 && x < size.width && y >= 0 && y < size.height) {
        gl.readRenderTargetPixels(pickingTarget, x, y, 1, 1, pixelBuffer);

        // Only process if alpha channel indicates a point was hit
        if (pixelBuffer[3] > 0) {
          const id =
            pixelBuffer[0] + (pixelBuffer[1] << 8) + (pixelBuffer[2] << 16) - 1;
          if (id >= 0 && id < points.length) {
            console.log(id);

            setHoveredPoint(id);
          } else {
            setHoveredPoint(null);
          }
        } else {
          setHoveredPoint(null);
        }
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
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={points.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={points.length}
            array={points.visibleColors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={5} color="#800080" sizeAttenuation={false} />
      </points>

      {/* Picking scene rendered to offscreen target */}
      {createPortal(
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={points.positions}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              count={points.length}
              array={points.pickingColors}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={5} vertexColors sizeAttenuation={false} />
        </points>,
        pickingScene
      )}

      {/* Hover indicator */}
      {hoveredPoint !== null && (
        <mesh
          position={[
            points.positions[hoveredPoint * 3],
            points.positions[hoveredPoint * 3 + 1],
            points.positions[hoveredPoint * 3 + 2],
          ]}
          scale={[0.1, 0.1, 0.1]}
        >
          <sphereGeometry args={[0.1]} />
          <meshBasicMaterial color="yellow" />
        </mesh>
      )}
    </group>
  );
};
