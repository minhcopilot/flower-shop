import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Flower2,
  Menu,
  X,
  Phone,
  Facebook,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import { shop } from "../shared/schema";
import { Home, Catalog, FlowerDetail, Contact, Missing } from "./pages/Store";
import Admin from "./pages/Admin";

function Layout() {
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const isAdmin = location.pathname.startsWith("/admin");
  return (
    <>
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      <div className="topline">
        <span>Hoa Tươi Ia Pa · Chợ Iamron, Gia Lai</span>
        <a href={`tel:${shop.phone}`}>
          Gọi shop: 0986 592 394 <ArrowUpRight size={13} />
        </a>
      </div>
      <header className="site-header">
        <div className="shell header-inner">
          <Link
            className="brand"
            to="/"
            aria-label="Hoa Tươi Ia Pa - Trang chủ"
          >
            <Flower2 size={35} strokeWidth={1.25} />
            <span>
              Hoa Tươi <i>Ia Pa</i>
              <small>GỬI HOA · GỬI YÊU THƯƠNG</small>
            </span>
          </Link>
          <nav
            className={menu ? "nav open" : "nav"}
            aria-label="Điều hướng chính"
          >
            <NavLink to="/" end>
              Trang chủ
            </NavLink>
            <NavLink to="/mau-hoa">Mẫu hoa</NavLink>
            <NavLink to="/gioi-thieu">Về shop</NavLink>
            <NavLink to="/lien-he">Liên hệ</NavLink>
          </nav>
          <a className="button header-call" href={`tel:${shop.phone}`}>
            <Phone size={16} /> Gọi đặt hoa
          </a>
          <button
            className="icon-button menu-toggle"
            aria-label={menu ? "Đóng menu" : "Mở menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mau-hoa" element={<Catalog />} />
          <Route path="/mau-hoa/:slug" element={<FlowerDetail />} />
          <Route path="/gioi-thieu" element={<Contact about />} />
          <Route path="/lien-he" element={<Contact />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="*" element={<Missing />} />
        </Routes>
      </main>
      <footer>
        <div className="shell footer-grid">
          <div>
            <Link className="brand" to="/">
              <Flower2 size={30} />
              <span>
                Hoa Tươi <i>Ia Pa</i>
              </span>
            </Link>
            <p>
              Một bó hoa, một lời thương.
              <br />
              Cùng bạn gửi trao những điều đẹp đẽ.
            </p>
          </div>
          <div>
            <h3>Khám phá</h3>
            <Link to="/mau-hoa">Các mẫu hoa</Link>
            <Link to="/gioi-thieu">Câu chuyện của shop</Link>
            <Link to="/lien-he">Liên hệ đặt hoa</Link>
          </div>
          <div>
            <h3>Ghé shop nhé</h3>
            <p>
              <MapPin size={16} />
              {shop.address}
            </p>
            <a href={`tel:${shop.phone}`}>
              <Phone size={16} />
              0986 592 394
            </a>
            <a href={shop.facebook} target="_blank" rel="noreferrer">
              <Facebook size={16} />
              Facebook Đinh Thị Hằng
            </a>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>© {new Date().getFullYear()} Hoa Tươi Ia Pa</span>
          <Link to="/admin">
            Quản trị shop <ArrowUpRight size={13} />
          </Link>
        </div>
      </footer>
      {!isAdmin && (
        <div className="mobile-contact">
          <a href={`tel:${shop.phone}`}>
            <Phone size={18} />
            Gọi đặt hoa
          </a>
          <a href={shop.facebook} target="_blank" rel="noreferrer">
            <Facebook size={18} />
            Liên hệ Facebook
          </a>
        </div>
      )}
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
