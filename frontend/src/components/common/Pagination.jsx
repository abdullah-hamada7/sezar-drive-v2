import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

function clamp(n, min, max) {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  return Math.min(Math.max(num, min), max);
}

function buildPageWindow({ page, totalPages, maxButtons }) {
  const safeTotal = Math.max(Number(totalPages) || 1, 1);
  const safePage = clamp(page, 1, safeTotal);
  const max = Math.max(Number(maxButtons) || 7, 5);

  const half = Math.floor(max / 2);
  let start = safePage - half;
  let end = safePage + half;

  if (start < 1) {
    end += 1 - start;
    start = 1;
  }
  if (end > safeTotal) {
    start -= end - safeTotal;
    end = safeTotal;
  }
  start = Math.max(start, 1);

  const pages = [];
  for (let p = start; p <= end; p += 1) pages.push(p);
  return pages;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 15, 25, 50],
  onPageSizeChange,
  maxButtons = 7,
  className = '',
}) {
  const { t } = useTranslation();
  const safeTotal = Math.max(Number(totalPages) || 1, 1);
  const safePage = clamp(page, 1, safeTotal);
  const [jumpDraft, setJumpDraft] = useState(String(safePage));

  const pages = useMemo(() => buildPageWindow({ page: safePage, totalPages: safeTotal, maxButtons }), [safePage, safeTotal, maxButtons]);

  if (!safeTotal || safeTotal <= 1) return null;

  const canPrev = safePage > 1;
  const canNext = safePage < safeTotal;

  return (
    <div className={`pagination pagination-advanced ${className}`.trim()}>
      <button type="button" onClick={() => onPageChange?.(safePage - 1)} disabled={!canPrev}>
        {t('common.pagination.prev')}
      </button>

      {pages[0] > 1 && (
        <>
          <button type="button" onClick={() => onPageChange?.(1)} className={safePage === 1 ? 'active' : ''}>
            1
          </button>
          {pages[0] > 2 && <span className="pagination-ellipsis">...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={p === safePage ? 'active' : ''}
          onClick={() => onPageChange?.(p)}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < safeTotal && (
        <>
          {pages[pages.length - 1] < safeTotal - 1 && <span className="pagination-ellipsis">...</span>}
          <button
            type="button"
            onClick={() => onPageChange?.(safeTotal)}
            className={safePage === safeTotal ? 'active' : ''}
          >
            {safeTotal}
          </button>
        </>
      )}

      <button type="button" onClick={() => onPageChange?.(safePage + 1)} disabled={!canNext}>
        {t('common.pagination.next')}
      </button>

      <span className="pagination-info text-sm text-muted">
        {t('common.pagination.info', { current: safePage, total: safeTotal })}
      </span>

      {typeof onPageSizeChange === 'function' && (
        <label className="pagination-size text-sm">
          <span className="text-muted">{t('common.pagination.page_size')}</span>
          <select
            className="form-select pagination-select"
            value={Number(pageSize) || ''}
            onChange={(e) => onPageSizeChange(Number(e.target.value) || undefined)}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      )}

      <form
        className="pagination-jump"
        onSubmit={(e) => {
          e.preventDefault();
          const next = clamp(jumpDraft, 1, safeTotal);
          setJumpDraft(String(next));
          onPageChange?.(next);
        }}
      >
        <span className="text-muted text-sm">{t('common.pagination.jump_to')}</span>
        <input
          className="form-input pagination-input"
          type="number"
          min={1}
          max={safeTotal}
          value={jumpDraft}
          onChange={(e) => setJumpDraft(e.target.value)}
          style={{ width: 90 }}
        />
        <button type="submit">{t('common.pagination.go')}</button>
      </form>
    </div>
  );
}
