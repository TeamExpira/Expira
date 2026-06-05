import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";

const BOXES = [
  { id: "Safe", position: [-2, 0.5, 0], baseColor: "#22c55e", emissiveColor: "#4ade80" },
  { id: "Warning", position: [0, 0.5, 0], baseColor: "#f59e0b", emissiveColor: "#fcd34d" },
  { id: "Critical", position: [2, 0.5, 0], baseColor: "#ef4444", emissiveColor: "#f87171" },
];

function ProductBox({ id, position, baseColor, emissiveColor, isActive, isIdle }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;

    const idlePulse = 0.4 + Math.sin(clock.elapsedTime * 2) * 0.2;
    const targetIntensity = isIdle ? idlePulse : isActive ? 1.5 : 0.05;
    const targetScale = isActive ? 1.15 : isIdle ? 1 : 0.9;

    materialRef.current.emissiveIntensity +=
      (targetIntensity - materialRef.current.emissiveIntensity) * 0.08;
    meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.08;
    meshRef.current.scale.y += (targetScale - meshRef.current.scale.y) * 0.08;
    meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.08;
  });

  const labelOpacity = isIdle ? 0.7 : isActive ? 1 : 0.4;

  return (
    <group position={position}>
      <pointLight color={emissiveColor} intensity={isActive ? 2 : 0} distance={4} position={[0, 2, 0]} />
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial
          ref={materialRef}
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={0.35}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>
      <Text
        position={[0, 1, 0]}
        fontSize={0.25}
        color={baseColor}
        anchorX="center"
        anchorY="middle"
        material-transparent
        material-opacity={labelOpacity}
      >
        {id}
      </Text>
    </group>
  );
}

export default function ThreeScene({ selectedStatus = null }) {
  const normalizedStatus = selectedStatus === "Expired" ? "Critical" : selectedStatus;
  const isIdle = normalizedStatus === null;

  return (
    <Canvas shadows camera={{ position: [6, 5, 8], fov: 40 }}>
      <color attach="background" args={["#070b16"]} />
      <fog attach="fog" args={["#070b16", 6, 18]} />

      <ambientLight intensity={0.9} />
      <directionalLight
        castShadow
        intensity={1.2}
        position={[5, 8, 5]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={20}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight intensity={0.4} position={[-6, 4, -4]} />

      <group position={[0, -0.85, 0]}>
        {BOXES.map((box) => (
          <ProductBox
            key={box.id}
            {...box}
            isActive={box.id === normalizedStatus}
            isIdle={isIdle}
          />
        ))}
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#0b1120" metalness={0.1} roughness={0.8} />
      </mesh>

      <gridHelper args={[16, 16, "#334155", "#0f172a"]} />
      <OrbitControls enableDamping makeDefault />
    </Canvas>
  );
}
