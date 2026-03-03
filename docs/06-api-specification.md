# Fleet Management Platform — API Specification

**Version:** 1.1
**Date:** 2026-02-17
**Base URL:** `/api/v1`

---

## 1. Authentication Module (`/auth`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/login` | Public | - | User login | `email`, `password` |
| `POST` | `/change-password` | Bearer | Any | Force password change | `currentPassword`, `newPassword` |
| `POST` | `/refresh` | Public | - | Refresh access token | `refreshToken` |
| `POST` | `/logout` | Bearer | Any | Logout user | - |

---

## 2. Driver Module (`/drivers`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Bearer | Admin | Create new driver | `name`, `email`, `phone`, `password`, `licenseNumber` |
| `GET` | `/` | Bearer | Admin | List all drivers (paginated) | Query: `page`, `limit`, `search` |
| `GET` | `/:id` | Bearer | Admin | Get driver details | - |
| `PUT` | `/:id` | Bearer | Admin | Update driver details | `name`, `phone`, `licenseNumber` |
| `DELETE` | `/:id` | Bearer | Admin | Deactivate driver | - |

---

## 3. Vehicle Module (`/vehicles`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Bearer | Admin | Create new vehicle | `plateNumber`, `model`, `year`, `qrCode`, `capacity` |
| `GET` | `/` | Bearer | Admin | List all vehicles | Query: various filters |
| `GET` | `/:id` | Bearer | Any | Get vehicle details | - |
| `PUT` | `/:id` | Bearer | Admin | Update vehicle details | `model`, `year`, `plateNumber` |
| `POST` | `/validate-qr` | Bearer | Any | Validate vehicle QR code | `qrCode` |
| `PUT` | `/:id/status` | Bearer | Admin | Update vehicle status | `status` (available, damaged, maintenance) |
| `DELETE` | `/:id` | Bearer | Admin | Deactivate vehicle | - |

---

## 4. Shift Module (`/shifts`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Bearer | Driver | Start new shift (PendingVerification) | - |
| `PUT` | `/:id/activate` | Bearer | Driver | Activate shift (after inspection) | - |
| `PUT` | `/:id/close` | Bearer | Driver | Close shift | - |
| `PUT` | `/:id/admin-close` | Bearer | Admin | Force close shift | `reason` |
| `GET` | `/active` | Bearer | Driver | Get current active shift | - |
| `GET` | `/` | Bearer | Admin | List all shifts | Query: `driverId`, `status`, `date` |
| `GET` | `/:id` | Bearer | Any | Get shift details | - |

> [!NOTE]
> All file URLs returned by the API (Identity Photos, Selfies, Reports) are **AWS S3 Presigned URLs** with a 15-minute expiry.

---

## 5. Trip Module (`/trips`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Bearer | Admin | Assign trip to driver | `driverId`, `pickupLocation`, `dropoffLocation`, `price`, `scheduledTime` |
| `PUT` | `/:id/start` | Bearer | Driver | Start assigned trip | - |
| `PUT` | `/:id/complete` | Bearer | Driver | Complete active trip | - |
| `PUT` | `/:id/cancel` | Bearer | Any | Cancel trip | `reason` |
| `GET` | `/active` | Bearer | Driver | Get current active trip | - |
| `GET` | `/` | Bearer | Admin | List all trips | Query: filters |
| `GET` | `/:id` | Bearer | Any | Get trip details | - |

---

## 6. Inspection Module (`/inspections`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Bearer | Driver | Create inspection entry | `shiftId`, `vehicleId`, `type` (full/checklist), `mileage` |
| `POST` | `/:id/photos` | Bearer | Driver | Upload inspection photo | `direction` (front/back/left/right), `photo` (file) |
| `PUT` | `/:id/complete` | Bearer | Driver | Complete inspection | `checklistData` (JSON) |
| `GET` | `/` | Bearer | Any | Get inspections for shift | Query: `shiftId` |

---

## 7. Expense Module (`/expenses`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Bearer | Driver | Submit new expense | `shiftId`, `categoryId`, `amount`, `description`, `receipt` (file) |
| `GET` | `/` | Bearer | Any | List expenses | Query: `driverId`, `status` |
| `PUT` | `/:id` | Bearer | Driver | Update expense | - |
| `PUT` | `/:id/review` | Bearer | Admin | Approve/Reject expense | `action`, `rejectionReason` |
| `GET` | `/categories` | Bearer | Any | List expense categories | - |
| `POST` | `/categories` | Bearer | Admin | Create expense category | `name`, `requiresApproval` |
| `PUT` | `/categories/:id` | Bearer | Admin | Update expense category | - |

---

## 8. Damage Module (`/damage-reports`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Bearer | Driver | Report vehicle damage | `vehicleId`, `shiftId`, `description`, `tripId` |
| `POST` | `/:id/photos` | Bearer | Driver | Upload damage photo | `photo` (file) |
| `PUT` | `/:id/review` | Bearer | Admin | Review damage report | `action` (acknowledge/maintenance/resolve) |
| `GET` | `/` | Bearer | Any | List damage reports | Query filters |

---

## 9. Tracking Module (`/tracking`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/location` | Bearer | Driver | Update current location | `latitude`, `longitude`, `speed` |
| `POST` | `/batch` | Bearer | Driver | Batch update locations | `locations` (array), `shiftId`, `tripId` |
| `GET` | `/active` | Bearer | Admin | Get all active driver positions | - |
| `GET` | `/history` | Bearer | Admin | Get location history | Query parameters |

---

## 10. Report Module (`/reports`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/revenue` | Bearer | Admin | Get revenue JSON data | Query: `startDate`, `endDate` |
| `GET` | `/revenue/pdf` | Bearer | Admin | Download Revenue PDF | Query: `startDate`, `endDate` |
| `GET` | `/revenue/excel` | Bearer | Admin | Download Revenue Excel | Query: `startDate`, `endDate` |

---

## 11. Verification Module (`/verify`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/identity/upload` | Bearer | Any | Upload identity items | `identity_photo`, `id_card_front`, `id_card_back` |
| `GET` | `/identity/queue` | Bearer | Admin | Get pending verification queue | Query: `status`, `search` |
| `PUT` | `/identity/:id/review` | Bearer | Admin | Approve/Reject identity | `status`, `rejection_reason` |
| `POST` | `/face/match` | Bearer | Driver | AWS Rekognition face match | `selfie` (file), `target_photo_url` |
| `GET` | `/stats` | Bearer | Admin | Get verification analytics | - |

---

## 12. Stats Module (`/stats`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin-dashboard` | Bearer | Admin | Get revenue & count cards | - |
| `GET` | `/driver-earnings` | Bearer | Driver | Get daily/weekly stats | - |

---

## 13. Audit Module (`/audit-logs`)

| Method | Endpoint | Auth | Role | Description | Request Body |
| :--- | :--- | : :--- | :--- | :--- | :--- |
| `GET` | `/` | Bearer | Admin | View system audit logs | Query: `actorId`, `entityType`, `actionType`, date range |

---

## Change Log

| Version | Date | Change | Author |
|---------|------|--------|--------|
| 1.0 | 2026-02-14 | Initial API Spec | Backend Developer |
| 1.1 | 2026-02-17 | Added /stats and /verify modules; synced identity routes | Backend Developer |
