-- ==========================================================
-- MIGRATION: Chuẩn hóa Schema Thiết bị Kiểm định
-- Ngày: 2026-03-07
-- Mô tả: Chuẩn hóa enum, bỏ FK lẻ, backfill declared_status
-- CHẠY TỪNG BLOCK, KIỂM TRA SAU MỖI BƯỚC
-- ==========================================================

-- -------------------------------------------------------
-- BƯỚC 1: Backfill declared_status về enum chuẩn
-- 'ok'   → 'declared'
-- 'none' → 'not_declared'
-- NULL   → 'not_declared'
-- -------------------------------------------------------
UPDATE public.assets
SET declared_status = 'declared'
WHERE declared_status = 'ok';

UPDATE public.assets
SET declared_status = 'not_declared'
WHERE declared_status IN ('none', '', 'chua') OR declared_status IS NULL;

-- Kiểm tra sau backfill (chạy để xác nhận)
-- SELECT declared_status, COUNT(*) FROM public.assets GROUP BY declared_status;

-- -------------------------------------------------------
-- BƯỚC 2: Bỏ FK constraint equipment_category → equipment_categories
-- Lý do: Import flow ghi free-text category label, không phải FK id
-- equipment_category vẫn giữ nguyên như text field linh hoạt
-- -------------------------------------------------------
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS fk_assets_equipment_category;
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_equipment_category_fkey;

-- -------------------------------------------------------
-- BƯỚC 3: Đảm bảo unique index trên asset_code (cho upsert)
-- -------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS assets_asset_code_unique ON public.assets (asset_code);

-- -------------------------------------------------------
-- BƯỚC 4: Thêm các cột còn thiếu trong init_schema.sql
-- (Schema v2 đã có đủ, nhưng nếu DB đang chạy init_schema.sql cũ thì cần ADD COLUMN)
-- -------------------------------------------------------

-- Thêm cột serial_or_model nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS serial_or_model text;

-- Thêm cột stamp_no nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS stamp_no text;

-- Thêm cột declared_status nếu chưa có (mặc định not_declared)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS declared_status text DEFAULT 'not_declared';

-- Thêm cột declaration_doc_no nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS declaration_doc_no text;

-- Thêm cột interval_text nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS interval_text text;

-- Thêm cột equipment_name nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS equipment_name text;

-- Thêm cột equipment_category nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS equipment_category text;

-- Thêm cột serial nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS serial text;

-- Thêm cột year_made nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS year_made integer;

-- Thêm cột manufacturer nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS manufacturer text;

-- Thêm cột working_pressure nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS working_pressure text;

-- Thêm cột capacity_or_rating nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS capacity_or_rating text;

-- Thêm created_at, updated_at nếu chưa có
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- -------------------------------------------------------
-- BƯỚC 5: Backfill serial_or_model từ serial hoặc model
-- -------------------------------------------------------
UPDATE public.assets
SET serial_or_model = COALESCE(serial, model)
WHERE serial_or_model IS NULL AND (serial IS NOT NULL OR model IS NOT NULL);

-- -------------------------------------------------------
-- BƯỚC 6: Thêm stamp_no cho asset_events nếu chưa có
-- -------------------------------------------------------
ALTER TABLE public.asset_events ADD COLUMN IF NOT EXISTS stamp_no text;
ALTER TABLE public.asset_events ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.asset_events ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- -------------------------------------------------------
-- BƯỚC 7: Thêm CHECK constraint cho declared_status
-- (Soft constraint — chỉ thêm nếu muốn enforce ở DB level)
-- -------------------------------------------------------
-- ALTER TABLE public.assets ADD CONSTRAINT assets_declared_status_check
--   CHECK (declared_status IN ('declared', 'not_declared', 'not_required'));

-- -------------------------------------------------------
-- KIỂM TRA CUỐI
-- -------------------------------------------------------
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'assets' AND table_schema = 'public'
-- ORDER BY ordinal_position;
