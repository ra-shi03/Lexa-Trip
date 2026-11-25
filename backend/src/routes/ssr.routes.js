import { Router } from 'express';
import * as ssr from '../controllers/ssr.controller.js';

/** Public, crawlable SEO pages + robots.txt + XML sitemaps (served by Express, not the SPA). */
const r = Router();

r.get('/robots.txt', ssr.robots);
r.get('/sitemap.xml', ssr.sitemapIndex);
r.get('/sitemaps/:file', ssr.sitemapFile);

r.use(['/hotels', '/blog'], ssr.seoRedirects);
r.get('/hotels/:state/:city/', ssr.cityHotels);
r.get('/hotels/:state/:city/:slug/', ssr.categoryOrHotel);
r.get('/hotels/:state/:city/:hotel/itinerary/:slug/', ssr.itineraryPage);
r.get('/blog/:state/', ssr.stateBlog);
r.get('/blog/:state/:slug/', ssr.blogCityOrArticle);
r.get('/blog/:state/:city/:slug/', ssr.cityArticle);

export default r;
