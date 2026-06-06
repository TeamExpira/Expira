import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, authHeaders, handleUnauthorized } from "../config/api";
import { calculateDaysLeft } from "../utils/expiryUtils";

function getCriticalProducts(products) {
  return products
    .map((product) => ({
      ...product,
      daysLeft: calculateDaysLeft(product.expiryDate),
    }))
    .filter((product) => product.daysLeft !== null && product.daysLeft <= 3)
    .sort((first, second) => first.daysLeft - second.daysLeft);
}

export function useExpiryAlerts() {
  const [criticalProducts, setCriticalProducts] = useState([]);
  const [error, setError] = useState("");

  const fetchCriticalProducts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        headers: authHeaders(),
      });
      handleUnauthorized(response);

      const products = await response.json();

      if (!response.ok) {
        throw new Error(products.message || "Unable to fetch products.");
      }

      setCriticalProducts(getCriticalProducts(products));
      setError("");
    } catch (fetchError) {
      setError(fetchError.message);
    }
  }, []);

  useEffect(() => {
    fetchCriticalProducts();
    window.addEventListener("products:changed", fetchCriticalProducts);

    return () => {
      window.removeEventListener("products:changed", fetchCriticalProducts);
    };
  }, [fetchCriticalProducts]);

  return useMemo(
    () => ({
      criticalProducts,
      hasCriticalProducts: criticalProducts.length > 0,
      error,
    }),
    [criticalProducts, error]
  );
}
