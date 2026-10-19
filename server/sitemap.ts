import type { Product } from "../shared/schema.js";

export const publicOrigin = "https://www.hoatuoiiapa.shop";
const xmlEscape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );

export function buildSitemap(
  products: Pick<Product, "slug" | "visible" | "updatedAt">[],
) {
  const entries = ["/", "/mau-hoa", "/gioi-thieu", "/lien-he"].map((path) => ({
    loc: publicOrigin + path,
    lastmod: "",
  }));
  for (const product of products) {
    if (!product.visible) continue;
    const timestamp = Date.parse(product.updatedAt);
    entries.push({
      loc: `${publicOrigin}/mau-hoa/${encodeURIComponent(product.slug)}`,
      lastmod: Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : "",
    });
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map(
        (entry) =>
          `  <url><loc>${xmlEscape(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : ""}</url>`,
      )
      .join("\n") +
    "\n</urlset>\n"
  );
}
