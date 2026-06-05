import ThreeScene from "./ThreeSceneNew";
import ProductList from "./ProductList";
import ProductScanner from "./ProductScanner";

const stats = [
  { label: "Total Products", value: 112, accent: "var(--accent)" },
  { label: "Expiring Soon", value: 8, accent: "var(--warning)" },
  { label: "Critical", value: 3, accent: "var(--danger)" },
];

function Dashboard() {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Smart Expiry Reminder</p>
          <h1>Inventory Dashboard</h1>
          <p className="subtitle">
            Monitor product freshness, inspect items using the scanner, and review expiry risks in one place.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((item) => (
          <div className="stat-card" key={item.label} style={{ borderColor: item.accent }}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="scene-container">
        <ThreeScene />
      </div>

      <div className="grid-two">
        <ProductList />
        <ProductScanner />
      </div>
    </div>
  );
}

export default Dashboard;