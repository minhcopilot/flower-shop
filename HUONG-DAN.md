# Hoa Tươi Ia Pa — hướng dẫn sử dụng

Website trưng bày hoa bằng tiếng Việt, không có giá, giỏ hàng hoặc thanh toán. Khách chọn mẫu rồi gọi **0986592394** hoặc liên hệ Facebook **Đinh Thị Hằng**. Shop tại **Chợ Iamron - Ia Pa - Gia Lai**.

## Mở website trên máy này

Website: **http://localhost:4317**. Quản trị: **http://localhost:4317/admin**.

Mở PowerShell trong thư mục `E:\DEV\WORKSPACE\flower-shop`, chạy:

```powershell
npm start
```

Hoặc chạy `Start-Shop.ps1`. Giữ cửa sổ terminal khi sử dụng; nhấn **Ctrl+C** để dừng. Website chỉ lắng nghe trên loopback của máy này, chưa có hosting hay tên miền. Nếu localhost của trình duyệt có vấn đề, dùng `http://127.0.0.1:4317` nhất quán cho cả đăng nhập và sử dụng.

## Tài khoản chủ shop

Tài khoản local đã được khởi tạo với mật khẩu ngẫu nhiên riêng cho lần cài đặt này. Xem **`data\owner-access.txt`** trên máy. Không chia sẻ tệp này hoặc đưa lên Git. Mật khẩu không được in trong log hoặc ghi trong mã nguồn.

Đổi mật khẩu: dừng website, chạy lệnh dưới đây và nhập mật khẩu mới ít nhất 12 ký tự. Ký tự được che khi nhập; phiên cũ bị thu hồi.

```powershell
npm run admin:password
```

Khi cài trên máy mới chưa có tài khoản, dùng `npm run admin:setup` để tự nhập tên và mật khẩu, hoặc `npm run admin:setup -- --generate` để tạo mật khẩu ngẫu nhiên. Lệnh setup không ghi đè tài khoản đã có.

## Thêm và chỉnh sửa hoa

1. Vào `/admin`, đăng nhập, chọn **Thêm mẫu hoa**.
2. Nhập tên và mã riêng (ví dụ `IP-010`). Đường dẫn không dấu được gợi ý từ tên, có thể sửa trước khi lưu. Mã mẫu và đường dẫn không được trùng.
3. Nhập mô tả, chọn loại hoa và dịp tặng. Không có trường giá.
4. Chọn một hoặc nhiều ảnh JPEG, PNG, WebP. Mỗi ảnh tối đa 10 MB, tối đa 12 ảnh/mẫu. Ảnh được kiểm tra và chuyển sang WebP, giữ tỷ lệ, cạnh tối đa 1600 × 1800, không phóng to ảnh nhỏ.
5. Ảnh đầu tiên là ảnh đại diện. Dùng nút dấu kiểm để chọn ảnh đại diện; nút mũi tên để sắp xếp; nút thùng rác để gỡ ảnh khỏi mẫu.
6. Chọn **Hiển thị ngoài website**, **Mẫu nổi bật ở trang chủ**, **Còn nhận đặt** theo nhu cầu và bấm **Lưu mẫu hoa**. Nếu chưa hoàn thiện, để mẫu ẩn và ghi chú bản nháp.

Mẫu có ghi chú bản nháp hoặc không có ảnh không thể bật hiển thị. Mẫu ẩn không xuất hiện ở danh mục, API công khai hoặc đường dẫn chi tiết. Ảnh chỉ gắn với mẫu ẩn cũng bị chặn với người chưa đăng nhập. Nếu cùng một ảnh vẫn được mẫu công khai khác dùng, ảnh đó vẫn xem được.

Tạm hết hoa: bỏ chọn **Còn nhận đặt**; mẫu vẫn hiện nhưng có thông báo tạm ngưng. Muốn gỡ hẳn khỏi website: bỏ chọn **Hiển thị ngoài website**. Nên dùng Ẩn trước khi quyết định xóa mẫu.

Trong mục **Danh mục**, tạo/sửa/xóa loại hoa hoặc dịp tặng. Danh mục đang có mẫu không xóa được: trước tiên sửa các mẫu để bỏ hoặc chuyển danh mục.

