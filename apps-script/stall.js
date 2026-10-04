/**
 * Public stall info for the customer menu: live stall location, call / WhatsApp numbers and Porter
 * delivery. Partners (e.g. Ishan at the stall) update it from the PWA; customers read it without signing in.
 *
 * Everything returned by getPublicInfo is deliberately public — no partner names, emails or money.
 */
const STALL_KEYS = { location: 'stall_location', phone: 'public_phone', whatsapp: 'public_whatsapp', delivery: 'delivery' };

function readJsonSetting_(key, fallback) {
  try { return JSON.parse(getSetting_(key, '') || 'null') || fallback; } catch (e) { return fallback; }
}

/** Indian mobile → "+91XXXXXXXXXX". Accepts 98xxxxxxxx, 098…, 91…, +91 98… with spaces/dashes. '' clears. */
function normalizeIndianMobile_(v, field) {
  const raw = String(v === undefined || v === null ? '' : v).trim();
  if (!raw) return '';
  let d = raw.replace(/[\s\-().]/g, '');
  if (/[^+\d]/.test(d)) throw new Error(field + ' can contain only digits, spaces and +.');
  d = d.replace(/^\+/, '');
  if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
  else if (d.length === 11 && d[0] === '0') d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) throw new Error(field + ' must be a valid 10-digit Indian mobile number.');
  return '+91' + d;
}

function publicInfo_() {
  const loc = readJsonSetting_(STALL_KEYS.location, null);
  const delivery = readJsonSetting_(STALL_KEYS.delivery, { enabled: false, note: '' });
  return {
    location: loc ? { lat: loc.lat, lng: loc.lng, label: loc.label || '', updated_at: loc.updated_at } : null,
    phone: getSetting_(STALL_KEYS.phone, '') || '',
    whatsapp: getSetting_(STALL_KEYS.whatsapp, '') || '',
    delivery: { enabled: !!delivery.enabled, note: delivery.note || '' },
  };
}

/** PUBLIC. Cached like the menu so the unauthenticated endpoint can't drain the quota. */
function getPublicInfo() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('public_info');
  if (hit) return JSON.parse(hit);
  const info = publicInfo_();
  cache.put('public_info', JSON.stringify(info), 600);
  return info;
}
function clearPublicInfoCache_() { CacheService.getScriptCache().remove('public_info'); }

/** For the app's Stall & Contact page: same data plus who changed the location and its GPS accuracy. */
function getStallInfo() {
  const loc = readJsonSetting_(STALL_KEYS.location, null);
  return Object.assign(publicInfo_(), { location_detail: loc });
}

/** One-tap "we're here": p = {lat, lng, accuracy, label}. */
function setStallLocation(user, p) {
  const lat = num_(p.lat, 'Latitude', { max: 90 });
  const lng = num_(p.lng, 'Longitude', { max: 180 });
  if (lat < -90 || lng < -180) throw new Error('Invalid coordinates.');
  const accuracy = p.accuracy === undefined || p.accuracy === null || p.accuracy === '' ? null : num_(p.accuracy, 'Accuracy', { max: 100000 });
  if (accuracy !== null && accuracy > 2000) throw new Error('GPS accuracy is too low (' + Math.round(accuracy) + ' m). Move to open sky and try again.');
  const before = readJsonSetting_(STALL_KEYS.location, null);
  const loc = {
    lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6,
    accuracy: accuracy === null ? null : Math.round(accuracy),
    label: str_(p.label, 'Location note').slice(0, 120),
    updated_at: nowIso_(), updated_by: user.email,
  };
  setSetting_(STALL_KEYS.location, JSON.stringify(loc), user);
  clearPublicInfoCache_();
  audit_(user, 'SET_STALL_LOCATION', 'SETTINGS', STALL_KEYS.location, before, loc);
  return getStallInfo();
}

/** p = {phone, whatsapp, delivery_enabled, delivery_note} — numbers shown publicly on the menu. */
function setContact(user, p) {
  const phone = normalizeIndianMobile_(p.phone, 'Call number');
  const whatsapp = normalizeIndianMobile_(p.whatsapp, 'WhatsApp number');
  const delivery = { enabled: p.delivery_enabled === true, note: str_(p.delivery_note, 'Delivery note').slice(0, 200) };
  if (delivery.enabled && !phone && !whatsapp) throw new Error('Add a call or WhatsApp number before turning on Porter delivery.');
  const before = publicInfo_();
  setSetting_(STALL_KEYS.phone, phone, user);
  setSetting_(STALL_KEYS.whatsapp, whatsapp, user);
  setSetting_(STALL_KEYS.delivery, JSON.stringify(delivery), user);
  clearPublicInfoCache_();
  audit_(user, 'SET_PUBLIC_CONTACT', 'SETTINGS', 'public_contact',
    { phone: before.phone, whatsapp: before.whatsapp, delivery: before.delivery }, { phone: phone, whatsapp: whatsapp, delivery: delivery });
  return getStallInfo();
}
