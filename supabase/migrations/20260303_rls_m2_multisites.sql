-- Migration cho Prompt M2: RLS Multi-site theo `profile_sites`

-- =========================================================================
-- 1) Helper functions
-- =========================================================================

-- Lấy role của user
create or replace function public.get_user_role()
returns text
language sql stable security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Lấy site_id mặc định của user 
-- (nếu auth.uid() chưa có record profile_sites nào, ta sẽ dùng site_id này)
create or replace function public.get_user_default_site()
returns uuid
language sql stable security definer
as $$
  select site_id from public.profiles where id = auth.uid();
$$;

-- Kiểm tra user có quyền truy cập vào site cụ thể không
create or replace function public.user_has_site(check_site_id uuid)
returns boolean
language sql stable security definer
as $$
  select extract(epoch from now()) > 0 and (
    -- TH1: Tồn tại record trong profile_sites
    exists (
      select 1 from public.profile_sites
      where profile_id = auth.uid() and site_id = check_site_id
    )
    or
    -- TH2: Fallback (nếu user này CHƯA có bất kỳ record nào trong profile_sites)
    (
      not exists (
        select 1 from public.profile_sites where profile_id = auth.uid()
      )
      and 
      check_site_id = public.get_user_default_site()
    )
  );
$$;


-- =========================================================================
-- 2) RLS Hệ Thống (sites, profile_sites, profiles)
-- =========================================================================

-- Bảng sites
alter table public.sites enable row level security;
drop policy if exists "Everyone can select sites" on public.sites;
create policy "Everyone can select sites"
  on public.sites for select
  using ( auth.role() = 'authenticated' );

-- Bảng profile_sites
alter table public.profile_sites enable row level security;
drop policy if exists "Users can select their own profile_sites" on public.profile_sites;
create policy "Users can select their own profile_sites"
  on public.profile_sites for select
  using ( 
    profile_id = auth.uid() 
    or public.get_user_role() in ('admin', 'hse') 
  );

drop policy if exists "Only admin and hse can insert profile_sites" on public.profile_sites;
create policy "Only admin and hse can insert profile_sites"
  on public.profile_sites for insert
  with check ( public.get_user_role() in ('admin', 'hse') );

drop policy if exists "Only admin and hse can update profile_sites" on public.profile_sites;
create policy "Only admin and hse can update profile_sites"
  on public.profile_sites for update
  using ( public.get_user_role() in ('admin', 'hse') );

drop policy if exists "Only admin and hse can delete profile_sites" on public.profile_sites;
create policy "Only admin and hse can delete profile_sites"
  on public.profile_sites for delete
  using ( public.get_user_role() in ('admin', 'hse') );


-- Bảng profiles
alter table public.profiles enable row level security;
drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile"
  on public.profiles for select
  using ( 
    id = auth.uid() 
    or public.get_user_role() in ('admin', 'hse') 
  );


-- =========================================================================
-- 3) Bảng assets
-- =========================================================================

alter table public.assets enable row level security;

-- Xóa các policy cũ của M1
drop policy if exists "Users can view assets in their site" on public.assets;
drop policy if exists "Admins and HSE can insert assets" on public.assets;
drop policy if exists "Admins and HSE can update assets" on public.assets;
drop policy if exists "Admins and HSE can delete assets" on public.assets;
drop policy if exists "Engineering can insert assets" on public.assets;
drop policy if exists "Engineering can update non-status fields of assets" on public.assets;

-- SELECT: Dựa vào user_has_site
create policy "Users can view matched site assets"
  on public.assets for select
  using ( public.user_has_site(site_id) );

-- INSERT
create policy "Admins HSE and Engineering can insert assets"
  on public.assets for insert
  with check (
    public.user_has_site(site_id) 
    and public.get_user_role() in ('admin', 'hse', 'engineering')
  );

-- UPDATE
create policy "Admins and HSE can update assets"
  on public.assets for update
  using (
    public.user_has_site(site_id) 
    and public.get_user_role() in ('admin', 'hse')
  );

create policy "Engineering can update assets except locking"
  on public.assets for update
  using (
    public.user_has_site(site_id) 
    and public.get_user_role() = 'engineering'
  )
  with check (
    status not in ('locked', 'scrapped')
  );

-- DELETE
create policy "Admins and HSE can delete assets"
  on public.assets for delete
  using (
    public.user_has_site(site_id) 
    and public.get_user_role() in ('admin', 'hse')
  );


-- =========================================================================
-- 4) Bảng asset_events & asset_documents
-- =========================================================================

-- ASSET_EVENTS
alter table public.asset_events enable row level security;

drop policy if exists "Users can view events for assets in their site" on public.asset_events;
drop policy if exists "Admins, HSE, and Engineering can insert events" on public.asset_events;
drop policy if exists "Admins, HSE, and Engineering can update events" on public.asset_events;
drop policy if exists "Admins and HSE can delete events" on public.asset_events;

create policy "Users can view mapped site events"
  on public.asset_events for select
  using (
    exists (
      select 1 from public.assets
      where id = asset_events.asset_id
      and public.user_has_site(site_id)
    )
  );

create policy "Admins, HSE, and Eng can insert events"
  on public.asset_events for insert
  with check (
    public.get_user_role() in ('admin', 'hse', 'engineering')
    and exists (
      select 1 from public.assets
      where id = asset_events.asset_id
      and public.user_has_site(site_id)
    )
  );

create policy "Admins, HSE, and Eng can update events"
  on public.asset_events for update
  using (
    public.get_user_role() in ('admin', 'hse', 'engineering')
    and exists (
      select 1 from public.assets
      where id = asset_events.asset_id
      and public.user_has_site(site_id)
    )
  );

create policy "Admins and HSE can delete events"
  on public.asset_events for delete
  using (
    public.get_user_role() in ('admin', 'hse')
    and exists (
      select 1 from public.assets
      where id = asset_events.asset_id
      and public.user_has_site(site_id)
    )
  );

-- ASSET_DOCUMENTS
alter table public.asset_documents enable row level security;

drop policy if exists "Users can view documents for assets in their site" on public.asset_documents;
drop policy if exists "Admins and HSE can insert documents" on public.asset_documents;
drop policy if exists "Admins and HSE can update documents" on public.asset_documents;
drop policy if exists "Admins and HSE can delete documents" on public.asset_documents;

create policy "Users can view mapped site documents"
  on public.asset_documents for select
  using (
    exists (
      select 1 from public.assets
      where id = asset_documents.asset_id
      and public.user_has_site(site_id)
    )
  );

create policy "Admins and HSE can insert documents"
  on public.asset_documents for insert
  with check (
    public.get_user_role() in ('admin', 'hse')
    and exists (
      select 1 from public.assets
      where id = asset_documents.asset_id
      and public.user_has_site(site_id)
    )
  );

create policy "Admins and HSE can update documents"
  on public.asset_documents for update
  using (
    public.get_user_role() in ('admin', 'hse')
    and exists (
      select 1 from public.assets
      where id = asset_documents.asset_id
      and public.user_has_site(site_id)
    )
  );

create policy "Admins and HSE can delete documents"
  on public.asset_documents for delete
  using (
    public.get_user_role() in ('admin', 'hse')
    and exists (
      select 1 from public.assets
      where id = asset_documents.asset_id
      and public.user_has_site(site_id)
    )
  );
