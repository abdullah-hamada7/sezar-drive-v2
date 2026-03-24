import { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { tripService as api } from '../../services/trip.service';
import { driverService } from '../../services/driver.service';
import { ToastContext } from '../../contexts/toastContext';
import { Eye, XCircle, MapPin, DollarSign, Save, X, Download, Search } from 'lucide-react';
import PromptModal from '../../components/common/PromptModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import Pagination from '../../components/common/Pagination';
import { ListError, ListLoading } from '../../components/common/ListStates';
import { downloadApiFile } from '../../utils/download';
import { EGYPT_PHONE_REGEX } from '../../utils/validation';
import WhatsAppLink from '../../components/common/WhatsAppLink';
import { MapContainer, Marker, TileLayer, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createDotMarkerIcon(color) {
  return L.divIcon({
    className: 'trip-dot-marker',
    html: `
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: ${color};
        border: 2px solid rgba(255, 255, 255, 0.95);
        box-shadow: 0 3px 10px rgba(0,0,0,0.45);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  });
}

const TRIP_MARKER_ICONS = {
  pickup: createDotMarkerIcon('#22c55e'),
  dropoff: createDotMarkerIcon('#ef4444'),
};

function toCoord(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function reverseGeocode(lat, lng, language = 'en') {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
      addressdetails: '1',
    });

    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': language,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name ? String(data.display_name) : null;
  } catch {
    return null;
  }
}

async function searchPlaces(query, language = 'en', limit = 6, signal) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    const params = new URLSearchParams({
      format: 'jsonv2',
      q,
      limit: String(limit),
      addressdetails: '1',
    });

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': language,
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((p) => {
        const lat = Number(p?.lat);
        const lng = Number(p?.lon);
        const label = p?.display_name ? String(p.display_name) : '';
        if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { label, lat, lng };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function TripMapClickHandler({ selectionMode, onSelect }) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;
      onSelect(selectionMode, lat, lng);
    },
  });
  return null;
}

function MapViewUpdater({ center, zoom = 14 }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.setView(center, zoom, { animate: true });
  }, [map, zoom, center]);
  return null;
}

const STATUS_BADGES = {
  ASSIGNED: 'badge-info',
  IN_PROGRESS: 'badge-warning',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
  DEFAULT: 'badge-neutral',
};

export default function TripsPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), [searchParams]);
  const limit = useMemo(() => {
    const n = parseInt(searchParams.get('limit') || '15', 10) || 15;
    return Math.min(Math.max(n, 5), 100);
  }, [searchParams]);
  const status = useMemo(() => String(searchParams.get('status') || ''), [searchParams]);
  const search = useMemo(() => String(searchParams.get('search') || ''), [searchParams]);
  const startDate = useMemo(() => String(searchParams.get('startDate') || ''), [searchParams]);
  const endDate = useMemo(() => String(searchParams.get('endDate') || ''), [searchParams]);
  const sortBy = useMemo(() => String(searchParams.get('sortBy') || ''), [searchParams]);
  const sortOrder = useMemo(() => String(searchParams.get('sortOrder') || ''), [searchParams]);

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [trips, setTrips] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [selectedTripLoading, setSelectedTripLoading] = useState(false);
  const [selectedTripLoadingId, setSelectedTripLoadingId] = useState(null);
  const [openingCreate, setOpeningCreate] = useState(false);

  const tripIdQuery = useMemo(() => {
    const id = searchParams.get('tripId');
    return id ? String(id).trim() : '';
  }, [searchParams]);

  const clearTripIdQuery = () => {
    if (!tripIdQuery) return;
    setQuery({ tripId: '' });
  };

  const closeSelectedTrip = () => {
    setSelectedTrip(null);
    setSelectedTripLoading(false);
    setSelectedTripLoadingId(null);
    clearTripIdQuery();
  };

  const openTripDetails = useCallback(async (trip) => {
    if (!trip?.id) return;
    setSelectedTrip(trip);
    setSelectedTripLoading(true);
    setSelectedTripLoadingId(trip.id);
    try {
      const res = await api.getTrip(trip.id);
      if (res?.data) setSelectedTrip(res.data);
    } catch (err) {
      const code = err?.errorCode || err?.code;
      const msg = code ? t(`errors.${code}`) : (err?.message || t('common.error'));
      addToast(msg, 'error');
    } finally {
      setSelectedTripLoading(false);
      setSelectedTripLoadingId(null);
    }
  }, [addToast, t]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    driverId: '',
    pickupLocation: '',
    dropoffLocation: '',
    paymentMethod: 'CASH',
    pickupLat: null,
    pickupLng: null,
    dropoffLat: null,
    dropoffLng: null,
    price: '',
    scheduledTime: '',
    passengers: [{ name: '', phone: '', companionCount: 0, bagCount: 0 }]
  });
  const [mapSelectionMode, setMapSelectionMode] = useState('pickup');
  const [mapFocus, setMapFocus] = useState('pickup');
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [pickupSuggestOpen, setPickupSuggestOpen] = useState(false);
  const [dropoffSuggestOpen, setDropoffSuggestOpen] = useState(false);
  const [pickupSuggestLoading, setPickupSuggestLoading] = useState(false);
  const [dropoffSuggestLoading, setDropoffSuggestLoading] = useState(false);
  const pickupSuggestAbortRef = useRef(null);
  const dropoffSuggestAbortRef = useRef(null);
  const pickupBlurTimerRef = useRef(null);
  const dropoffBlurTimerRef = useRef(null);
  const [assignmentCharge, setAssignmentCharge] = useState(0);
  const [chargeDraft, setChargeDraft] = useState('0');
  const [savingCharge, setSavingCharge] = useState(false);
  const [selectedDriverName, setSelectedDriverName] = useState('');
  const [, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [promptData, setPromptData] = useState({ isOpen: false, tripId: null });
  const [mapDetails, setMapDetails] = useState({ isOpen: false, trip: null });
  const [confirmSaveChargeOpen, setConfirmSaveChargeOpen] = useState(false);
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);
  const filterLabel = status ? t(`common.trip_status.${status.toLowerCase()}`) : t('trips.filter_all');

  const mapCenter = useMemo(() => {
    const pickup = form.pickupLat != null && form.pickupLng != null ? [form.pickupLat, form.pickupLng] : null;
    const dropoff = form.dropoffLat != null && form.dropoffLng != null ? [form.dropoffLat, form.dropoffLng] : null;
    if (mapFocus === 'pickup') return pickup || dropoff || [30.0444, 31.2357];
    return dropoff || pickup || [30.0444, 31.2357];
  }, [form.pickupLat, form.pickupLng, form.dropoffLat, form.dropoffLng, mapFocus]);

  function applyPlace(mode, place, { setLabel = true } = {}) {
    if (!place) return;
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (mode === 'pickup') {
      setForm((prev) => ({
        ...prev,
        pickupLat: lat,
        pickupLng: lng,
        pickupLocation: setLabel ? place.label : prev.pickupLocation,
      }));
      setMapFocus('pickup');
      setMapSelectionMode('pickup');
    } else {
      setForm((prev) => ({
        ...prev,
        dropoffLat: lat,
        dropoffLng: lng,
        dropoffLocation: setLabel ? place.label : prev.dropoffLocation,
      }));
      setMapFocus('dropoff');
      setMapSelectionMode('dropoff');
    }
  }

  useEffect(() => {
    if (!showCreateModal) return;
    const q = String(form.pickupLocation || '').trim();
    if (q.length < 3) {
      setPickupSuggestions([]);
      setPickupSuggestLoading(false);
      return;
    }

    if (pickupSuggestAbortRef.current) pickupSuggestAbortRef.current.abort();
    const controller = new AbortController();
    pickupSuggestAbortRef.current = controller;

    setPickupSuggestLoading(true);
    const tId = window.setTimeout(async () => {
      const results = await searchPlaces(q, i18n.language || 'en', 6, controller.signal);
      setPickupSuggestions(results);
      setPickupSuggestLoading(false);
    }, 250);

    return () => {
      window.clearTimeout(tId);
      controller.abort();
    };
  }, [form.pickupLocation, showCreateModal, i18n.language]);

  useEffect(() => {
    if (!showCreateModal) return;
    const q = String(form.dropoffLocation || '').trim();
    if (q.length < 3) {
      setDropoffSuggestions([]);
      setDropoffSuggestLoading(false);
      return;
    }

    if (dropoffSuggestAbortRef.current) dropoffSuggestAbortRef.current.abort();
    const controller = new AbortController();
    dropoffSuggestAbortRef.current = controller;

    setDropoffSuggestLoading(true);
    const tId = window.setTimeout(async () => {
      const results = await searchPlaces(q, i18n.language || 'en', 6, controller.signal);
      setDropoffSuggestions(results);
      setDropoffSuggestLoading(false);
    }, 250);

    return () => {
      window.clearTimeout(tId);
      controller.abort();
    };
  }, [form.dropoffLocation, showCreateModal, i18n.language]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const params = new URLSearchParams({ page, limit });
        if (status) params.set('status', status);
        if (search.trim()) params.set('search', search.trim());
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (sortBy) params.set('sortBy', sortBy);
        if (sortOrder) params.set('sortOrder', sortOrder);
        const res = await api.getTrips(params.toString());
        setTrips(res.data.trips || []);
        setPagination(res.data || {});
      } catch (err) {
        console.error(err);
        const msg = err?.message || t('common.error');
        setLoadError(msg);
        addToast(msg, 'error');
      }
      finally { setLoading(false); }
    }
    load();
  }, [addToast, endDate, limit, page, refresh, search, sortBy, sortOrder, startDate, status, t]);

  useEffect(() => {
    if (!tripIdQuery) return;
    if (selectedTrip?.id === tripIdQuery) return;

    const fromList = trips.find((trip) => String(trip?.id || '') === tripIdQuery);
    if (fromList) {
      setSelectedTrip(fromList);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.getTrip(tripIdQuery);
        if (cancelled) return;
        if (res?.data) setSelectedTrip(res.data);
      } catch (err) {
        if (cancelled) return;
        const code = err?.errorCode || err?.code;
        const msg = code ? t(`errors.${code}`) : (err?.message || t('common.error'));
        addToast(msg, 'error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tripIdQuery, selectedTrip?.id, trips, addToast, t]);

  useEffect(() => {
    async function loadCharge() {
      try {
        const response = await api.getAssignmentCharge();
        const charge = Number(response.data?.charge ?? 0);
        const normalized = Number.isFinite(charge) ? charge : 0;
        setAssignmentCharge(normalized);
        setChargeDraft(String(normalized));
      } catch (err) {
        const msg = err.code ? t(`errors.${err.code}`) : (err.message || t('common.error'));
        addToast(msg, 'error');
      }
    }

    loadCharge();
  }, [addToast, t]);

  useEffect(() => {
    const handleUpdate = () => setRefresh(r => r + 1);
    window.addEventListener('ws:trip_assigned', handleUpdate);
    window.addEventListener('ws:trip_started', handleUpdate);
    window.addEventListener('ws:trip_completed', handleUpdate);
    window.addEventListener('ws:trip_cancelled', handleUpdate);
    window.addEventListener('ws:update', handleUpdate);
    return () => {
      window.removeEventListener('ws:trip_assigned', handleUpdate);
      window.removeEventListener('ws:trip_started', handleUpdate);
      window.removeEventListener('ws:trip_completed', handleUpdate);
      window.removeEventListener('ws:trip_cancelled', handleUpdate);
      window.removeEventListener('ws:update', handleUpdate);
    };
  }, []);

  async function openCreate() {
    setError('');
    setOpeningCreate(true);
    setShowCreateModal(true);
    try {
      const res = await driverService.getDrivers('limit=100');
      setDrivers(res.data.drivers || []);
    } catch (err) {
      const msg = err.code ? t(`errors.${err.code}`) : (err.message || t('common.error'));
      addToast(msg, 'error');
    } finally {
      setOpeningCreate(false);
    }
  }

  function toLocalInputValue(date) {
    const pad = value => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function toOffsetISOString(date) {
    const pad = value => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const offsetAbs = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(offsetAbs / 60));
    const offsetMins = pad(offsetAbs % 60);
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!form.driverId) {
      addToast(t('trips.modal.select_driver'), 'error');
      return;
    }
    if (!String(form.pickupLocation || '').trim() || !String(form.dropoffLocation || '').trim()) {
      addToast(t('common.errors.check_fields'), 'error');
      return;
    }

    const parsedPrice = parseFloat(form.price);
    if (Number.isNaN(parsedPrice)) {
      addToast(t('trips.modal.price_label', { unit: t('common.currency') }), 'error');
      return;
    }
    const passenger = form.passengers?.[0];
    if (!passenger?.name?.trim() || !passenger?.phone?.trim()) {
      addToast(t('common.errors.check_fields'), 'error');
      return;
    }
    if (!EGYPT_PHONE_REGEX.test(passenger.phone.trim())) {
      addToast(t('drivers.modal.phone_invalid'), 'error');
      return;
    }

    setConfirmAssignOpen(true);
  }

  async function submitAssignTrip() {
    try {
      const parsedPrice = parseFloat(form.price);
      if (Number.isNaN(parsedPrice)) {
        addToast(t('trips.modal.price_label', { unit: t('common.currency') }), 'error');
        return;
      }

      let scheduledTime = form.scheduledTime;
      if (scheduledTime) {
        const scheduledDate = new Date(scheduledTime);
        if (!Number.isNaN(scheduledDate.getTime())) {
          scheduledTime = toOffsetISOString(scheduledDate);
        }
      }
      await api.assignTrip({ ...form, price: parsedPrice, scheduledTime });
      setShowCreateModal(false);
                      setForm({
                        driverId: '',
                        pickupLocation: '',
                        dropoffLocation: '',
                        paymentMethod: 'CASH',
                        pickupLat: null,
                        pickupLng: null,
                        dropoffLat: null,
                        dropoffLng: null,
                        price: '',
                        scheduledTime: '',
                        passengers: [{ name: '', phone: '', companionCount: 0, bagCount: 0 }]
                      });
      setPickupSuggestions([]);
      setDropoffSuggestions([]);
      setPickupSuggestOpen(false);
      setDropoffSuggestOpen(false);
      setSelectedDriverName('');
      setRefresh(r => r + 1);
    } catch (err) {
      const driverName = selectedDriverName || drivers.find(d => String(d.id) === String(form.driverId))?.name || '';
      addToast(err.code ? t(`errors.${err.code}`, { name: driverName }) : err.message, 'error');
    }
  }

  async function saveAssignmentCharge() {
    setSavingCharge(true);
    try {
      const parsed = Number(chargeDraft);
      await api.updateAssignmentCharge({ charge: Number.isFinite(parsed) ? parsed : 0 });
      const response = await api.getAssignmentCharge();
      const charge = Number(response.data?.charge ?? 0);
      const normalized = Number.isFinite(charge) ? charge : 0;
      setAssignmentCharge(normalized);
      setChargeDraft(String(normalized));
    } catch (err) {
      addToast(err.message || t('common.error'), 'error');
    } finally {
      setSavingCharge(false);
    }
  }

  async function handleCancel(id) {
    setPromptData({ isOpen: true, tripId: id });
  }

  async function onConfirmCancel(reason) {
    try {
      await api.cancelTrip(promptData.tripId, { reason });
      setRefresh(r => r + 1);
    } catch (err) { addToast(err.message, 'error'); }
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
  }

  const sortPreset = useMemo(() => {
    if (sortBy === 'createdAt' && sortOrder === 'asc') return 'created_asc';
    if (sortBy === 'scheduledTime' && sortOrder === 'asc') return 'scheduled_asc';
    if (sortBy === 'scheduledTime' && sortOrder === 'desc') return 'scheduled_desc';
    if (sortBy === 'price' && sortOrder === 'asc') return 'price_asc';
    if (sortBy === 'price' && sortOrder === 'desc') return 'price_desc';
    if (sortBy === 'status' && sortOrder === 'asc') return 'status_asc';
    if (sortBy === 'status' && sortOrder === 'desc') return 'status_desc';
    if (sortBy === 'createdAt' && sortOrder === 'desc') return 'created_desc';
    return 'created_desc';
  }, [sortBy, sortOrder]);

  function clearFilters() {
    setQuery({ page: 1, status: '', search: '', startDate: '', endDate: '', sortBy: '', sortOrder: '' });
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);
      await downloadApiFile({
        endpoint: `/trips/export?${params.toString()}`,
        filename: `trips-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err?.message || t('common.error'), 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('trips.title')}</h1>
          <p className="page-subtitle">{t('trips.subtitle')}</p>
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? <span className="spinner" /> : <Download size={18} />} {t('common.export_csv')}
          </button>
          <button className="btn btn-primary" onClick={openCreate} disabled={openingCreate}>
            {openingCreate ? <span className="spinner" /> : null}
            {t('trips.assign_btn')}
          </button>
        </div>
      </div>

      <div className="card p-sm mb-md flex gap-sm" style={{ overflowX: 'auto' }}>
        {['', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setQuery({ status: s, page: 1 })}
          >
            {s ? t(`common.trip_status.${s.toLowerCase()}`) : t('trips.filter_all')}
          </button>
        ))}
      </div>

      <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
        <div className="grid grid-4 gap-md" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('common.search')}</label>
            <div className="flex items-center gap-sm">
              <Search size={16} className="text-muted" />
              <input
                className="form-input"
                value={search}
                onChange={(e) => setQuery({ search: e.target.value, page: 1 })}
                placeholder={t('common.search')}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.date_from')}</label>
            <input type="date" className="form-input" value={startDate} onChange={(e) => setQuery({ startDate: e.target.value, page: 1 })} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.date_to')}</label>
            <input type="date" className="form-input" value={endDate} onChange={(e) => setQuery({ endDate: e.target.value, page: 1 })} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('admin_expenses.filters.sort_by')}</label>
            <select
              className="form-select"
              value={sortPreset}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'created_asc') setQuery({ sortBy: 'createdAt', sortOrder: 'asc', page: 1 });
                else if (v === 'scheduled_asc') setQuery({ sortBy: 'scheduledTime', sortOrder: 'asc', page: 1 });
                else if (v === 'scheduled_desc') setQuery({ sortBy: 'scheduledTime', sortOrder: 'desc', page: 1 });
                else if (v === 'price_asc') setQuery({ sortBy: 'price', sortOrder: 'asc', page: 1 });
                else if (v === 'price_desc') setQuery({ sortBy: 'price', sortOrder: 'desc', page: 1 });
                else if (v === 'status_asc') setQuery({ sortBy: 'status', sortOrder: 'asc', page: 1 });
                else if (v === 'status_desc') setQuery({ sortBy: 'status', sortOrder: 'desc', page: 1 });
                else setQuery({ sortBy: 'createdAt', sortOrder: 'desc', page: 1 });
              }}
            >
              <option value="created_desc">{t('common.sort.newest')}</option>
              <option value="created_asc">{t('common.sort.oldest')}</option>
              <option value="scheduled_desc">{t('trips.modal.time_label')} (desc)</option>
              <option value="scheduled_asc">{t('trips.modal.time_label')} (asc)</option>
              <option value="price_desc">{t('common.sort.amount_desc')}</option>
              <option value="price_asc">{t('common.sort.amount_asc')}</option>
              <option value="status_desc">{t('common.sort.status_desc')}</option>
              <option value="status_asc">{t('common.sort.status_asc')}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-sm mt-md" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters} disabled={!(status || search || startDate || endDate || sortBy || sortOrder)}>
            {t('common.filters.clear')}
          </button>
        </div>
      </div>

      {!loading && (
        <div className="card mb-md" style={{ padding: '0.75rem var(--space-md)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trips.table.status')}</span>
              <span className="badge badge-neutral">{filterLabel}</span>
            </div>
            <span className="badge badge-info">{trips.length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <ListLoading />
      ) : loadError ? (
        <ListError message={loadError} onRetry={() => setRefresh((r) => r + 1)} onClearFilters={clearFilters} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('trips.table.driver')}</th>
                <th>{t('trips.table.pickup')}</th>
                <th>{t('trips.table.dropoff')}</th>
                <th>{t('trips.table.passengers')}</th>
                <th>{t('trips.table.price')}</th>
                <th>{t('trip.payment.cash')}</th>
                <th>{t('trips.table.status')}</th>
                <th>{t('trips.table.created')}</th>
                <th>{t('trips.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">{t('trips.table.empty')}</td></tr>
              ) : trips.map(t_obj => (
                <tr key={t_obj.id}>
                  <td style={{ fontWeight: 500 }}>{t_obj.driver?.name || '—'}</td>
                  <td><span className="flex items-center gap-sm"><MapPin size={14} /> {t_obj.pickupLocation}</span></td>
                  <td>{t_obj.dropoffLocation}</td>
                  <td>
                    {t_obj.passengers && t_obj.passengers.length > 0 ? (
                      <span className="badge badge-neutral">{t_obj.passengers.length}</span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td><span className="flex items-center gap-sm"><DollarSign size={14} /> {t_obj.price} {t('common.currency')}</span></td>
                  <td>
                    {String(t_obj.paymentMethod || '').toUpperCase() === 'CASH' ? (
                      <div className="flex flex-col" style={{ gap: 2 }}>
                        <span className={t_obj.cashCollectedAt ? 'badge badge-success' : 'badge badge-danger'} style={{ width: 'fit-content' }}>
                          {t_obj.cashCollectedAt ? formatDate(t_obj.cashCollectedAt) : '—'}
                        </span>
                        {t_obj.cashCollectedNote ? (
                          <span className="text-xs text-muted" title={String(t_obj.cashCollectedNote)} style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t('trip.payment.cash_collected_note')}: {String(t_obj.cashCollectedNote)}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-status ${STATUS_BADGES[t_obj.status] ?? STATUS_BADGES.DEFAULT}`}>
                      {t(`common.trip_status.${t_obj.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="text-muted text-sm">{formatDate(t_obj.createdAt)}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => openTripDetails(t_obj)} title={t('common.view')} disabled={selectedTripLoadingId === t_obj.id}>
                        {selectedTripLoadingId === t_obj.id ? <span className="spinner" /> : <Eye size={16} />}
                      </button>
                      {(t_obj.status === 'ASSIGNED' || t_obj.status === 'IN_PROGRESS') && (
                        <button className="btn-icon text-danger" onClick={() => handleCancel(t_obj.id)} title={t('common.cancel')}>
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onPageChange={(p) => setQuery({ page: p })}
        pageSize={limit}
        onPageSizeChange={(size) => setQuery({ limit: size, page: 1 })}
      />

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('trips.modal.assign_title')}</h2>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="modal-body">
                <div className="form-section mb-md">
                <div className="card p-md mb-md" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                    <div className="flex items-start justify-between" style={{ gap: 'var(--space-md)', marginBottom: '0.75rem' }}>
                      <div>
                      <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trips.modal.assignment_charge_title')}</div>
                      <div className="text-sm" style={{ fontWeight: 650 }}>
                        {assignmentCharge.toFixed(2)} {t('common.currency')}
                        <span className="text-xs text-muted" style={{ marginInlineStart: '0.5rem' }}>{t('trips.modal.assignment_charge_deducted_hint')}</span>
                      </div>
                    </div>
                     <button
                       type="button"
                       className="btn btn-secondary btn-sm"
                       disabled={savingCharge}
                       onClick={() => setConfirmSaveChargeOpen(true)}
                     >
                       <Save size={16} /> {t('common.save')}
                     </button>
                  </div>

                  <div className="grid grid-3 gap-md">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{t('trips.modal.assignment_charge_input_label', { unit: t('common.currency') })}</label>
                      <input
                        className="form-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={chargeDraft}
                        onChange={(e) => setChargeDraft(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{t('trips.modal.trip_price_input_label', { unit: t('common.currency') })}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={form.price}
                        onChange={e => { setForm({ ...form, price: e.target.value }); setError(''); }}
                        required
                        placeholder={t('common.amount_placeholder')}
                        min="0"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{t('trips.modal.net_to_driver_label', { unit: t('common.currency') })}</label>
                      <div className="form-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.95 }}>
                        <span style={{ fontWeight: 650 }}>
                          {(() => {
                            const parsed = Number(form.price);
                            if (!Number.isFinite(parsed)) return '—';
                            return (parsed - assignmentCharge).toFixed(2);
                          })()}
                        </span>
                        {(() => {
                          const parsed = Number(form.price);
                          if (!Number.isFinite(parsed)) return null;
                          return parsed - assignmentCharge < 0 ? (
                            <span className="text-xs text-danger" style={{ fontWeight: 650 }}>{t('trips.modal.price_lt_charge')}</span>
                          ) : (
                            <span className="text-xs text-muted">{t('trips.modal.after_charge_hint')}</span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group mb-md">
                  <label className="form-label">{t('trips.modal.driver_label')}</label>
                  <select
                    className="form-input"
                    value={form.driverId}
                    onChange={e => {
                      const value = e.target.value;
                      const selected = drivers.find(d => String(d.id) === String(value));
                      setForm({ ...form, driverId: value });
                      setSelectedDriverName(selected?.name || '');
                    }}
                    required
                  >
                    <option value="">{t('trips.modal.select_driver')}</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.identityVerified ? t('common.shift_verification_status.verified') : t('common.shift_verification_status.pending')})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-md">
                  <label className="form-label">{t('trip.payment.method')} *</label>
                  <select
                    className="form-input"
                    value={form.paymentMethod}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, paymentMethod: e.target.value }));
                      setError('');
                    }}
                    required
                    dir={i18n.dir()}
                    lang={i18n.language}
                  >
                    <option value="CASH">{t('trip.payment.cash')}</option>
                    <option value="E_WALLET">{t('trip.payment.ewallet')}</option>
                    <option value="E_PAYMENT">{t('trip.payment.epayment')}</option>
                  </select>
                </div>

                <div className="grid grid-2 gap-md mb-md">
                  <div className="form-group">
                    <label className="form-label">{t('trips.modal.pickup_label')}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        value={form.pickupLocation}
                        dir={i18n.dir()}
                        lang={i18n.language}
                        onChange={e => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            pickupLocation: value,
                            pickupLat: null,
                            pickupLng: null,
                          }));
                          setPickupSuggestOpen(true);
                          setError('');
                        }}
                        onFocus={() => {
                          setMapFocus('pickup');
                          setPickupSuggestOpen(true);
                        }}
                        onBlur={() => {
                          if (pickupBlurTimerRef.current) window.clearTimeout(pickupBlurTimerRef.current);
                          pickupBlurTimerRef.current = window.setTimeout(async () => {
                            setPickupSuggestOpen(false);
                            const q = String(form.pickupLocation || '').trim();
                            if (q.length < 3) return;
                            const results = await searchPlaces(q, i18n.language || 'en', 1);
                            if (results[0]) applyPlace('pickup', results[0], { setLabel: true });
                          }, 150);
                        }}
                        required
                        placeholder={t('trips.modal.pickup_placeholder')}
                        autoComplete="off"
                        style={{ padding: '0.85rem 0.9rem', fontSize: '1rem', lineHeight: 1.35, minHeight: 46 }}
                      />

                      {pickupSuggestOpen && (pickupSuggestLoading || pickupSuggestions.length > 0) && (
                        <div
                          dir={i18n.dir()}
                          style={{
                            position: 'absolute',
                            insetInlineStart: 0,
                            insetInlineEnd: 0,
                            top: 'calc(100% + 6px)',
                            zIndex: 50,
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            maxHeight: 220,
                            boxShadow: '0 12px 30px rgba(0,0,0,0.18)'
                          }}
                        >
                          {pickupSuggestLoading && (
                            <div className="text-sm text-muted" style={{ padding: '0.6rem 0.75rem' }}>
                              {t('common.loading')}
                            </div>
                          )}
                          {!pickupSuggestLoading && pickupSuggestions.map((s, idx) => (
                            <button
                              key={`${s.lat}:${s.lng}:${idx}`}
                              type="button"
                              className="btn"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (pickupBlurTimerRef.current) window.clearTimeout(pickupBlurTimerRef.current);
                                applyPlace('pickup', s, { setLabel: true });
                                setPickupSuggestOpen(false);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'start',
                                padding: '0.6rem 0.75rem',
                                borderRadius: 0,
                                background: 'transparent',
                                border: 'none',
                              }}
                            >
                              <div className="text-sm" style={{ fontWeight: 650 }}>{t('trips.table.pickup')}</div>
                              <div className="text-xs text-muted" style={{ marginTop: 4, lineHeight: 1.35 }}>{s.label}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('trips.modal.dropoff_label')}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        value={form.dropoffLocation}
                        dir={i18n.dir()}
                        lang={i18n.language}
                        onChange={e => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            dropoffLocation: value,
                            dropoffLat: null,
                            dropoffLng: null,
                          }));
                          setDropoffSuggestOpen(true);
                          setError('');
                        }}
                        onFocus={() => {
                          setMapFocus('dropoff');
                          setDropoffSuggestOpen(true);
                        }}
                        onBlur={() => {
                          if (dropoffBlurTimerRef.current) window.clearTimeout(dropoffBlurTimerRef.current);
                          dropoffBlurTimerRef.current = window.setTimeout(async () => {
                            setDropoffSuggestOpen(false);
                            const q = String(form.dropoffLocation || '').trim();
                            if (q.length < 3) return;
                            const results = await searchPlaces(q, i18n.language || 'en', 1);
                            if (results[0]) applyPlace('dropoff', results[0], { setLabel: true });
                          }, 150);
                        }}
                        required
                        placeholder={t('trips.modal.dropoff_placeholder')}
                        autoComplete="off"
                        style={{ padding: '0.85rem 0.9rem', fontSize: '1rem', lineHeight: 1.35, minHeight: 46 }}
                      />

                      {dropoffSuggestOpen && (dropoffSuggestLoading || dropoffSuggestions.length > 0) && (
                        <div
                          dir={i18n.dir()}
                          style={{
                            position: 'absolute',
                            insetInlineStart: 0,
                            insetInlineEnd: 0,
                            top: 'calc(100% + 6px)',
                            zIndex: 50,
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            maxHeight: 220,
                            boxShadow: '0 12px 30px rgba(0,0,0,0.18)'
                          }}
                        >
                          {dropoffSuggestLoading && (
                            <div className="text-sm text-muted" style={{ padding: '0.6rem 0.75rem' }}>
                              {t('common.loading')}
                            </div>
                          )}
                          {!dropoffSuggestLoading && dropoffSuggestions.map((s, idx) => (
                            <button
                              key={`${s.lat}:${s.lng}:${idx}`}
                              type="button"
                              className="btn"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (dropoffBlurTimerRef.current) window.clearTimeout(dropoffBlurTimerRef.current);
                                applyPlace('dropoff', s, { setLabel: true });
                                setDropoffSuggestOpen(false);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'start',
                                padding: '0.6rem 0.75rem',
                                borderRadius: 0,
                                background: 'transparent',
                                border: 'none',
                              }}
                            >
                              <div className="text-sm" style={{ fontWeight: 650 }}>{t('trips.table.dropoff')}</div>
                              <div className="text-xs text-muted" style={{ marginTop: 4, lineHeight: 1.35 }}>{s.label}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                 <div className="card mb-md" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                    <div className="flex gap-sm">
                      <button type="button" className={`btn btn-sm ${mapSelectionMode === 'pickup' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMapSelectionMode('pickup')}>
                        {t('trips.table.pickup')}
                      </button>
                      <button type="button" className={`btn btn-sm ${mapSelectionMode === 'dropoff' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMapSelectionMode('dropoff')}>
                        {t('trips.table.dropoff')}
                      </button>
                    </div>
                    <div className="text-xs text-muted" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="badge badge-neutral">
                        {form.pickupLat != null && form.pickupLng != null
                          ? t('trips.modal.pin_status_pinned', { label: t('trips.table.pickup') })
                          : t('trips.modal.pin_status_not_pinned', { label: t('trips.table.pickup') })}
                      </span>
                      <span className="badge badge-neutral">
                        {form.dropoffLat != null && form.dropoffLng != null
                          ? t('trips.modal.pin_status_pinned', { label: t('trips.table.dropoff') })
                          : t('trips.modal.pin_status_not_pinned', { label: t('trips.table.dropoff') })}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 260, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapViewUpdater center={mapCenter} zoom={14} />
                        <TripMapClickHandler
                           selectionMode={mapSelectionMode}
                         onSelect={async (mode, lat, lng) => {
                           const address = await reverseGeocode(lat, lng, i18n.language);
                            if (mode === 'pickup') {
                              setForm((prev) => ({
                                ...prev,
                                pickupLat: lat,
                                pickupLng: lng,
                               pickupLocation: prev.pickupLocation?.trim()
                                 ? prev.pickupLocation
                                 : (address || t('trips.modal.pinned_pickup_fallback')),
                              }));
                              setMapFocus('pickup');
                            } else {
                              setForm((prev) => ({
                                ...prev,
                                dropoffLat: lat,
                                dropoffLng: lng,
                               dropoffLocation: prev.dropoffLocation?.trim()
                                 ? prev.dropoffLocation
                                 : (address || t('trips.modal.pinned_dropoff_fallback')),
                              }));
                              setMapFocus('dropoff');
                            }
                          }}
                          />
                      {form.pickupLat != null && form.pickupLng != null && (
                        <Marker position={[form.pickupLat, form.pickupLng]} icon={TRIP_MARKER_ICONS.pickup}>
                          <Popup>
                            <div style={{ fontWeight: 650, marginBottom: 4 }}>{t('trips.table.pickup')}</div>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>{form.pickupLocation || '—'}</div>
                          </Popup>
                        </Marker>
                      )}
                      {form.dropoffLat != null && form.dropoffLng != null && (
                        <Marker position={[form.dropoffLat, form.dropoffLng]} icon={TRIP_MARKER_ICONS.dropoff}>
                          <Popup>
                            <div style={{ fontWeight: 650, marginBottom: 4 }}>{t('trips.table.dropoff')}</div>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>{form.dropoffLocation || '—'}</div>
                          </Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('trips.modal.time_label')}</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={form.scheduledTime}
                    onChange={e => { setForm({ ...form, scheduledTime: e.target.value }); setError(''); }}
                    min={toLocalInputValue(new Date())}
                  />
                </div>
              </div>

              {/* Single Passenger Section */}
              <div className="form-section mb-md">
                <div className="flex justify-between items-center mb-md">
                  <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70">{t('trips.modal.passengers_label')}</h3>
                </div>

                <div className="grid grid-1 gap-sm">
                  <div className="card p-md" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                    <div className="grid grid-2 gap-sm">
                      <div className="form-group">
                        <input
                          className="form-input text-sm"
                          placeholder={t('trips.modal.name_ph')}
                          value={form.passengers[0]?.name || ''}
                          onChange={e => {
                            const newPassengers = [...form.passengers];
                            newPassengers[0] = { ...newPassengers[0], name: e.target.value };
                            setForm({ ...form, passengers: newPassengers });
                          }}
                          required
                          minLength={2}
                          maxLength={100}
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="tel"
                          className="form-input text-sm"
                          placeholder={t('trips.modal.phone_ph')}
                          value={form.passengers[0]?.phone || ''}
                          onChange={e => {
                            const newPassengers = [...form.passengers];
                            newPassengers[0] = { ...newPassengers[0], phone: e.target.value };
                            setForm({ ...form, passengers: newPassengers });
                          }}
                          pattern="^(?:\+201[0125]\d{8}|01[0125]\d{8})$"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ maxWidth: '180px' }}>
                        <label className="form-label">{t('trips.modal.companion_count_ph')}</label>
                        <input
                          type="number"
                          className="form-input text-sm"
                          placeholder={t('trips.modal.companion_count_ph')}
                          value={form.passengers[0]?.companionCount ?? 0}
                          min="0"
                          step="1"
                          onChange={e => {
                            const newPassengers = [...form.passengers];
                            newPassengers[0] = { ...newPassengers[0], companionCount: parseInt(e.target.value || '0', 10) };
                            setForm({ ...form, passengers: newPassengers });
                          }}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ maxWidth: '180px' }}>
                        <label className="form-label">{t('trips.modal.bags_ph')}</label>
                        <input
                          type="number"
                          className="form-input text-sm"
                          placeholder={t('trips.modal.bags_ph')}
                          value={form.passengers[0]?.bagCount ?? 0}
                          min="0"
                          step="1"
                          onChange={e => {
                            const newPassengers = [...form.passengers];
                            newPassengers[0] = { ...newPassengers[0], bagCount: parseInt(e.target.value || '0', 10) };
                            setForm({ ...form, passengers: newPassengers });
                          }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('trips.assign_btn')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTrip && (
        <div className="modal-overlay" onClick={closeSelectedTrip}>
          <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {t('trips.modal.details_title')}
                {selectedTripLoading && <span className="spinner" style={{ marginInlineStart: 10 }} />}
              </h2>
              <button className="btn-icon" onClick={closeSelectedTrip}>
                <XCircle size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="grid grid-2 gap-xl">
                <div className="form-section">
                  <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-md">{t('trips.modal.details_title')}</h3>
                  <div className="flex flex-col gap-md">
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.status')}</span>
                      <span className={`badge badge-status ${STATUS_BADGES[selectedTrip.status]}`}>{t(`common.trip_status.${selectedTrip.status.toLowerCase()}`)}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.table.driver')}</span>
                      <span className="font-medium">{selectedTrip.driver?.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.vehicle')}</span>
                      <span className="font-medium">{selectedTrip.vehicle?.plateNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.pickup')}</span>
                      <span className="font-medium">{selectedTrip.pickupLocation}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.dropoff')}</span>
                      <span className="font-medium">{selectedTrip.dropoffLocation}</span>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setMapDetails({ isOpen: true, trip: selectedTrip })}
                      >
                        <MapPin size={16} /> {t('trip.map_details')}
                      </button>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.price')}</span>
                      <span className="font-medium text-primary">{selectedTrip.price} {t('common.currency')}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trip.payment.method')}</span>
                      <span className="font-medium">
                        {(() => {
                          const method = String(selectedTrip.paymentMethod || 'CASH').toUpperCase();
                          if (method === 'CASH') return t('trip.payment.cash');
                          if (method === 'E_WALLET') return t('trip.payment.ewallet');
                          if (method === 'E_PAYMENT') return t('trip.payment.epayment');
                          return method;
                        })()}
                      </span>
                    </div>

                    {String(selectedTrip.paymentMethod || 'CASH').toUpperCase() === 'CASH' && (
                      <>
                        <div className="flex justify-between border-b border-subtle pb-xs">
                          <span className="text-muted text-sm">{t('trip.payment.cash_collected_at')}</span>
                          <span className="font-medium">{selectedTrip.cashCollectedAt ? formatDate(selectedTrip.cashCollectedAt) : '—'}</span>
                        </div>
                        <div className="flex justify-between border-b border-subtle pb-xs" style={{ gap: '0.75rem' }}>
                          <span className="text-muted text-sm">{t('trip.payment.cash_collected_note')}</span>
                          <span
                            className="font-medium"
                            style={{
                              maxWidth: '65%',
                              textAlign: 'end',
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere'
                            }}
                          >
                            {selectedTrip.cashCollectedNote ? String(selectedTrip.cashCollectedNote) : '—'}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.scheduled')}</span>
                      <span className="font-medium">{formatDate(selectedTrip.scheduledTime)}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.started')}</span>
                      <span className="font-medium">{formatDate(selectedTrip.actualStartTime)}</span>
                    </div>
                    <div className="flex justify-between border-b border-subtle pb-xs">
                      <span className="text-muted text-sm">{t('trips.details.ended')}</span>
                      <span className="font-medium">{formatDate(selectedTrip.actualEndTime)}</span>
                    </div>
                    {selectedTrip.cancellationReason && (
                      <div className="mt-md p-md rounded bg-danger-subtle border border-danger">
                        <span className="text-danger text-xs font-bold uppercase">{t('trips.details.cancel_reason')}</span>
                        <p className="mt-xs text-sm">{selectedTrip.cancellationReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-md">
                    {t('trips.modal.passengers_label')} ({selectedTrip.passengers?.length || 0})
                  </h3>
                  <div className="flex flex-col gap-sm">
                    {!selectedTrip.passengers || selectedTrip.passengers.length === 0 ? (
                      <p className="text-sm text-muted italic">{t('trips.modal.no_passengers')}</p>
                    ) : selectedTrip.passengers.map((p, idx) => (
                      <div key={idx} className="card p-md" style={{ background: 'var(--color-bg-subtle)' }}>
                        <div className="font-semibold text-primary mb-xs">{p.name}</div>
                        <div className="grid grid-2 gap-x-md gap-y-xs">
                          {p.phone && (
                            <div className="text-xs">
                              <span className="text-muted">{t('drivers.table.phone')}:</span>{' '}
                              <span className="font-medium">{p.phone}</span>{' '}
                              <WhatsAppLink
                                phone={p.phone}
                                title={t('trip.contact_whatsapp')}
                                size={18}
                                className="text-success"
                              />
                            </div>
                          )}
                          <div className="text-xs">
                            <span className="text-muted">{t('trips.modal.companion_count_ph')}:</span> <span className="font-medium">{p.companionCount ?? 0}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted">{t('trips.modal.bags_ph')}:</span> <span className="font-medium">{p.bagCount ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeSelectedTrip}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <PromptModal
        isOpen={promptData.isOpen}
        onClose={() => setPromptData({ isOpen: false, tripId: null })}
        onConfirm={onConfirmCancel}
        title={t('common.cancel')}
        message={t('trips.messages.cancel_prompt')}
        placeholder={t('trips.modal.reason_placeholder')}
      />

      <ConfirmModal
        isOpen={confirmSaveChargeOpen}
        onClose={() => setConfirmSaveChargeOpen(false)}
        onConfirm={saveAssignmentCharge}
        title={t('trips.messages.save_charge_confirm_title')}
        message={t('trips.messages.save_charge_confirm_message')}
        confirmText={t('common.save')}
        variant="primary"
      />

      <ConfirmModal
        isOpen={confirmAssignOpen}
        onClose={() => setConfirmAssignOpen(false)}
        onConfirm={submitAssignTrip}
        title={t('trips.assign_btn')}
        message={t('trips.messages.assign_confirm_message')}
        confirmText={t('trips.assign_btn')}
        variant="primary"
      />

      {mapDetails.isOpen && mapDetails.trip && (() => {
        const pickupLat = toCoord(mapDetails.trip.pickupLat);
        const pickupLng = toCoord(mapDetails.trip.pickupLng);
        const dropoffLat = toCoord(mapDetails.trip.dropoffLat);
        const dropoffLng = toCoord(mapDetails.trip.dropoffLng);

        const pickup = pickupLat != null && pickupLng != null ? [pickupLat, pickupLng] : null;
        const dropoff = dropoffLat != null && dropoffLng != null ? [dropoffLat, dropoffLng] : null;

        if (!pickup && !dropoff) {
          return (
            <div className="modal-overlay" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
              <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2 className="modal-title">{t('trip.map_details')}</h2>
                  <button className="btn-icon" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-body">
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    {t('trip.location_not_available')}
                  </p>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const center = pickup || dropoff;
        const polyline = [pickup, dropoff].filter(Boolean);

        return (
          <div className="modal-overlay" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
            <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{t('trip.map_details')}</h2>
                <button className="btn-icon" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div style={{ height: 520, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {polyline.length >= 2 && (
                      <Polyline positions={polyline} pathOptions={{ color: '#64748b', weight: 4, opacity: 0.9 }} />
                    )}
                    {pickup && (
                      <Marker position={pickup} icon={TRIP_MARKER_ICONS.pickup}>
                        <Popup>
                          <div style={{ fontWeight: 650, marginBottom: 4 }}>{t('trips.details.pickup')}</div>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>{mapDetails.trip.pickupLocation || '—'}</div>
                        </Popup>
                      </Marker>
                    )}
                    {dropoff && (
                      <Marker position={dropoff} icon={TRIP_MARKER_ICONS.dropoff}>
                        <Popup>
                          <div style={{ fontWeight: 650, marginBottom: 4 }}>{t('trips.details.dropoff')}</div>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>{mapDetails.trip.dropoffLocation || '—'}</div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>

                <div className="grid grid-2 gap-md" style={{ marginTop: 'var(--space-md)' }}>
                  <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                    <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trips.details.pickup')}</div>
                    <div className="text-sm" style={{ fontWeight: 650, marginTop: 6 }}>{mapDetails.trip.pickupLocation || '—'}</div>
                  </div>
                  <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--color-border)' }}>
                    <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.08em' }}>{t('trips.details.dropoff')}</div>
                    <div className="text-sm" style={{ fontWeight: 650, marginTop: 6 }}>{mapDetails.trip.dropoffLocation || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setMapDetails({ isOpen: false, trip: null })}>
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
