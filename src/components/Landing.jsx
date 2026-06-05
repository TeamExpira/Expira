import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere, Icosahedron } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";


function AnimatedIcosahedron() {
  const meshRef = useRef();
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.001;
      meshRef.current.rotation.y += 0.002;
    }
  });

  return (
    <Icosahedron ref={meshRef} args={[1, 4]} scale={2}>
      <meshPhongMaterial 
        color="#00d4ff" 
        emissive="#0099cc" 
        wireframe={false}
        shininess={100}
      />
    </Icosahedron>
  );
}


function Particles() {
  const particles = useRef();
  
  useFrame(() => {
    if (particles.current) {
      particles.current.rotation.x += 0.0002;
      particles.current.rotation.y += 0.0003;
    }
  });

  const particlePositions = new Float32Array(300);
  for (let i = 0; i < 300; i += 3) {
    particlePositions[i] = (Math.random() - 0.5) * 40;
    particlePositions[i + 1] = (Math.random() - 0.5) * 40;
    particlePositions[i + 2] = (Math.random() - 0.5) * 40;
  }

  return (
    <points ref={particles}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlePositions.length / 3}
          array={particlePositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} sizeAttenuation={true} color="#00d4ff" />
    </points>
  );
}

function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 75 }} className="hero-canvas">
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#00d4ff" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#ff006e" />
      
      <AnimatedIcosahedron />
      <Particles />
    </Canvas>
  );
}


export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      
      <section className="hero-section">
        <HeroScene />
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">EXPIRA</h1>
            <p className="hero-subtitle">Inventory Management System</p>
            <p className="hero-description">
              Revolutionize your inventory with real-time tracking and 3D product visualization
            </p>
            <div className="hero-buttons">
              <button
                className="btn btn-primary"
                onClick={() => navigate("/signup")}
              >
                Sign Up
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate("/login")}
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </section>

      
      <section className="features-section">
        <h2>Why Choose Expira?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Real-time Tracking</h3>
            <p>Monitor your inventory in real-time with live updates and instant notifications</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>3D Visualization</h3>
            <p>Interactive 3D product visualization for better product understanding</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analytics Dashboard</h3>
            <p>Comprehensive insights and analytics to optimize your inventory</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔐</div>
            <h3>Secure & Reliable</h3>
            <p>Enterprise-grade security with role-based access control</p>
          </div>
        </div>
      </section>

      
      <section className="cta-section">
        <h2>Ready to Transform Your Inventory Management?</h2>
        <p>Join thousands of businesses using Expira to streamline operations</p>
        <button className="btn btn-primary btn-large">
          Start Free Trial
        </button>
      </section>

    
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>About Expira</h4>
            <p>Next-generation inventory management system</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#terms">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Expira. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
