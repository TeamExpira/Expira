import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function ProductBox({ position, color }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color={color} metalness={0.2} roughness={0.3} />
    </mesh>
  );
}

export default function ThreeScene() {
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
        <ProductBox position={[-2, 0.5, 0]} color="#22c55e" />
        <ProductBox position={[0, 0.5, 0]} color="#f59e0b" />
        <ProductBox position={[2, 0.5, 0]} color="#ef4444" />
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
