import express from "express";
import multer from "multer";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
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

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    console.log("📥 Получен запрос на загрузку");
    console.log("📁 Файл:", req.file ? "есть" : "нет");
    console.log("📋 Тело запроса:", req.body);
    console.log("🏷️ Категория:", req.body.category);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!req.body.category) {
      return res.status(400).json({ error: "Category is required" });
    }

    // Загружаем на Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          folder: "uploads",
          resource_type: "auto"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      stream.end(req.file.buffer);
    });

    const image = {
      id: result.public_id,
      url: result.secure_url,
      public_id: result.public_id,
      filename: req.file.originalname,
      category: req.body.category,
      uploadedAt: new Date().toISOString()
    };

    images.push(image);
    
    console.log("✅ Изображение успешно загружено:", image);
    res.json(image);

  } catch (error) {
    console.error("❌ Ошибка загрузки:", error);
    res.status(500).json({ 
      error: "Upload failed",
      details: error.message 
    });
  }
});

app.get("/images", (req, res) => {
  console.log("📸 Отправляем список изображений:", images.length);
  res.json(images);
});

app.delete("/images/:id", async (req, res) => {
  try {
    console.log("🗑️ Удаление изображения:", req.params.id);
    
    const index = images.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Image not found" });
    }

    const image = images[index];
    
    await cloudinary.uploader.destroy(image.public_id);
    
    images.splice(index, 1);

    console.log("✅ Изображение удалено:", req.params.id);
    res.json({ success: true });

  } catch (error) {
    console.error("❌ Ошибка удаления:", error);
    res.status(500).json({ 
      error: "Delete failed",
      details: error.message 
    });
  }
});

app.get("/test", (req, res) => {
  console.log("🔗 Тестовый запрос получен");
  res.json({ 
    status: "OK", 
    message: "Server is running",
    imagesCount: images.length,
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
});