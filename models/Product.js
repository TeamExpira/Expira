import mongoose from "mongoose";
import { calculateDaysLeft, getProductStatus } from "../utils/expiryUtils.js";

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
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.virtual("daysLeft").get(function () {
  return calculateDaysLeft(this.expiryDate);
});

productSchema.virtual("status").get(function () {
  const status = getProductStatus(this.daysLeft);
  return status.charAt(0).toUpperCase() + status.slice(1);
});

export default mongoose.model("Product", productSchema);
