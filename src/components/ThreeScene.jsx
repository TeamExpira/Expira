import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function ProductBox({ position, color }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[1,1,1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export default function ThreeScene() {
  return (
    <Canvas camera={{ position: [4, 4, 5] }}>
      <ambientLight intensity={2} />
      <directionalLight position={[2,2,2]} />

      <ProductBox position={[-2,0,0]} color="green" />
      <ProductBox position={[0,0,0]} color="orange" />
      <ProductBox position={[2,0,0]} color="red" />

      <OrbitControls />
    </Canvas>
  );
}