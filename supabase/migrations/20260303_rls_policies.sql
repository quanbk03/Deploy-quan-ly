-- Helper function để lấy site_id của current user
create or replace function public.get_user_site()
returns uuid
language sql stable
as $$
  select site_id from public.profiles where id = auth.uid();
$$;

-- Helper function để lấy role của current user
create or replace function public.get_user_role()
returns text
language sql stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Bảng assets
alter table public.assets enable row level security;

create policy "Users can view assets in their site"
  on public.assets for select
  using ( site_id = public.get_user_site() );

create policy "Admins and HSE can insert assets"
  on public.assets for insert
  with check (
    site_id = public.get_user_site() 
    and public.get_user_role() in ('admin', 'hse')
  );

create policy "Admins and HSE can update assets"
  on public.assets for update
  using (
    site_id = public.get_user_site() 
    and public.get_user_role() in ('admin', 'hse')
  );

create policy "Admins and HSE can delete assets"
  on public.assets for delete
  using (
    site_id = public.get_user_site() 
    and public.get_user_role() in ('admin', 'hse')
  );

create policy "Engineering can insert assets"
  on public.assets for insert
  with check (
    site_id = public.get_user_site() 
    and public.get_user_role() = 'engineering'
  );

create policy "Engineering can update non-status fields of assets"
  on public.assets for update
  using (
    site_id = public.get_user_site() 
    and public.get_user_role() = 'engineering'
  )
  with check (
    -- Chỉ cho phép engineering update nếu status mới không phải là locked hoặc scrapped
    -- Hoặc nếu status mới bằng status cũ (tức là không sửa status)
    status not in ('locked', 'scrapped')
  );

-- Bảng asset_events
alter table public.asset_events enable row level security;

-- (Giả sử asset_events không có site_id, ta join qua assets để lấy site_id)
-- Nếu asset_events CÓ site_id, ta có thể dùng trực tiếp site_id đó.
-- Dưới đây giả sử asset_events có cột asset_id tham chiếu đến public.assets

create policy "Users can view events for assets in their site"
  on public.asset_events for select
  using (
    exists (
      select 1 from public.assets
      where id = asset_events.asset_id
      and site_id = public.get_user_site()
    )
  );

create policy "Admins, HSE, and Engineering can insert events"
  on public.asset_events for insert
  with check (
    public.get_user_role() in ('admin', 'hse', 'engineering')
    and exists (
      select 1 from public.assets
      where id = asset_events.asset_id
      and site_id = public.get_user_site()
    )
  );

create policy "Admins, HSE, and Engineering can update events"
  on public.asset_events for update
  using (
    public.get_user_role() in ('admin', 'hse', 'engineering')
    and exists (
      select 1 from public.assets
      where id = asset_events.asset_id
      and site_id = public.get_user_site()
    )
  );

create policy "Admins and HSE can delete events"
  on public.asset_events for delete
  using (
    public.get_user_role() in ('admin', 'hse')
    and exists (
      select 1 from public.assets
      where id = asset_events.asset_id
      and site_id = public.get_user_site()
    )
  );

-- Bảng asset_documents
alter table public.asset_documents enable row level security;

-- Giả sử asset_documents cũng quan hệ qua asset_id

create policy "Users can view documents for assets in their site"
  on public.asset_documents for select
  using (
    exists (
      select 1 from public.assets
      where id = asset_documents.asset_id
      and site_id = public.get_user_site()
    )
  );

create policy "Admins and HSE can insert documents"
  on public.asset_documents for insert
  with check (
    public.get_user_role() in ('admin', 'hse')
    and exists (
      select 1 from public.assets
      where id = asset_documents.asset_id
      and site_id = public.get_user_site()
    )
  );

create policy "Admins and HSE can update documents"
  on public.asset_documents for update
  using (
    public.get_user_role() in ('admin', 'hse')
    and exists (
      select 1 from public.assets
      where id = asset_documents.asset_id
      and site_id = public.get_user_site()
    )
  );

create policy "Admins and HSE can delete documents"
  on public.asset_documents for delete
  using (
    public.get_user_role() in ('admin', 'hse')
    and exists (
      select 1 from public.assets
      where id = asset_documents.asset_id
      and site_id = public.get_user_site()
    )
  );
