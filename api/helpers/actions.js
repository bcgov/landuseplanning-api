'use strict';

const { find, isEqual, remove } = require('lodash');
const winston = require('winston');
const defaultLog = winston.loggers.get('defaultLog');

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
      remove(o.tags, (item) =>
        isEqual(Array.isArray(item) ? item : [item], ['public']),
      );
      remove(o.tags, (item) => item === 'public');
      if (typeof o.markModified === 'function') o.markModified('tags');
    }

    o.isDeleted = true;
    if (typeof o.markModified === 'function') o.markModified('isDeleted');
    return await (o.save ? o.save() : o);
  } catch (e) {
    throw {
      code: 400,
      message: e && e.message ? e.message : String(e),
    };
  }
};

// Sanitize errors for client
const toSafeClientError = (code, e) => {
  const status = Number(code);
  let message = (e && e.message) || 'Unknown error';
  if (status >= 500) {
    // 500 level: Do not leak details
    message = 'Internal server error';
  } else if (status >= 400 && status < 500) {
    // 400 level: Safe for users
    message =
      (e && typeof e.message === 'string' && e.message.trim()) ||
      'Request failed';
  }
  return { code, message };
};

// Send a response to the client
exports.sendResponse = (res, code, obj, details = '') => {
  const isError =
    obj &&
    typeof obj === 'object' &&
    (obj instanceof Error || ('stack' in obj && 'message' in obj));

  // Prefer error object status code, then code argument, then default value
  const status =
    Number((obj && (obj.status || obj.statusCode)) || code) ||
    (isError ? 500 : 200);
    
  try {
    // Let regular responses pass through
    if (status === 204 && !isError) {
      return res.status(204).end();
    } else if (status < 400 && !isError) {
      return res.status(status).json(obj);
    }

    // Log errors
    const errorLogObj = {
      status: status,
      err: { name: obj && obj.name, message: obj && obj.message, stack: obj && obj.stack },
    };
    errorLogObj.stack =
      (status >= 500 || isError) && obj ? obj.stack : undefined;
    if (status < 500) {
      defaultLog.warn(details, errorLogObj);
    } else {
      defaultLog.error(details, errorLogObj);
    }

    // Send a safe response
    const safe = toSafeClientError(status, obj);
    return res.status(status).json(safe);
  } catch (re) {
    defaultLog.error('Failed to send a response to the user', {
      message: re && re.message,
      stack: re && re.stack,
      original: obj,
    });
    return res
      .status(500)
      .json({ code: 500, message: 'Internal server error' });
  }
};

