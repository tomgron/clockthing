const fs = require('fs');
const path = require('path');
const { sanitizeSettings } = require('./settingsValidation');

const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  color: '#cc2222',
  dialColor: '#e0f2fe'
});

function getConfigPath(app) {
  return path.join(app.getPath('userData'), 'config.json');
}

async function readSettings(app) {
  const configPath = getConfigPath(app);

  try {
    const data = await fs.promises.readFile(configPath, 'utf8');
    return sanitizeSettings(JSON.parse(data));
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.error('Failed to load settings:', error);
    }

    return { ...DEFAULT_SETTINGS };
  }
}

async function writeSettings(app, settings) {
  const configPath = getConfigPath(app);
  const normalized = sanitizeSettings(settings);

  try {
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, JSON.stringify(normalized, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }

  return normalized;
}

module.exports = {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings
};