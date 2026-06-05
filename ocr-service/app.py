from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from utils.category_detector import detect_category
from utils.date_parser import extract_expiry_date
from utils.extractor import average_confidence, extract_product_name, run_ocr


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}

app = FastAPI(title="Expira OCR Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"success": True, "service": "expira-ocr", "status": "ok"}


@app.post("/ml/scan")
async def scan_product_image(image: UploadFile = File(...)):
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        return {"success": False, "error": "Unsupported image type."}

    suffix = Path(image.filename or "").suffix.lower() or ".jpg"
    upload_path = UPLOAD_DIR / f"{uuid4().hex}{suffix}"

    try:
        content = await image.read()
        if not content:
            return {"success": False, "error": "Uploaded image is empty."}

        upload_path.write_bytes(content)

        ocr_blocks = run_ocr(upload_path)
        full_text = "\n".join(block["text"] for block in ocr_blocks)
        date_result = extract_expiry_date(full_text)
        product_name = extract_product_name(ocr_blocks)
        category = detect_category(" ".join([product_name or "", full_text]))

        return {
            "success": True,
            "product_name": product_name,
            "expiry_date": date_result["expiry_date"],
            "raw_date": date_result["raw_date"],
            "category": category,
            "confidence": average_confidence(ocr_blocks),
        }
    except Exception as error:
        return {"success": False, "error": str(error)}
    finally:
        upload_path.unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=5001, reload=False)
