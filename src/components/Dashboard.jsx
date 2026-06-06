import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThreeScene from "./ThreeSceneNew";
import ProductList from "./ProductList";
import ProductScanner from "./ProductScanner";
import CriticalAlertBanner from "./CriticalAlertBanner";
import { useExpiryAlerts } from "../hooks/useExpiryAlerts";
import { API_BASE_URL, authHeaders, clearAuthSession, handleUnauthorized } from "../config/api";
import { calculateDaysLeft, formatExpiryDate, getProductStatus, getStatusLabel } from "../utils/expiryUtils";

const CRITICAL_ALARM_SESSION_KEY = "expiraCriticalAlarmPlayed";

async function playCriticalAlarm() {
  try {
    const alarm = new Audio("/alarm.mp3");
    alarm.preload = "auto";
    await alarm.play();
    return;
  } catch {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.85);
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const [productStats, setProductStats] = useState({
    total: 0,
    warning: 0,
    critical: 0,
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [statsError, setStatsError] = useState("");
  const { criticalProducts, hasCriticalProducts, error: expiryAlertError } = useExpiryAlerts();

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
        setStatsError("");
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

  useEffect(() => {
    if (!hasCriticalProducts || sessionStorage.getItem(CRITICAL_ALARM_SESSION_KEY)) {
      return;
    }

    sessionStorage.setItem(CRITICAL_ALARM_SESSION_KEY, "true");
    playCriticalAlarm();
  }, [hasCriticalProducts]);

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

  const selectedDaysLeft = selectedProduct ? calculateDaysLeft(selectedProduct.expiryDate) : null;
  const selectedStatus =
    selectedDaysLeft === null ? selectedProduct?.status ?? null : getStatusLabel(getProductStatus(selectedDaysLeft));
  const selectedDaysText =
    selectedDaysLeft === null
      ? "Not available"
      : selectedDaysLeft < 0
      ? `${Math.abs(selectedDaysLeft)} day${Math.abs(selectedDaysLeft) === 1 ? "" : "s"} expired`
      : `${selectedDaysLeft} day${selectedDaysLeft === 1 ? "" : "s"} remaining`;
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

      <CriticalAlertBanner products={criticalProducts} />

      <div className="stats-grid">
        {stats.map((item) => (
          <div className="stat-card" key={item.label} style={{ borderColor: item.accent }}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      {(statsError || expiryAlertError) && <p className="form-message">{statsError || expiryAlertError}</p>}

      <div className="scene-status-grid">
        <div className="scene-container">
          <ThreeScene selectedStatus={selectedStatus} />
        </div>

        <div className="selected-product-panel" onClick={(event) => event.stopPropagation()}>
          <p className="eyebrow">Selected Product</p>
          {selectedProduct ? (
            <>
              <h2>{selectedProduct.name}</h2>
              <span className={`status ${selectedStatus.toLowerCase()}`}>{selectedStatus}</span>
              <dl>
                <div>
                  <dt>Days Remaining</dt>
                  <dd>{selectedDaysText}</dd>
                </div>
                <div>
                  <dt>Expiry Date</dt>
                  <dd>{formatExpiryDate(selectedProduct.expiryDate)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="subtitle">Select a product to inspect expiry status in the visualization.</p>
          )}
        </div>
      </div>

      <div className="grid-two">
        <ProductList onProductSelect={setSelectedProduct} selectedProduct={selectedProduct} />
        <ProductScanner />
      </div>
    </div>
  );
}

export default Dashboard;
