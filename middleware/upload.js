import fs from "fs";
import path from "path";
import multer from "multer";

const UPLOAD_DIR = path.resolve("uploads");
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    const safeExtension = path.extname(file.originalname).toLowerCase() || ".jpg";
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`);
  },
});

const productImageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype) || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      return callback(new Error("Only JPG and PNG images are allowed."));
    }

    callback(null, true);
  },
});

export function uploadProductImage(req, res, next) {
  productImageUpload.single("image")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "Image must be 10 MB or smaller." });
    }

    return res.status(400).json({ success: false, message: error.message });
  });
}
