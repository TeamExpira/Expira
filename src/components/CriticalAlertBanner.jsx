function getProductAlertText(product) {
  if (product.daysLeft < 0) {
    return `${product.name} has expired.`;
  }

  if (product.daysLeft === 0) {
    return `${product.name} expires today.`;
  }

  return `${product.name} expires in ${product.daysLeft} day${product.daysLeft === 1 ? "" : "s"}.`;
}

function CriticalAlertBanner({ products }) {
  if (!products.length) {
    return null;
  }

  const message =
    products.length === 1
      ? getProductAlertText(products[0])
      : `${products.length} Products Require Immediate Attention`;

  return (
    <div className="critical-banner" role="alert">
      <strong>Warning: Critical Product Alert</strong>
      <span>{message}</span>
      <small>Immediate action recommended.</small>
    </div>
  );
}

export default CriticalAlertBanner;
