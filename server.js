import express from "express";
import multer from "multer";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log("Headers:", req.headers);
  next();
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 
  }
});

let images = [];

app.get("/test", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running",
    imagesCount: images.length,
    timestamp: new Date().toISOString()
  });
});

app.get("/images", (req, res) => {
  res.json(images);
});
!
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    console.log("📥 POST /upload отримано");
    console.log("📁 Файл:", req.file ? `${req.file.originalname} (${req.file.size} bytes)` : "Немає");
    console.log("📋 Тіло:", req.body);
    console.log("🏷️ Категорія:", req.body.category);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!req.body.category) {
      return res.status(400).json({ error: "Category is required" });
    }
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: "image-uploads",
          resource_type: "auto"
        },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary error:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const newImage = {
      id: result.public_id,
      url: result.secure_url,
      public_id: result.public_id,
      filename: req.file.originalname,
      category: req.body.category,
      uploadedAt: new Date().toISOString(),
      size: req.file.size,
      format: result.format
    };

    images.push(newImage);
    
    console.log("✅ Зображення завантажено:", newImage);
    res.json(newImage);

  } catch (error) {
    console.error("❌ Помилка завантаження:", error);
    res.status(500).json({ 
      error: "Upload failed",
      message: error.message 
    });
  }
});

app.delete("/images/:id", async (req, res) => {
  try {
    const imageId = req.params.id;
    console.log(`🗑️ DELETE /images/${imageId}`);
    
    const imageIndex = images.findIndex(img => img.id === imageId);
    
    if (imageIndex === -1) {
      return res.status(404).json({ error: "Image not found" });
    }

    const image = images[imageIndex];
    
    await cloudinary.uploader.destroy(image.public_id);
    
    images.splice(imageIndex, 1);
    
    res.json({ success: true, message: "Image deleted" });
    
  } catch (error) {
    console.error("❌ Помилка видалення:", error);
    res.status(500).json({ 
      error: "Delete failed",
      message: error.message 
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    serverTime: new Date().toISOString(),
    memoryUsage: process.memoryUsage()
  });
});

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(200);
});

app.use((req, res) => {
  res.status(404).json({ 
    error: "Route not found",
    method: req.method,
    url: req.url
  });
});

app.use((error, req, res, next) => {
  console.error("🔥 Серверна помилка:", error);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? error.message : undefined
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порті ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
  console.log(`🌍 Cloudinary налаштовано: ${process.env.CLOUDINARY_CLOUD_NAME ? "Так" : "Ні"}`);
  console.log(`📁 Ендпоінти доступні:`);
  console.log(`   GET  /test`);
  console.log(`   GET  /images`);
  console.log(`   POST /upload`);
  console.log(`   DELETE /images/:id`);
});