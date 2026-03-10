-- Bảng danh phục vụ quản lý thiết bị RG1
-- Chạy script này trong Supabase SQL Editor

-- 1. Create Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing triggers to avoid errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP FUNCTION IF EXISTS public.get_user_site() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.update_modified_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Common Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Create Tables

-- Sites
CREATE TABLE IF NOT EXISTS public.sites (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sites_pkey PRIMARY KEY (id)
);

-- Profiles (Liên kết với auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'hse', 'engineering', 'viewer')),
    site_id text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT profiles_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id)
);

-- Bảng thiết lập ngưỡng cảnh báo (site setting)
CREATE TABLE IF NOT EXISTS public.site_settings (
    site_id text NOT NULL,
    due_soon_days integer DEFAULT 30 NOT NULL,
    overdue_lock_enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT site_settings_pkey PRIMARY KEY (site_id),
    CONSTRAINT site_settings_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

-- Thêm trigger tự tạo profile từ auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, site_id)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'viewer'),
    COALESCE(new.raw_user_meta_data->>'site_id', 'RG1')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Tài sản / Thiết bị (Assets)
CREATE TABLE IF NOT EXISTS public.assets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asset_code text NOT NULL,
    site_id text,
    created_by uuid,
    equipment_name text,
    equipment_type text,
    equipment_category text,
    description_raw text,
    location text,
    serial_or_model text,
    serial text,
    model text,
    year_made integer,
    manufacturer text,
    working_pressure text,
    capacity_or_rating text,
    is_strict_required boolean DEFAULT false,
    status text NOT NULL DEFAULT 'in_service'::text CHECK (status IN ('in_service', 'out_of_service', 'locked', 'scrapped')),
    last_inspection_date date,
    next_due_date date,
    interval_months integer,
    interval_text text,
    stamp_no text,
    inspection_agency text,
    declared_status text DEFAULT 'not_declared' CHECK (declared_status IN ('declared', 'not_declared', 'not_required')),
    declaration_doc_no text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT assets_pkey PRIMARY KEY (id),
    CONSTRAINT assets_asset_code_key UNIQUE (asset_code),
    CONSTRAINT assets_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id)
);

-- Lịch sử kiểm định (Asset Events)
CREATE TABLE IF NOT EXISTS public.asset_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    created_by uuid,
    event_type text NOT NULL CHECK (event_type IN ('planned', 'periodic', 'after_repair', 'maintenance')),
    status text NOT NULL DEFAULT 'planned'::text CHECK (status IN ('planned', 'done', 'verified')),
    planned_date date,
    performed_date date,
    next_due_date date,
    interval_months integer,
    result text CHECK (result IN ('pass', 'conditional', 'fail', 'unknown')),
    stamp_no text,
    agency text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT asset_events_pkey PRIMARY KEY (id),
    CONSTRAINT asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE
);

-- Tài liệu thiết bị (Asset Documents)
CREATE TABLE IF NOT EXISTS public.asset_documents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL,
    event_id uuid,
    site_id text,
    doc_type text NOT NULL,
    doc_no text,
    title text,
    description text,
    issue_date date,
    expiry_date date,
    file_name text NOT NULL,
    original_file_name text,
    file_path text NOT NULL,
    file_size integer,
    mime_type text,
    uploaded_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT asset_documents_pkey PRIMARY KEY (id),
    CONSTRAINT asset_documents_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
    CONSTRAINT asset_documents_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.asset_events(id) ON DELETE SET NULL,
    CONSTRAINT asset_documents_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id)
);

-- Cài đặt cảnh báo (Alert settings)
CREATE TABLE IF NOT EXISTS public.alert_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    site_id text,
    recipient_email text NOT NULL,
    days_before integer NOT NULL DEFAULT 30,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alert_settings_pkey PRIMARY KEY (id),
    CONSTRAINT alert_settings_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

-- Lịch sử gửi mail cảnh báo (Alert logs)
CREATE TABLE IF NOT EXISTS public.alert_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asset_id uuid,
    due_date date NOT NULL,
    recipient_email text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alert_logs_pkey PRIMARY KEY (id),
    CONSTRAINT alert_logs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE
);

-- KPI Snapshots (dùng cho vẽ biểu đồ trend lịch sử)
CREATE TABLE IF NOT EXISTS public.kpi_snapshots (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    site_id text NOT NULL,
    period_type text NOT NULL CHECK (period_type IN ('month', 'year')),
    period_value text NOT NULL, -- "MM/YYYY"
    total integer,
    ok_count integer,
    due_soon_count integer,
    overdue_count integer,
    declared_count integer,
    not_declared_count integer,
    locked_count integer,
    due_soon_days integer,
    generated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT kpi_snapshots_pkey PRIMARY KEY (id)
);

