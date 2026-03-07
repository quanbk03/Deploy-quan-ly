-- WARNING: Chạy đoạn mã này sẽ XÓA TOÀN BỘ dữ liệu cũ của các bảng này để làm lại từ đầu.
-- Chỉ chạy trên môi trường Development/Testing hoặc khi bạn chưa có dữ liệu quan trọng.

-- 1. DROP ALL EXISTING TABLES to start fresh (Reverse dependency order)
DROP TABLE IF EXISTS public.alert_logs CASCADE;
DROP TABLE IF EXISTS public.alert_settings CASCADE;
DROP TABLE IF EXISTS public.asset_documents CASCADE;
DROP TABLE IF EXISTS public.asset_events CASCADE;
DROP TABLE IF EXISTS public.reference_docs CASCADE;
DROP TABLE IF EXISTS public.kpi_snapshots CASCADE;
DROP TABLE IF EXISTS public.site_settings CASCADE;
DROP TABLE IF EXISTS public.profile_sites CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.equipment_categories CASCADE;
DROP TABLE IF EXISTS public.sites CASCADE;


-- 2. CREATE TABLES (In order of dependencies)

-- Bảng gốc tột cùng (Không phụ thuộc ai)
CREATE TABLE public.sites (
  id text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sites_pkey PRIMARY KEY (id)
);

CREATE TABLE public.equipment_categories (
  id text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  code text UNIQUE,
  label_short text NOT NULL DEFAULT ''::text,
  label_full text NOT NULL DEFAULT ''::text,
  aliases text[] DEFAULT '{}'::text[],
  CONSTRAINT equipment_categories_pkey PRIMARY KEY (id)
);

-- Bảng profiles (Phụ thuộc vào user Auth của Supabase)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'viewer'::text CHECK (role = ANY (ARRAY['admin'::text, 'hse'::text, 'engineering'::text, 'viewer'::text])),
  site_id text NOT NULL DEFAULT 'RG1'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Các bảng phụ thuộc Cấp 1
CREATE TABLE public.site_settings (
  site_id text NOT NULL,
  due_soon_days integer NOT NULL DEFAULT 30,
  overdue_lock_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT site_settings_pkey PRIMARY KEY (site_id),
  CONSTRAINT site_settings_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

CREATE TABLE public.profile_sites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  site_id text,
  is_default boolean DEFAULT false,
  CONSTRAINT profile_sites_pkey PRIMARY KEY (id),
  CONSTRAINT profile_sites_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT profile_sites_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

CREATE TABLE public.kpi_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  period_type text NOT NULL CHECK (period_type = ANY (ARRAY['month'::text, 'year'::text])),
  period_value text NOT NULL,
  total integer NOT NULL,
  ok_count integer NOT NULL,
  due_soon_count integer NOT NULL,
  overdue_count integer NOT NULL,
  declared_count integer NOT NULL,
  not_declared_count integer NOT NULL,
  locked_count integer NOT NULL,
  due_soon_days integer NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kpi_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT kpi_snapshots_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE
);

CREATE TABLE public.reference_docs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'legal'::text,
  summary text,
  link_url text,
  file_path text,
  site_id text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  file_name text,
  file_size bigint,
  mime_type text,
  CONSTRAINT reference_docs_pkey PRIMARY KEY (id),
  CONSTRAINT reference_docs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.alert_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id text DEFAULT 'RG1'::text,
  recipient_email text NOT NULL,
  days_before integer NOT NULL DEFAULT 15,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_settings_pkey PRIMARY KEY (id)
  -- Không khai báo FK rõ ràng cho site_id theo schema mà bạn yêu cầu
);

-- Các bảng phụ thuộc Cấp 2 (Nghiệp vụ cốt lõi)
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_code text NOT NULL UNIQUE,
  equipment_type text NOT NULL,
  location text,
  model text,
  serial text,
  year_made integer,
  manufacturer text,
  working_pressure text,
  capacity_or_rating text,
  is_strict_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'in_service'::text CHECK (status = ANY (ARRAY['in_service'::text, 'out_of_service'::text, 'locked'::text, 'scrapped'::text])),
  last_inspection_date date,
  next_due_date date,
  interval_months integer DEFAULT 12,
  inspection_agency text,
  created_by uuid,
  site_id text NOT NULL DEFAULT 'RG1'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  description_raw text,
  equipment_category text,
  equipment_name text,
  serial_or_model text,
  interval_text text,
  stamp_no text,
  declared_status text,
  declaration_doc_no text,
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_assets_equipment_category FOREIGN KEY (equipment_category) REFERENCES public.equipment_categories(id) ON DELETE SET NULL
);

-- Các bảng phụ thuộc Cấp 3 (Con của phần Cốt lõi)
CREATE TABLE public.asset_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'periodic'::text CHECK (event_type = ANY (ARRAY['planned'::text, 'periodic'::text, 'after_repair'::text, 'maintenance'::text])),
  interval_months integer DEFAULT 12,
  planned_date date,
  performed_date date,
  result text DEFAULT 'unknown'::text CHECK (result = ANY (ARRAY['pass'::text, 'conditional'::text, 'fail'::text, 'unknown'::text])),
  stamp_no text,
  agency text,
  notes text,
  next_due_date date,
  status text NOT NULL DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'done'::text, 'verified'::text])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asset_events_pkey PRIMARY KEY (id),
  CONSTRAINT asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT asset_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.alert_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid,
  due_date date NOT NULL,
  recipient_email text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_logs_pkey PRIMARY KEY (id),
  CONSTRAINT alert_logs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE
);

-- Các bảng phụ thuộc Cấp 4
CREATE TABLE public.asset_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  event_id uuid,
  doc_type text NOT NULL DEFAULT 'certificate'::text CHECK (doc_type = ANY (ARRAY['certificate'::text, 'report'::text, 'checklist'::text, 'invoice'::text, 'declaration_letter'::text, 'legal_confirmation'::text])),
  doc_no text,
  issue_date date,
  expiry_date date,
  file_path text,
  file_name text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  mime_type text,
  site_id text,
  CONSTRAINT asset_documents_pkey PRIMARY KEY (id),
  CONSTRAINT asset_documents_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT asset_documents_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.asset_events(id) ON DELETE CASCADE,
  CONSTRAINT asset_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);
