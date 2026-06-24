const crypto = require('crypto');
const path = require('path');
const s3Service = require('./S3Service');
const cache = require('./cache.service');
const config = require('../config');

class FileService {
  /**
   * Uploads a file buffer strictly to S3. Local fallback disabled.
   * @param {Object} file - Multer file object (memoryStorage)
   * @param {string} folder - S3 folder prefix (identity, inspections, damage, receipts)
   * @returns {Promise<string>} - The S3 key
   */
  async upload(file, folder) {
    if (!file || !file.buffer) {
      throw new Error('No file buffer provided for upload');
    }

    if (!config.s3.bucket) {
      throw new Error('S3_BUCKET is not configured. Media uploads are restricted.');
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${filename}`;

    await s3Service.uploadFile(key, file.buffer, file.mimetype);

    return key;
  }

  /**
   * Generates a signed URL for an S3 key (cached briefly to avoid presign storms).
   * @param {string} key - The S3 key
   * @returns {Promise<string>} - The signed URL
   */
  async getUrl(key) {
    if (!key) return null;

    if (!config.s3.bucket) {
      if (config.isProduction) {
        throw new Error('S3_BUCKET misconfigured - Cannot generate access URL');
      }
      return `/mock-url/${key}`;
    }

    const cacheKey = `s3url:${key}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const url = await s3Service.generateSignedUrl(key);
    await cache.set(cacheKey, url, config.cacheTtl.s3SignedUrlSeconds);
    return url;
  }

  async _signFields(target, fields) {
    await Promise.all(
      fields.filter((field) => target[field]).map(async (field) => {
        target[field] = await this.getUrl(target[field]);
      }),
    );
  }

  /**
   * Signs all file keys in a driver object
   * @param {Object} driver
   * @returns {Promise<Object>} driver with signed URLs
   */
  async signDriverUrls(driver) {
    if (!driver) return driver;
    const d = { ...driver };

    try {
      await this._signFields(d, ['avatarUrl', 'identityPhotoUrl', 'idCardFront', 'idCardBack']);
    } catch (err) {
      console.error('Failed to sign driver URLs:', err.message);
    }

    return d;
  }

  /**
   * Signs URLs for a single identity verification record.
   * @param {Object} verification
   * @returns {Promise<Object>} verification with signed URLs
   */
  async signIdentityVerification(verification) {
    if (!verification) return verification;
    const v = { ...verification };

    try {
      await this._signFields(v, ['photoUrl', 'idCardFront', 'idCardBack']);
      if (v.driver) {
        v.driver = await this.signDriverUrls(v.driver);
      }
    } catch (err) {
      console.error('Failed to sign identity verification URLs:', err.message);
    }

    return v;
  }

  /**
   * Signs URLs for multiple identity verification records.
   * @param {Array} verifications
   */
  async signIdentityVerifications(verifications) {
    if (!verifications || !Array.isArray(verifications)) return verifications;
    return Promise.all(verifications.map((v) => this.signIdentityVerification(v)));
  }

  /**
   * Signs URLs for a single damage report
   * @param {Object} report
   */
  async signDamageReport(report) {
    if (!report) return report;
    const r = { ...report };
    if (r.photos && Array.isArray(r.photos)) {
      r.photos = await Promise.all(r.photos.map(async (p) => ({
        ...p,
        photoUrl: await this.getUrl(p.photoUrl),
      })));
    }
    return r;
  }

  /**
   * Signs URLs for multiple damage reports
   * @param {Array} reports
   */
  async signDamageReports(reports) {
    if (!reports || !Array.isArray(reports)) return reports;
    return Promise.all(reports.map((r) => this.signDamageReport(r)));
  }

  /**
   * Signs URLs for a single expense
   * @param {Object} expense
   */
  async signExpense(expense) {
    if (!expense) return expense;
    const e = { ...expense };
    if (e.receiptUrl) {
      e.receiptUrl = await this.getUrl(e.receiptUrl);
    }
    return e;
  }

  /**
   * Signs URLs for multiple expenses
   * @param {Array} expenses
   */
  async signExpenses(expenses) {
    if (!expenses || !Array.isArray(expenses)) return expenses;
    return Promise.all(expenses.map((e) => this.signExpense(e)));
  }

  /**
   * Signs URLs for a single inspection
   * @param {Object} inspection
   */
  async signInspection(inspection) {
    if (!inspection) return inspection;
    const i = { ...inspection };
    if (i.photos && Array.isArray(i.photos)) {
      i.photos = await Promise.all(i.photos.map(async (p) => ({
        ...p,
        photoUrl: await this.getUrl(p.photoUrl),
      })));
    }
    return i;
  }

  /**
   * Signs URLs for multiple inspections
   * @param {Array} inspections
   */
  async signInspections(inspections) {
    if (!inspections || !Array.isArray(inspections)) return inspections;
    return Promise.all(inspections.map((i) => this.signInspection(i)));
  }
}

module.exports = new FileService();