-- Logs Import (Lưu lại lịch sử import dữ liệu hàng loạt)
CREATE TABLE IF NOT EXISTS public.import_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    site_id text,
    imported_by uuid,
    file_name text NOT NULL,
    total_records integer DEFAULT 0,
    success_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    import_date timestamp with time zone DEFAULT now(),
    CONSTRAINT import_logs_pkey PRIMARY KEY (id),
    CONSTRAINT import_logs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT import_logs_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users(id) ON DELETE SET NULL
);


-- Add Indexes
CREATE INDEX IF NOT EXISTS idx_assets_site_id ON public.assets(site_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_next_due_date ON public.assets(next_due_date);
CREATE INDEX IF NOT EXISTS idx_asset_events_asset_id ON public.asset_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_docs_asset_id ON public.asset_documents(asset_id);

-- Attach updated_at triggers

drop trigger if exists update_profiles_modtime on public.profiles;
create trigger update_profiles_modtime
before update on public.profiles
for each row
execute function public.update_modified_column();

drop trigger if exists update_site_settings_modtime on public.site_settings;
create trigger update_site_settings_modtime
before update on public.site_settings
for each row
execute function public.update_modified_column();

drop trigger if exists update_assets_modtime on public.assets;
create trigger update_assets_modtime
before update on public.assets
for each row
execute function public.update_modified_column();

drop trigger if exists update_asset_events_modtime on public.asset_events;
create trigger update_asset_events_modtime
before update on public.asset_events
for each row
execute function public.update_modified_column();

drop trigger if exists update_asset_documents_modtime on public.asset_documents;
create trigger update_asset_documents_modtime
before update on public.asset_documents
for each row
execute function public.update_modified_column();

-- 4. Helper Functions

CREATE OR REPLACE FUNCTION public.get_user_site() 
RETURNS text 
LANGUAGE sql 
STABLE SECURITY DEFINER 
AS $$
  SELECT site_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role() 
RETURNS text 
LANGUAGE sql 
STABLE SECURITY DEFINER 
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 5. Row Level Security (RLS) Policies

-- Bật RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Sites: ai cũng xem được, chỉ sysadmin (không check trong app này) mới sửa
DROP POLICY IF EXISTS "Cho phép đọc Sites" ON public.sites;
CREATE POLICY "Cho phép đọc Sites" ON public.sites FOR SELECT USING (true);

-- Site settings: đọc theo site_id, admin/hse edit
DROP POLICY IF EXISTS "Read site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Edit site_settings" ON public.site_settings;
CREATE POLICY "Read site_settings" ON public.site_settings FOR SELECT USING (site_id = get_user_site() OR get_user_site() = 'ALL');
CREATE POLICY "Edit site_settings" ON public.site_settings FOR ALL USING ((site_id = get_user_site() OR get_user_site() = 'ALL') AND get_user_role() IN ('admin', 'hse'));

-- Profiles: đọc profile cùng site, user tự sửa profile của mình
DROP POLICY IF EXISTS "Read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin update profiles" ON public.profiles;
CREATE POLICY "Read profiles" ON public.profiles FOR SELECT USING (site_id = get_user_site() OR get_user_site() = 'ALL' OR id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin update profiles" ON public.profiles FOR UPDATE USING (get_user_role() = 'admin');

-- Assets: theo site_id
DROP POLICY IF EXISTS "Read assets in site" ON public.assets;
DROP POLICY IF EXISTS "Insert assets" ON public.assets;
DROP POLICY IF EXISTS "Update assets" ON public.assets;
DROP POLICY IF EXISTS "Delete assets" ON public.assets;
CREATE POLICY "Read assets in site" ON public.assets FOR SELECT USING (site_id = get_user_site() OR get_user_site() = 'ALL');
CREATE POLICY "Insert assets" ON public.assets FOR INSERT WITH CHECK ((site_id = get_user_site() OR get_user_site() = 'ALL') AND get_user_role() IN ('admin', 'hse', 'engineering'));
CREATE POLICY "Update assets" ON public.assets FOR UPDATE USING ((site_id = get_user_site() OR get_user_site() = 'ALL') AND get_user_role() IN ('admin', 'hse', 'engineering'));
CREATE POLICY "Delete assets" ON public.assets FOR DELETE USING ((site_id = get_user_site() OR get_user_site() = 'ALL') AND get_user_role() IN ('admin', 'hse'));

-- Asset Events: theo tài sản
DROP POLICY IF EXISTS "Read events" ON public.asset_events;
DROP POLICY IF EXISTS "Insert events" ON public.asset_events;
DROP POLICY IF EXISTS "Update events" ON public.asset_events;
DROP POLICY IF EXISTS "Delete events" ON public.asset_events;
CREATE POLICY "Read events" ON public.asset_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_events.asset_id AND (a.site_id = get_user_site() OR get_user_site() = 'ALL'))
);
CREATE POLICY "Insert events" ON public.asset_events FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_events.asset_id AND (a.site_id = get_user_site() OR get_user_site() = 'ALL'))
    AND get_user_role() IN ('admin', 'hse', 'engineering')
);
CREATE POLICY "Update events" ON public.asset_events FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_events.asset_id AND (a.site_id = get_user_site() OR get_user_site() = 'ALL'))
    AND get_user_role() IN ('admin', 'hse', 'engineering')
);
CREATE POLICY "Delete events" ON public.asset_events FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_events.asset_id AND (a.site_id = get_user_site() OR get_user_site() = 'ALL'))
    AND get_user_role() IN ('admin', 'hse')
);

