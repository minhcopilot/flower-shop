import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  LogOut,
  Flower2,
  ImagePlus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  Check,
  LayoutGrid,
  Layers,
  Eye,
  ExternalLink,
  CloudUpload,
} from "lucide-react";
import CloudStorage from "./CloudStorage";
import type { StorageStatus } from "../../shared/storage";
import { api, mediaUrl } from "../lib/api";
import {
  type Product,
  type ProductInput,
  type Category,
  slugify,
} from "../../shared/schema";

const fresh = (): ProductInput => ({
  code: "",
  name: "",
  slug: "",
  description: "",
  categoryIds: [],
  images: [],
  featured: false,
  visible: false,
  available: true,
  sourceUrl: "",
  draftNote: "",
});
function Editor({
  initial,
  categories,
  onSaved,
  onCancel,
}: {
  initial: Product | ProductInput;
  categories: Category[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<ProductInput>({ ...initial });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  useEffect(() => {
    api<StorageStatus>("/api/admin/storage")
      .then((s) => setCloudReady(s.configured))
      .catch(() => {});
  }, []);
  const change = <K extends keyof ProductInput>(key: K, v: ProductInput[K]) =>
    setValue((prev) => ({ ...prev, [key]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const {
        code,
        name,
        slug,
        description,
        categoryIds,
        images,
        featured,
        visible,
        available,
        sourceUrl,
        draftNote,
      } = value;
      await api(
        "/api/admin/products" + ("id" in initial ? `/${initial.id}` : ""),
        {
          method: "id" in initial ? "PUT" : "POST",
          body: JSON.stringify({
            code,
            name,
            slug,
            description,
            categoryIds,
            images,
            featured,
            visible,
            available,
            sourceUrl,
            draftNote,
          }),
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setError("");
    setUploadNote("");
    try {
      if (value.images.length + files.length > 12)
        throw new Error("Mỗi mẫu tối đa 12 ảnh.");
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) throw new Error("Ảnh vượt quá 10 MB.");
        const form = new FormData();
        form.append("image", f);
        const { id, storage } = await api<{
          id: string;
          storage: "uploadthing" | "local";
        }>("/api/admin/media", {
          method: "POST",
          body: form,
        });
        setValue((prev) => ({ ...prev, images: [...prev.images, id] }));
        setUploadNote(
          storage === "uploadthing"
            ? "Ảnh đã được tải lên UploadThing. Bấm Lưu mẫu hoa để cập nhật."
            : "Ảnh đã được lưu trên máy chủ. Kết nối UploadThing ở mục Lưu trữ ảnh để lưu trên cloud.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  function move(index: number, to: number) {
    const images = [...value.images];
    images.splice(to, 0, images.splice(index, 1)[0]);
    change("images", images);
  }
  return (
    <form className="editor" onSubmit={save}>
      <div className="editor-heading">
        <div>
          <span className="eyebrow">BỘ SƯU TẬP CỦA SHOP</span>
          <h2>{"id" in initial ? "Chỉnh sửa mẫu hoa" : "Thêm mẫu hoa mới"}</h2>
        </div>
        <button
          type="button"
          className="button outline"
          disabled={busy || uploading}
          onClick={onCancel}
        >
          <ArrowLeft size={16} />
          Quay lại
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="editor-grid">
        <div className="panel">
          <h3>Thông tin mẫu hoa</h3>
          <label>
            Tên mẫu hoa
            <input
              required
              maxLength={140}
              value={value.name}
              onChange={(e) => {
                const name = e.target.value;
                setValue((prev) => ({
                  ...prev,
                  name,
                  slug:
                    prev.slug === slugify(prev.name) || !prev.slug
                      ? slugify(name)
                      : prev.slug,
                }));
              }}
            />
          </label>
          <div className="form-row">
            <label>
              Mã mẫu
              <input
                required
                maxLength={24}
                placeholder="VD: IP-011"
                value={value.code}
                onChange={(e) => change("code", e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Đường dẫn
              <input
                required
                maxLength={160}
                value={value.slug}
                onChange={(e) => change("slug", e.target.value)}
              />
            </label>
          </div>
          <label>
            Mô tả
            <textarea
              rows={5}
              maxLength={4000}
              value={value.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          <fieldset>
            <legend>Danh mục và dịp tặng</legend>
            <div className="check-grid">
              {categories.map((c) => (
                <label className="checkbox" key={c.id}>
                  <input
                    type="checkbox"
                    checked={value.categoryIds.includes(c.id)}
                    onChange={(e) =>
                      change(
                        "categoryIds",
                        e.target.checked
                          ? [...value.categoryIds, c.id]
                          : value.categoryIds.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
            {!categories.length && (
              <p>Hãy tạo danh mục ở mục Danh mục trước.</p>
            )}
          </fieldset>
          <label>
            Ghi chú bản nháp
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Để trống khi đã có ảnh thật và sẵn sàng hiển thị."
              value={value.draftNote}
              onChange={(e) => change("draftNote", e.target.value)}
            />
          </label>
        </div>
        <div>
          <div className="panel">
            <h3>Ảnh mẫu hoa</h3>
            <p className="muted">
              {cloudReady
                ? "Ảnh được tối ưu và tải lên UploadThing."
                : "Ảnh hiện lưu local. Kết nối UploadThing trong mục Lưu trữ ảnh khi muốn dùng cloud."}
            </p>
            <p className="muted">
              Ảnh đầu tiên là ảnh đại diện. Tối đa 12 ảnh, 10 MB/ảnh. JPEG, PNG,
              WebP.
            </p>
            <label className={`upload-zone ${uploading ? "disabled" : ""}`}>
              <ImagePlus size={29} />
              <span>
                {uploading
                  ? cloudReady
                    ? "Đang tải ảnh lên UploadThing…"
                    : "Đang xử lý ảnh…"
                  : "Chọn ảnh từ máy hoặc điện thoại"}
              </span>
              <input
                type="file"
                aria-label="Tải ảnh mẫu hoa"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || busy}
                onChange={(e) => {
                  void upload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {uploadNote && (
              <p className="notice success" role="status">
                {uploadNote}
              </p>
            )}
            <div className="admin-images">
              {value.images.map((id, i) => (
                <div key={id} className="admin-image">
                  <img src={mediaUrl(id)} alt={`Ảnh mẫu ${i + 1}`} />
                  <div>
                    <span>{i === 0 ? "Ảnh đại diện" : `Ảnh ${i + 1}`}</span>
                    <div className="image-controls">
                      <button
                        type="button"
                        aria-label={`Đặt ảnh ${i + 1} làm đại diện`}
                        disabled={i === 0 || uploading}
                        onClick={() => move(i, 0)}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Đưa ảnh ${i + 1} lên`}
                        disabled={i === 0 || uploading}
                        onClick={() => move(i, i - 1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Đưa ảnh ${i + 1} xuống`}
                        disabled={i === value.images.length - 1 || uploading}
                        onClick={() => move(i, i + 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Gỡ ảnh ${i + 1}`}
                        disabled={uploading}
                        onClick={() =>
                          change(
                            "images",
                            value.images.filter((x) => x !== id),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3>Trạng thái</h3>
            {(
              [
                ["visible", "Hiển thị ngoài website"],
                ["featured", "Mẫu nổi bật ở trang chủ"],
                ["available", "Còn nhận đặt"],
              ] as const
            ).map(([key, label]) => (
              <label className="checkbox" key={key}>
                <input
                  type="checkbox"
                  checked={value[key]}
                  onChange={(e) => change(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
            <p className="muted">
              Mẫu ẩn chỉ chủ shop xem được. Ghi chú bản nháp phải được xóa trước
              khi hiển thị.
            </p>
          </div>
        </div>
      </div>
      <div className="editor-actions">
        <button className="button" disabled={busy || uploading}>
          {busy ? "Đang lưu…" : "Lưu mẫu hoa"}
        </button>
        <button
          type="button"
          className="button outline"
          disabled={busy || uploading}
          onClick={onCancel}
        >
          Hủy thay đổi
        </button>
      </div>
    </form>
  );
}
function CategoryManager({
  categories,
  onRefresh,
}: {
  categories: Category[];
  onRefresh: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"type" | "occasion">("type");
  const [id, setId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/categories${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ name, kind }),
      });
      setName("");
      setId(null);
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Category) {
    if (!window.confirm(`Xóa danh mục “${c.name}”?`)) return;
    setError("");
    try {
      await api(`/api/admin/categories/${c.id}`, { method: "DELETE" });
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="category-admin">
      <form className="panel" onSubmit={save}>
        <h2>{id ? "Sửa danh mục" : "Thêm danh mục"}</h2>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <label>
          Tên danh mục
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Nhóm
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="type">Loại hoa</option>
            <option value="occasion">Dịp tặng</option>
          </select>
        </label>
        <div className="actions">
          <button className="button" disabled={busy}>
            {busy ? "Đang lưu…" : id ? "Lưu danh mục" : "Thêm danh mục"}
          </button>
          {id && (
            <button
              type="button"
              className="button outline"
              onClick={() => {
                setId(null);
                setName("");
              }}
            >
              Hủy sửa
            </button>
          )}
        </div>
      </form>
      <div className="panel">
        <h2>Danh mục hiện có</h2>
        {categories.map((c) => (
          <div className="category-row" key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <small>{c.kind === "type" ? "Loại hoa" : "Dịp tặng"}</small>
            </div>
            <button
              className="icon-button"
              aria-label={`Sửa ${c.name}`}
              onClick={() => {
                setId(c.id);
                setName(c.name);
                setKind(c.kind);
              }}
            >
              <Pencil size={17} />
            </button>
            <button
              className="icon-button"
              aria-label={`Xóa ${c.name}`}
              onClick={() => void remove(c)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function Admin() {
  const [username, setUsername] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Product | ProductInput | null>(null);
  const [tab, setTab] = useState<"products" | "categories" | "storage">(
    "products",
  );
  const [search, setSearch] = useState("");
  useEffect(() => {
    document.title = "Quản trị | Hoa Tươi Ia Pa";
    api<{ username: string | null }>("/api/auth/me")
      .then((v) => setUsername(v.username))
      .catch((e) => setError(e.message))
      .finally(() => setChecking(false));
  }, []);
  async function refresh() {
    const [p, c] = await Promise.all([
      api<Product[]>("/api/admin/products"),
      api<Category[]>("/api/categories"),
    ]);
    setProducts(p);
    setCategories(c);
  }
  useEffect(() => {
    if (username) refresh().catch((e) => setError(e.message));
  }, [username]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<{ username: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      setUsername(result.username);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUsername(null);
      setProducts([]);
      setEditor(null);
      setError("");
      setNotice("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(p: Product) {
    if (
      !window.confirm(
        `Xóa mẫu “${p.name}” (${p.code})? Bạn có thể chọn Ẩn thay vì xóa.`,
      )
    )
      return;
    try {
      await api(`/api/admin/products/${p.id}`, { method: "DELETE" });
      await refresh();
      setNotice("Đã xóa mẫu hoa.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (checking)
    return <div className="shell loading">Đang kiểm tra đăng nhập…</div>;
  if (!username)
    return (
      <section className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <Flower2 size={42} strokeWidth={1} />
          <span className="eyebrow">GÓC NHỎ CỦA CHỦ SHOP</span>
          <h1>
            Chào shop <em>trở lại.</em>
          </h1>
          <p>Đăng nhập để chăm chút bộ sưu tập hoa.</p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <label>
            Tên đăng nhập
            <input
              name="username"
              autoComplete="username"
              required
              maxLength={80}
            />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            <ArrowLeft size={17} style={{ transform: "rotate(180deg)" }} />
          </button>
          <small>
            Tài khoản được tạo bằng lệnh thiết lập trên máy chạy website.
          </small>
        </form>
      </section>
    );
  return (
    <section className="shell admin-section">
      <div className="admin-title">
        <div>
          <span className="eyebrow">HOA TƯƠI IA PA / QUẢN TRỊ</span>
          <h1>
            Chăm chút từng <em>mẫu hoa.</em>
          </h1>
          <p>Xin chào, {username}.</p>
        </div>
        <button className="button outline" onClick={() => void logout()}>
          <LogOut size={17} />
          Đăng xuất
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => {
              setError("");
              void refresh().catch((e) => setError(e.message));
            }}
          >
            Thử tải lại
          </button>
        </div>
      )}
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {editor ? (
        <Editor
          key={"id" in editor ? editor.id : "new"}
          initial={editor}
          categories={categories}
          onCancel={() => {
            if (window.confirm("Bỏ những thay đổi chưa lưu?")) setEditor(null);
          }}
          onSaved={() => {
            setEditor(null);
            setNotice("Đã lưu mẫu hoa.");
            void refresh().catch((e) => setError(e.message));
          }}
        />
      ) : (
        <>
          <div className="admin-stats">
            <div>
              <Flower2 />
              <strong>{products.length}</strong>
              <span>Mẫu hoa</span>
            </div>
            <div>
              <Eye />
              <strong>{products.filter((p) => p.visible).length}</strong>
              <span>Đang hiển thị</span>
            </div>
            <div>
              <Layers />
              <strong>{categories.length}</strong>
              <span>Danh mục</span>
            </div>
          </div>
          <div className="admin-toolbar">
            <div className="tabs">
              <button
                aria-pressed={tab === "products"}
                onClick={() => {
                  setTab("products");
                  setNotice("");
                }}
              >
                <LayoutGrid size={17} />
                Mẫu hoa
              </button>
              <button
                aria-pressed={tab === "categories"}
                onClick={() => {
                  setTab("categories");
                  setNotice("");
                }}
              >
                <Layers size={17} />
                Danh mục
              </button>
              <button
                aria-pressed={tab === "storage"}
                onClick={() => {
                  setTab("storage");
                  setNotice("");
                }}
              >
                <CloudUpload size={17} />
                Lưu trữ ảnh
              </button>
            </div>
            {tab === "products" && (
              <button
                className="button"
                onClick={() => {
                  setEditor(fresh());
                  setNotice("");
                }}
              >
                <Plus size={17} />
                Thêm mẫu hoa
              </button>
            )}
          </div>
          {tab === "storage" ? (
            <CloudStorage />
          ) : tab === "categories" ? (
            <CategoryManager categories={categories} onRefresh={refresh} />
          ) : (
            <>
              <label className="admin-search">
                Tìm mẫu hoa
                <input
                  placeholder="Tên hoa hoặc mã mẫu…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="admin-products">
                {products
                  .filter((p) =>
                    `${p.name} ${p.code}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <article className="admin-product" key={p.id}>
                      <div className="admin-product-photo">
                        {p.images[0] ? (
                          <img src={mediaUrl(p.images[0])} alt={p.name} />
                        ) : (
                          <Flower2 />
                        )}
                      </div>
                      <div className="admin-product-body">
                        <small>
                          {p.code} {p.featured ? "· Nổi bật" : ""}
                        </small>
                        <h3>{p.name}</h3>
                        <div className="pill-row">
                          <span
                            className={`status-pill ${p.visible ? "" : "paused"}`}
                          >
                            {p.visible ? "Hiển thị" : "Đang ẩn"}
                          </span>
                          <span className="status-pill neutral">
                            {p.available ? "Còn nhận đặt" : "Tạm ngưng"}
                          </span>
                        </div>
                        {p.draftNote && (
                          <p className="draft-note">Bản nháp: {p.draftNote}</p>
                        )}
                        <div className="admin-card-actions">
                          <button
                            className="button outline"
                            onClick={() => {
                              setEditor(p);
                              setNotice("");
                            }}
                          >
                            <Pencil size={15} />
                            Sửa
                          </button>
                          {p.visible && (
                            <a
                              className="icon-button"
                              href={`/mau-hoa/${p.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Xem ${p.name}`}
                            >
                              <ExternalLink size={17} />
                            </a>
                          )}
                          <button
                            className="icon-button danger"
                            aria-label={`Xóa ${p.code}`}
                            onClick={() => void remove(p)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
              {!products.length && (
                <div className="empty">
                  <h2>Thêm mẫu hoa đầu tiên nhé.</h2>
                  <p>Ảnh và nội dung sẽ được lưu trên máy chạy website.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
