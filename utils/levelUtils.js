export function getUserLevel(points = 0) {
  if (points >= 600) return "Zero Waste Hero";
  if (points >= 300) return "Eco Guardian";
  if (points >= 100) return "Waste Warrior";
  return "Beginner Saver";
}
