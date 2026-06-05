import { useEffect, useState } from "react";
import { API_BASE_URL, authHeaders, handleUnauthorized } from "../config/api";

const initialForm = {
  name: "",
  category: "Food",
  quantity: "",
  unit: "pcs",
  expiryDate: "",
};

function formatDaysLeft(daysLeft) {
  if (daysLeft <= 0) {
    const daysAgo = Math.abs(daysLeft);
    return daysAgo === 0 ? "0 days left" : `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
  }

  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

function ProductList({ onProductSelect = () => {}, selectedProduct = null }) {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchProducts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        headers: authHeaders(),
      });
      handleUnauthorized(response);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to fetch products.");
      }

      setProducts(data);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          ...formData,
          quantity: Number(formData.quantity),
        }),
      });
      handleUnauthorized(response);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to add product.");
      }

      setFormData(initialForm);
      await fetchProducts();
      window.dispatchEvent(new Event("products:changed"));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId) {
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      handleUnauthorized(response);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete product.");
      }

      await fetchProducts();
      window.dispatchEvent(new Event("products:changed"));
      if (selectedProduct?._id === productId) {
        onProductSelect(null);
      }
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function handleProductClick(event, product) {
    event.stopPropagation();
    onProductSelect(selectedProduct?._id === product._id ? null : product);
  }

  return (
    <div className="product-list">
      <h2>Products</h2>

      <form className="product-form" onSubmit={handleSubmit}>
        <input
          name="name"
          placeholder="Product name"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          name="category"
          placeholder="Category"
          value={formData.category}
          onChange={handleChange}
        />
        <input
          name="quantity"
          type="number"
          min="0"
          placeholder="Quantity"
          value={formData.quantity}
          onChange={handleChange}
          required
        />
        <input name="unit" placeholder="Unit" value={formData.unit} onChange={handleChange} />
        <input
          name="expiryDate"
          type="date"
          value={formData.expiryDate}
          onChange={handleChange}
          required
        />
        <button type="submit" disabled={saving}>
          {saving ? "Adding..." : "Add Product"}
        </button>
      </form>

      {loading && <p>Loading products...</p>}
      {error && <p className="form-message">{error}</p>}
      {!loading && products.length === 0 && <p>No products added yet.</p>}

      {products.map((item) => (
        <div
          className={`card ${selectedProduct?._id === item._id ? "selected" : ""}`}
          key={item._id}
          onClick={(event) => handleProductClick(event, item)}
        >
          <h3>{item.name}</h3>
          <p>{formatDaysLeft(item.daysLeft)}</p>
          <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
          <p className="product-meta">
            {item.category || "Other"} - {item.quantity} {item.unit || "pcs"}
          </p>
          <button
            className="delete-product"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleDelete(item._id);
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default ProductList;
