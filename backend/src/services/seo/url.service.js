import { env } from '../../config/env.js';

/**
 * Single source of truth for public SEO URLs (always trailing slash).
 *   /hotels/<state>/<city>/                                  city hotel hub
 *   /hotels/<state>/<city>/<category>/                       e.g. 5-star-hotels
 *   /hotels/<state>/<city>/<hotel>/                          hotel profile
 *   /hotels/<state>/<city>/<hotel>/itinerary/<itinerary>/    hotel itinerary
 *   /blog/<state>/                                           state guide hub
 *   /blog/<state>/<city>/                                    city guide hub
 *   /blog/<state>/<article>/                                 state-level article
 *   /blog/<state>/<city>/<article>/                          city-level article
 */
const s = (x) => (typeof x === 'string' ? x : x?.slug);

export const paths = {
  cityHotels: (state, city) => `/hotels/${s(state)}/${s(city)}/`,
  category: (state, city, cat) => `/hotels/${s(state)}/${s(city)}/${s(cat)}/`,
  hotel: (state, city, hotel) => `/hotels/${s(state)}/${s(city)}/${s(hotel)}/`,
  itinerary: (state, city, hotel, it) => `/hotels/${s(state)}/${s(city)}/${s(hotel)}/itinerary/${s(it)}/`,
  stateBlog: (state) => `/blog/${s(state)}/`,
  cityBlog: (state, city) => `/blog/${s(state)}/${s(city)}/`,
  article: (state, city, a) => (city ? `/blog/${s(state)}/${s(city)}/${s(a)}/` : `/blog/${s(state)}/${s(a)}/`),
};

export const absolute = (path, siteUrl = env.siteUrl) => (/^https?:\/\//.test(path || '') ? path : `${siteUrl}${path || '/'}`);

/** Path for any populated SEO entity (state/city must be populated with slug) */
export function pathFor(type, doc) {
  switch (type) {
    case 'SeoHotel': return paths.hotel(doc.state, doc.city, doc);
    case 'Itinerary': return paths.itinerary(doc.hotel.state, doc.hotel.city, doc.hotel, doc);
    case 'SeoArticle': return paths.article(doc.state, doc.city, doc);
    case 'HotelCategory': return paths.category(doc.state, doc.city, doc);
    case 'City': return paths.cityHotels(doc.state, doc);
    case 'State': return paths.stateBlog(doc);
    default: return '/';
  }
}
