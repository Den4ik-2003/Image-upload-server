import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, 
});

app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let images = [];

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    cloudinary.uploader.upload_stream(
      { folder: "uploads" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary error:", error);
          return res.status(500).json({ error: "Cloudinary upload failed" });
        }

        res.json({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    ).end(req.file.buffer);

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/images", (req, res) => {
  console.log("\n📥 Запит на отримання всіх зображень");
  console.log("📸 Кількість зображень:", images.length);
  res.json(images);
});

app.get("/test", (req, res) => {
  console.log("✅ Тестовий запит отримано");
  res.json({ 
    status: "OK", 
    message: "Сервер працює",
    imagesCount: images.length,
    uploadsFolder: uploadsDir
  });
});

app.delete("/images/:id", async (req, res) => {
  console.log("\n🗑️ Запит на видалення зображення");
  console.log("ID для видалення:", req.params.id);
  
  try {
    const index = images.findIndex((img) => img.id === req.params.id);
    
    if (index === -1) {
      console.log("❌ Зображення не знайдено");
      return res.status(404).json({ error: "Зображення не знайдено" });
    }

    const [removed] = images.splice(index, 1);
    console.log("🗑️ Видаляємо з Cloudinary:", removed.public_id);
    
    await cloudinary.uploader.destroy(removed.public_id);
    
    console.log("✅ Зображення видалено");
    res.json({ 
      success: true,
      message: "Зображення видалено"
    });

  } catch (err) {
    console.error("❌ ПОМИЛКА видалення:", err);
    res.status(500).json({ error: "Помилка видалення" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("✅ СЕРВЕР ЗАПУЩЕНО");
  console.log("🌐 Адреса: http://localhost:" + PORT);
  console.log("📁 Папка для завантажень:", uploadsDir);
  console.log("☁️ Cloudinary:", process.env.CLOUDINARY_CLOUD_NAME ? "ПІДКЛЮЧЕНО" : "НЕ НАЛАШТОВАНО");
  console.log("=".repeat(50) + "\n");
  console.log("📋 Доступні маршрути:");
  console.log("  POST   /upload     - завантажити фото");
  console.log("  GET    /images     - отримати всі фото");
  console.log("  DELETE /images/:id - видалити фото");
  console.log("  GET    /test       - тестовий запит\n");
});