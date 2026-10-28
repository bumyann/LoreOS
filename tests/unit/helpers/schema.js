// A small JSON Schema (draft-07) checker, enough for the Backyard schemas: type, const, enum, required, properties,
// additionalProperties, items, minItems/maxItems, pattern, oneOf and format date-time. Returns a list of problems.
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const typeOf = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const isType = (v, t) => (t === 'number' ? typeof v === 'number' : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t);

export function validate(schema, value, path = '$') {
  const errs = [];
  if (schema.oneOf) {
    const ok = schema.oneOf.filter(s => validate(s, value, path).length === 0).length;
    if (ok !== 1) errs.push(path + ': matches ' + ok + ' of the oneOf options, expected exactly 1');
    return errs;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(t => isType(value, t))) { errs.push(path + ': expected ' + types.join('|') + ', got ' + typeOf(value)); return errs; }
  }
  if ('const' in schema && value !== schema.const) errs.push(path + ': must be ' + JSON.stringify(schema.const));
  if (schema.enum && !schema.enum.includes(value)) errs.push(path + ': not one of ' + schema.enum.join(', '));
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(path + ': does not match ' + schema.pattern);
    if (schema.format === 'date-time' && !DATE_TIME.test(value)) errs.push(path + ': not an ISO date-time');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(path + ': fewer than ' + schema.minItems + ' items');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(path + ': more than ' + schema.maxItems + ' items');
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items, v, path + '[' + i + ']')));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    (schema.required || []).forEach(k => { if (!(k in value)) errs.push(path + ': missing ' + k); });
    const props = schema.properties || {};
    Object.keys(value).forEach(k => {
      if (props[k]) errs.push(...validate(props[k], value[k], path + '.' + k));
      else if (schema.additionalProperties === false) errs.push(path + ': unexpected property ' + k);
    });
  }
  return errs;
}
