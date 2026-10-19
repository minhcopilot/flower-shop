# Kết quả kiểm tra bàn giao — 19/10/2026

- `npm run build`: đạt, bao gồm TypeScript frontend/backend và cấu hình Vite.
- `npm run lint`: đạt, không lỗi/cảnh báo.
- `npm test`: 15/15 nhóm kiểm thử đạt; chạy trên database tạm riêng, không sửa dữ liệu shop.
- `npm audit`: 0 lỗ hổng được báo cáo tại thời điểm kiểm tra.
- `git diff --check`: đạt.

## API và dữ liệu

Đã kiểm tra: chặn quản trị và upload khi chưa đăng nhập; mật khẩu băm; đăng nhập đúng/sai; cookie HttpOnly, SameSite; từ chối yêu cầu thiếu header hoặc sai Origin; giới hạn đăng nhập; CRUD danh mục và mẫu hoa; chặn xóa danh mục đang dùng; chặn mã/đường dẫn trùng và ID không hợp lệ.

Upload nhận JPEG, PNG, WebP, chuyển WebP; từ chối SVG, tệp giả ảnh và tệp vượt 10 MB. Đã kiểm tra đổi thứ tự ảnh/ảnh đại diện và chặn công khai mẫu nháp thiếu ảnh. Mẫu ẩn không nằm trong API công khai, không xem được URL chi tiết hoặc ảnh riêng khi chưa đăng nhập.

Database, ảnh và phiên đăng nhập tồn tại sau khi đóng/mở lại database. Đăng xuất thu hồi phiên. Sao lưu/khôi phục được kiểm tra trên dữ liệu tạm: ảnh và mẫu hoa còn nguyên, các phiên được xóa khi khôi phục, bản sao lưu bị thay đổi bị từ chối.

Đã chạy `npm run backup` trên dữ liệu shop sau khi dọn mẫu kiểm thử. Có bản sao lưu trong `backups/` với database, ảnh và checksum. Không khôi phục đè lên dữ liệu shop để kiểm thử.

## Kiểm tra trình duyệt

Đã mở bản build chạy từ Express và kiểm tra giao diện thực:

- Trang chủ, danh mục, chi tiết mẫu và liên hệ ở 375, 768, 1440 px: chiều rộng nội dung không vượt viewport, không cuộn ngang.
- Danh mục hiện 9 mẫu thật; không có ảnh lỗi khi kiểm tra. Tìm `hong do` trả 2 mẫu; lọc dịp tặng hoạt động; từ khóa không có kết quả hiện hướng dẫn và nút xóa lọc.
- Đăng nhập bằng tài khoản local, tạo mẫu tạm `QA-LOCAL`, upload 2 ảnh, đổi ảnh đại diện, lưu và xem trang chi tiết. Đổi ảnh chi tiết có cập nhật trạng thái chọn.
- Sửa mẫu tạm, bỏ hiển thị, lưu; trang chi tiết báo không tìm thấy. Mẫu tạm đã được dọn, còn 9 mẫu khởi tạo.
- Đăng xuất trở lại form đăng nhập. Nút điện thoại dùng `tel:0986592394`, Facebook trỏ đúng hồ sơ được cung cấp.
- Kiểm tra dev proxy: health, đăng nhập và đăng xuất qua cổng 5173 với cả localhost và 127.0.0.1. Cấu hình proxy giữ Host để kiểm tra Origin hoạt động đúng.

Ảnh giao diện lưu local trong `artifacts/`: `home-1440.jpg`, `home-768.jpg`, `mobile-375.jpg`, `catalog-375.jpg`, `catalog-768.jpg`, `catalog-1440.jpg`, `admin-1440.jpg`, `admin-375.jpg`.

## Bổ sung UploadThing

- Đã kết nối tài khoản UploadThing bằng token lưu riêng ngoài Git. API quản trị không trả token về trình duyệt.
- Đã chuyển 9/9 ảnh hiện có lên UploadThing, tải trực tiếp từng tệp từ cloud và so sánh byte ảnh giải mã với WebP local: 9/9 khớp. Mã băm dữ liệu mẫu hoa trước/sau không đổi; giữ nguyên mã mẫu, ảnh đại diện và thứ tự ảnh.
- Đã thử chọn ảnh từ máy bằng trang quản trị: UploadThing nhận tệp, hiện thông báo thành công và ảnh xem trước. Hủy mẫu thử và dọn riêng tệp thử, giữ nguyên 9 mẫu thật.
- Đã kiểm tra tab Lưu trữ ảnh: 9 ảnh cloud, 0 ảnh chờ chuyển; không còn trường nguồn Facebook trong form mẫu hoa. Giao diện 375/768/1440 px không cuộn ngang.
- Kiểm thử tự động bổ sung: nâng schema không mất ảnh cũ, xác thực cấu hình, không lộ token, migration chạy lại an toàn, xử lý lỗi upload, chặn ảnh mẫu ẩn trước khi gọi cloud, mã hóa/giải mã và phát hiện tệp bị sửa, sao lưu khóa đọc ảnh và giữ cấu hình riêng khi khôi phục.
- Ảnh bằng chứng trong `artifacts/`: `uploadthing-admin.jpg`, `uploadthing-admin-375.jpg`, `uploadthing-upload-success.jpg`; kết quả đối chiếu cloud trong `uploadthing-live-check.json`.

