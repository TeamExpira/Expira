export function calculateWasteReductionRate(productsSaved, productsWasted) {
  const totalTracked = productsSaved + productsWasted;

  if (totalTracked === 0) {
    return 0;
  }

  return Math.round((productsSaved / totalTracked) * 100);
}

export function calculateEcoScore({ wasteReductionRate, productsSaved, ecoPoints }) {
  const rawScore = wasteReductionRate * 0.6 + productsSaved * 2 + ecoPoints * 0.1;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

export function getEcoRating(score) {
  if (score >= 80) return "Zero Waste Champion";
  if (score >= 60) return "Eco Performer";
  if (score >= 40) return "Eco Starter";
  return "Needs Improvement";
}
