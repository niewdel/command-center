/**
 * Minimal in-memory stand-in for the Supabase query builder, just enough to
 * exercise the pipeline API routes in tests (select/insert/update/delete +
 * eq/order/single/maybeSingle, thenable like the real client). Not a general
 * Supabase mock — extend as new query shapes show up.
 */
type Row = Record<string, unknown>;

export function createFakeSupabase(initial: Record<string, Row[]> = {}) {
  const store: Record<string, Row[]> = {};
  for (const [table, rows] of Object.entries(initial)) {
    store[table] = rows.map((r) => ({ ...r }));
  }

  function ensure(table: string): Row[] {
    if (!store[table]) store[table] = [];
    return store[table];
  }

  let idCounter = 0;

  const client = {
    from(table: string) {
      let op: "select" | "insert" | "update" | "delete" = "select";
      let payload: unknown = null;
      const filters: [string, unknown][] = [];
      let orderCol: string | null = null;
      let orderAsc = true;
      let wantSingle = false;
      let wantMaybeSingle = false;

      const matches = (r: Row) => filters.every(([c, v]) => r[c] === v);

      type QueryResult = { data: unknown; error: { message: string } | null };

      const builder: {
        select: () => typeof builder;
        insert: (p: unknown) => typeof builder;
        update: (p: unknown) => typeof builder;
        delete: () => typeof builder;
        eq: (col: string, val: unknown) => typeof builder;
        order: (col: string, opts?: { ascending?: boolean }) => typeof builder;
        maybeSingle: () => typeof builder;
        single: () => typeof builder;
        then: <TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) => Promise<TResult1 | TResult2>;
      } = {
        select() {
          return builder;
        },
        insert(p: unknown) {
          op = "insert";
          payload = p;
          return builder;
        },
        update(p: unknown) {
          op = "update";
          payload = p;
          return builder;
        },
        delete() {
          op = "delete";
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push([col, val]);
          return builder;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          orderCol = col;
          orderAsc = opts?.ascending !== false;
          return builder;
        },
        maybeSingle() {
          wantMaybeSingle = true;
          return builder;
        },
        single() {
          wantSingle = true;
          return builder;
        },
        then(onfulfilled, onrejected) {
          const run = (): QueryResult => {
            const rows = ensure(table);
            let result: Row[] = [];
            const error: { message: string } | null = null;

            if (op === "select") {
              result = rows.filter(matches);
              if (orderCol) {
                const col = orderCol;
                result = [...result].sort((a, b) => {
                  const av = a[col] as string | number;
                  const bv = b[col] as string | number;
                  if (av < bv) return orderAsc ? -1 : 1;
                  if (av > bv) return orderAsc ? 1 : -1;
                  return 0;
                });
              }
            } else if (op === "insert") {
              const arr = (Array.isArray(payload) ? payload : [payload]) as Row[];
              const inserted = arr.map((p) => ({
                id: `fake-${idCounter++}`,
                created_at: new Date().toISOString(),
                ...p,
              }));
              rows.push(...inserted);
              result = inserted;
            } else if (op === "update") {
              const filtered = rows.filter(matches);
              filtered.forEach((r) => Object.assign(r, payload as Row));
              result = filtered;
            } else if (op === "delete") {
              const remaining = rows.filter((r) => !matches(r));
              store[table] = remaining;
              result = [];
            }

            let data: unknown = result;
            if (wantSingle || wantMaybeSingle) {
              data = result[0] ?? null;
            }

            return { data, error };
          };

          return Promise.resolve().then(() => {
            const value = run();
            return onfulfilled ? onfulfilled(value) : (value as never);
          }, onrejected ?? undefined);
        },
      };
      return builder;
    },
  };

  return { client, store };
}
