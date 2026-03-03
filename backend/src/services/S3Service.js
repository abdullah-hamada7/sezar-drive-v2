const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require("../config");

class S3Service {
  constructor() {
    this.client = new S3Client({
      region: config.s3.region,
      // Credentials are picked up automatically from environment (local)
      // or IAM Roles (EC2)
    });
    this.bucket = config.s3.bucket;
  }

  /**
   * Uploads a file to S3
   * @param {string} key - The S3 path/prefix (e.g., 'profiles/driver_1.jpg')
   * @param {Buffer | ReadableStream | string} body - The file content
   * @param {string} contentType - The MIME type (e.g., 'image/jpeg')
   */
  async uploadFile(key, body, contentType) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    try {
      return await this.client.send(command);
    } catch (error) {
      console.error("S3 Upload Error:", error);
      throw new Error(`Failed to upload file to S3: ${error.message}`, { cause: error });
    }
  }

  /**
   * Generates a temporary GET URL for a private S3 object
   * @param {string} key - The S3 path/prefix
   * @param {number} expiresIn - Expiry in seconds (Default: 300s)
   */
  async generateSignedUrl(key, expiresIn = 300) {
    if (!key) return null;
    
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      console.error("S3 Signed URL Error:", error);
      throw new Error(`Failed to generate signed URL: ${error.message}`, { cause: error });
    }
  }
}

module.exports = new S3Service();
