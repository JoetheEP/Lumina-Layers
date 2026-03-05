import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Compute the offset needed to center a bounding box at the origin.
 * Pure function, independently testable.
 */
export function computeCenterOffset(
  min: [number, number, number],
  max: [number, number, number],
): [number, number, number] {
  return [
    -(min[0] + max[0]) / 2,
    -(min[1] + max[1]) / 2,
    -(min[2] + max[2]) / 2,
  ];
}

interface ModelViewerProps {
  url: string;
}

function ModelViewer({ url }: ModelViewerProps) {
  const { scene } = useGLTF(url);

  // Clone the scene so we don't mutate the cached original from useGLTF.
  // Direct mutation of the shared scene causes re-render loops and WebGL context loss.
  const centeredScene = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const min = box.min.toArray() as [number, number, number];
    const max = box.max.toArray() as [number, number, number];
    const [ox, oy, oz] = computeCenterOffset(min, max);
    clone.position.set(ox, oy, oz);
    return clone;
  }, [scene]);

  return <primitive object={centeredScene} />;
}

export default ModelViewer;
