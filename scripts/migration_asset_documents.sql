-- =================================================================
-- MIGRATION: Nâng cấp bảng asset_documents cho production
-- Ngày: 2026-03-07
-- Mô tả: Thêm các cột còn thiếu, index, soft-delete, storage policy SQL
-- An toàn: Chỉ dùng ADD COLUMN IF NOT EXISTS — không xóa dữ liệu cũ
-- =================================================================

-- -------------------------------------------------------
-- BƯỚC 1: Thêm các cột còn thiếu
-- -------------------------------------------------------

-- Tiêu đề tài liệu (người dùng có thể đặt tên rõ ràng hơn file_name)
ALTER TABLE public.asset_documents ADD COLUMN IF NOT EXISTS title text;

-- Mô tả / ghi chú thêm
ALTER TABLE public.asset_documents ADD COLUMN IF NOT EXISTS description text;

-- Tên file gốc khi upload (file_name có thể bị rename khi lưu storage)
ALTER TABLE public.asset_documents ADD COLUMN IF NOT EXISTS original_file_name text;

-- Soft delete: thay vì xóa thật, ghi lại thời điểm
ALTER TABLE public.asset_documents ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.asset_documents ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- updated_at cho audit trail
ALTER TABLE public.asset_documents ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- -------------------------------------------------------
-- BƯỚC 2: Backfill original_file_name từ file_name hiện có
-- -------------------------------------------------------
UPDATE public.asset_documents
SET original_file_name = file_name
WHERE original_file_name IS NULL AND file_name IS NOT NULL;

-- -------------------------------------------------------
-- BƯỚC 3: Index cho các query phổ biến
-- -------------------------------------------------------

-- Query theo asset (hay dùng nhất)
CREATE INDEX IF NOT EXISTS idx_asset_documents_asset_id
    ON public.asset_documents (asset_id);

-- Query theo loại tài liệu
CREATE INDEX IF NOT EXISTS idx_asset_documents_doc_type
    ON public.asset_documents (doc_type);

-- Cảnh báo hồ sơ hết hạn
CREATE INDEX IF NOT EXISTS idx_asset_documents_expiry_date
    ON public.asset_documents (expiry_date)
    WHERE expiry_date IS NOT NULL AND deleted_at IS NULL;

-- Site-level query (cho dashboard)
CREATE INDEX IF NOT EXISTS idx_asset_documents_site_id
    ON public.asset_documents (site_id);

-- -------------------------------------------------------
-- BƯỚC 4: Chuẩn hóa doc_type values
-- -------------------------------------------------------
-- Chuẩn hóa các giá trị cũ nếu có
UPDATE public.asset_documents SET doc_type = 'inspection_report' WHERE doc_type = 'report';
UPDATE public.asset_documents SET doc_type = 'certificate'       WHERE doc_type = 'cert';
UPDATE public.asset_documents SET doc_type = 'other'             WHERE doc_type NOT IN (
    'certificate', 'inspection_report', 'legal_confirmation', 'declaration_letter',
    'maintenance_record', 'checklist', 'invoice', 'other'
);

-- -------------------------------------------------------
-- BƯỚC 5: Tạo bucket Supabase Storage (chỉ là hướng dẫn SQL — chạy qua Dashboard hoặc API)
-- Tạo bucket 'equipment-docs' > Private > Max 50MB
-- -------------------------------------------------------

-- HƯỚNG DẪN MANUAL (chạy trong Supabase Dashboard > Storage):
-- 1. Tạo bucket: equipment-docs
--    - Public: false (private)
--    - File size limit: 52428800 (50MB)
--    - Allow MIME types: application/pdf, image/*, application/msword,
--      application/vnd.openxmlformats-officedocument.wordprocessingml.document,
--      application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

-- -------------------------------------------------------
-- BƯỚC 6: Storage RLS Policies (áp dụng qua Supabase Dashboard > Storage > Policies)
-- -------------------------------------------------------

-- Policy 1: Authenticated users có thể UPLOAD vào bucket (với role hợp lệ)
-- Tên: "Allow upload for hse/admin/engineering"
-- Operation: INSERT
-- Definition:
--   bucket_id = 'equipment-docs'
--   AND auth.role() = 'authenticated'
--   AND EXISTS (
--     SELECT 1 FROM public.profiles
--     WHERE id = auth.uid()
--     AND role IN ('admin', 'hse', 'engineering')
--   )

-- Policy 2: Authenticated users có thể ĐỌC/DOWNLOAD
-- Tên: "Allow read for authenticated"
-- Operation: SELECT
-- Definition:
--   bucket_id = 'equipment-docs'
--   AND auth.role() = 'authenticated'

-- Policy 3: admin/hse có thể XÓA
-- Tên: "Allow delete for hse/admin"
-- Operation: DELETE
-- Definition:
--   bucket_id = 'equipment-docs'
--   AND auth.role() = 'authenticated'
--   AND EXISTS (
--     SELECT 1 FROM public.profiles
--     WHERE id = auth.uid()
--     AND role IN ('admin', 'hse')
--   )

-- -------------------------------------------------------
-- KIỂM TRA
-- -------------------------------------------------------
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'asset_documents' AND table_schema = 'public'
-- ORDER BY ordinal_position;
