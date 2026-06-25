import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ToastContext } from '../contexts/toastContext';

export function useAdminTable({ defaultLimit = 15, defaultStatus = '' } = {}) {
  const { t } = useTranslation();
  const { addToast } = useContext(ToastContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), [searchParams]);
  const limit = useMemo(() => {
    const n = parseInt(searchParams.get('limit') || String(defaultLimit), 10) || defaultLimit;
    return Math.min(Math.max(n, 5), 100);
  }, [searchParams, defaultLimit]);
  const search = useMemo(() => String(searchParams.get('search') || ''), [searchParams]);
  const statusFilter = useMemo(() => String(searchParams.get('status') || defaultStatus), [searchParams, defaultStatus]);

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || v === false) next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const buildParams = useCallback((extra) => {
    const params = new URLSearchParams({ page, limit, ...extra });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [page, limit, search, statusFilter]);

  const createLoadFn = useCallback((apiCall, onSuccess) => {
    return async (extraParams = {}) => {
      setLoading(true);
      setLoadError('');
      try {
        const params = buildParams(extraParams);
        const res = await apiCall(params);
        const data = res.data || res;
        setItems(data.items || data.shifts || data.trips || data.vehicles || data.drivers || data.expenses || data.damageReports || data.violations || data.admins || data.auditLogs || []);
        setPagination(data || {});
        if (onSuccess) onSuccess(data);
      } catch (err) {
        console.error(err);
        const msg = err?.message || t('common.error');
        setLoadError(msg);
        addToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    };
  }, [buildParams, addToast, t]);

  const clearFilters = useCallback((defaults = {}) => {
    setQuery({ search: '', status: defaultStatus, page: 1, ...defaults });
  }, [setQuery, defaultStatus]);

  return {
    page, limit, search, statusFilter,
    items, pagination, loading, loadError,
    setItems, setPagination, setLoading, setLoadError,
    setQuery, buildParams, createLoadFn, clearFilters, t, addToast,
  };
}
