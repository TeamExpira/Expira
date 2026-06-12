import Product from "../models/Product.js";
import mongoose from "mongoose";
import { getChallengeDaysRemaining, isChallengeEligible } from "../utils/challengeUtils.js";

function userOwnsProduct(product, userId) {
  return product.addedBy?.toString() === userId?.toString();
}

export async function getActiveChallengesForUser(userId, now = new Date()) {
  const products = await Product.find({
    addedBy: userId,
    challengeCompleted: { $ne: true },
    consumed: { $ne: true },
  }).sort({ expiryDate: 1 });

  return products
    .map((product) => {
      const daysRemaining = getChallengeDaysRemaining(product.expiryDate, now);

      return {
        productId: product._id.toString(),
        productName: product.name,
        daysRemaining,
        expiryDate: product.expiryDate,
        challengeEligible: isChallengeEligible(product.expiryDate, now),
      };
    })
    .filter((challenge) => challenge.challengeEligible);
}

export async function completeChallenge({ productId, userId, now = new Date() }) {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return { error: { status: 404, message: "Product not found." } };
  }

  const product = await Product.findById(productId);

  if (!product) {
    return { error: { status: 404, message: "Product not found." } };
  }

  if (!userOwnsProduct(product, userId)) {
    return { error: { status: 403, message: "You do not have permission to access this product." } };
  }

  if (product.challengeCompleted) {
    return { error: { status: 409, message: "Challenge already completed." } };
  }

  const daysRemaining = getChallengeDaysRemaining(product.expiryDate, now);

  if (daysRemaining === null) {
    return { error: { status: 400, message: "Product expiry date is invalid." } };
  }

  if (daysRemaining < 0) {
    return { error: { status: 400, message: "Product expired before completion." } };
  }

  if (!isChallengeEligible(product.expiryDate, now)) {
    return { error: { status: 400, message: "Product is not eligible for a challenge." } };
  }

  product.consumed = true;
  product.challengeCompleted = true;
  product.challengeEligible = false;
  product.consumedAt = now;

  await product.save();

  return {
    product,
    daysRemaining,
    completedAt: product.consumedAt,
  };
}
