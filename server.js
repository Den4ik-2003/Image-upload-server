// server.js
import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Отримуємо __dirname для ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Створюємо папку для тимчасових файлів
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Налаштування multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// CORS
app.use(cors());
app.use(express.json());

// Конфігурація Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Масив для зберігання зображень
let images = [];

// Маршрут для завантаження
app.post("/upload", upload.single("image"), async (req, res) => {
  console.log("\n📤 ========== ЗАПИТ НА ЗАВАНТАЖЕННЯ ==========");
  console.log("Файл:", req.file ? req.file.originalname : "НЕМАЄ");
  console.log("Категорія:", req.body.category || "НЕ ВКАЗАНО");
  console.log("Розмір файлу:", req.file ? (req.file.size / 1024).toFixed(2) + "KB" : "НЕМАЄ");
  console.log("Тип файлу:", req.file ? req.file.mimetype : "НЕМАЄ");
  console.log("Шлях:", req.file ? req.file.path : "НЕМАЄ");

  try {
    // Перевірка наявності файлу
    if (!req.file) {
      console.log("❌ ПОМИЛКА: Файл не знайдено");
      return res.status(400).json({ error: "Файл не знайдено" });
    }

    // Перевірка категорії
    if (!req.body.category) {
      console.log("❌ ПОМИЛКА: Категорія не вказана");
      return res.status(400).json({ error: "Категорія не вказана" });
    }

    // Перевірка чи файл не порожній
    if (req.file.size === 0) {
      console.log("❌ ПОМИЛКА: Файл порожній");
      return res.status(400).json({ error: "Файл порожній" });
    }

    // Перевірка чи файл існує на диску
    if (!fs.existsSync(req.file.path)) {
      console.log("❌ ПОМИЛКА: Файл не знайдено на диску");
      return res.status(400).json({ error: "Файл не знайдено на диску" });
    }

    // Перевірка типу файлу
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      console.log("❌ ПОМИЛКА: Неправильний тип файлу");
      return res.status(400).json({ error: "Дозволені тільки зображення (JPEG, PNG, GIF, WebP)" });
    }

    console.log("☁️ Завантаження на Cloudinary...");

    try {
      // Завантаження на Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "my_images",
      });

      console.log("✅ УСПІШНО завантажено на Cloudinary!");
      console.log("URL:", result.secure_url);
      console.log("Public ID:", result.public_id);

      // Видалення тимчасового файлу
      fs.unlinkSync(req.file.path);
      console.log("🗑️ Тимчасовий файл видалено");

      // Створення об'єкта зображення
      const imageObj = {
        id: Date.now().toString(),
        url: result.secure_url,
        category: req.body.category,
        public_id: result.public_id,
        filename: req.file.originalname,
        uploadedAt: new Date().toISOString()
      };

      // Додавання до масиву
      images.push(imageObj);
      console.log("📊 Всього зображень у базі:", images.length);

      res.json({
        success: true,
        message: "Фото успішно завантажено",
        image: imageObj
      });

    } catch (cloudinaryErr) {
      console.error("❌ ПОМИЛКА Cloudinary:", cloudinaryErr);
      
      // Видалення тимчасового файлу при помилці
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({ 
        error: "Помилка завантаження на Cloudinary", 
        details: cloudinaryErr.message 
      });
    }

  } catch (err) {
    console.error("❌ ЗАГАЛЬНА ПОМИЛКА:", err);
    res.status(500).json({ 
      error: "Внутрішня помилка сервера", 
      details: err.message 
    });
  }
});

// Маршрут для отримання всіх зображень
app.get("/images", (req, res) => {
  console.log("\n📥 Запит на отримання всіх зображень");
  console.log("📸 Кількість зображень:", images.length);
  res.json(images);
});

// Тестовий маршрут
app.get("/test", (req, res) => {
  console.log("✅ Тестовий запит отримано");
  res.json({ 
    status: "OK", 
    message: "Сервер працює",
    imagesCount: images.length,
    uploadsFolder: uploadsDir
  });
});

// Маршрут для видалення зображення
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
    
    // Видалення з Cloudinary
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