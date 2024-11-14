import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { data } from "./data";
import { PlotPoints } from "./plot-points";
import { createDataset, Dataset, Point3D, PointMetadata } from "./scatter";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { BufferGeometry, Group, LineBasicMaterial, Vector3, Line } from "three";
// import { BufferGeometry } from "three/src/core/BufferGeometry.ts";
// import { Group } from "three/src/objects/Group.ts";
// import { LineBasicMaterial } from "three/src/materials/LineBasicMaterial.ts";
// import { Vector3 } from "three/src/math/Vector3.ts";
// import { Line } from "three/src/objects/Line.ts";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Nav } from "./nav";

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

function Rotator({ children }: { children: ReactNode }) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = 0.01; // Small tilt on the x-axis
      groupRef.current.rotation.y += 0.001; // Autorotate around y-axis
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const handleAddPoints = () => {
    if (!dataset) {
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
      setDataset(createDataset(dataPoints, metadata));
    }
  };
  
  return (
    <div
      id="canvas-container"
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      <Nav
        onAddPoints={() => {
          handleAddPoints();
        }}
        onRemovePoints={() => {
          setDataset(null);
        }}
      />
      <Canvas
        camera={{
          position: [0.5, 0.5, 0.5], // Position along x, y, and z at 45 degrees
          near: 0.1,
          far: 1000,
        }}
      >
        <ambientLight />
        <AxisLines />
        <axesHelper args={[5]} />
        <CustomOrbitControls />
        <Rotator>
          <gridHelper args={[2, 2]} />
          <PlotPoints dataset={dataset} />
        </Rotator>
      </Canvas>
    </div>
  );
}

export default App;
