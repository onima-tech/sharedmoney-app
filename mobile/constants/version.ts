/**
 * Version Constants
 *
 * Exports the app version from version.json for use in API headers.
 */

// Import version data directly - this is bundled at build time
const versionData = require('../version.json');

export const APP_VERSION: string = versionData.version;