Nguồn Facebook và ghi chú bản nháp chỉ hiển thị trong quản trị. Tên của 9 mẫu ban đầu mô tả theo ảnh, chủ shop có thể sửa lại. Không có đồng bộ Facebook tự động.

## Dữ liệu và sao lưu

Database nằm ở `data\shop.sqlite`, ảnh ở `data\uploads`. Không xóa thư mục `data`. Mã nguồn, tài khoản, ảnh upload và bản sao lưu được tách riêng. Không chạy hai tiến trình website dùng chung thư mục dữ liệu.

**Dừng website trước khi sao lưu hoặc khôi phục.**

```powershell
npm run backup
```

Lệnh in đường dẫn thư mục mới trong `backups\`, chứa database, tất cả ảnh và manifest SHA-256. Chép nguyên thư mục bản sao lưu sang ổ đĩa khác để dự phòng. Bản sao lưu chứa thông tin tài khoản đã băm, vì vậy cần giữ riêng tư. Tệp mật khẩu rõ `owner-access.txt` không được đưa vào bản sao lưu tự động.

Khôi phục:

```powershell
npm run restore -- "E:\DEV\WORKSPACE\flower-shop\backups\TEN-BAN-SAO-LUU"
npm start
```

Lệnh kiểm tra checksum, tính toàn vẹn database và ảnh trước khi thay dữ liệu. Dữ liệu hiện tại được giữ ở thư mục `data.before-restore-...` để có thể quay lại; không bị xóa. Các phiên đăng nhập trong bản khôi phục bị thu hồi. Sau khôi phục dùng mật khẩu tại thời điểm bản sao lưu, hoặc chạy `npm run admin:password` để đặt lại.

Ảnh đã gỡ khỏi mẫu hoặc thuộc mẫu đã xóa được giữ trong kho local để tránh xóa nhầm; chúng không tự hiện ngoài website. Chưa có chức năng dọn kho ảnh mồ côi.

## Cài đặt lại và phát triển

Yêu cầu Node.js **22.12 trở lên**; đã kiểm tra với Node 22.22.1 trên Windows.

```powershell
npm ci
npm run seed
npm run admin:setup
npm run build
npm start
```

Chỉ chạy seed khi muốn nhập lại bộ mẫu ban đầu. Nó không ghi đè mẫu cùng mã nhưng sẽ tạo lại mẫu khởi tạo đã bị xóa.

Khi sửa mã nguồn: `npm run dev` chạy frontend tại `http://localhost:5173`, backend tại cổng 4317. Không chạy đồng thời với `npm start`. Frontend proxy `/api` và `/media` về backend; mở frontend ở cổng 5173 để thấy cập nhật tự động. Sau khi sửa, chạy lại `npm run build` trước khi dùng `npm start`.

Kiểm tra:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

Kiểm thử API dùng thư mục tạm riêng, không sửa database shop. Báo cáo kiểm tra trình duyệt và ảnh nằm trong `artifacts\` trên máy bàn giao. Có thể cấu hình `PORT` và `DATA_DIR` qua biến môi trường; nếu đổi cổng backend khi phát triển phải cập nhật proxy tương ứng trong Vite.

## Nguồn mã và giới hạn bản đầu

Phát triển từ Flora Bloom của Themixly: https://github.com/themixlyweb/react-flower-shop-website-template. Giữ `LICENSE` MIT và thông báo bản quyền gốc. Các trang và backend mới được bổ sung trên bản miễn phí, không dùng mã bản Pro.

Stack: React 18, TypeScript, Vite, Tailwind CSS, Express, SQLite, Sharp. Dependency Vite, Tailwind và React Router đã được cập nhật khi triển khai để xử lý cảnh báo audit từ template cũ.

Một tài khoản chủ shop; chưa có phân quyền nhân viên, kho, đơn hàng, thanh toán hoặc triển khai public. Font dùng Google Fonts với font dự phòng khi mất mạng. Khi đưa lên Internet cần cấu hình hosting, HTTPS và cookie Secure phù hợp; bản hiện tại được cấu hình cho local HTTP.
