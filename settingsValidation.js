const ALLOWED_THEMES = new Set(['light', 'dark']);
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

function normalizeTheme(theme) {
  return ALLOWED_THEMES.has(theme) ? theme : 'dark';
}

function normalizeColor(color, fallback) {
  return HEX_COLOR_REGEX.test(color) ? color : fallback;
}

function sanitizeSettings(settings) {
  const safe = settings && typeof settings === 'object' ? settings : {};

  return {
    theme: normalizeTheme(safe.theme),
    color: normalizeColor(safe.color, '#cc2222'),
    dialColor: normalizeColor(safe.dialColor, '#e0f2fe')
  };
}

module.exports = {
  sanitizeSettings,
  normalizeTheme,
  normalizeColor
};
