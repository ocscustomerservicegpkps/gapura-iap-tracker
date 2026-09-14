-- `is_admin()` has to be executable by every role that can reach a policy naming it.
-- A policy expression runs with the querying role's privileges, so revoking this from
-- `anon` did not hide anything: it turned an anonymous read of `profiles` — which
-- returns no rows anyway — into "permission denied for function is_admin".
--
-- The function takes no arguments and answers only "is the caller an admin", which is
-- a constant false for anyone not signed in, so exposing it discloses nothing. The
-- linter's warning about publicly callable SECURITY DEFINER functions is accepted here
-- for that reason.
grant execute on function public.is_admin() to anon, authenticated;
