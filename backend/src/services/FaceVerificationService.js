const { RekognitionClient, CompareFacesCommand } = require("@aws-sdk/client-rekognition");
const config = require("../config");
const { DriverVerificationStatus } = require("../config/constants");

class FaceVerificationService {
  constructor() {
    this.client = new RekognitionClient({
      region: config.s3.region,
    });
    this.bucket = config.s3.bucket;
    this.threshold = 90; // Verified threshold
    this.manualReviewThreshold = 75; // Manual review threshold
  }

  /**
   * Compares a live image (buffer) against a reference image in S3
   * @param {string} referenceKey - S3 key of the driver's reference photo
   * @param {Buffer} liveImageBuffer - Buffer of the captured selfie
   * @returns {Promise<Object>} - Verification results with status and similarity
   */
  async verify(referenceKey, liveImageBuffer) {
    const command = new CompareFacesCommand({
      SourceImage: {
        S3Object: {
          Bucket: this.bucket,
          Name: referenceKey,
        },
      },
      TargetImage: {
        Bytes: liveImageBuffer,
      },
      SimilarityThreshold: 0, // We want the score even if it's low
    });

    try {
      const response = await this.client.send(command);
      const matchedFaces = response.FaceMatches || [];
      
      let similarity = 0;
      if (matchedFaces.length > 0) {
        similarity = matchedFaces[0].Similarity;
      }

      let status = DriverVerificationStatus.FAILED_MATCH;
      if (similarity >= this.threshold) {
        status = DriverVerificationStatus.VERIFIED;
      } else if (similarity >= this.manualReviewThreshold) {
        status = DriverVerificationStatus.MANUAL_REVIEW;
      }

      return {
        status,
        similarity,
        matched: similarity >= this.threshold
      };
    } catch (error) {
      console.error("Rekognition Error:", error);
      return {
        status: DriverVerificationStatus.PENDING,
        similarity: 0,
        error: error.message
      };
    }
  }
}

module.exports = new FaceVerificationService();
