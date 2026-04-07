import express from "express";
import upload from "../middleware/upload.js";
import { verifyToken } from "../middleware/verifyToken.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

// POST /api/upload — upload a single file, return Cloudinary URL
router.post("/", verifyToken, upload.single("file"), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ success: false, message: "No file provided" });
        }

        const isImage = req.file.mimetype?.startsWith("image/");
        const originalName = req.file.originalname || "upload";
        const ext = (originalName.split(".").pop() || "").toLowerCase();
        const baseName = originalName.replace(/\.[^/.]+$/, "");
        const safeBase = baseName
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80) || "file";
        const rawPublicId = ext
            ? `${safeBase}-${Date.now()}.${ext}`
            : `${safeBase}-${Date.now()}`;

        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: "circlecore",
                    resource_type: isImage ? "image" : "raw",
                    ...(isImage
                        ? { use_filename: true, unique_filename: true }
                        : { public_id: rawPublicId, unique_filename: false, use_filename: false }),
                },
                (err, result) => {
                    if (err) return reject(err);
                    return resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        const url = uploadResult?.secure_url || uploadResult?.url;
        if (!url) {
            return res.status(500).json({ success: false, message: "Upload succeeded but URL missing" });
        }

        return res.status(200).json({ success: true, url });
    } catch (error) {
        console.log("Error in upload route:", error);
        return res.status(500).json({ success: false, message: error.message || "Upload failed" });
    }
});

router.use((err, req, res, next) => {
    if (!err) return next();
    console.log("Upload middleware error:", err);
    return res.status(400).json({
        success: false,
        message: err.message || "Upload failed",
    });
});

export default router;
