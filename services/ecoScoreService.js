import mongoose from "mongoose";
import Product from "../models/Product.js";
import User from "../models/User.js";
import {
  calculateEcoScore,
  calculateWasteReductionRate,
  getEcoRating,
} from "../utils/ecoScoreUtils.js";

const CARBON_SAVED_PER_PRODUCT_KG = 0.5;
const DEFAULT_ESTIMATED_VALUE = 50;

function getStartOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getMonthRange(now = new Date()) {
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    nextMonthStart: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function getMonthLabel(now = new Date()) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(now);
}

function buildMetrics({ productsSaved, productsWasted, moneySaved, ecoPoints }) {
  const wasteReductionRate = calculateWasteReductionRate(productsSaved, productsWasted);
  const carbonSaved = Number((productsSaved * CARBON_SAVED_PER_PRODUCT_KG).toFixed(2));
  const ecoScore = calculateEcoScore({ wasteReductionRate, productsSaved, ecoPoints });

  return {
    productsSaved,
    productsWasted,
    wasteReductionRate,
    moneySaved,
    carbonSaved,
    ecoPoints,
    ecoScore,
    ecoRating: getEcoRating(ecoScore),
  };
}

async function getUserEcoPoints(userId) {
  const user = await User.findById(userId).select("ecoPoints");

  if (!user) {
    return { error: { status: 404, message: "User not found." } };
  }

  return { ecoPoints: user.ecoPoints || 0 };
}

export async function getEcoScoreAnalytics(userId, now = new Date()) {
  const userPoints = await getUserEcoPoints(userId);

  if (userPoints.error) {
    return userPoints;
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const startOfToday = getStartOfToday(now);
  const [metrics = {}] = await Product.aggregate([
    { $match: { addedBy: userObjectId } },
    {
      $facet: {
        saved: [
          { $match: { consumed: true, challengeCompleted: true } },
          {
            $group: {
              _id: null,
              productsSaved: { $sum: 1 },
              moneySaved: { $sum: { $ifNull: ["$estimatedValue", DEFAULT_ESTIMATED_VALUE] } },
            },
          },
        ],
        wasted: [
          { $match: { consumed: { $ne: true }, expiryDate: { $lt: startOfToday } } },
          { $count: "productsWasted" },
        ],
      },
    },
  ]);

  const saved = metrics.saved?.[0] || {};
  const wasted = metrics.wasted?.[0] || {};

  return buildMetrics({
    productsSaved: saved.productsSaved || 0,
    productsWasted: wasted.productsWasted || 0,
    moneySaved: saved.moneySaved || 0,
    ecoPoints: userPoints.ecoPoints,
  });
}

export async function getMonthlyEcoScoreAnalytics(userId, now = new Date()) {
  const userPoints = await getUserEcoPoints(userId);

  if (userPoints.error) {
    return userPoints;
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const startOfToday = getStartOfToday(now);
  const { monthStart, nextMonthStart } = getMonthRange(now);
  const [metrics = {}] = await Product.aggregate([
    { $match: { addedBy: userObjectId } },
    {
      $facet: {
        saved: [
          {
            $match: {
              consumed: true,
              challengeCompleted: true,
              consumedAt: { $gte: monthStart, $lt: nextMonthStart },
            },
          },
          {
            $group: {
              _id: null,
              productsSaved: { $sum: 1 },
              moneySaved: { $sum: { $ifNull: ["$estimatedValue", DEFAULT_ESTIMATED_VALUE] } },
            },
          },
        ],
        wasted: [
          {
            $match: {
              consumed: { $ne: true },
              expiryDate: { $gte: monthStart, $lt: startOfToday },
            },
          },
          { $count: "productsWasted" },
        ],
      },
    },
  ]);

  const saved = metrics.saved?.[0] || {};
  const wasted = metrics.wasted?.[0] || {};
  const analytics = buildMetrics({
    productsSaved: saved.productsSaved || 0,
    productsWasted: wasted.productsWasted || 0,
    moneySaved: saved.moneySaved || 0,
    ecoPoints: userPoints.ecoPoints,
  });

  return {
    month: getMonthLabel(now),
    productsSaved: analytics.productsSaved,
    productsWasted: analytics.productsWasted,
    ecoScore: analytics.ecoScore,
  };
}
