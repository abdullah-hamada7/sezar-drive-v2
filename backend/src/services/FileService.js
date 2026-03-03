const crypto = require('crypto');
const path = require('path');
const s3Service = require('./S3Service');
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
   * Generates a signed URL for an S3 key.
   * @param {string} key - The S3 key
   * @returns {Promise<string>} - The signed URL
   */
  async getUrl(key) {
    if (!config.s3.bucket) {
      // In production, failure to sign is a serious misconfiguration
      if (config.isProduction) {
        throw new Error('S3_BUCKET misconfigured - Cannot generate access URL');
      }
      return `/mock-url/${key}`;
    }
    return await s3Service.generateSignedUrl(key);
  }

  /**
   * Signs all file keys in a driver object
   * @param {Object} driver
   * @returns {Promise<Object>} driver with signed URLs
   */
  async signDriverUrls(driver) {
    if (!driver) return driver;
    const d = { ...driver }; // Shallow copy
    
    try {
      if (d.avatarUrl) d.avatarUrl = await this.getUrl(d.avatarUrl);
      if (d.identityPhotoUrl) d.identityPhotoUrl = await this.getUrl(d.identityPhotoUrl);
      if (d.idCardFront) d.idCardFront = await this.getUrl(d.idCardFront);
      if (d.idCardBack) d.idCardBack = await this.getUrl(d.idCardBack);
    } catch (err) {
      console.error('Failed to sign driver URLs:', err.message);
      // We don't throw here to avoid breaking the whole response, but URLs will be invalid
    }
    
    return d;
  }

  /**
   * Signs URLs for a single damage report
   * @param {Object} report 
   */
  async signDamageReport(report) {
    if (!report) return report;
    const r = { ...report };
    if (r.photos && Array.isArray(r.photos)) {
      r.photos = await Promise.all(r.photos.map(async p => ({
        ...p,
        photoUrl: await this.getUrl(p.photoUrl)
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
    return await Promise.all(reports.map(r => this.signDamageReport(r)));
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
    return await Promise.all(expenses.map(e => this.signExpense(e)));
  }

  /**
   * Signs URLs for a single inspection
   * @param {Object} inspection 
   */
  async signInspection(inspection) {
    if (!inspection) return inspection;
    const i = { ...inspection };
    if (i.photos && Array.isArray(i.photos)) {
      i.photos = await Promise.all(i.photos.map(async p => ({
        ...p,
        photoUrl: await this.getUrl(p.photoUrl)
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
    return await Promise.all(inspections.map(i => this.signInspection(i)));
  }
}

module.exports = new FileService();
