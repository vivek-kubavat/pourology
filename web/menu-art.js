// Line icons for the customer menu, drawn in code (the photos are in web/img).
const ico = (d) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const STEAM = '<path d="M14 4c-3 4 3 6 0 11M21 4c-3 4 3 6 0 11M28 4c-3 4 3 6 0 11"/>';
export const ICON = {
  dripper: ico('<path d="M5 9h38l-9 21H14z"/><path d="M9 17h30M12 24h24"/><path d="M11 35h26M17 35v6h14v-6"/>'),
  cup: ico(`${STEAM}<path d="M7 21h28v8a12 12 0 0 1-12 12h-4A12 12 0 0 1 7 29z"/><path d="M35 24h3a5 5 0 0 1 0 10h-4"/><path d="M4 45h36"/>`),
  atom: ico('<ellipse cx="24" cy="24" rx="20" ry="8"/><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(60 24 24)"/><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(120 24 24)"/><circle cx="24" cy="24" r="2.6" fill="currentColor"/>'),
  straw: ico('<path d="M9 17h30M11 17l3 28h20l3-28"/><path d="M12.500 28h23"/><path d="M22 17 26 3h8"/>'),
  sliders: ico('<path d="M5 12h20M33 12h10M5 24h6M19 24h24M5 36h22M35 36h8"/><circle cx="29" cy="12" r="4"/><circle cx="15" cy="24" r="4"/><circle cx="31" cy="36" r="4"/>'),
};

// ---------- footer line icons ----------
const line = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const LINE = {
  phone: line('<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.500h3"/>'),
  wa: line('<path d="M3.5 20.500l1.3-4.600A8.5 8.5 0 1 1 8.2 19.300z"/><path d="M9 8.300c-.5 2.6 3.2 6.4 6 6.200l1-1.3-1.8-1.2-1 .7c-.9-.4-1.9-1.4-2.3-2.300l.7-1L10.4 7.600z"/>'),
  scooter: line('<circle cx="5.5" cy="17" r="2.5"/><circle cx="18.5" cy="17" r="2.5"/><path d="M8 17h8l-2-9h-2.500M14.7 11H19l1.5 3.500M3 13.500h6.500l1 3.500M4 10.500h5v3"/><circle cx="16.5" cy="5" r="1.5"/>'),
};
