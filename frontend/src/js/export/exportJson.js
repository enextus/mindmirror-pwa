// =====================================================================
// src/js/export/exportJson.js – JSON export helpers and browser downloads
// =====================================================================

/**
 * @typedef {ReturnType<typeof import('../core/profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
 * @typedef {import('../core/lifeSimulationEngine.js').LifeSimulationSession} LifeSimulationSession
 * @typedef {import('../core/profileComparator.js').ProfileComparison} ProfileComparison
 */

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {Record<string, unknown>}
 */
function requireRecord(value, fieldName) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an object`);
  }

  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {SubjectProfile}
 */
function requireSubjectProfile(value, fieldName) {
  const record = requireRecord(value, fieldName);

  if (typeof record.subjectName !== 'string' || record.subjectName.trim().length === 0) {
    throw new TypeError(`${fieldName}.subjectName must be a non-empty string`);
  }

  if (typeof record.pointsByRealm !== 'object' || record.pointsByRealm === null) {
    throw new TypeError(`${fieldName}.pointsByRealm must be an object`);
  }

  return /** @type {SubjectProfile} */ (value);
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {LifeSimulationSession}
 */
function requireLifeSimulationSession(value, fieldName) {
  const record = requireRecord(value, fieldName);

  if (!Array.isArray(record.answers)) {
    throw new TypeError(`${fieldName}.answers must be an array`);
  }

  requireSubjectProfile(record.baselineProfile, `${fieldName}.baselineProfile`);
  requireSubjectProfile(record.recentProfile, `${fieldName}.recentProfile`);
  requireSubjectProfile(record.overallProfile, `${fieldName}.overallProfile`);

  return /** @type {LifeSimulationSession} */ (value);
}

/**
 * @returns {string}
 */
function resolveExportVersion() {
  return globalThis.window?.MIND_MIRROR_APP_VERSION ?? 'dev';
}

/**
 * @param {string} kind
 * @param {Record<string, unknown>} payload
 * @returns {{ kind: string, app: { name: string, version: string }, exportedAt: string, payload: Record<string, unknown> }}
 */
function createExportEnvelope(kind, payload) {
  return {
    kind,
    app: {
      name: 'mindmirror-pwa',
      version: resolveExportVersion(),
    },
    exportedAt: new Date().toISOString(),
    payload,
  };
}

/**
 * @param {SubjectProfile} profile
 * @returns {ReturnType<typeof createExportEnvelope>}
 */
export function createProfileJsonExport(profile) {
  const safeProfile = requireSubjectProfile(profile, 'profile');
  return createExportEnvelope('mindmirror.profile.v1', { profile: safeProfile });
}

/**
 * @param {LifeSimulationSession} session
 * @returns {ReturnType<typeof createExportEnvelope>}
 */
export function createLifeSimulationJsonExport(session) {
  const safeSession = requireLifeSimulationSession(session, 'session');
  return createExportEnvelope('mindmirror.life_simulation.v1', { session: safeSession });
}

/**
 * @param {ProfileComparison} comparison
 * @returns {ReturnType<typeof createExportEnvelope>}
 */
export function createComparisonJsonExport(comparison) {
  requireRecord(comparison, 'comparison');
  return createExportEnvelope('mindmirror.comparison.v1', { comparison });
}

/**
 * @param {unknown} value
 * @param {{ pretty?: boolean }} [options]
 * @returns {string}
 */
export function stringifyJsonExport(value, options = {}) {
  return JSON.stringify(value, null, options.pretty === false ? 0 : 2);
}

/**
 * @param {SubjectProfile} profile
 * @param {{ pretty?: boolean }} [options]
 * @returns {string}
 */
export function exportProfileToJsonString(profile, options = {}) {
  return stringifyJsonExport(createProfileJsonExport(profile), options);
}

/**
 * @param {LifeSimulationSession} session
 * @param {{ pretty?: boolean }} [options]
 * @returns {string}
 */
export function exportLifeSimulationToJsonString(session, options = {}) {
  return stringifyJsonExport(createLifeSimulationJsonExport(session), options);
}

/**
 * @param {string} value
 * @returns {string}
 */
export function slugifyFileNamePart(value) {
  const cleaned = requireNonEmptyString(value, 'value')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return cleaned.length > 0 ? cleaned.slice(0, 72) : 'mindmirror';
}

/**
 * @param {string|Date} value
 * @returns {string}
 */
export function formatExportTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * @param {SubjectProfile} profile
 * @param {{ timestamp?: string|Date }} [options]
 * @returns {string}
 */
export function createProfileJsonFileName(profile, options = {}) {
  const safeProfile = requireSubjectProfile(profile, 'profile');
  const subject = slugifyFileNamePart(safeProfile.subjectName);
  const timestamp = formatExportTimestamp(options.timestamp ?? new Date());
  return `mindmirror-profile_${subject}_${timestamp}.json`;
}

/**
 * @param {string} text
 * @param {string} fileName
 * @param {{ documentRef?: Document, urlRef?: Pick<typeof URL, 'createObjectURL'|'revokeObjectURL'> }} [options]
 * @returns {{ fileName: string, objectUrl: string }}
 */
export function downloadTextFile(text, fileName, options = {}) {
  const doc = options.documentRef ?? globalThis.document;
  const urlApi = options.urlRef ?? globalThis.URL;

  if (doc === undefined || typeof doc.createElement !== 'function') {
    throw new Error('downloadTextFile requires a DOM document');
  }

  if (urlApi === undefined || typeof urlApi.createObjectURL !== 'function') {
    throw new Error('downloadTextFile requires URL.createObjectURL');
  }

  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';
  doc.body.append(anchor);
  anchor.click();
  anchor.remove();

  if (typeof urlApi.revokeObjectURL === 'function') {
    setTimeout(() => urlApi.revokeObjectURL(objectUrl), 0);
  }

  return { fileName, objectUrl };
}

/**
 * @param {SubjectProfile} profile
 * @param {{ pretty?: boolean, timestamp?: string|Date, documentRef?: Document, urlRef?: Pick<typeof URL, 'createObjectURL'|'revokeObjectURL'> }} [options]
 * @returns {{ fileName: string, objectUrl: string }}
 */
export function downloadProfileJson(profile, options = {}) {
  const json = exportProfileToJsonString(profile, { pretty: options.pretty });
  const fileName = createProfileJsonFileName(profile, { timestamp: options.timestamp });
  return downloadTextFile(json, fileName, options);
}

// Ende src/js/export/exportJson.js
