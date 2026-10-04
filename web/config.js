// Fill these in after deploying (see README → Setup). Both values are public identifiers, not secrets.
const PROD = {
  // Apps Script → Deploy → New deployment → Web app → URL ending in /exec
  API_URL: 'https://script.google.com/macros/s/AKfycbxmk2B_RCLV5QMcMZAsmJ6Snmlh1b7Bu8KFhS9U5sMDneNkXZbvqITPUW8zA1XuY2Ir2w/exec',
  // Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application)
  GOOGLE_CLIENT_ID: '476675116670-msm51po7jnjf44puc9petdg9i7iuignc.apps.googleusercontent.com',
};

// `npm run dev` serves the app on localhost with the real backend code over in-memory sheets
// and a "sign in as…" picker. Dev tokens are only accepted by that local server, never by Apps Script.
const DEV = ['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '5173';

export const CONFIG = DEV ? { ...PROD, API_URL: '/api', DEV: true } : { ...PROD, DEV: false };
