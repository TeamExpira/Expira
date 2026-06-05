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

export function getReminderLevel(daysLeft) {
  if (daysLeft === 7) return "7-day";
  if (daysLeft === 3) return "3-day";
  if (daysLeft === 1) return "1-day";
  if (daysLeft < 0) return "expired";
  return null;
}

export function formatExpiryDate(expiryDate) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(expiryDate));
}
