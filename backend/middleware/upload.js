import multer from "multer";
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx", "txt", "csv", "xls", "xlsx", "ppt", "pptx"]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const ext = (file.originalname?.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return cb(new Error("Unsupported file type"));
    }
    return cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export default upload;
