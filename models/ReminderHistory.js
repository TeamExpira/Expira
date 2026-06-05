import mongoose from "mongoose";

const reminderHistorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    level: {
      type: String,
      enum: ["7-day", "3-day", "1-day", "expired"],
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

reminderHistorySchema.index({ product: 1, user: 1, level: 1 }, { unique: true });

export default mongoose.models.ReminderHistory ||
  mongoose.model("ReminderHistory", reminderHistorySchema);
