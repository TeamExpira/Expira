import mongoose from "mongoose";
import { calculateDaysLeft, getProductStatus } from "../utils/expiryUtils.js";
import { isChallengeEligible } from "../utils/challengeUtils.js";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "Other",
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      default: "pcs",
      trim: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    estimatedValue: {
      type: Number,
      default: 50,
      min: 0,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    challengeEligible: {
      type: Boolean,
      default: false,
    },
    consumed: {
      type: Boolean,
      default: false,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    challengeCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        const daysRemaining = calculateDaysLeft(ret.expiryDate);
        ret.daysRemaining = daysRemaining;
        ret.challengeEligible =
          isChallengeEligible(ret.expiryDate) && !ret.challengeCompleted && !ret.consumed;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

productSchema.virtual("daysLeft").get(function () {
  return calculateDaysLeft(this.expiryDate);
});

productSchema.virtual("daysRemaining").get(function () {
  return calculateDaysLeft(this.expiryDate);
});

productSchema.virtual("status").get(function () {
  const status = getProductStatus(this.daysLeft);
  return status.charAt(0).toUpperCase() + status.slice(1);
});

export default mongoose.model("Product", productSchema);
