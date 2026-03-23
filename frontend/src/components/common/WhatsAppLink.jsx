import React from 'react';

function normalizeWhatsAppPhone(phone) {
  if (!phone) return null;
  const raw = String(phone).trim();
  if (!raw) return null;

  // Keep digits and leading + only.
  const cleaned = raw.replace(/[\s\-().]/g, '');
  const digits = cleaned.replace(/[^\d+]/g, '');

  let v = digits;

  // Egypt: 01XXXXXXXXX -> 20 + 1XXXXXXXXX
  if (v.startsWith('01')) v = `20${v.slice(1)}`;
  if (v.startsWith('+20')) v = v.slice(1);
  if (v.startsWith('+')) v = v.slice(1);

  // WhatsApp expects digits only.
  v = v.replace(/\D/g, '');
  return v || null;
}

function WhatsAppIcon({ size = 18 }) {
  const s = Number(size) || 18;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M19.11 17.43c-.28-.14-1.64-.81-1.9-.9-.25-.09-.44-.14-.62.14-.19.28-.71.9-.87 1.09-.16.19-.32.21-.6.07-.28-.14-1.18-.43-2.25-1.38-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.44.12-.58.12-.12.28-.32.41-.48.14-.16.19-.28.28-.46.09-.19.05-.35-.02-.5-.07-.14-.62-1.5-.85-2.05-.22-.53-.45-.46-.62-.47l-.53-.01c-.19 0-.5.07-.76.35-.25.28-.97.95-.97 2.32 0 1.37.99 2.69 1.13 2.88.14.19 1.95 2.98 4.72 4.18.66.28 1.18.45 1.58.58.66.21 1.26.18 1.73.11.53-.08 1.64-.67 1.87-1.32.23-.65.23-1.21.16-1.32-.07-.12-.25-.19-.53-.33z" />
      <path d="M16 3C8.83 3 3 8.83 3 16c0 2.29.6 4.52 1.75 6.49L3 29l6.68-1.7A12.9 12.9 0 0 0 16 29c7.17 0 13-5.83 13-13S23.17 3 16 3zm0 23.57c-2.02 0-3.99-.54-5.69-1.55l-.41-.24-3.96 1.01 1.06-3.86-.27-.4A10.57 10.57 0 1 1 26.57 16 10.58 10.58 0 0 1 16 26.57z" />
    </svg>
  );
}

export default function WhatsAppLink({ phone, message, size = 18, className = '', title = 'WhatsApp' }) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;

  const text = message ? String(message) : '';
  const url = text
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${normalized}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={className}
      title={title}
      aria-label={title}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <WhatsAppIcon size={size} />
    </a>
  );
}
