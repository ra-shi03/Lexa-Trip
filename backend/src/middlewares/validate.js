/** zod body validator: replaces req.body with the parsed (coerced, stripped) value. */
export const validate = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body ?? {});
  next();
};
