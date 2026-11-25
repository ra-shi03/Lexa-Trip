import { ApiError } from './ApiError.js';
import { ok, created } from './response.js';
import { buildListQuery, pageMeta } from './queryBuilder.js';
import { slugify } from './helpers.js';

/**
 * Generic CRUD controller used by simple master-data resources
 * (categories, amenities, coupons, banners, pages, FAQs …).
 * Keeps controllers thin and consistent across the admin panel.
 */
export function crudFactory(Model, opts = {}) {
  const {
    searchFields = ['name'],
    filterFields = [],
    populate = '',
    slugFrom, // auto-generate `slug` from this field if slug missing
    defaultSort,
  } = opts;

  const clean = (body) => { for (const k of ['_id', '__v', 'createdAt', 'updatedAt', 'usedCount']) delete body[k]; return body; };
  const withSlug = (body) => {
    clean(body);
    if (slugFrom && body[slugFrom] && !body.slug) body.slug = slugify(body[slugFrom]);
    if (body.slug) body.slug = slugify(body.slug);
    return body;
  };

  return {
    list: async (req, res) => {
      const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields, filterFields });
      const [items, total] = await Promise.all([
        Model.find(filter).sort(req.query.sort ? sort : defaultSort || sort).skip(skip).limit(limit).populate(populate).lean(),
        Model.countDocuments(filter),
      ]);
      ok(res, items, pageMeta(total, page, limit));
    },
    get: async (req, res) => {
      const item = await Model.findById(req.params.id).populate(populate).lean();
      if (!item) throw ApiError.notFound();
      ok(res, item);
    },
    create: async (req, res) => {
      const item = await Model.create(withSlug({ ...req.body }));
      created(res, item);
    },
    update: async (req, res) => {
      const item = await Model.findByIdAndUpdate(req.params.id, withSlug({ ...req.body }), {
        new: true,
        runValidators: true,
      });
      if (!item) throw ApiError.notFound();
      ok(res, item, undefined, 'Saved');
    },
    remove: async (req, res) => {
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) throw ApiError.notFound();
      ok(res, { id: req.params.id }, undefined, 'Deleted');
    },
  };
}

/** Mounts the five CRUD routes on a router under `path`. */
export function mountCrud(router, path, ctrl, ...middlewares) {
  router.get(path, ...middlewares, ctrl.list);
  router.get(`${path}/:id`, ...middlewares, ctrl.get);
  router.post(path, ...middlewares, ctrl.create);
  router.put(`${path}/:id`, ...middlewares, ctrl.update);
  router.delete(`${path}/:id`, ...middlewares, ctrl.remove);
}
