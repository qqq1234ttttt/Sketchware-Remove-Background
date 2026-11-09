const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const app = express();

app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.REMOVE_BG_API_KEY;

const REMOVE_BG_URL =
    "https://api.remove.bg/v1.0/removebg";

// Image upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 12 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("INVALID_IMAGE"));
        }

        cb(null, true);
    }
});

// Request limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: "Request limit exceeded"
    }
});

// Health check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "NewPic AI Backend is running"
    });
});

// Background removal
app.post(
    "/removebg",
    limiter,
    upload.single("image_file"),
    async (req, res) => {

        try {

            if (!API_KEY) {
                return res.status(500).json({
                    success: false,
                    error: "Server API Key is missing"
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "Image file is required"
                });
            }

            const formData = new FormData();

            const imageBlob = new Blob(
                [req.file.buffer],
                { type: req.file.mimetype }
            );

            formData.append(
                "image_file",
                imageBlob,
                "image.png"
            );

            formData.append("size", "auto");

            const response = await fetch(
                REMOVE_BG_URL,
                {
                    method: "POST",

                    headers: {
                        "X-Api-Key": API_KEY
                    },

                    body: formData
                }
            );

            if (!response.ok) {

                const errorText =
                    await response.text();

                console.error(
                    "Remove.bg Error:",
                    response.status,
                    errorText
                );

                return res.status(response.status).json({
                    success: false,
                    status: response.status,
                    error: errorText
                });
            }

            const imageBuffer = Buffer.from(
                await response.arrayBuffer()
            );

            res.setHeader(
                "Content-Type",
                "image/png"
            );

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.status(200).send(imageBuffer);

        } catch (error) {

            console.error(
                "Backend Error:",
                error.message
            );

            res.status(500).json({
                success: false,
                error: "Backend processing failed"
            });

        }
    }
);

// Error handler
app.use((error, req, res, next) => {

    if (error instanceof multer.MulterError) {

        return res.status(413).json({
            success: false,
            error: "Image is too large"
        });

    }

    if (error.message === "INVALID_IMAGE") {

        return res.status(400).json({
            success: false,
            error: "Invalid image format"
        });

    }

    console.error(error);

    res.status(500).json({
        success: false,
        error: "Internal server error"
    });

});

// Start server
app.listen(PORT, "0.0.0.0", () => {

    console.log(
        "NewPic AI Backend running on port " + PORT
    );

});
