import { calculateDaysLeft } from "./expiryUtils.js";

export function getChallengeDaysRemaining(expiryDate, now = new Date()) {
  return calculateDaysLeft(expiryDate, now);
}

export function isChallengeEligible(expiryDate, now = new Date()) {
  const daysLeft = getChallengeDaysRemaining(expiryDate, now);

  return daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
}
