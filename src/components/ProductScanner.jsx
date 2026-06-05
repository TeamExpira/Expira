import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, authHeaders, handleUnauthorized } from "../config/api";

const initialEditedProduct = {
  name: "",
  category: "",
  expiryDate: "",
};

function getConfidenceDetails(confidence = 0) {
  const rawScore = Number(confidence || 0);
  const score = Math.min(100, Math.max(0, Math.round(rawScore > 1 ? rawScore : rawScore * 100)));

  if (score >= 95) {
    return { score, label: "Excellent", className: "excellent" };
  }

  if (score >= 80) {
    return { score, label: "Good", className: "good" };
  }

  if (score >= 60) {
    return { score, label: "Medium", className: "medium" };
  }

  return { score, label: "Low Confidence", className: "low" };
}

function formatDisplayDate(dateValue) {
  if (!dateValue) {
    return "Not detected";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function ProductScanner() {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [editedProduct, setEditedProduct] = useState(initialEditedProduct);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function handleUpload(event) {
    const file = event.target.files[0];

    setError("");
    setSuccess("");
    setOcrResult(null);
    setEditedProduct(initialEditedProduct);
    setImage(file || null);

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPreview(file ? URL.createObjectURL(file) : "");
  }

  function handleEditChange(event) {
    const { name, value } = event.target;
    setEditedProduct((current) => ({ ...current, [name]: value }));
  }

  async function handleScan() {
    if (!image) {
      setError("Please select an image to scan.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setOcrResult(null);

    const formData = new FormData();
    formData.append("image", image);

    try {
      const response = await fetch(`${API_BASE_URL}/api/products/scan`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      handleUnauthorized(response);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to detect product details. Please try another image.");
      }

      setOcrResult(data);
      setEditedProduct({
        name: data.product_name || "",
        category: data.category || "Other",
        expiryDate: data.expiry_date || "",
      });

      if (!data.expiry_date) {
        setError("Expiry date not detected. Please enter manually.");
      }
    } catch (scanError) {
      setError(scanError.message || "Unable to detect product details. Please try another image.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmProduct(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          ...editedProduct,
          quantity: 1,
          unit: "pcs",
        }),
      });
      handleUnauthorized(response);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to add product.");
      }

      setImage(null);
      setPreview("");
      setOcrResult(null);
      setEditedProduct(initialEditedProduct);
      setSuccess("Product Added Successfully");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      window.dispatchEvent(new Event("products:changed"));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  const confidence = getConfidenceDetails(ocrResult?.confidence);
  const controlsDisabled = loading || saving;

  return (
    <div className="scanner-panel">
      <h2>Scan Product</h2>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUpload}
        disabled={controlsDisabled}
      />

      {preview && <img src={preview} width="250" alt="Scanned item preview" />}

      <button type="button" onClick={handleScan} disabled={!image || controlsDisabled}>
        {loading ? "Scanning..." : "Scan Product"}
      </button>

      {loading && (
        <div className="scanner-status" role="status" aria-live="polite">
          <span className="scanner-spinner" aria-hidden="true" />
          <p>Scanning Product...</p>
          <p>Extracting Expiry Date...</p>
          <p>Please Wait...</p>
        </div>
      )}

      {error && <p className="form-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {ocrResult && (
        <form className="ocr-review-card" onSubmit={handleConfirmProduct}>
          <div className="ocr-review-header">
            <h3>Detected Product Information</h3>
            <span className={`confidence-badge ${confidence.className}`}>
              {confidence.score}% - {confidence.label}
            </span>
          </div>

          <p className="ocr-warning">Please verify extracted details.</p>

          <div className="ocr-detected-grid">
            <div>
              <span>Product Name</span>
              <strong>{ocrResult.product_name || "Not detected"}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>{ocrResult.category || "Not detected"}</strong>
            </div>
            <div>
              <span>Expiry Date</span>
              <strong>{formatDisplayDate(ocrResult.expiry_date)}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{confidence.score}%</strong>
            </div>
          </div>

          <div className="ocr-edit-fields">
            <label>
              Product Name
              <input
                name="name"
                value={editedProduct.name}
                onChange={handleEditChange}
                required
                disabled={controlsDisabled}
              />
            </label>
            <label>
              Category
              <input
                name="category"
                value={editedProduct.category}
                onChange={handleEditChange}
                disabled={controlsDisabled}
              />
            </label>
            <label>
              Expiry Date
              <input
                name="expiryDate"
                type="date"
                value={editedProduct.expiryDate}
                onChange={handleEditChange}
                required
                disabled={controlsDisabled}
              />
            </label>
          </div>

          <button type="submit" disabled={saving || loading}>
            {saving ? "Saving..." : "Confirm Product"}
          </button>
        </form>
      )}
    </div>
  );
}

export default ProductScanner;
