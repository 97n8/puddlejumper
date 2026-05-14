// spark.utils.paginate

export interface PageOptions {
  page?: number;
  pageSize?: number;
}

export function createSparkPaginate() {
  return {
    slice<T>(items: T[], opts: PageOptions = {}): { items: T[]; total: number; page: number; pageSize: number; hasMore: boolean } {
      const page = Math.max(1, opts.page ?? 1);
      const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
      const start = (page - 1) * pageSize;
      const sliced = items.slice(start, start + pageSize);
      return { items: sliced, total: items.length, page, pageSize, hasMore: start + pageSize < items.length };
    },
    cursor<T>(items: T[], cursor: string | null, pageSize = 50): { items: T[]; nextCursor: string | null } {
      const start = cursor ? parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10) : 0;
      const sliced = items.slice(start, start + pageSize);
      const nextStart = start + pageSize;
      const nextCursor = nextStart < items.length
        ? Buffer.from(String(nextStart), 'utf8').toString('base64')
        : null;
      return { items: sliced, nextCursor };
    },
  };
}
