import nodemailer from "nodemailer";
import { formatExpiryDate } from "../utils/expiryUtils.js";

const REMINDER_SUBJECTS = {
  "7-day": "Product Expiry Reminder - 7 Days Remaining",
  "3-day": "Urgent Product Expiry Reminder - 3 Days Remaining",
  "1-day": "Critical Product Expiry Reminder - 1 Day Remaining",
  expired: "Product Expired",
};

function createEmailTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

function buildExpiryReminderBody(product, daysLeft) {
  return [
    "Hello,",
    "",
    "The following product requires attention:",
    "",
    `Product: ${product.name}`,
    "",
    `Category: ${product.category || "Other"}`,
    "",
    `Expiry Date: ${formatExpiryDate(product.expiryDate)}`,
    "",
    `Days Remaining: ${daysLeft < 0 ? "Expired" : daysLeft}`,
    "",
    "Please take necessary action.",
    "",
    "Expira Inventory System",
  ].join("\n");
}

export async function sendExpiryAlertEmail({ product, daysLeft, level }) {
  const transporter = createEmailTransporter();

  if (!transporter) {
    console.warn("Expiry email skipped: EMAIL_USER or EMAIL_PASSWORD is missing.");
    return false;
  }

  if (!product.addedBy?.email) {
    console.warn(`Expiry email skipped: user email missing for product ${product._id}.`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: product.addedBy.email,
      subject: REMINDER_SUBJECTS[level],
      text: buildExpiryReminderBody(product, daysLeft),
    });

    console.log(`Expiry email sent: ${level} reminder for product ${product._id}.`);
    return true;
  } catch (error) {
    console.error(`Expiry email failed for product ${product._id}:`, error);
    return false;
  }
}
