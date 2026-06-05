import { unlink } from "fs/promises";
import express from "express";
import Product from "../models/Product.js";
import { authenticateToken } from "../middleware/auth.js";
import { uploadProductImage } from "../middleware/upload.js";
import { OcrServiceUnavailableError, scanImageWithOcr } from "../services/ocrService.js";

const router = express.Router();

function getExpiryDate(expiryDate) {
  if (!expiryDate) {
    return null;
  }

  const parsedDate = new Date(expiryDate);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

router.post("/", authenticateToken, uploadProductImage, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Product image is required." });
  }

  try {
    const ocrData = await scanImageWithOcr(req.file);

    if (!ocrData.success) {
      return res.status(502).json({
        success: false,
        message: ocrData.error || "OCR scan failed.",
      });
    }

    const parsedExpiryDate = getExpiryDate(ocrData.expiry_date);
    const warning = parsedExpiryDate ? undefined : "Expiry date could not be detected";

    const product = await Product.create({
      name: ocrData.product_name || "Scanned Product",
      category: ocrData.category || "General",
      quantity: 1,
      unit: "pcs",
      expiryDate: parsedExpiryDate || new Date(),
      addedBy: req.user.id,
    });

    console.log("Product created");

    return res.status(201).json({
      success: true,
      ...(warning ? { warning } : {}),
      product,
      ocr: {
        raw_date: ocrData.raw_date || null,
        confidence: ocrData.confidence ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof OcrServiceUnavailableError) {
      return res.status(503).json({ success: false, message: "OCR service unavailable" });
    }

    console.error(error);
    return res.status(500).json({ success: false, message: "Unable to scan product image." });
  } finally {
    if (req.file?.path) {
      await unlink(req.file.path).catch(() => {});
    }
  }
});

export default router;
