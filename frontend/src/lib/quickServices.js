/**
 * Home quick-service tiles (settings.app.quickServices) — one source of truth for the app home and the
 * admin editor/preview. Built-in types are shown only while one of their feature flags is on.
 */
export const SERVICE_TYPES = [
  { value: 'stays', label: 'Stays', link: '/search', icon: 'bed-double', features: ['hotels'] },
  { value: 'buses', label: 'Buses', link: '/bus', icon: 'bus', features: ['buses'] },
  { value: 'flights', label: 'Flights', link: '/flights', icon: 'plane', features: ['flights'] },
  { value: 'ai', label: 'AI assistant', link: '/ai', icon: 'sparkles', features: ['aiAssistant', 'aiTripPlanner'] },
  { value: 'custom', label: 'Custom link', link: '', icon: 'compass', features: [] },
];

export const serviceType = (key) => SERVICE_TYPES.find((x) => x.value === key) || SERVICE_TYPES[SERVICE_TYPES.length - 1];

/** false when the tile's service is switched off in App features */
export const serviceOn = (t, feature) => {
  const f = serviceType(t.key).features;
  return !f.length || f.some((k) => feature(k));
};

/** Empty label → AI assistant's first name for the AI tile, the type name for built-ins, "Explore" for custom links */
export const tileLabel = (t, aiName) => t.label?.trim() || (t.key === 'ai' ? aiName?.split(' ')[0] || 'AI' : t.key && t.key !== 'custom' ? serviceType(t.key).label : 'Explore');

/** The tiles guests actually see, in order */
export const visibleServices = (list, feature, aiName) =>
  (list || []).filter((t) => t.enabled !== false && t.link && serviceOn(t, feature)).map((t) => ({ ...t, label: tileLabel(t, aiName) }));
