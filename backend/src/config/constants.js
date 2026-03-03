/**
 * Domain Enums as per System Contract
 */

const DriverVerificationStatus = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  FAILED_MATCH: "FAILED_MATCH",
  MANUAL_REVIEW: "MANUAL_REVIEW"
};

const TripState = {
  ASSIGNED: "ASSIGNED",
  ACCEPTED: "ACCEPTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  OFFLINE_PENDING_SYNC: "OFFLINE_PENDING_SYNC"
};

module.exports = {
  DriverVerificationStatus,
  TripState
};
