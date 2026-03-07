# RG1 Manager - Hệ thống Quản lý Thiết bị Nghiêm ngặt & Kiểm định

Đây là ứng dụng Web quản lý thiết bị cho nhà máy RG1, được xây dựng với **React (Vite)**, **Tailwind CSS v4** và Backend **Supabase**.

## Các chức năng (MVP)

1. **Đăng nhập**: Sử dụng Supabase Auth để bảo mật, chỉ có người dùng hợp lệ mới truy cập được các chức năng.
2. **Tổng quan (Dashboard)**: Thống kê số lượng thiết bị, thiết bị sắp đến hạn, quá hạn và thiết bị đang bị khóa (có danh sách top 10 sắp đến hạn).
3. **Danh sách thiết bị**: Xem toàn bộ danh sách, hỗ trợ tìm kiếm theo tên/mã và lọc theo loại thiết bị.
4. **Chi tiết thiết bị**: Xem thông tin mở rộng, lịch sử kiểm định/sửa chữa (events timeline) và tải/xem tài liệu liên quan.
5. **Quản lý Quá hạn**: Theo dõi các thiết bị sắp hoặc đã hết hạn. Role **HSE / Admin** có quyền Khóa/Mở khóa.

## Phân quyền hệ thống (RLS - Row Level Security)
- **Viewer**: Chỉ được xem (Read-only).
- **Engineering**: Có thể thao tác (Thêm/Sửa) trên danh sách thiết bị và sự kiện nhưng không được phê duyệt khóa/mở khóa.
- **HSE / Admin**: Toàn quyền, bao gồm việc khóa (Lock) thiết bị khi quá hạn an toàn.

## Cài đặt và Triển khai
### Yêu cầu
- Node.js version 20+
- Một dự án thiết lập sẵn trên [Supabase](https://supabase.com/)

### Hướng dẫn chạy môi trường Local
1. Chạy mã SQL trong file `../schema.sql` vào Supabase SQL Editor để khởi tạo sơ đồ cơ sở dữ liệu và chính sách phân quyền (RLS).
2. Viết các khóa API vào file `.env` theo mẫu:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
3. Cài đặt các thư viện thiết yếu:
   ```bash
   npm install
   ```
4. Chạy dự án ở môi trường dev:
   ```bash
   npm run dev
   ```

### Xây dựng bản Production
```bash
npm run build
```
Mã nguồn đã tối ưu và có thể deploy trên Vercel, Netlify hoặc bất kỳ static hosting platform nào.
