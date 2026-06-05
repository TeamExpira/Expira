import { unlink } from "fs/promises";
import express from "express";
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

    return res.status(200).json({
      success: true,
      product_name: ocrData.product_name || "",
      category: ocrData.category || "",
      expiry_date: parsedExpiryDate ? parsedExpiryDate.toISOString().slice(0, 10) : "",
      raw_date: ocrData.raw_date || null,
      confidence: ocrData.confidence ?? 0,
      ...(parsedExpiryDate ? {} : { warning: "Expiry date not detected. Please enter manually." }),
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
