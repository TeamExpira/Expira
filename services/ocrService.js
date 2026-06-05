import { readFile } from "fs/promises";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://localhost:5001/ml/scan";
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 120000);

export class OcrServiceUnavailableError extends Error {
  constructor(message = "OCR service unavailable") {
    super(message);
    this.name = "OcrServiceUnavailableError";
  }
}

export async function scanImageWithOcr(file) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const imageBuffer = await readFile(file.path);
    const formData = new FormData();
    const imageBlob = new Blob([imageBuffer], { type: file.mimetype });

    formData.append("image", imageBlob, file.originalname);

    console.log("OCR request sent");

    const response = await fetch(OCR_SERVICE_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OcrServiceUnavailableError();
    }

    const data = await response.json();
    console.log("OCR response received");

    return data;
  } catch (error) {
    console.error("OCR failure:", error.message);

    if (error instanceof OcrServiceUnavailableError || error.name === "AbortError") {
      throw new OcrServiceUnavailableError();
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
