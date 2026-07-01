// Decision logic for the middleware login gate. Pure so it can be unit
// tested; the middleware supplies the inputs. FAIL CLOSED: any membership
// query error counts as "not provisioned".
export function isLoginAllowed(opts: {
  emailAllowed: boolean;
  membershipRows: { workspace_id: string }[] | null;
  queryError: { message: string } | null;
}): boolean {
  if (opts.emailAllowed) return true;
  if (opts.queryError) return false;
  return (opts.membershipRows?.length ?? 0) > 0;
}
