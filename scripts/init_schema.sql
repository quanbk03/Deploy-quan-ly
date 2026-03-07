-- 1. Create equipment_categories table first (referenced by assets)
CREATE TABLE IF NOT EXISTS public.equipment_categories (
  id text NOT NULL,
  code text,
  label_short text,
  label_full text,
  sort_order integer,
  CONSTRAINT equipment_categories_pkey PRIMARY KEY (id),
  CONSTRAINT equipment_categories_code_key UNIQUE (code)
);

-- 2. Create assets table (core table)
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_code text NOT NULL,
  site_id text,
  created_by uuid,
  equipment_category text,
  equipment_name text,
  equipment_type text,
  status text NOT NULL DEFAULT 'in_service'::text,
  is_strict_required boolean DEFAULT false,
  last_inspection_date date,
  next_due_date date,
  interval_months integer,
  inspection_agency text,
  model text,
  location text,
  description_raw text,
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_asset_code_key UNIQUE (asset_code),
  CONSTRAINT assets_equipment_category_fkey FOREIGN KEY (equipment_category) REFERENCES public.equipment_categories(id)
);

-- 3. Create asset_events table (depends on assets)
CREATE TABLE IF NOT EXISTS public.asset_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  created_by uuid,
  event_type text NOT NULL,
  planned_date date,
  performed_date date,
  next_due_date date,
  status text NOT NULL DEFAULT 'planned'::text,
  result text,
  scheduled_date date,
  completed_date date,
  interval_months integer,
  notes text,
  agency text,
  CONSTRAINT asset_events_pkey PRIMARY KEY (id),
  CONSTRAINT asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);

-- 4. Create asset_documents table (depends on both assets and events)
CREATE TABLE IF NOT EXISTS public.asset_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  event_id uuid,
  uploaded_by uuid,
  doc_type text NOT NULL,
  doc_no text,
  issue_date date,
  expiry_date date,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  site_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT asset_documents_pkey PRIMARY KEY (id),
  CONSTRAINT asset_documents_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT asset_documents_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.asset_events(id) ON DELETE SET NULL
);

-- 5. Create alert_settings table
CREATE TABLE IF NOT EXISTS public.alert_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id text,
  recipient_email text NOT NULL,
  days_before integer NOT NULL DEFAULT 15,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_settings_pkey PRIMARY KEY (id)
);

-- 6. Create alert_logs table
CREATE TABLE IF NOT EXISTS public.alert_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid,
  due_date date NOT NULL,
  recipient_email text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_logs_pkey PRIMARY KEY (id),
  CONSTRAINT alert_logs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);

-- Note: We assume auth.users and public.profiles already exist based on previous interactions, 
-- or they are created via Supabase Auth standard flows.

-- Chèn dữ liệu danh mục mẫu để không bị lỗi khóa ngoại khi nhập thiết bị
INSERT INTO public.equipment_categories (id, code, label_short, label_full, sort_order)
VALUES 
('cat_chiuap', 'CA', 'Chịu áp', 'Thiết bị chịu áp lực', 1),
('cat_nangha', 'NH', 'Nâng hạ', 'Thiết bị nâng hạ', 2)
ON CONFLICT (code) DO NOTHING;

-- BÂY GIỜ BẠN CÓ THỂ CHẠY LẠI CÁC CÂU LỆNH INSERT DỮ LIỆU TỪ FILE `seed.sql` TRƯỚC ĐÓ.
