import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export const notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 400;
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = 'Please check the highlighted fields';
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(', ')}`;
    details = err.keyValue;
  } else if (err.name === 'ZodError') {
    status = 400;
    message = 'Invalid input';
    details = err.issues?.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err.name === 'MulterError') {
    status = 400;
  }

  if (status >= 500) console.error(`[error] req=${req.id || '-'} ${req.method} ${req.originalUrl}`, err);

  // Server-rendered SEO routes get an HTML error page instead of JSON
  if (req.accepts(['html', 'json']) === 'html' && !req.originalUrl.startsWith('/api')) {
    return res.status(status).render('seo/error', { status, message: status === 404 ? 'Page not found' : 'Something went wrong' });
  }

  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProd ? 'Internal server error' : message,
    ...(details ? { details } : {}),
  });
};
