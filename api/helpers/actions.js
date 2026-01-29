'use strict';

const { find, isEqual, remove } = require('lodash');

exports.isPublished = (o) => {
  if (!o) return undefined;
  if (Array.isArray(o.tags)) {
    const asAA = o.tags.map(t => (Array.isArray(t) ? t : [t]));
    const hit = find(asAA, (item) => isEqual(item, ['public']));
    if (hit) return ['public'];
    if (o.tags.includes && o.tags.includes('public')) return ['public'];
  }
  if (Array.isArray(o.read) && o.read.includes('public')) return ['public'];
  return undefined;
};

exports.publish = async (o) => {
  if (!o) throw { code: 400, message: 'Invalid object' };

  o.tags = Array.isArray(o.tags) ? o.tags : [];
  const hasAA = find(o.tags.map(t => (Array.isArray(t) ? t : [t])), it => isEqual(it, ['public']));
  const hasFlat = o.tags.includes && o.tags.includes('public');
  if (!hasAA && !hasFlat) {
    o.tags = o.tags.map(t => (Array.isArray(t) ? t : [t]));
    o.tags.push(['public']);
    if (typeof o.markModified === 'function') o.markModified('tags');
  }

  o.read = Array.isArray(o.read) ? o.read : [];
  if (!o.read.includes('public')) o.read.push('public');
  return o.save ? o.save() : o;
};

exports.unPublish = async (o) => {
  if (!o) throw { code: 400, message: 'Invalid object' };
  if (!exports.isPublished(o)) {
    throw { code: 409, message: 'Object already unpublished' };
  }
  if (!Array.isArray(o.tags)) {
    o.tags = [];
  } else {
    remove(o.tags, (item) => isEqual(Array.isArray(item) ? item : [item], ['public']));
    remove(o.tags, (item) => item === 'public');
    if (typeof o.markModified === 'function') o.markModified('tags');
  }
  if (Array.isArray(o.read)) {
    o.read = o.read.filter((perm) => perm !== 'public');
  }
  return o.save ? o.save() : o;
};

exports.delete = async (o) => {
  try {
    if (!Array.isArray(o.tags)) {
      o.tags = [];
    } else {
      remove(o.tags, (item) => isEqual(Array.isArray(item) ? item : [item], ['public']));
      remove(o.tags, (item) => item === 'public');
      if (typeof o.markModified === 'function') o.markModified('tags');
    }

    o.isDeleted = true;
    if (typeof o.markModified === 'function') o.markModified('isDeleted');
    return await (o.save ? o.save() : o);
  } catch (err) {
    throw {
      code: 400,
      message: err && err.message ? err.message : String(err),
    };
  }
};

exports.sendResponse = (res, code, object) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(object));
};
