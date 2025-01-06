import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { data } from "./data";
import { createDataset, Dataset, Point3D, PointMetadata } from "./scatter";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferGeometry, LineBasicMaterial, Vector3, Line } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Nav } from "./nav";
import { AppProvider } from "./app-provider";
// import { PlotPoints } from "./plot-points";
import { ScatterPoints } from "./scatter-points";

function CustomOrbitControls() {
  const { camera, gl } = useThree(); // Access camera and renderer
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    // Initialize OrbitControls
    controlsRef.current = new OrbitControls(camera, gl.domElement);

    // Optional settings for controls
    controlsRef.current.enableDamping = true;
    controlsRef.current.dampingFactor = 0.1;
    controlsRef.current.rotateSpeed = 0.5;

    return () => {
      // Clean up controls on unmount
      controlsRef.current?.dispose();
    };
  }, [camera, gl]);

  // Update the controls every frame
  useFrame(() => controlsRef.current?.update());

  return null;
}

function AxisLines() {
  // X-axis (Red)
  const xAxis = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0), // Start point
      new Vector3(5, 0, 0), // End point
    ]);
    const material = new LineBasicMaterial({ color: 0xff0000 }); // Red color
    return new Line(geometry, material);
  }, []);

  // Y-axis (Green)
  const yAxis = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0), // Start point
      new Vector3(0, 5, 0), // End point
    ]);
    const material = new LineBasicMaterial({ color: 0x00ff00 }); // Green color
    return new Line(geometry, material);
  }, []);

  // Z-axis (Blue)
  const zAxis = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0), // Start point
      new Vector3(0, 0, 5), // End point
    ]);
    const material = new LineBasicMaterial({ color: 0x0000ff }); // Blue color
    return new Line(geometry, material);
  }, []);

  return (
    <>
      <primitive object={xAxis} />
      <primitive object={yAxis} />
      <primitive object={zAxis} />
    </>
  );
}

export const getDataset = (cursor: number, limit: number) => {
  const dataPoints: Point3D[] = [];
  const metadata: PointMetadata[] = [];
  // data.projection.forEach((vector, index) => {
  //   const labelIndex = data.labels[index];
  //   dataPoints.push(vector);
  //   metadata.push({
  //     labelIndex,
  //     label: data.labelNames[labelIndex],
  //   });
  // });
  const start = cursor * limit;

  if (start >= data.projection.length) return { dataPoints, metadata };

  for (let i = start; i < start + limit; i++) {
    const vector = data.projection[i];
    const labelIndex = data.labels[i];
    dataPoints.push(vector);
    metadata.push({
      labelIndex,
      label: data.labelNames[labelIndex],
    });
  }

  return { dataPoints, metadata };
};

function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [cursor, setCursor] = useState(0);
  const handleAddPoints = () => {
    const { dataPoints, metadata } = getDataset(cursor, 100);
    setCursor(cursor + 1);
    setDataset((state) => {
      if (dataPoints.length === 0) return state;
      if (!state) {
        return createDataset(dataPoints, metadata);
      }
      return {
        points: [...state.points, ...dataPoints],
        metadata: [...state.metadata, ...metadata],
        dimensions: 3,
      };
    });
  };

  const handleRemovePoints = () => {
    setDataset((state) => {
      if (!state) return null;
      const n = state.points.length;
      const m = 100;
      if (n <= m) return null;
      return {
        points: state.points.slice(0, n - m),
        metadata: state.metadata.slice(0, n - m),
        dimensions: 3,
      };
    });
  };

  return (
    <div
      id="canvas-container"
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      <Nav onAddPoints={handleAddPoints} onRemovePoints={handleRemovePoints} />
      <Canvas
        camera={{
          position: [0.5, 0.5, 0.5], // Position along x, y, and z at 45 degrees
          near: 0.1,
          far: 1000,
        }}
      >
        <AppProvider dataset={dataset}>
          <ambientLight />
          {/* <axesHelper args={[5]} /> */}
          <gridHelper args={[2, 2]} />
          {dataset ? <ScatterPoints /> : null}
          {/* <PlotPoints dataset={dataset} /> */}
          <AxisLines />
        </AppProvider>
      </Canvas>
    </div>
  );
}

export default App;
