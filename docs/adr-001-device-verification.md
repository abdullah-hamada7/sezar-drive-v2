# ADR-001: Driver Device Verification Gate

**Status:** Accepted  
**Date:** 2026-06-25

## Context

Drivers authenticate with email/password, then may need face verification before a JWT is issued. Device fingerprints are stored in `user_devices` with an `isVerified` flag.

## Decision

1. **Trusted device:** If `user_devices.isVerified === true` for the login fingerprint, skip face verification and issue tokens immediately.
2. **New or unverified device:** Login returns `requiresVerification: true` plus a short-lived `verificationToken` (JWT, 5 min, type `device_verify`).
3. **Verify endpoint:** `POST /auth/verify-device` requires `verificationToken`, `userId`, `deviceFingerprint`, and `photo`.
4. **Post-logout:** Logout sets `isVerified = false` for the device fingerprint (via `X-Device-Fingerprint` header), so the next login requires face verification again.

## Consequences

- Better UX on repeat logins from the same trusted device.
- Verification ticket prevents unauthenticated verify attempts with only a user ID.
- Mobile and web clients must pass `verificationToken` through the verify step.
