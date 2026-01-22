import express from "express";
import multer from "multer";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

let images = [];

app.post("/upload", (req, res) => {
  upload.single("image")(req, res, err => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large" });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: "uploads" },
      (error, result) => {
        if (error) {
          return res.status(500).json({ error: "Cloudinary upload failed" });
        }

        const image = {
          id: result.public_id,
          url: result.secure_url,
          public_id: result.public_id,
        };

        images.push(image);
        res.json(image);
      }
    );

    stream.end(req.file.buffer);
  });
});

app.get("/images", (req, res) => {
  res.json(images);
});

app.delete("/images/:id", async (req, res) => {
  try {
    const index = images.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Not found" });
    }

    const image = images[index];
    await cloudinary.uploader.destroy(image.public_id);
    images.splice(index, 1);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

app.get("/test", (req, res) => {
  res.json({ status: "OK" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
