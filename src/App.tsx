import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { data } from "./data";
import { PlotPoints } from "./plot-points";
import {
  createDataset,
  Dataset,
  generatePointPositionArray,
  Point3D,
  PointMetadata,
} from "./scatter";
import { ReactNode, useRef } from "react";
import { Vector3 } from "three";

const dataPoints: Point3D[] = [];
const metadata: PointMetadata[] = [];
data.projection.forEach((vector, index) => {
  const labelIndex = data.labels[index];
  dataPoints.push(vector);
  metadata.push({
    labelIndex,
    label: data.labelNames[labelIndex],
  });
});

const dataset = createDataset(dataPoints, metadata);

function AxesLines() {
  return (
    <>
      {/* X-axis (Red) */}
      <Line
        points={[
          [0, 0, 0],
          [1, 0, 0],
        ]} // Line endpoints
        color="red"
        lineWidth={2}
      />

      {/* Y-axis (Green) */}
      <Line
        points={[
          [0, 0, 0],
          [0, 1, 0],
        ]}
        color="green"
        lineWidth={2}
      />

      {/* Z-axis (Blue) */}
      <Line
        points={[
          [0, 0, 0],
          [0, 0, 1],
        ]}
        color="blue"
        lineWidth={2}
      />
    </>
  );
}

function Rotator({ children }: { children: ReactNode }) {
  const groupRef = useRef(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = 0.01; // Small tilt on the x-axis
      groupRef.current.rotation.y += 0.001; // Autorotate around y-axis
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

function App() {
  return (
    <div
      id="canvas-container"
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      <Canvas
        camera={{
          position: [1, 1, 1], // Position along x, y, and z at 45 degrees
          near: 0.1,
          far: 1000,
        }}
      >
        <ambientLight />
        <Rotator>
          <AxesLines />
          <gridHelper args={[10, 10]} />
          <PlotPoints dataset={dataset} />
        </Rotator>
        {/* Optional grid helper for reference */}
        {/* <perspectiveCamera position={[10, 100, 10]} /> */}
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default App;
