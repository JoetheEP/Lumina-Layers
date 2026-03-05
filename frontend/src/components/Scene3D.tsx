import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
} from "@react-three/drei";
import ModelViewer from "./ModelViewer";

interface Scene3DProps {
  modelUrl?: string;
}

function Scene3D({ modelUrl }: Scene3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 45 }}
      onCreated={({ gl }) => {
        // Recover from WebGL context loss instead of crashing
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
        });
        canvas.addEventListener("webglcontextrestored", () => {
          gl.setSize(canvas.clientWidth, canvas.clientHeight);
        });
      }}
    >
      <ambientLight intensity={0.5} />
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={1}
        maxDistance={50}
      />
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>
      <ContactShadows
        position={[0, -0.5, 0]}
        opacity={0.4}
        blur={2}
        far={4}
      />
      {modelUrl && (
        <Suspense fallback={null}>
          <ModelViewer url={modelUrl} />
        </Suspense>
      )}
    </Canvas>
  );
}

export default Scene3D;
