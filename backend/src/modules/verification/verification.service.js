const faceVerificationService = require('../../services/FaceVerificationService');
const { DriverVerificationStatus } = require('../../config/constants');

/**
 * Shared service for verifying identity using face comparison.
 */
async function verifyFace(referenceUrl, liveBuffer) {
  if (!referenceUrl) {
    throw new Error('No reference photo available for comparison');
  }

  // Face comparison using AWS Rekognition
  const verification = await faceVerificationService.verify(referenceUrl, liveBuffer);
  
  return {
    status: verification.status,
    similarity: verification.similarity,
    matched: verification.status === DriverVerificationStatus.VERIFIED
  };
}

module.exports = {
  verifyFace
};
