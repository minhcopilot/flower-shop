import { readFileSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { openDatabase, saveProduct, categories } from "./db.js";
import { claimLock } from "./lock.js";
import { slugify, productSchema } from "../shared/schema.js";
const dir = path.resolve(process.env.DATA_DIR || "data");
const release = claimLock(dir);
const db = openDatabase(dir);
try {
  const addCategory = db.prepare(
    "INSERT OR IGNORE INTO categories(name,kind) VALUES(?,?)",
  );
  for (const name of ["Bó hoa", "Giỏ hoa", "Kệ hoa"])
    addCategory.run(name, "type");
  for (const name of [
    "Hoa sinh nhật",
    "Hoa khai trương",
    "Hoa chúc mừng",
    "Hoa tình yêu",
  ])
    addCategory.run(name, "occasion");
  const cats = categories(db);
  const id = (name: string) => cats.find((c) => c.name === name)!.id;
  const manifestFile = path.resolve("content/sources.json");
  if (existsSync(manifestFile)) {
    const manifest = JSON.parse(
      readFileSync(manifestFile, "utf8").replace(/^\uFEFF/, ""),
    ) as { file: string; sourceUrl: string }[];
    const names = [
      "Bó hoa hồng pastel",
      "Bó hồng đỏ cổ điển",
      "Hồng đỏ trong nắng",
      "Bó hồng phấn dịu dàng",
      "Bó hồng phối sắc",
      "Bó hoa hồng trắng hồng",
      "Bó hoa sắc tím",
      "Bó hồng kem thanh nhã",
      "Bó hoa hồng rực rỡ",
    ];
    for (const [i, item] of manifest.entries()) {
      const code = `IP-${String(i + 1).padStart(3, "0")}`;
      if (db.prepare("SELECT id FROM products WHERE code=?").get(code))
        continue;
      const imageId = randomUUID(),
        filename = `${imageId}.webp`;
      await sharp(path.resolve("content/images", item.file))
        .rotate()
        .resize({
          width: 1600,
          height: 1800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(path.join(dir, "uploads", filename));
      db.prepare("INSERT INTO media VALUES(?,?)").run(imageId, filename);
      const name = names[i] || `Bó hoa mẫu ${i + 1}`;
      saveProduct(
        db,
        productSchema.parse({
          code,
          name,
          slug: slugify(name),
          description: `Mẫu hoa ${code} từ album công khai của Hoa tươi Ia Pa. Tên mẫu được mô tả theo hình ảnh. Bạn liên hệ shop và nhắc mã mẫu để trao đổi màu sắc, kích thước và tình trạng hoa nhé.`,
          categoryIds: [
            id("Bó hoa"),
            id(i === 1 || i === 2 ? "Hoa tình yêu" : "Hoa sinh nhật"),
          ],
          images: [imageId],
          featured: [0, 3, 6, 7].includes(i),
          visible: true,
          available: true,
          sourceUrl: item.sourceUrl,
          draftNote: "",
        }),
      );
    }
  } else {
    const code = "NHAP-001";
    if (!db.prepare("SELECT id FROM products WHERE code=?").get(code)) {
      const imageId = randomUUID();
      copyFileSync(
        path.resolve("src/assets/hero-slide-1.webp"),
        path.join(dir, "uploads", `${imageId}.webp`),
      );
      db.prepare("INSERT INTO media VALUES(?,?)").run(
        imageId,
        `${imageId}.webp`,
      );
      saveProduct(db, {
        code,
        name: "Mẫu nháp - ảnh template",
        slug: "mau-nhap",
        description: "",
        categoryIds: [],
        images: [imageId],
        featured: false,
        visible: false,
        available: false,
        sourceUrl: "",
        draftNote: "Ảnh template minh họa. Cần chủ shop thay ảnh hoa thật.",
      });
    }
  }
  console.log("Đã chuẩn bị danh mục và mẫu hoa. Không ghi đè mẫu đã có.");
} finally {
  db.close();
  release();
}
