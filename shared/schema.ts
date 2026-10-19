import { z } from "zod";
z.config(z.locales.vi());

export const categorySchema = z
  .object({
    name: z.string().trim().min(1, "Nhập tên danh mục.").max(80),
    kind: z.enum(["type", "occasion"]),
  })
  .strict();
export const productSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(
        /^[A-Z0-9-]{2,24}$/,
        "Mã mẫu chỉ gồm chữ in hoa, số và dấu gạch ngang.",
      ),
    name: z.string().trim().min(2, "Nhập tên mẫu hoa.").max(140),
    slug: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Đường dẫn dùng chữ thường không dấu và gạch ngang.",
      )
      .max(160),
    description: z.string().trim().max(4000),
    categoryIds: z.array(z.number().int().positive()).max(20),
    images: z.array(z.string().uuid()).max(12),
    featured: z.boolean(),
    visible: z.boolean(),
    available: z.boolean(),
    sourceUrl: z
      .union([
        z.literal(""),
        z
          .string()
          .url()
          .refine((v) => {
            const u = new URL(v);
            return (
              u.protocol === "https:" &&
              ["facebook.com", "www.facebook.com"].includes(u.hostname)
            );
          }, "Nguồn ảnh phải là liên kết Facebook HTTPS."),
      ])
      .default(""),
    draftNote: z.string().trim().max(500),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.images).size !== v.images.length)
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message: "Ảnh không được trùng lặp.",
      });
    if (v.visible && (!v.images.length || v.draftNote))
      ctx.addIssue({
        code: "custom",
        path: ["visible"],
        message: "Mẫu hiển thị cần có ảnh thật và không còn ghi chú bản nháp.",
      });
  });
export type ProductInput = z.infer<typeof productSchema>;
export type Product = ProductInput & { id: number; updatedAt: string };
export type Category = z.infer<typeof categorySchema> & { id: number };
export const shop = {
  name: "Hoa Tươi Ia Pa",
  address: "Chợ Iamron - Ia Pa - Gia Lai",
  phone: "0986592394",
  facebook: "https://www.facebook.com/thihang002224",
  zalo: "https://zalo.me/0986592394",
  mapsUrl: "https://www.google.com/maps?cid=16143076200607342447",
  mapsEmbed:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d437.6611224279924!2d108.44587090374853!3d13.477759263745378!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x316e5dc6aefc3de3%3A0xe007ba4657435f6f!2sHelen%20Flower!5e0!3m2!1svi!2s!4v1792372189754!5m2!1svi!2s",
};
export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
