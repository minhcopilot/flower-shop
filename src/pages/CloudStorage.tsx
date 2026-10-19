import { useEffect, useState, type FormEvent } from "react";
import { CloudUpload, HardDrive, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import type { StorageStatus } from "../../shared/storage";
export default function CloudStorage() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    api<StorageStatus>("/api/admin/storage")
      .then((s) => {
        if (live) setStatus(s);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  async function connect(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("Đang kiểm tra kết nối UploadThing…");
    try {
      setStatus(
        await api<StorageStatus>("/api/admin/storage", {
          method: "PUT",
          body: JSON.stringify({ token }),
        }),
      );
      setToken("");
      setMessage("Đã kết nối. Ảnh mới được tải lên UploadThing.");
    } catch (e) {
      setMessage("");
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function migrate() {
    if (!status) return;
    setBusy(true);
    setError("");
    const ids = [...status.pendingIds];
    let done = 0;
    try {
      for (const id of ids) {
        setMessage(
          `Đang chuyển ảnh ${done + 1}/${ids.length} lên UploadThing…`,
        );
        setStatus(
          await api<StorageStatus>("/api/admin/storage/migrate", {
            method: "POST",
            body: JSON.stringify({ id }),
          }),
        );
        done++;
      }
      setMessage(
        `Đã chuyển ${done} ảnh. Mẫu hoa, ảnh đại diện và thứ tự ảnh được giữ nguyên.`,
      );
    } catch (e) {
      setMessage(
        `Đã chuyển ${done}/${ids.length} ảnh. Bấm chuyển tiếp để thử lại các ảnh còn lại.`,
      );
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="storage-section" aria-busy={busy}>
      <div className="panel storage-intro">
        <div>
          <CloudUpload size={30} />
          <h2>Kho ảnh UploadThing</h2>
        </div>
        <p>
          Thêm ảnh từ máy hoặc điện thoại trong phần sửa mẫu hoa. Ảnh được tối
          ưu và lưu trên UploadThing, không cần nhập nguồn Facebook.
        </p>
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status" aria-live="polite">
          {message}
        </div>
      )}
      <div className="category-admin">
        <div>
          <div className="panel">
            <h3>Ảnh của shop</h3>
            {status ? (
              <>
                <span
                  className={`status-pill ${status.configured ? "" : "paused"}`}
                >
                  {status.configured
                    ? "Đã kết nối UploadThing"
                    : "Chưa cấu hình UploadThing"}
                </span>
                {status.configured && (
                  <p className="storage-account">
                    Ứng dụng: <strong>{status.appId}</strong>
                  </p>
                )}
                <div className="storage-count">
                  <CloudUpload size={22} />
                  <strong>{status.cloudImages}</strong>
                  <span>ảnh đã lưu trên UploadThing</span>
                </div>
                <div className="storage-count">
                  <HardDrive size={22} />
                  <strong>{status.localImages}</strong>
                  <span>ảnh chờ chuyển từ local</span>
                </div>
                <p className="muted">
                  Chỉ tính ảnh đang được dùng trong mẫu hoa, kể cả mẫu ẩn.
                </p>
                <button
                  className="button outline storage-migrate"
                  onClick={() => void migrate()}
                  disabled={
                    busy || !status.configured || !status.pendingIds.length
                  }
                >
                  <CloudUpload size={17} />
                  Chuyển ảnh hiện có lên UploadThing
                </button>
                {status.configured && !status.localImages && (
                  <p className="storage-complete">
                    <CheckCircle2 size={18} />
                    Toàn bộ ảnh đang dùng đã có trên cloud.
                  </p>
                )}
              </>
            ) : (
              <p role="status">Đang đọc kho ảnh…</p>
            )}
          </div>
          <div className="panel">
            <h3>Ảnh cũ vẫn nguyên vẹn</h3>
            <p className="muted">
              Chuyển ảnh giữ nguyên mẫu hoa, ảnh đại diện và thứ tự ảnh. Website
              giữ bản WebP local để sao lưu và dự phòng khi dịch vụ tạm gián
              đoạn.
            </p>
            <p className="muted storage-note">
              Mẫu đang ẩn vẫn chỉ xem được trong quản trị. Theo dõi hạn mức
              trong UploadThing; website không tự đăng ký gói trả phí.
            </p>
          </div>
        </div>
        <form className="panel" onSubmit={connect}>
          <h3>Cấu hình kết nối</h3>
          <p className="muted">
            Chỉ cần cập nhật khi thay token. Token hiện tại được giữ riêng trên
            máy chủ và không hiển thị lại.
          </p>
          <p className="storage-links">
            <a
              href="https://uploadthing.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Mở bảng điều khiển UploadThing ↗
            </a>
          </p>
          <label>
            UPLOADTHING_TOKEN
            <input
              type="password"
              required
              autoComplete="new-password"
              spellCheck={false}
              maxLength={4096}
              value={token}
              disabled={busy}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <p className="muted storage-note">
            Dùng token V7 từ API Keys. Không cần nhập thêm Secret Key; token đã
            chứa thông tin kết nối.
          </p>
          <button className="button" disabled={busy}>
            {busy ? "Đang xử lý…" : "Kiểm tra và lưu token"}
          </button>
        </form>
      </div>
    </div>
  );
}
