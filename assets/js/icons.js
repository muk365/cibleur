/**
 * Custom Geometric SVG Icon Library for Cibleur Prédictif (Marché Caché × OETH).
 */
export const Icons = {
  radar: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9.5" opacity="0.28"/>
      <circle cx="12" cy="12" r="5.5" opacity="0.55"/>
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>
      <path d="M12 12L18.5 5.5"/>
      <path d="M12 2.5A9.5 9.5 0 0 1 21.5 12" stroke="url(#grad-cyan)" stroke-width="2.2"/>
    </svg>`,

  sparkleTarget: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3"/>
      <circle cx="12" cy="12" r="6" opacity="0.35"/>
      <path d="M12 8.5L13.2 11l2.3 1-2.3 1-1.2 2.5-1.2-2.5L8.5 12l2.3-1L12 8.5Z" fill="currentColor" stroke="none"/>
    </svg>`,

  buildingOeth: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="3" width="11" height="18" rx="2"/>
      <path d="M15 9h3a2 2 0 0 1 2 2v10h-5"/>
      <path d="M8 7h3M8 11h3M8 15h3" opacity="0.7"/>
      <circle cx="17.5" cy="5.5" r="2.5" fill="currentColor" stroke="none" opacity="0.85"/>
    </svg>`,

  globeCheck: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="12" r="8.5"/>
      <path d="M2.8 12h16.4M11 3.5a12.5 12.5 0 0 1 0 17M11 3.5a12.5 12.5 0 0 0 0 17" opacity="0.5"/>
      <circle cx="18.5" cy="17.5" r="4" fill="var(--bg-surface, #0f172a)" stroke="currentColor"/>
      <path d="M16.8 17.5l1.2 1.2 2.4-2.4"/>
    </svg>`,

  euroShield: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2.5l7.5 3v6c0 5-3.3 8.8-7.5 10-4.2-1.2-7.5-5-7.5-10v-6l7.5-3Z"/>
      <path d="M14.5 9.2a3.2 3.2 0 1 0 0 5.6M8.5 11.2h4.2M8.5 13.2h3.5"/>
    </svg>`,

  flameSignal: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.5 2.5c.4 3.2-2.2 4.8-2.2 7.2 0 1.4 1 2.5 2.3 2.5 1.8 0 2.7-1.6 2.5-3.4 2.5 1.7 3.9 4.2 3.9 6.8a7 7 0 1 1-14 0c0-3.8 2.8-7.4 7.5-13.1Z"/>
    </svg>`,

  leaderUser: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="3.6"/>
      <path d="M5 19.5c.8-3.3 3.5-5 7-5s6.2 1.7 7 5"/>
      <path d="M9 3.2l3 1.4 3-1.4" opacity="0.65"/>
    </svg>`,

  mapPin: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 1 1 13 0c0 5.2-6.5 11-6.5 11Z"/>
      <circle cx="12" cy="10" r="2.2"/>
    </svg>`,

  briefcase: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2.5"/>
      <path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2"/>
      <path d="M3 12.5h18" opacity="0.5"/>
    </svg>`,

  leafRse: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19.5 4.5C12 4.5 6 8.5 6 15.5c0 1.4.4 2.8 1.2 3.8 1 .8 2.4 1.2 3.8 1.2 7 0 11-6 11-13.5V4.5h-2.5Z"/>
      <path d="M6 19.5c2.5-3.5 5.5-6.5 10-9"/>
    </svg>`,

  mailSpark: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5"/>
      <path d="M4 7l8 5.5L20 7"/>
    </svg>`,

  bookmark: (cls = 'icon', filled = false) => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5v16l-6-3.8-6 3.8v-16Z"/>
    </svg>`,

  sliders: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/>
      <circle cx="15" cy="7" r="2"/>
      <circle cx="9" cy="12" r="2"/>
      <circle cx="17" cy="17" r="2"/>
    </svg>`,

  download: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5"/>
      <path d="M4 17.5v1A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-1"/>
    </svg>`,

  external: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 4h6v6M20 4L10 14"/>
      <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>
    </svg>`,

  grid: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/>
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/>
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/>
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>
    </svg>`,

  table: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <path d="M3 9.5h18M9 9.5V20M3 14.5h18"/>
    </svg>`,

  map: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3.5 6.5L9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20V6.5Z"/>
      <path d="M9 4v13.5M15 6.5V20" opacity="0.65"/>
    </svg>`,

  sun: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
    </svg>`,

  moon: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>
    </svg>`,

  copy: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2"/>
      <path d="M5 15H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 3h9A1.5 1.5 0 0 1 14.5 4.5V6"/>
    </svg>`,

  kanban: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="5" height="15" rx="1.5"/>
      <rect x="9.5" y="4" width="5" height="10" rx="1.5"/>
      <rect x="16" y="4" width="5" height="13" rx="1.5"/>
    </svg>`,

  close: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>`,

  check: (cls = 'icon') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5"/>
    </svg>`,
};
