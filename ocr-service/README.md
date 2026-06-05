# Expira OCR Service

Standalone OCR microservice for Expira product label scanning.

This service runs independently from the existing React frontend, Express backend, MongoDB models, and authentication flow.

## Features

- Accepts product images through `multipart/form-data`
- Preprocesses images with OpenCV grayscale, denoise, and contrast enhancement
- Runs EasyOCR in CPU mode
- Extracts likely expiry dates from common product label formats
- Estimates product name from high-confidence OCR text blocks
- Detects a simple keyword-based category
- Returns average OCR confidence

## Installation

```bash
cd ocr-service
pip install -r requirements.txt
```

## Run

```bash
uvicorn app:app --reload --port 5001
```

The service will be available at:

```txt
http://localhost:5001
```

## API

### Health Check

```txt
GET /health
```

### Scan Product Image

```txt
POST /ml/scan
```

Form field:

```txt
image
```

Example:

```bash
curl -X POST \
  -F "image=@sample.jpg" \
  http://localhost:5001/ml/scan
```

Success response:

```json
{
  "success": true,
  "product_name": "Amul Milk",
  "expiry_date": "2026-06-20",
  "raw_date": "20/06/2026",
  "category": "Dairy",
  "confidence": 0.91
}
```

Failure response:

```json
{
  "success": false,
  "error": "Unsupported image type."
}
```

## Supported Date Examples

- `12/06/2026`
- `12-06-2026`
- `2026-06-12`
- `12 JUN 2026`
- `JUN 12 2026`
- `EXP 12/06/26`
- `BEST BEFORE 6 MONTHS`

For relative values such as `BEST BEFORE 6 MONTHS`, the service adds the duration to a detected `MFG`, `MFD`, `PKD`, or `PACKED` date when available. If no reference date is detected, it uses the current date.

## CORS

Allowed origins:

- `http://localhost:5173`
- `http://localhost:3000`
