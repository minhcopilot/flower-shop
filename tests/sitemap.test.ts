import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../server/app.js";
import { saveProduct } from "../server/db.js";
import { buildSitemap, publicOrigin } from "../server/sitemap.js";

test("sitemap công khai trả XML: chỉ URL chuẩn và hoa hiển thị, tự cập nhật khi đổi slug/ẩn/xóa", async () => {
  const { app, db } = createApp(
    mkdtempSync(path.join(tmpdir(), "iapa-sitemap-")),
  );
  try {
    const flower = {
      code: "IP-SITE",
      name: "Hoa thử",
      slug: "hoa-thu",
      description: "",
      categoryIds: [],
      images: [],
      featured: false,
      visible: true,
      available: true,
      sourceUrl: "https://www.facebook.com/private-source",
      draftNote: "private-draft",
    };
    const id = saveProduct(db, flower);
    saveProduct(db, {
      ...flower,
      code: "IP-HIDDEN",
      slug: "hoa-an",
      visible: false,
    });
    const response = await request(app)
      .get("/sitemap.xml")
      .set("Host", "untrusted.example")
      .expect(200)
      .expect("Content-Type", /application\/xml/);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.match(response.text, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(
      response.text,
      /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/,
    );
    const urls = [...response.text.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(urls, [
      `${publicOrigin}/`,
      `${publicOrigin}/mau-hoa`,
      `${publicOrigin}/gioi-thieu`,
      `${publicOrigin}/lien-he`,
      `${publicOrigin}/mau-hoa/hoa-thu`,
    ]);
    assert.match(response.text, /<lastmod>\d{4}-\d{2}-\d{2}T/);
    for (const privateValue of [
      "hoa-an",
      "private-source",
      "private-draft",
      "untrusted.example",
      "/admin",
      "/api/",
      "/media/",
    ])
      assert.ok(!response.text.includes(privateValue));
    saveProduct(db, { ...flower, slug: "hoa-da-doi" }, id);
    let xml = (await request(app).get("/sitemap.xml").expect(200)).text;
    assert.ok(xml.includes("/hoa-da-doi</loc>"));
    assert.ok(!xml.includes("/hoa-thu</loc>"));
    saveProduct(db, { ...flower, slug: "hoa-da-doi", visible: false }, id);
    xml = (await request(app).get("/sitemap.xml").expect(200)).text;
    assert.equal([...xml.matchAll(/<loc>/g)].length, 4);
    db.prepare("DELETE FROM products").run();
    assert.equal(
      [
        ...(await request(app).get("/sitemap.xml").expect(200)).text.matchAll(
          /<loc>/g,
        ),
      ].length,
      4,
    );
  } finally {
    db.close();
  }
});
test("sitemap escape XML, bỏ ngày lỗi; robots và Vercel trỏ đúng endpoint", () => {
  const xml = buildSitemap([
    { slug: "hoa'&<>\"", visible: true, updatedAt: "invalid" },
  ]);
  assert.ok(xml.includes("hoa&apos;%26%3C%3E%22"));
  assert.ok(!xml.includes("<lastmod>"));
  assert.ok(!xml.includes("Invalid Date"));
  assert.ok(
    readFileSync("public/robots.txt", "utf8").includes(
      `Sitemap: ${publicOrigin}/sitemap.xml`,
    ),
  );
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(config.rewrites[0], {
    source: "/sitemap.xml",
    destination: "/api/index",
  });
});
