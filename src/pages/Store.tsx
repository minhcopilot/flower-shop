import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Flower2,
  Phone,
  Facebook,
  Search,
  MapPin,
  Sprout,
  Heart,
  ChevronLeft,
} from "lucide-react";
import type { Product, Category } from "../../shared/schema";
import { shop } from "../../shared/schema";
import { api, mediaUrl } from "../lib/api";

function ShopPhoto({
  id,
  name,
  pending,
  priority = false,
}: {
  id?: string;
  name?: string;
  pending: boolean;
  priority?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <div
      className="shop-photo"
      aria-busy={(!!id && !ready && !failed) || pending}
    >
      {id && !failed && (
        <img
          key={attempt}
          src={`${mediaUrl(id)}${attempt ? `?retry=${attempt}` : ""}`}
          alt={name || "Mẫu hoa của shop"}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          width="700"
          height="850"
          className={ready ? "photo-ready" : "photo-pending"}
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}
      {!ready && (
        <div className="photo-placeholder" role="status">
          <Flower2 size={36} strokeWidth={1} aria-hidden="true" />
          <span>
            {failed
              ? "Ảnh tạm thời chưa tải được"
              : pending || id
                ? "Đang tải ảnh hoa…"
                : "Shop đang cập nhật ảnh hoa"}
          </span>
          {failed && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setReady(false);
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              Thử tải lại ảnh
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Hoa Tươi Ia Pa`;
  }, [title]);
}
function useCatalog() {
  const [data, setData] = useState<{
    products: Product[];
    categories: Category[];
  }>({ products: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      api<Product[]>("/api/products"),
      api<Category[]>("/api/categories"),
    ])
      .then(([products, categories]) => {
        if (live) setData({ products, categories });
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return { ...data, loading, error };
}
function Notice({ loading, error }: { loading: boolean; error: string }) {
  return error ? (
    <div className="notice error" role="alert">
      {error}
      <button onClick={() => window.location.reload()} className="text-button">
        Thử lại
      </button>
    </div>
  ) : loading ? (
    <div className="loading" role="status">
      Đang chọn những đóa hoa đẹp…
    </div>
  ) : null;
}
function ContactButtons() {
  return (
    <div className="actions">
      <a className="button" href={`tel:${shop.phone}`}>
        <Phone size={17} />
        Gọi đặt hoa
      </a>
      <a
        className="button outline"
        href={shop.facebook}
        target="_blank"
        rel="noreferrer"
      >
        <Facebook size={17} />
        Liên hệ Facebook
      </a>
    </div>
  );
}
function ProductCard({
  product: p,
  categories,
}: {
  product: Product;
  categories: Category[];
}) {
  return (
    <Link to={`/mau-hoa/${p.slug}`} className="product-card">
      <div className="product-image">
        <img
          src={mediaUrl(p.images[0])}
          alt={p.name}
          loading="lazy"
          width="600"
          height="720"
        />
        {!p.available && (
          <span className="image-badge">Tạm ngưng nhận đặt</span>
        )}
        <span className="card-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="product-meta">
        <span>
          {categories.find((c) => p.categoryIds.includes(c.id))?.name ||
            "Mẫu hoa"}{" "}
          · {p.code}
        </span>
        <h3>{p.name}</h3>
        <small>
          Xem mẫu hoa <ArrowRight size={14} />
        </small>
      </div>
    </Link>
  );
}
const categoryNames = ["Bó hoa", "Giỏ hoa", "Hoa sinh nhật", "Hoa khai trương"];
export function Home() {
  useTitle("Hoa đẹp thay lời muốn nói");
  const { products, categories, loading, error } = useCatalog();
  const withPhotos = products.filter((p) => p.images.length > 0);
  const featured = withPhotos.filter((p) => p.featured).slice(0, 4);
  const shown = featured.length ? featured : withPhotos.slice(0, 4);
  const hero = shown[0];
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow">
            <span /> HOA TƯƠI IA PA · GIA LAI
          </span>
          <h1>
            Một bó hoa,
            <br />
            ngàn lời <em>yêu thương.</em>
          </h1>
          <p>
            Đôi khi, những điều muốn nói chỉ cần một bó hoa. Chọn một mẫu thật
            xinh, để Hoa Tươi Ia Pa cùng bạn gửi trao.
          </p>
          <div className="actions">
            <Link className="button" to="/mau-hoa">
              Khám phá mẫu hoa <ArrowUpRight size={18} />
            </Link>
            <a className="hero-phone" href={`tel:${shop.phone}`}>
              <Phone size={18} />
              <span>
                Trò chuyện cùng shop<strong>0986 592 394</strong>
              </span>
            </a>
          </div>
          <div className="hero-note">
            <Flower2 size={23} strokeWidth={1.2} />
            <span>
              Gửi hoa bằng cả tấm lòng.
              <br />
              <small>Ghé shop tại Chợ Iamron, Ia Pa.</small>
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-arch">
            <ShopPhoto
              key={hero?.images[0] || "hero-pending"}
              id={hero?.images[0]}
              name={hero?.name}
              pending={loading}
              priority
            />
          </div>
          <div className="hero-stamp">
            <Flower2 size={25} strokeWidth={1.2} />
            <span>
              Mỗi đóa hoa
              <br />
              <i>một lời thương</i>
            </span>
          </div>
          <div className="hero-caption">
            <span>{hero?.code || "HOA TƯƠI IA PA"}</span>
            <span>
              {hero?.name ||
                (loading
                  ? "Đang chọn những đóa hoa đẹp…"
                  : "Gửi hoa · Gửi yêu thương")}
            </span>
            <ArrowUpRight size={18} />
          </div>
          <span className="vertical-note">
            NHỮNG ĐIỀU ĐẸP ĐẼ BẮT ĐẦU TỪ ĐÂY
          </span>
        </div>
      </section>
      <div className="floral-strip">
        <span>
          <Sprout size={19} /> Một chút dịu dàng
        </span>
        <b>✧</b>
        <span>
          <Heart size={18} /> Một lời quan tâm
        </span>
        <b>✧</b>
        <span>
          <Flower2 size={19} /> Một bó hoa thay lời
        </span>
      </div>
      <section className="section shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DÀNH CHO NHỮNG KHOẢNH KHẮC RIÊNG</span>
            <h2>
              Hôm nay, bạn muốn <em>gửi gì?</em>
            </h2>
          </div>
          <p>
            Một lời chúc mừng, một lời cảm ơn,
            <br />
            hay đơn giản là “mình nhớ bạn”.
          </p>
        </div>
        <div className="category-grid">
          {categoryNames.map((name, i) => {
            const cat = categories.find((c) => c.name === name);
            const image = products.find(
              (p) => cat && p.categoryIds.includes(cat.id),
            );
            return (
              <Link
                key={name}
                to={`/mau-hoa${cat ? `?danh-muc=${cat.id}` : ""}`}
                className="category-card"
              >
                <span className="category-number">0{i + 1}</span>
                {image ? (
                  <img src={mediaUrl(image.images[0])} alt="" loading="lazy" />
                ) : (
                  <Flower2 size={60} strokeWidth={0.7} />
                )}
                <h3>{name}</h3>
                <ArrowUpRight size={20} />
              </Link>
            );
          })}
        </div>
      </section>
      <section className="section shell" id="mau-noi-bat">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MỘT CHÚT CẢM HỨNG CHO BẠN</span>
            <h2>
              Những mẫu hoa <em>đáng yêu.</em>
            </h2>
          </div>
          <Link className="text-link" to="/mau-hoa">
            Xem tất cả mẫu hoa <ArrowRight size={18} />
          </Link>
        </div>
        <Notice loading={loading} error={error} />
        <div className="product-grid">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} categories={categories} />
          ))}
        </div>
        {!loading && !error && !shown.length && (
          <p className="empty">
            Shop đang cập nhật bộ sưu tập. Bạn ghé Facebook để xem các mẫu hoa
            mới nhé.
          </p>
        )}
      </section>
      <section className="story-section">
        <div className="shell story-grid">
          <div className="story-art">
            <ShopPhoto
              key={withPhotos[1]?.images[0] || "story-pending"}
              id={withPhotos[1]?.images[0]}
              name={withPhotos[1]?.name}
              pending={loading}
            />
            <span className="story-tag">
              Từ Ia Pa,
              <br />
              <em>với yêu thương.</em>
            </span>
          </div>
          <div className="story-copy">
            <span className="eyebrow">MỘT GÓC HOA Ở CHỢ IAMRON</span>
            <h2>
              Hoa đẹp để ngắm.
              <br />
              Tình cảm để <em>gửi trao.</em>
            </h2>
            <p>
              Hoa Tươi Ia Pa là một góc nhỏ dành cho những người yêu hoa tại Chợ
              Iamron, Ia Pa, Gia Lai. Shop cùng bạn chọn mẫu hoa cho những dịp
              đặc biệt và cả những ngày bình thường.
            </p>
            <p>
              Bạn đã có một mẫu yêu thích? Gửi mã mẫu cho shop qua Facebook hoặc
              gọi điện để cùng trao đổi nhé.
            </p>
            <Link to="/gioi-thieu" className="text-link">
              Ghé thăm shop <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="contact-banner shell">
        <Flower2 size={44} strokeWidth={1} />
        <span className="eyebrow">MỘT LỜI THƯƠNG ĐANG CHỜ BẠN GỬI</span>
        <h2>
          Cùng chọn một bó hoa <em>nhé?</em>
        </h2>
        <p>Shop luôn sẵn lòng cùng bạn tìm một mẫu hoa phù hợp.</p>
        <ContactButtons />
      </section>
    </>
  );
}
export function Catalog() {
  useTitle("Các mẫu hoa");
  const { products, categories, loading, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const type = params.get("loai") || params.get("danh-muc") || "";
  const occasion = params.get("dip") || "";
  const fold = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
  const filtered = products.filter(
    (p) =>
      fold(`${p.name} ${p.code}`).includes(fold(query)) &&
      (!type || p.categoryIds.includes(Number(type))) &&
      (!occasion || p.categoryIds.includes(Number(occasion))),
  );
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (key === "loai") next.delete("danh-muc");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  return (
    <section className="shell section catalog">
      <div className="page-heading">
        <span className="eyebrow">BỘ SƯU TẬP HOA TƯƠI IA PA</span>
        <h1>
          Chọn hoa, <em>gửi thương.</em>
        </h1>
        <p>Tìm một mẫu hoa cho người bạn đang nghĩ đến.</p>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={18} />
          <span className="sr-only">Tìm mẫu hoa</span>
          <input
            value={query}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Tìm tên hoa hoặc mã mẫu…"
          />
        </label>
        <label>
          <span className="sr-only">Loại hoa</span>
          <select
            aria-label="Loại hoa"
            value={type}
            onChange={(e) => setFilter("loai", e.target.value)}
          >
            <option value="">Tất cả loại hoa</option>
            {categories
              .filter((c) => c.kind === "type")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Dịp tặng</span>
          <select
            aria-label="Dịp tặng"
            value={occasion}
            onChange={(e) => setFilter("dip", e.target.value)}
          >
            <option value="">Tất cả dịp tặng</option>
            {categories
              .filter((c) => c.kind === "occasion")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <Notice loading={loading} error={error} />
      {!loading && !error && (
        <>
          <div className="result-count">
            {filtered.length} mẫu hoa{" "}
            <span>· Liên hệ shop để trao đổi mẫu bạn thích</span>
          </div>
          <div className="product-grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} categories={categories} />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty">
              <Flower2 size={35} />
              <h2>Chưa tìm thấy mẫu phù hợp</h2>
              <p>Thử từ khóa khác hoặc xem toàn bộ bộ sưu tập.</p>
              <button className="button outline" onClick={() => setParams({})}>
                Xóa bộ lọc
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
export function FlowerDetail() {
  const { slug } = useParams();
  const [p, setP] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  useTitle(p?.name || "Chi tiết mẫu hoa");
  useEffect(() => {
    let live = true;
    setP(null);
    setError("");
    setSelected(0);
    api<Product>(`/api/products/${encodeURIComponent(slug || "")}`)
      .then((v) => {
        if (live) setP(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [slug]);
  return (
    <section className="shell section">
      <Link to="/mau-hoa" className="back-link">
        <ChevronLeft size={17} />
        Trở lại mẫu hoa
      </Link>
      <Notice loading={!p && !error} error={error} />
      {p && (
        <div className="detail-grid">
          <div>
            <div className="detail-image">
              <img
                src={mediaUrl(p.images[selected])}
                alt={`${p.name} - ảnh ${selected + 1}`}
                width="700"
                height="850"
              />
            </div>
            <div className="thumbnails">
              {p.images.map((id, i) => (
                <button
                  key={id}
                  aria-label={`Xem ảnh ${i + 1}`}
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i)}
                >
                  <img src={mediaUrl(id)} alt="" />
                </button>
              ))}
            </div>
          </div>
          <div className="detail-copy">
            <span className="eyebrow">MẪU HOA · {p.code}</span>
            <h1>{p.name}</h1>
            <span className={`status-pill ${p.available ? "" : "paused"}`}>
              {p.available ? "Còn nhận đặt" : "Tạm ngưng nhận đặt"}
            </span>
            <p className="description">{p.description}</p>
            <div className="order-note">
              <Flower2 size={24} />
              <p>
                {p.available ? (
                  <>
                    Bạn thích mẫu này? Nhắc mã <strong>{p.code}</strong> khi
                    liên hệ để shop tư vấn dễ hơn nhé.
                  </>
                ) : (
                  <>
                    Mẫu này đang tạm ngưng nhận đặt. Bạn có thể liên hệ shop để
                    chọn mẫu khác phù hợp.
                  </>
                )}
              </p>
            </div>
            <ContactButtons />
            <a
              className="detail-address"
              href={shop.mapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={16} />
              {shop.address}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
export function Contact({ about = false }: { about?: boolean }) {
  useTitle(about ? "Về shop" : "Liên hệ");
  return (
    <section className="shell section">
      <div className="page-heading">
        <span className="eyebrow">HOA TƯƠI IA PA</span>
        <h1>
          {about ? "Một góc hoa," : "Ghé shop,"}{" "}
          <em>{about ? "một tấm lòng." : "gửi thương."}</em>
        </h1>
        <p>
          {about
            ? "Những điều đẹp đẽ từ Chợ Iamron, Ia Pa, Gia Lai."
            : "Bạn chọn hoa, shop cùng bạn trao gửi."}
        </p>
      </div>
      <div className="contact-grid">
        <div>
          <Flower2 size={48} strokeWidth={1} />
          <h2>
            Chào bạn,
            <br />
            shop ở <em>đây nhé.</em>
          </h2>
          <p>
            Hoa Tươi Ia Pa cùng bạn chọn những mẫu hoa dành tặng người thân, bạn
            bè và những người thương yêu. Bạn có thể xem mẫu trên website, rồi
            trao đổi trực tiếp với shop để chọn hoa phù hợp.
          </p>
          <p>Chủ shop: Đinh Thị Hằng.</p>
          <ContactButtons />
        </div>
        <div className="contact-info">
          <span className="eyebrow">KẾT NỐI CÙNG SHOP</span>
          <a href={shop.mapsUrl} target="_blank" rel="noreferrer">
            <MapPin />
            <span>
              Địa chỉ<strong>{shop.address}</strong>
            </span>
            <ArrowUpRight />
          </a>
          <a href={`tel:${shop.phone}`}>
            <Phone />
            <span>
              Gọi đặt hoa<strong>0986 592 394</strong>
            </span>
            <ArrowUpRight />
          </a>
          <a href={shop.facebook} target="_blank" rel="noreferrer">
            <Facebook />
            <span>
              Facebook chủ shop<strong>Đinh Thị Hằng · Hoa tươi Ia Pa</strong>
            </span>
            <ArrowUpRight />
          </a>
          <p>
            Vui lòng liên hệ shop để xác nhận mẫu hoa và trao đổi việc nhận hoặc
            giao hoa.
          </p>
        </div>
      </div>
      <section className="shop-map" aria-labelledby="shop-map-title">
        <div className="map-heading">
          <div>
            <span className="eyebrow">HẸN BẠN Ở SHOP</span>
            <h2 id="shop-map-title">
              Đường đến <em>góc hoa.</em>
            </h2>
          </div>
          <a
            className="text-link"
            href={shop.mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Mở Google Maps <ArrowUpRight size={18} />
          </a>
        </div>
        <iframe
          title="Bản đồ đến shop - Chợ Iamron, Ia Pa, Gia Lai"
          src={shop.mapsEmbed}
          width="600"
          height="450"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <a
          className="map-address"
          href={shop.mapsUrl}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin size={18} />
          {shop.address}
          <ArrowUpRight size={16} />
        </a>
      </section>
    </section>
  );
}
export function Missing() {
  useTitle("Không tìm thấy trang");
  return (
    <div className="shell empty">
      <Flower2 size={45} />
      <h1>Trang này chưa có hoa.</h1>
      <p>Đường dẫn không tồn tại hoặc mẫu hoa đã được ẩn.</p>
      <Link className="button" to="/mau-hoa">
        Khám phá mẫu hoa <ArrowRight size={17} />
      </Link>
    </div>
  );
}
