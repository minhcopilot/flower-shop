// Keep the request under Vercel's function payload limit, even for phone photos.
export async function prepareUpload(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Chỉ nhận ảnh JPEG, PNG hoặc WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Ảnh vượt quá 10 MB.");
  // Small files go unchanged, preserving backend content/animation validation.
  if (file.size <= 3 * 1024 * 1024) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Tệp không phải ảnh hợp lệ.");
  }
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error("Ảnh có độ phân giải quá lớn.");
    const ratio = Math.min(1, 1600 / bitmap.width, 1800 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Không thể xử lý ảnh trong trình duyệt này.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob || blob.size > 3 * 1024 * 1024)
      throw new Error(
        "Ảnh vẫn quá lớn sau tối ưu. Hãy chọn ảnh có kích thước nhỏ hơn.",
      );
    return new File([blob], "flower.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
