// ---------------------------------------------------------
// SHARED DTOS & TYPES
// ---------------------------------------------------------

export enum TripState {
    ASSIGNED = 'ASSIGNED',
    ACCEPTED = 'ACCEPTED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export enum ShiftState {
    PENDING_VERIFICATION = 'PendingVerification',
    ACTIVE = 'Active',
    CLOSED = 'Closed'
}

export interface DriverDTO {
    id: string;
    name: string;
    phone: string;
    identityPhotoUrl?: string;
    languagePreference: string;
}

export interface TripDTO {
    id: string;
    status: TripState;
    price: number;
    paymentMethod?: 'CASH' | 'E_WALLET' | 'E_PAYMENT';
    pickupLocation: string;
    dropoffLocation: string;
    passengerName: string;
    passengerPhone?: string;
    notes?: string;
}

export interface ShiftDTO {
    id: string;
    status: ShiftState;
    driverId: string;
    vehicleId?: string;
    startedAt?: Date;
    closedAt?: Date;
}
