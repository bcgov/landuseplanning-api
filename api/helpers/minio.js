'use strict';

const minio = require('minio');
const path = require('path');

/**
 * The Minio client which facilitates the connection to Minio, and through which all calls should be made.
 */
const minioClient = new minio.Client({
  endPoint: process.env.MINIO_HOST,
  port: 443,
  useSSL: true,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

// This is the list of known, valid buckets documents can be uploaded and downloaded from.
const BUCKETS = {
  DOCUMENTS_BUCKET: 'uploads',
};
exports.BUCKETS = BUCKETS;

/**
 * Checks whether the provided bucket name is a valid (known) bucket.
 * @param {string} bucket the name of the bucket
 * @returns {boolean} true if the bucket is valid, false otherwise
 */
const isValidBucket = (bucket) => {
  if (bucket) {
    for (const key in BUCKETS) {
      if (BUCKETS[key] === bucket.toLowerCase()) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Returns a 32 character, 16-bit pseudo-random string to be used as file name for the storage.
 * @returns {string} a 16-bit pseudo-random string
 * @see https://stackoverflow.com/a/58326357
 */
const getRandomizedFileName = () => {
  return [...Array(32)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('');
};

/**
 * Return the file extension, derived from the full file name
 * @param {string} fileName
 * @returns {string|null} the file extension (ex: somefile.txt => 'txt'), or null if no extension is found.
 */
const getFileExtension = (fileName) => {
  const match =
    typeof fileName === 'string' ? fileName.match(/\.([0-9a-z]+$)/i) : null;
  return match ? match[1] : null;
};

/**
 * Creates a Minio bucket with the given name
 * @param {string} bucket the name of the bucket
 * @returns {Promise<void>}
 */
const makeBucket = (bucket) => {
  return minioClient.makeBucket(bucket);
};

/**
 * Checks if the provided bucket name exists on Minio
 * @param {string} bucket the name of the bucket
 * @returns {Promise<boolean>}
 */
const bucketExists = (bucket) => {
  return minioClient.bucketExists(bucket);
};

/**
 * Save an object to Minio.
 * The url can be used multiple times, but expires after 5 minutes.
 * @param {string} bucket the Minio bucket
 * @param {string} projectCode a project code
 * @param {string} fileName the name of the file
 * @param {string} pathOnDisk the path to the file being uploaded
 * @returns {Promise<{fullName: string, extension: string|null, path: string}>}
 */
const putDocument = async (bucket, projectCode, fileName, pathOnDisk) => {
  if (!isValidBucket(bucket)) {
    return Promise.reject('[' + bucket + '] is not a valid bucket');
  }

  const exists = await bucketExists(bucket);
  if (!exists) {
    await makeBucket(bucket);
  }

  // generate randomized file name and append extension from original name
  const fileExtension = getFileExtension(fileName);
  const newFileName =
    getRandomizedFileName() + (fileExtension ? '.' + fileExtension : '');
  const filePath = path.posix.join(projectCode, newFileName);

  // upload the file to minio
  await minioClient.fPutObject(bucket, filePath, pathOnDisk);

  return {
    fullName: newFileName,
    extension: fileExtension,
    path: filePath,
  };
};
exports.putDocument = putDocument;

/**
 * Delete a file from Minio.
 * @param {string} bucket the Minio bucket
 * @param {string} projectCode a project code
 * @param {string} fileName the name of the file
 * @returns {Promise<any>}
 */
const deleteDocument = async (bucket, projectCode, fileName) => {
  // removeObject resolves/rejects; no (result, err) tuple in .then for Promises
  return minioClient.removeObject(bucket, projectCode + '/' + fileName);
};
exports.deleteDocument = deleteDocument;

/**
 * Get a Minio presigned url, for a specific file object, that permits GET operations.
 * The url can be used multiple times, but expires after 5 minutes.
 * @param {string} bucket the name of the bucket where the object is stored
 * @param {string} filePath the file path for the file to retrieve. Typically "some-gold-mine/thisisarandomizedbytestring12345.pdf"
 * @returns {Promise<string>} a presigned url
 */
const getPresignedGETUrl = (bucket, filePath) => {
  return minioClient.presignedGetObject(bucket, filePath, 5 * 60);
};
exports.getPresignedGETUrl = getPresignedGETUrl;

/**
 * Gets the metadata for the specified object
 * @param {string} bucketName the name of the bucket where the object is stored
 * @param {string} objectName the name of the object being checked
 * @returns {Promise<object|undefined>} the object metadata, or undefined if the object does not exist
 */
const statObject = async (bucketName, objectName) => {
  try {
    const stat = await minioClient.statObject(bucketName, objectName);
    return stat;
  } catch (e) {
    defaultLog.error('Unable to get metadata for the specified file from minio client', {
      message: e && e.message,
      stack: e && e.stack,
    })
    return undefined;
  }
};
exports.statObject = statObject;

/**
 * Wrappers for the above functions to add support for http request/response.
 */
const asHttpRequest = {
  /**
   * Wraps the existing function of the same name in a promise that supports http request/response.
   * @see deleteDocument
   */
  deleteDocument: async (req, res) => {
    try {
      const result = await deleteDocument(
        BUCKETS.DOCUMENTS_BUCKET,
        req.params.projectCode,
        req.params.fileName,
      );
      return res.json(result);
    } catch (e) {
      defaultLog.error('Minio delete document failed', {
        message: e && e.message,
        stack: e && e.stack,
      });
      return Actions.sendResponse(res, 400, e);
    }
  },
};
exports.asHttpRequest = asHttpRequest;
