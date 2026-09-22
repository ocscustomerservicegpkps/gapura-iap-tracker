-- Resolves the database linter's security and performance findings.
--
-- 1. `is_admin()` moves out of the API schema. As `public.is_admin` it was reachable
--    as /rest/v1/rpc/is_admin, and `anon` needed EXECUTE only because the profile
--    policies applied to every role. Policies are now scoped to `authenticated`, so an
--    anonymous read simply matches no policy and `anon` needs nothing.
-- 2. The two permissive SELECT policies become one, and `auth.uid()` / `is_admin()`
--    are wrapped in a sub-select so they are evaluated once per query, not per row.
-- 3. `admin_delete_user()` is replaced by an admin-only DELETE policy on `profiles`
--    plus a trigger that removes the login. There is no longer a SECURITY DEFINER
--    function a signed-in user can call directly.
-- 4. The IAP tables are server-only; that is now an explicit policy rather than the
--    absence of one.
-- 5. The conflict log is tiny and read whole; its created_at index was never used.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

drop policy "read own profile" on public.profiles;
drop policy "admin reads every profile" on public.profiles;
drop policy "admin updates every profile" on public.profiles;
drop policy "admin deletes profiles" on public.profiles;

create policy "read own profile or admin reads all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "admin updates every profile" on public.profiles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- An admin cannot delete their own account, as before.
create policy "admin deletes other profiles" on public.profiles
  for delete to authenticated
  using ((select private.is_admin()) and id <> (select auth.uid()));

-- Deleting a profile deletes the login too, so the address can register again.
-- When the delete starts from auth.users instead, the cascade reaches here after the
-- user row is already gone and this deletes nothing.
create function private.delete_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = old.id;
  return old;
end;
$$;
revoke all on function private.delete_auth_user() from public, anon, authenticated;

create trigger profiles_delete_auth_user
  after delete on public.profiles
  for each row execute function private.delete_auth_user();

drop function public.admin_delete_user(uuid);
drop function public.is_admin();

create policy "server only" on public.iap_tracker
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "server only" on public.iap_sync_state
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "server only" on public.iap_sync_conflicts
  as restrictive for all to anon, authenticated using (false) with check (false);

drop index if exists public.iap_sync_conflicts_created_idx;
