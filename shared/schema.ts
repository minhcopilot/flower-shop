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
    sourceUrl: z.union([
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
    ]),
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
