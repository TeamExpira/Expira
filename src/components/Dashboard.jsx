import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThreeScene from "./ThreeSceneNew";
import ProductList from "./ProductList";
import ProductScanner from "./ProductScanner";
import { API_BASE_URL, authHeaders, clearAuthSession, handleUnauthorized } from "../config/api";

function Dashboard() {
  const navigate = useNavigate();
  const [productStats, setProductStats] = useState({
    total: 0,
    warning: 0,
    critical: 0,
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/products/stats`, {
          headers: authHeaders(),
        });
        handleUnauthorized(response);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to fetch product stats.");
        }

        setProductStats(data);
      } catch (error) {
        setStatsError(error.message);
      }
    }

    fetchStats();
    window.addEventListener("products:changed", fetchStats);

    return () => {
      window.removeEventListener("products:changed", fetchStats);
    };
  }, []);

  function handleLogout() {
    clearAuthSession();
    navigate("/login", { replace: true });
  }

  const stats = [
    { label: "Total Products", value: productStats.total, accent: "var(--accent)" },
    {
      label: "Expiring Soon",
      value: productStats.warning + productStats.critical,
      accent: "var(--warning)",
    },
    { label: "Critical", value: productStats.critical, accent: "var(--danger)" },
  ];

  return (
    <div className="dashboard" onClick={() => setSelectedProduct(null)}>
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Smart Expiry Reminder</p>
          <h1>Inventory Dashboard</h1>
          <p className="subtitle">
            Monitor product freshness, inspect items using the scanner, and review expiry risks in one place.
          </p>
        </div>
        <button className="logout-button" type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="stats-grid">
        {stats.map((item) => (
          <div className="stat-card" key={item.label} style={{ borderColor: item.accent }}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      {statsError && <p className="form-message">{statsError}</p>}

      <div className="scene-container">
        <ThreeScene selectedStatus={selectedProduct?.status ?? null} />
      </div>

      <div className="grid-two">
        <ProductList onProductSelect={setSelectedProduct} selectedProduct={selectedProduct} />
        <ProductScanner />
      </div>
    </div>
  );
}

export default Dashboard;
