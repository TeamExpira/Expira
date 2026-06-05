import nodemailer from "nodemailer";
import Product from "../models/Product.js";
import ReminderHistory from "../models/ReminderHistory.js";
import { calculateDaysLeft, formatExpiryDate, getReminderLevel } from "../utils/expiryUtils.js";

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function createEmailBody(product, daysLeft) {
  return [
    `Product: ${product.name}`,
    "",
    `Category: ${product.category || "Other"}`,
    "",
    `Expiry Date: ${formatExpiryDate(product.expiryDate)}`,
    "",
    `Days Remaining: ${daysLeft}`,
    "",
    "Please take necessary action.",
  ].join("\n");
}

export async function sendExpiryReminder(product, daysLeft) {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn("Expiry reminder skipped: SMTP configuration is incomplete.");
    return false;
  }

  if (!product.addedBy?.email) {
    console.warn(`Expiry reminder skipped: user email missing for product ${product._id}.`);
    return false;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: product.addedBy.email,
    subject: "Product Expiry Reminder",
    text: createEmailBody(product, daysLeft),
  });

  return true;
}

export async function runExpiryReminderCheck(now = new Date()) {
  const products = await Product.find({}).populate("addedBy", "email");
  const summary = {
    checked: products.length,
    sent: 0,
    skipped: 0,
  };

  for (const product of products) {
    const daysLeft = calculateDaysLeft(product.expiryDate, now);
    const level = getReminderLevel(daysLeft);

    if (!level || !product.addedBy?._id) {
      summary.skipped += 1;
      continue;
    }

    const alreadySent = await ReminderHistory.exists({
      product: product._id,
      user: product.addedBy._id,
      level,
    });

    if (alreadySent) {
      summary.skipped += 1;
      continue;
    }

    const wasSent = await sendExpiryReminder(product, daysLeft);

    if (!wasSent) {
      summary.skipped += 1;
      continue;
    }

    await ReminderHistory.create({
      product: product._id,
      user: product.addedBy._id,
      level,
    });
    summary.sent += 1;
  }

  return summary;
}
