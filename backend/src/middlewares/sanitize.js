/**
 * NoSQL-injection guard: removes keys starting with `$` or containing `.`
 * from body / params / query. Mutates in place (Express 5 `req.query` is a getter).
 */
function clean(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      clean(obj[key]);
    }
  }
}

export const mongoSanitize = (req, _res, next) => {
  clean(req.body);
  clean(req.params);
  clean(req.query);
  next();
};