-- Asset Documents: theo tài sản / site
DROP POLICY IF EXISTS "Read documents" ON public.asset_documents;
DROP POLICY IF EXISTS "Insert documents" ON public.asset_documents;
DROP POLICY IF EXISTS "Update documents" ON public.asset_documents;
DROP POLICY IF EXISTS "Delete documents" ON public.asset_documents;
CREATE POLICY "Read documents" ON public.asset_documents FOR SELECT USING (site_id = get_user_site() OR get_user_site() = 'ALL');
CREATE POLICY "Insert documents" ON public.asset_documents FOR INSERT WITH CHECK (
    (site_id = get_user_site() OR get_user_site() = 'ALL') AND get_user_role() IN ('admin', 'hse', 'engineering')
);
CREATE POLICY "Update documents" ON public.asset_documents FOR UPDATE USING (
    (site_id = get_user_site() OR get_user_site() = 'ALL') AND get_user_role() IN ('admin', 'hse')
);
CREATE POLICY "Delete documents" ON public.asset_documents FOR DELETE USING (
    (site_id = get_user_site() OR get_user_site() = 'ALL') AND get_user_role() IN ('admin', 'hse')
);

-- Import Logs 
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read import logs" ON public.import_logs;
DROP POLICY IF EXISTS "Insert import logs" ON public.import_logs;
CREATE POLICY "Read import logs" ON public.import_logs FOR SELECT USING (site_id = get_user_site() OR get_user_site() = 'ALL');
CREATE POLICY "Insert import logs" ON public.import_logs FOR INSERT WITH CHECK (
    (site_id = get_user_site() OR get_user_site() = 'ALL') AND get_user_role() IN ('admin', 'hse', 'engineering')
);


-- KPI Snapshots 
DROP POLICY IF EXISTS "Read KPI snapshots" ON public.kpi_snapshots;
CREATE POLICY "Read KPI snapshots" ON public.kpi_snapshots FOR SELECT USING (site_id = get_user_site() OR get_user_site() = 'ALL');


-- 6. Storage Bucket for asset_documents

-- Bật extension Storage (có sẵn trên bảng Supabase mới)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'asset-documents', 
  'asset-documents', 
  false, 
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO UPDATE SET public = false;

-- RLS cho Storage
-- 1. Xem file: Bất kỳ ai login (site filter check cứng hơn qua Signed URL generation trong Backend code)
DROP POLICY IF EXISTS "Authenticated users can read asset documents" ON storage.objects;
CREATE POLICY "Authenticated users can read asset documents" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'asset-documents' AND auth.role() = 'authenticated');

-- 2. Thêm file: Admin, HSE, Engineering
DROP POLICY IF EXISTS "Role based insert asset documents" ON storage.objects;
CREATE POLICY "Role based insert asset documents" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'asset-documents' 
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'hse', 'engineering')
  );

-- 3. Cập nhật/Xoá: Admin, HSE
DROP POLICY IF EXISTS "Role based update asset documents" ON storage.objects;
CREATE POLICY "Role based update asset documents" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'asset-documents' 
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'hse')
  );

DROP POLICY IF EXISTS "Role based delete asset documents" ON storage.objects;
CREATE POLICY "Role based delete asset documents" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'asset-documents' 
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'hse')
  );

-- 7. Seed Data Cơ bản (Tuỳ chọn)
INSERT INTO public.sites (id, name) VALUES ('RG1', 'Nhà máy RG1'), ('ALL', 'Toàn bộ công ty') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.site_settings (site_id, due_soon_days, overdue_lock_enabled) VALUES ('RG1', 30, true) ON CONFLICT (site_id) DO NOTHING;
