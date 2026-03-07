-- =================================================================
-- MIGRATION: Admin Tables — alert_settings + alert_logs
-- Ngày: 2026-03-07
-- Mô tả: Thêm bảng cấu hình cảnh báo và log gửi email
-- An toàn: Additive only — không xóa bảng hoặc column cũ
-- =================================================================

-- -------------------------------------------------------
-- BẢNG 1: alert_settings — Cấu hình cảnh báo theo site
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_settings (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id             text NOT NULL UNIQUE,  -- khóa chính logic, mỗi site 1 bản ghi
    enabled             boolean NOT NULL DEFAULT false,
    days_before         integer NOT NULL DEFAULT 30,  -- cảnh báo trước N ngày
    recipients          jsonb NOT NULL DEFAULT '[]'::jsonb,  -- mảng email string
    include_due_soon    boolean NOT NULL DEFAULT true,
    include_overdue     boolean NOT NULL DEFAULT true,
    updated_at          timestamp with time zone DEFAULT now(),
    updated_by          uuid REFERENCES auth.users(id)
);

-- -------------------------------------------------------
-- BẢNG 2: alert_logs — Lịch sử gửi cảnh báo email
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_logs (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id         text NOT NULL,
    run_at          timestamp with time zone NOT NULL DEFAULT now(),
    total_due_soon  integer NOT NULL DEFAULT 0,
    total_overdue   integer NOT NULL DEFAULT 0,
    recipients      jsonb NOT NULL DEFAULT '[]'::jsonb,
    status          text NOT NULL DEFAULT 'success',  -- 'success' | 'error' | 'partial'
    error           text,                             -- error message nếu có
    created_at      timestamp with time zone DEFAULT now()
);

-- -------------------------------------------------------
-- INDEX
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_alert_settings_site_id
    ON public.alert_settings (site_id);

CREATE INDEX IF NOT EXISTS idx_alert_logs_site_id_run_at
    ON public.alert_logs (site_id, run_at DESC);

-- -------------------------------------------------------
-- RLS (Row Level Security)
-- -------------------------------------------------------
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;

-- alert_settings: admin read/write, hse read-only
CREATE POLICY "alert_settings_admin_all" ON public.alert_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "alert_settings_hse_read" ON public.alert_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('hse', 'engineering')
        )
    );

-- alert_logs: admin read/write, hse read-only
CREATE POLICY "alert_logs_admin_all" ON public.alert_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "alert_logs_hse_read" ON public.alert_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('hse', 'engineering')
        )
    );

-- -------------------------------------------------------
-- Seed dữ liệu alert_settings cho các site mặc định
-- (safe: chỉ insert nếu chưa có)
-- -------------------------------------------------------
INSERT INTO public.alert_settings (site_id, enabled, days_before, recipients, include_due_soon, include_overdue)
VALUES
    ('RG1',  false, 30, '[]', true, true),
    ('RG2',  false, 30, '[]', true, true),
    ('RG3',  false, 30, '[]', true, true),
    ('RG5',  false, 30, '[]', true, true),
    ('CSVL', false, 30, '[]', true, true)
ON CONFLICT (site_id) DO NOTHING;

-- -------------------------------------------------------
-- KIỂM TRA SAU KHI CHẠY
-- -------------------------------------------------------
-- SELECT * FROM public.alert_settings;
-- SELECT * FROM public.alert_logs ORDER BY created_at DESC LIMIT 10;
