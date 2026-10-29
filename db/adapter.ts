export type DatabaseRow = Record<string, unknown>;
export type QueryResult = { rows: DatabaseRow[]; rowCount?: number | null };
export type QueryExecutor = { query(sql: string, values?: unknown[]): Promise<QueryResult> };
export type DatabaseConnection = QueryExecutor & { release(): void };

/** Translate placeholders without modifying strings, comments or quoted identifiers. */
export function postgresPlaceholders(sql: string): { text: string; count: number } {
  let text = "", count = 0, i = 0;
  while (i < sql.length) {
    const c = sql[i], next = sql[i + 1];
    if (c === "'" || c === '"') {
      const quote = c;
      const escaped = quote === "'" && /[eE]/.test(sql[i - 1] ?? "") && (i < 2 || !/[\w$]/.test(sql[i - 2]));
      text += c; i++;
      while (i < sql.length) {
        const item = sql[i++]; text += item;
        if (escaped && item === "\\" && i < sql.length) { text += sql[i++]; continue; }
        if (item === quote) {
          if (sql[i] === quote) { text += sql[i++]; continue; }
          break;
        }
      }
      continue;
    }
    if (c === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      if (end < 0) { text += sql.slice(i); break; }
      text += sql.slice(i, end + 1); i = end + 1; continue;
    }
    if (c === "/" && next === "*") {
      let depth = 1; text += "/*"; i += 2;
      while (i < sql.length && depth) {
        const pair = sql.slice(i, i + 2);
        if (pair === "/*") { depth++; text += pair; i += 2; }
        else if (pair === "*/") { depth--; text += pair; i += 2; }
        else text += sql[i++];
      }
      continue;
    }
    if (c === "$") {
      const tag = sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0];
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length);
        if (end < 0) { text += sql.slice(i); break; }
        text += sql.slice(i, end + tag.length); i = end + tag.length; continue;
      }
    }
    if (c === "?") { text += `$${++count}`; i++; }
    else { text += c; i++; }
  }
  return { text, count };
}

class Statement {
  private executor: QueryExecutor;
  private sql: string;
  private values: unknown[];
  constructor(executor: QueryExecutor, sql: string, values: unknown[] = []) { this.executor = executor; this.sql = sql; this.values = values; }
  bind(...values: unknown[]) { return new Statement(this.executor, this.sql, values); }
  private async execute() {
    const query = postgresPlaceholders(this.sql);
    if (query.count !== this.values.length) throw new Error("Database parameter count does not match the query.");
    return this.executor.query(query.text, this.values);
  }
  async first<T = DatabaseRow>(): Promise<T | null> { return ((await this.execute()).rows[0] as T | undefined) ?? null; }
  async all<T = DatabaseRow>(): Promise<{ results: T[] }> { return { results: (await this.execute()).rows as T[] }; }
  async run() { const result = await this.execute(); const changes = result.rowCount ?? 0; return { success: true, changes, meta: { changes } }; }
}

export class Database {
  private executor: QueryExecutor;
  private acquire?: () => Promise<DatabaseConnection>;
  constructor(executor: QueryExecutor, acquire?: () => Promise<DatabaseConnection>) { this.executor = executor; this.acquire = acquire; }
  prepare(sql: string) { return new Statement(this.executor, sql); }

  /** Serializes availability-changing work for a listing across all Render instances. */
  async withListingLock<T>(listingId: string, work: (database: Database) => Promise<T>): Promise<T> {
    if (!this.acquire) throw new Error("A listing transaction requires a database connection pool.");
    const client = await this.acquire();
    let started = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED"); started = true;
      await client.query("SET LOCAL search_path TO parksarthi, public");
      // The subsequent SQL gets a fresh snapshot after any concurrent writer finishes.
      await client.query("SELECT id FROM parksarthi.listings WHERE id = $1 FOR UPDATE", [listingId]);
      const result = await work(new Database(client));
      await client.query("COMMIT"); started = false;
      return result;
    } catch (error) {
      if (started) { try { await client.query("ROLLBACK"); } catch { /* preserve the original failure */ } }
      throw error;
    } finally { client.release(); }
  }
}
