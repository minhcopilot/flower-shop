# Kết quả kiểm tra bàn giao — 19/10/2026

- `npm run build`: đạt, bao gồm TypeScript frontend/backend và cấu hình Vite.
- `npm run lint`: đạt, không lỗi/cảnh báo.
- `npm test`: 9/9 nhóm kiểm thử API đạt; chạy trên database tạm riêng.
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

## Phạm vi xác minh

Bản bàn giao chạy local tại cổng 4317, chưa triển khai Internet. Chưa kiểm tra trên thiết bị điện thoại vật lý hoặc thao tác gọi điện thực tế. Chưa tự động đồng bộ Facebook, không có đơn hàng/thanh toán. Các danh mục giỏ hoa/kệ hoa/khai trương chưa được điền sản phẩm suy đoán; chủ shop bổ sung qua quản trị.
