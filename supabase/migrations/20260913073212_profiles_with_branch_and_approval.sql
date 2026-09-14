-- Users of the IAP dashboard. One row per auth.users row, created by trigger.
-- Branch access lives here; the tracker data itself stays in Google Sheets.

create type public.user_role as enum ('admin', 'user');
create type public.user_status as enum ('pending', 'active', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  -- 'PUSAT' sees every branch; anything else is an IATA station code.
  branch_code text not null,
  role public.user_role not null default 'user',
  status public.user_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Read through a security definer so the admin policies below can consult profiles
-- without the policy re-entering itself.
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "admin reads every profile"
  on public.profiles for select
  using (public.is_admin());

create policy "admin updates every profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin deletes profiles"
  on public.profiles for delete
  using (public.is_admin());

-- Registration fills the profile from the sign-up metadata. Role and status are
-- NOT taken from metadata: a new account is always a pending, non-admin user,
-- so nobody can register themselves straight into admin.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, branch_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'branch_code', ''), 'PUSAT')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Removing an account means removing the auth.users row; the profile cascades.
-- Exposed as an RPC so the app never needs the service role key.
create function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;
  if target = auth.uid() then
    raise exception 'tidak bisa menghapus akun sendiri';
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
