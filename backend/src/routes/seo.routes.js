import { Router } from 'express';
import { validateObjectIdParams } from '../middlewares/security.js';
import { can } from '../middlewares/permission.js';
import { imageUpload, sheetUpload } from '../middlewares/upload.js';
import * as seo from '../controllers/seo/seo.controller.js';

/** Mounted at /api/v1/admin/seo (requireAdmin already applied) */
const r = Router();
validateObjectIdParams(r);
const SEO = can('seo');
const LOC = can('seo', 'catalog');

r.get('/overview', SEO, seo.overview);
r.get('/tree', LOC, seo.tree);

function mountEntity(path, type, guard = SEO) {
  const e = seo.entity(type);
  r.get(path, guard, e.list);
  r.post(path, guard, e.create);
  r.get(`${path}/:id`, guard, e.get);
  r.put(`${path}/:id`, guard, e.update);
  r.delete(`${path}/:id`, guard, e.remove);
  r.post(`${path}/:id/status`, guard, e.status);
  r.get(`${path}/:id/revisions`, guard, e.revisions);
  r.post(`${path}/:id/duplicate`, guard, e.duplicate);
}

// Folder hierarchy: India → State → City → Hotel Category → Hotels → Itineraries (+ Articles)
mountEntity('/states', 'State', LOC);
mountEntity('/cities', 'City', LOC);
mountEntity('/hotel-categories', 'HotelCategory');
mountEntity('/hotels', 'SeoHotel');
mountEntity('/itineraries', 'Itinerary');
mountEntity('/articles', 'SeoArticle');
r.post('/cities/:cityId/generate-categories', SEO, seo.generateCategories);

r.get('/revisions/:id', SEO, seo.revision);
r.post('/revisions/:id/restore', SEO, seo.restore);
r.get('/preview/:type/:id', SEO, seo.previewLink);

r.get('/redirects', SEO, seo.redirects);
r.post('/redirects', SEO, seo.saveRedirect);
r.put('/redirects/:id', SEO, seo.saveRedirect);
r.delete('/redirects/:id', SEO, seo.deleteRedirect);

r.get('/media', can('seo', 'media'), seo.media);
r.post('/media', can('seo', 'media'), imageUpload.array('files', 30), seo.uploadMedia);
r.put('/media/:id', can('seo', 'media'), seo.updateMedia);
r.delete('/media/:id', can('seo', 'media'), seo.deleteMedia);

r.get('/import/template', SEO, seo.importTemplate);
r.get('/import/columns', SEO, seo.importColumns);
r.post('/import', SEO, sheetUpload.single('file'), seo.importRun);

r.get('/sitemap', SEO, seo.sitemap);
r.post('/sitemap/submit', SEO, seo.submitToGoogle);
r.get('/search-console/sitemaps', SEO, seo.gscSitemaps);

r.post('/ai/assist', SEO, seo.aiAssist);

export default r;
