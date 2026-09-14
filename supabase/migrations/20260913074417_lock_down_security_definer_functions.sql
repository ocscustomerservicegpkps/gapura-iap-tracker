-- `handle_new_user` only ever runs from the trigger on auth.users; nobody should be
-- able to reach it through /rest/v1/rpc.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- `is_admin` stays executable by `authenticated` on purpose: the policies on
-- `profiles` call it, and a policy expression runs with the querying role's rights,
-- so revoking it there would break every admin read. Signed-out callers have no
-- reason to ask.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
