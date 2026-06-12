import User from "../models/User.js";
import { getUserLevel } from "../utils/levelUtils.js";

export function calculateChallengeReward(daysRemaining) {
  if (daysRemaining >= 2) return 20;
  if (daysRemaining === 1) return 10;
  if (daysRemaining === 0) return 5;
  return 0;
}

export async function awardChallengePoints({ userId, product, daysRemaining, awardedAt = new Date() }) {
  const pointsAwarded = calculateChallengeReward(daysRemaining);

  if (pointsAwarded <= 0) {
    return { pointsAwarded: 0, totalPoints: 0 };
  }

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      "pointTransactions.productId": { $ne: product._id },
    },
    {
      $inc: { ecoPoints: pointsAwarded },
      $push: {
        pointTransactions: {
          productId: product._id,
          productName: product.name,
          pointsAwarded,
          awardedAt,
        },
      },
    },
    { new: true }
  );

  if (!updatedUser) {
    const user = await User.findById(userId).select("ecoPoints pointTransactions");

    if (!user) {
      return { error: { status: 404, message: "User not found." } };
    }

    return { error: { status: 409, message: "Points already awarded for this challenge." } };
  }

  return {
    pointsAwarded,
    totalPoints: updatedUser.ecoPoints,
    level: getUserLevel(updatedUser.ecoPoints),
  };
}

export async function getPointsProfile(userId) {
  const user = await User.findById(userId).select("ecoPoints pointTransactions");

  if (!user) {
    return { error: { status: 404, message: "User not found." } };
  }

  const ecoPoints = user.ecoPoints || 0;

  return {
    ecoPoints,
    level: getUserLevel(ecoPoints),
    completedChallenges: user.pointTransactions?.length || 0,
  };
}

export async function getPointHistory(userId) {
  const user = await User.findById(userId).select("pointTransactions");

  if (!user) {
    return { error: { status: 404, message: "User not found." } };
  }

  return [...(user.pointTransactions || [])]
    .sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt))
    .map((transaction) => ({
      productId: transaction.productId?.toString(),
      productName: transaction.productName,
      pointsAwarded: transaction.pointsAwarded,
      awardedAt: transaction.awardedAt,
    }));
}
