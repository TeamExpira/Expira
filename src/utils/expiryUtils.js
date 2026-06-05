const DAY_MS = 1000 * 60 * 60 * 24;

export function calculateDaysLeft(expiryDate, now = new Date()) {
  const expiry = new Date(expiryDate);

  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.ceil((expiryDay - today) / DAY_MS);
}

export function getProductStatus(daysLeft) {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 30) return "warning";
  return "safe";
}

export function getStatusLabel(status) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Safe";
}

export function formatExpiryDate(expiryDate) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(expiryDate));
}
