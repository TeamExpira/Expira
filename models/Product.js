import mongoose from "mongoose";

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
  return Math.ceil((this.expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
});

productSchema.virtual("status").get(function () {
  const daysLeft = this.daysLeft;

  if (daysLeft <= 0) return "Expired";
  if (daysLeft <= 3) return "Critical";
  if (daysLeft <= 10) return "Warning";
  return "Safe";
});

export default mongoose.model("Product", productSchema);
