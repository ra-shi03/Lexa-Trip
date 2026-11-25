import { escapeRegex } from './helpers.js';

/**
 * Builds a paginated Mongo query from ?page&limit&q&sort&<field>=<value>
 * - searchFields: fields matched by ?q (case-insensitive regex)
 * - filterFields: whitelisted equality filters taken from the query string
 */
export function buildListQuery(query, { searchFields = [], filterFields = [], baseFilter = {} } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 20));
  const filter = { ...baseFilter };

  if (query.q && searchFields.length) {
    const rx = new RegExp(escapeRegex(String(query.q).trim()), 'i');
    filter.$or = searchFields.map((f) => ({ [f]: rx }));
  }
  for (const f of filterFields) {
    const v = query[f];
    if (v === undefined || v === '') continue;
    filter[f] = v === 'true' ? true : v === 'false' ? false : v;
  }

  let sort = { createdAt: -1 };
  if (query.sort) {
    const s = String(query.sort);
    sort = { [s.replace(/^-/, '')]: s.startsWith('-') ? -1 : 1 };
  }
  return { filter, page, limit, skip: (page - 1) * limit, sort };
}

export const pageMeta = (total, page, limit) => ({ total, page, limit, pages: Math.ceil(total / limit) || 1 });
