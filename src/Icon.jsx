const paths = {
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  external: <><path d="M7 17 17 7M7 7h10v10" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  document: <><path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h6" /></>,
  calculator: <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M8 7h8M8 12h1M15 12h1M8 16h1M15 16h1" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 6" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V3h8v4M3 12c6 4 12 4 18 0M12 12v4" /></>,
  chat: <><path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z" /><path d="M8 9h8M8 13h5" /></>,
  bell: <><path d="M5 17h14l-2-4V9A5 5 0 0 0 7 9v4ZM10 21h4M12 2v2" /></>,
  play: <><rect x="3" y="4" width="18" height="16" rx="4" /><path d="m10 8 6 4-6 4Z" /></>,
  layers: <><path d="m12 3 10 5-10 5L2 8ZM2 12l10 5 10-5M2 16l10 5 10-5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  phone: <path d="m7 3 3 5-3 3a15 15 0 0 0 6 6l3-3 5 3c0 3-2 5-5 4A23 23 0 0 1 3 8C2 5 4 3 7 3Z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>
};

export default function Icon({ name, size = 24, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] || paths.document}</svg>;
}