## Bổ sung bản đồ và liên hệ nổi

- Nhúng đúng iframe Google Maps được cung cấp (địa điểm trên Google hiển thị Helen Flower); bản đồ đã tải và hiện điểm đánh dấu trong trình duyệt. Địa chỉ ở trang liên hệ, chi tiết mẫu, dưới bản đồ và chân trang mở cùng địa điểm bằng CID.
- Header có mục Quản trị. Đã thử mở menu ở 375 px, bấm Quản trị, đến `/admin` và menu tự đóng.
- Cụm liên hệ nổi bên phải trên cả website và quản trị: gọi `0986592394`, Zalo `https://zalo.me/0986592394`, Facebook đúng hồ sơ chủ shop. Trên điện thoại mỗi nút 56 × 56 px, cách nhau 8 px.
- Kiểm tra chiều rộng 375/768/1440 px không cuộn ngang; CSP cho phép iframe từ `https://www.google.com`. Build/TypeScript, lint, 15/15 kiểm thử đạt sau thay đổi.
- Ảnh kiểm tra: `artifacts/contact-map-1440.jpg`, `artifacts/contact-admin-375.jpg`. Chưa thực hiện cuộc gọi hoặc gửi tin nhắn Zalo/Facebook.

## Bổ sung Turso và Vercel

- Đã chuyển 1 tài khoản chủ shop (mật khẩu băm), 7 danh mục, 10 mẫu hoa, 16 bản ghi media lên Turso. Đối chiếu từng hàng của bốn bảng với SQLite: khớp. Bao gồm mẫu do chủ shop bổ sung; không xóa hoặc đổi dữ liệu shop.
- Có 12 ảnh đang được dùng trong các mẫu: backend serverless đọc từ UploadThing, giải mã bằng ENV, so sánh SHA-256 với ảnh local, 12/12 khớp. Không dùng fallback ảnh local trong phép kiểm tra này. Ảnh chưa được dùng không tính trong thống kê dashboard.
- Kiểm tra trực tiếp handler Vercel với Turso thật: API quản trị chưa đăng nhập trả 401, đăng nhập tài khoản hiện có thành công, đọc dữ liệu/ảnh, đăng xuất thu hồi phiên. Báo cáo không chứa bí mật ở `artifacts/turso-live-check.json`.
- 20/20 kiểm thử tự động đạt: giữ 15 kiểm thử cũ, thêm migration chạy lại/không ghi đè/không chép phiên, phiên Secure dùng chung qua nhiều instance, CRUD và upload cloud không ghi file, ẩn ảnh, lỗi cloud trả 502, CSRF, giới hạn đăng nhập dùng chung và ENV thiếu/sai.
- Đã chọn ảnh PNG thử 6.763.537 byte từ trình duyệt, tối ưu trước khi gửi và upload UploadThing thành công; ảnh WebP lưu được 1.568.098 byte. Hủy form và dọn riêng tệp thử. Không tạo mẫu hoa thử trên Turso.
- Build/TypeScript, lint, audit (0 lỗ hổng) và kiểm tra whitespace đạt. Bản local đã chạy lại, vẫn dùng SQLite độc lập.
- Bản sao lưu trước chuyển: `backups/iapa-2026-10-19T01-29-19-983Z-4b4b54`; đã xuất snapshot Turso trong `backups/turso-1792373625179.json`. Không khôi phục đè dữ liệu đang chạy để thử.
- `data/vercel.env` chứa đủ biến môi trường riêng, không vào Git. Cấu hình deploy và giới hạn xem `DEPLOY-VERCEL.md`.
- Chưa chạy build trên hạ tầng Vercel hoặc xác nhận URL deployment public; cần import ENV, deploy commit mới và kiểm tra URL thực tế.

## Giới hạn bàn giao sau chuyển cloud

Bản bàn giao chạy local tại cổng 4317, chưa triển khai Internet. Chưa kiểm tra trên thiết bị điện thoại vật lý hoặc thao tác gọi điện thực tế. Chưa tự động đồng bộ Facebook, không có đơn hàng/thanh toán. Các danh mục giỏ hoa/kệ hoa/khai trương chưa được điền sản phẩm suy đoán; chủ shop bổ sung qua quản trị.
