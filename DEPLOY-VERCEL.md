# Deploy Hoa Tươi Ia Pa: Vercel + Turso + UploadThing

Frontend Vite và API Express cùng tên miền. Mẫu hoa, danh mục, tài khoản băm, phiên đăng nhập và giới hạn đăng nhập nằm trong Turso. Ảnh ở UploadThing. Function không ghi database, khóa hoặc ảnh lên ổ đĩa Vercel.

## Cấu hình trên Vercel

1. Import repo `minhcopilot/flower-shop`, nhánh `main`. Preset **Vite**, Root Directory `./`, Build Command `npm run build`, Output Directory `dist`. `vercel.json` đã cấu hình API, ảnh, SPA fallback, bảo mật và vùng Tokyo gần database.
2. Mở **Environment Variables → Import .env**, chọn tệp **`data/vercel.env`** trên máy đã chuyển dữ liệu. Tệp này có đủ 5 biến dưới đây, nằm ngoài Git. Chọn Production; dùng database riêng nếu muốn Preview có thể chỉnh dữ liệu độc lập.
3. Bấm Deploy. Nếu dự án đã deploy trước đó: Settings → Environment Variables → import, rồi Deployments → Redeploy bản commit mới nhất.
4. Mở `/api/health`, trang chủ, một chi tiết mẫu hoa, `/admin`. Đăng nhập bằng tài khoản hiện có, thử thêm/sửa mẫu rồi kiểm tra ảnh. Trang chi tiết và `/admin` phải mở trực tiếp được sau khi refresh.

| Biến | Giá trị |
| --- | --- |
| `TURSO_DATABASE_URL` | URL libSQL của database shop |
| `TURSO_AUTH_TOKEN` | Token đọc/ghi của database, không phải Platform API Token |
| `UPLOADTHING_TOKEN` | Token V7 cùng ứng dụng đã chứa ảnh |
| `SESSION_SECRET` | Khóa phiên dài tối thiểu 32 ký tự, giữ ổn định giữa các lần deploy |
| `MEDIA_ENCRYPTION_KEY` | Khóa 64 ký tự hex từ `data/media-encryption-key`, giữ nguyên để đọc ảnh cũ |

Không thêm `VITE_` vào các biến này. Không nhập `PORT`, `DATA_DIR`, mật khẩu admin hoặc Secret Key UploadThing riêng vào Vercel. Tài khoản chủ shop đã nằm trong Turso dưới dạng mật khẩu băm. Có thể tạo lại tệp ENV riêng bằng `npm run turso:env` trên máy đang có cấu hình local.

## Trạng thái dữ liệu khi chuyển

Đã sao lưu dữ liệu local trước khi chuyển. Bốn bảng dữ liệu đã được đối chiếu từng hàng; không chép các phiên đăng nhập cũ. Lệnh migration chỉ nhập vào bảng trống hoặc xác nhận dữ liệu giống hệt, từ chối ghi đè dữ liệu khác.

```powershell
# Chỉ thực hiện khi chuyển ban đầu, với server local đã dừng
npm run turso:migrate

# Xuất dữ liệu cloud ra backups/ (không chứa token và phiên đăng nhập)
npm run turso:backup
```

Sau khi bắt đầu quản trị trên Vercel, coi **Turso là dữ liệu chính**. `npm start` vẫn chạy bản SQLite local độc lập; chỉnh ở local không tự đồng bộ lên cloud. Không chạy lại seed/migrate để cập nhật dữ liệu cloud đã thay đổi. Các lệnh `admin:password`, `backup`, `restore` cũ chỉ thao tác SQLite local.

Giữ an toàn tệp ENV và khóa đọc ảnh cùng bản sao lưu. Khóa đọc ảnh không thể tự tạo lại nếu đã mất. Khi cần khôi phục cloud, tạo database mới, phục hồi dữ liệu đã xuất sau khi đối chiếu, rồi đổi URL/token của Vercel; không ghi đè database đang hoạt động.

## Sitemap và Google Search Console

Sitemap XML công khai tại `https://www.hoatuoiiapa.shop/sitemap.xml`. API tạo danh sách mới từ Turso mỗi lần truy cập: trang chủ, danh mục, giới thiệu, liên hệ và chi tiết các mẫu đang hiển thị; không chứa trang quản trị/API hoặc mẫu ẩn. Ngày cập nhật mẫu lấy từ dữ liệu, không tự gán ngày hôm nay cho mọi URL. `robots.txt` đã khai báo sitemap. Không cần thêm ENV.

Sau khi xác minh tên miền trong Search Console, mở **Sơ đồ trang web**, nhập toàn bộ URL sitemap trên và bấm **Gửi**. Không dùng HTML trang chủ làm sitemap. Khi thêm/sửa đường dẫn/ẩn/xóa mẫu hoa, sitemap tự đổi theo database, không cần deploy lại.

## Token và vận hành cloud

Token database cấp lúc chuyển có thời hạn **180 ngày**. Trước khi hết hạn, tạo token đọc/ghi mới cho **cùng database**, cập nhật `TURSO_AUTH_TOKEN` trên Vercel và cấu hình local, redeploy, kiểm tra `/api/products` và đăng nhập. Platform API Token không cần đưa lên Vercel.

Cookie quản trị trên Vercel có Secure, HttpOnly, SameSite=Strict. Phiên và bộ đếm đăng nhập lưu trong Turso nên dùng chung giữa các function instance. Không dùng bộ nhớ hay `/tmp` làm database bền vững.

Vercel giới hạn payload function 4.5 MB; giao diện vẫn cho chọn ảnh JPEG/PNG/WebP đến 10 MB, tự tối ưu ảnh lớn xuống dưới 3 MB trước khi gửi. Server tiếp tục kiểm tra nội dung và tối ưu WebP trước khi lưu UploadThing.

Chưa xác nhận deployment thực tế cho đến khi kiểm tra URL Vercel sau deploy. Không coi build local hoặc kiểm tra trực tiếp Turso là bằng chứng website đã chạy trên Internet.

Tài liệu: [Turso libSQL](https://docs.turso.tech/sdk/ts/quickstart#remote-libsql-database-libsql-client), [Vercel Functions limits](https://vercel.com/docs/functions/limitations), [Vercel rewrites](https://vercel.com/docs/project-configuration/vercel-json#rewrites).
