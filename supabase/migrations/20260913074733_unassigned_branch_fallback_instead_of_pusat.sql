-- A sign-up that arrives without a branch used to fall back to 'PUSAT', which is the
-- one value that sees every station — the most privileged possible default for the
-- least informative input. It now falls back to a code that matches no station at
-- all, so such an account sees nothing until an admin assigns it a real branch.
create or replace function public.handle_new_user()
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
    coalesce(nullif(new.raw_user_meta_data ->> 'branch_code', ''), 'UNASSIGNED')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
