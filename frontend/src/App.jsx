import { lazy, Suspense, useEffect, useContext, useRef, useCallback } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { useAuth } from "./hooks/useAuth";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { ShiftProvider } from "./contexts/ShiftContext.jsx";
import { ToastContext } from "./contexts/toastContext";
import OfflineBanner from "./components/OfflineBanner";

// Loading Component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-950">
    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
  </div>
);

// Lazy loaded pages
const LoginPage = lazy(() => import("./pages/Login"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePassword"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));
const DeviceVerificationPage = lazy(() => import("./pages/DeviceVerification"));

const VerificationQueuePage = lazy(() => import("./pages/admin/VerificationQueue"));

// Admin Pages
const AdminsPage = lazy(() => import("./pages/admin/Admins"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout/AdminLayout"));
const DashboardPage = lazy(() => import("./pages/admin/Dashboard"));
const DriversPage = lazy(() => import("./pages/admin/Drivers"));
const VehiclesPage = lazy(() => import("./pages/admin/Vehicles"));
const TripsPage = lazy(() => import("./pages/admin/Trips"));
const ShiftsPage = lazy(() => import("./pages/admin/Shifts"));
const ExpensesPage = lazy(() => import("./pages/admin/Expenses"));
const DamageReportsPage = lazy(() => import("./pages/admin/DamageReports"));
const TrackingPage = lazy(() => import("./pages/admin/Tracking"));
const ReportsPage = lazy(() => import("./pages/admin/Reports"));
const AuditLogsPage = lazy(() => import("./pages/admin/AuditLogs"));
const AdminProfilePage = lazy(() => import("./pages/admin/Profile"));

// Driver Pages
const DriverLayout = lazy(() => import("./layouts/DriverLayout/DriverLayout"));
const DriverHome = lazy(() => import("./pages/driver/DriverHome"));
const DriverShift = lazy(() => import("./pages/driver/DriverShift"));
const DriverTrips = lazy(() => import("./pages/driver/DriverTrips"));
const DriverInspection = lazy(() => import("./pages/driver/DriverInspection"));
const DriverExpenses = lazy(() => import("./pages/driver/DriverExpenses"));
const DriverDamage = lazy(() => import("./pages/driver/DriverDamage"));

function ProtectedRoute({ children, requireAdmin, requireDriver }) {
  const { isAuthenticated, isAdmin, isDriver, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword)
    return <Navigate to="/change-password" replace />;

  if (requireAdmin && !isAdmin) {
    return isDriver ? (
      <Navigate to="/driver" replace />
    ) : (
      <Navigate to="/login" replace />
    );
  }

  if (requireDriver && !isDriver) {
    return isAdmin ? (
      <Navigate to="/admin" replace />
    ) : (
      <Navigate to="/login" replace />
    );
  }

  return children;
}

function AppRoutes() {
  const { isAuthenticated, isAdmin, user } = useAuth();
  const { i18n } = useTranslation();

  // Sync i18n with user preference on load
  useEffect(() => {
    if (user?.languagePreference && user.languagePreference !== i18n.language) {
      i18n.changeLanguage(user.languagePreference);
    }
  }, [user, i18n]);

  // Sync document direction with current language
  useEffect(() => {
    const dir = i18n.dir();
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n, i18n.language]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={isAdmin ? "/admin" : "/driver"} />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-device" element={<DeviceVerificationPage />} />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="admins" element={<AdminsPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="damage" element={<DamageReportsPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
        <Route path="profile" element={<AdminProfilePage />} />
        <Route path="verification" element={<VerificationQueuePage />} />
      </Route>

      {/* Driver Routes */}
      <Route
        path="/driver"
        element={
          <ProtectedRoute requireDriver>
            <DriverLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DriverHome />} />
        <Route path="shift" element={<DriverShift />} />
        <Route path="trips" element={<DriverTrips />} />
        <Route path="inspection" element={<DriverInspection />} />
        <Route path="expenses" element={<DriverExpenses />} />
        <Route path="damage" element={<DriverDamage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function GlobalToastListener() {
  const { addToast } = useContext(ToastContext);
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail || {};
      const code = detail.code;
      const defaultMessage = detail.message || t('common.error');
      const type = detail.type ?? 'error';

      // Check for translation using the code first (e.g., errors.NO_ACTIVE_SHIFT)
      let finalMessage = defaultMessage;
      if (code && t) {
        const translated = t(`errors.${code}`);
        if (translated !== `errors.${code}`) {
          finalMessage = translated;
        }
      }

      addToast(finalMessage, type);
    };

    window.addEventListener('app:toast', handler);
    window.addEventListener('app:error', handler);

    // Real-time Trip Notifications for Drivers
    const handleTripAssigned = () => {
      addToast(t('trip.new_assignment_notif'), 'info');
    };
    const handleTripCancelled = () => {
      addToast(t('trip.cancellation_notif'), 'warning');
    };

    window.addEventListener('ws:trip_assigned', handleTripAssigned);
    window.addEventListener('ws:trip_cancelled', handleTripCancelled);

    return () => {
      window.removeEventListener('app:toast', handler);
      window.removeEventListener('app:error', handler);
      window.removeEventListener('ws:trip_assigned', handleTripAssigned);
      window.removeEventListener('ws:trip_cancelled', handleTripCancelled);
    };
  }, [addToast, t]);

  return null;
}

function GlobalRealtimeResync() {
  const { isAdmin, isDriver } = useAuth();
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  const runResync = useCallback(async (detail) => {
    const now = Date.now();
    if (inFlightRef.current) return;
    if (now - lastRunRef.current < 5000) return;

    inFlightRef.current = true;
    lastRunRef.current = now;

    try {
      if (isAdmin) {
        const [statsMod, auditMod, trackingMod, authMod] = await Promise.all([
          import('./services/stats.service'),
          import('./services/audit.service'),
          import('./services/tracking.service'),
          import('./services/auth.service'),
        ]);

        await Promise.allSettled([
          statsMod.statsService.getSummaryStats(),
          auditMod.auditService.getAuditLogs('limit=5'),
          trackingMod.trackingService.getActiveDrivers(),
          authMod.authService.getPendingRescueRequests(),
          authMod.authService.getPendingVerifications('status=pending&limit=10'),
        ]);
      }

      if (isDriver) {
        const [authMod, shiftMod, tripMod, expenseMod, inspectionMod] = await Promise.all([
          import('./services/auth.service'),
          import('./services/shift.service'),
          import('./services/trip.service'),
          import('./services/expense.service'),
          import('./services/inspection.service'),
        ]);

        await Promise.allSettled([
          authMod.authService.getMe(),
          shiftMod.shiftService.getActiveShift(),
          tripMod.tripService.getTrips('limit=20'),
          expenseMod.expenseService.getExpenses('limit=20'),
          inspectionMod.inspectionService.getInspections('limit=10'),
        ]);
      }
    } finally {
      inFlightRef.current = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ws:update', {
          detail: { type: 'resync_completed', source: 'global-resync', trigger: detail?.eventType || null },
        }));
      }
    }
  }, [isAdmin, isDriver]);

  useEffect(() => {
    const handleResyncRequired = (event) => {
      runResync(event?.detail || null);
    };

    window.addEventListener('ws:resync-required', handleResyncRequired);
    return () => {
      window.removeEventListener('ws:resync-required', handleResyncRequired);
    };
  }, [runResync]);

  return null;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <HashRouter>
        <AuthProvider>
          <ShiftProvider>
            <ToastProvider>
              <GlobalToastListener />
              <GlobalRealtimeResync />
              <OfflineBanner />
              <AppRoutes />
            </ToastProvider>
          </ShiftProvider>
        </AuthProvider>
      </HashRouter>
    </Suspense>
  );
}
