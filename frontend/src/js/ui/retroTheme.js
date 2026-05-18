// =====================================================================
// src/js/ui/retroTheme.js – Retro Mind Mirror visual theme tokens
// =====================================================================

/**
 * Stable theme identifiers.
 */
export const RETRO_THEME_IDS = Object.freeze({
  DOS_COLOR: 'dos_color',
  DOS_MONO: 'dos_mono',
});

/**
 * Palette reconstructed from the PC DOS gameplay frames.
 *
 * The original GUI uses a black background, red headings/markers,
 * green map fields, warm brown/orange outer areas, and bright DOS text.
 * Values are intentionally centralized so the visual reverse-engineering
 * layer can evolve without touching the scoring/core modules.
 */
export const RETRO_COLORS = Object.freeze({
  background: '#050505',
  panelBackground: '#080808',
  foreground: '#f2f2f2',
  mutedForeground: '#b8b8b8',
  dimForeground: '#777777',
  border: '#f2f2f2',
  titleRed: '#ff3b2f',
  markerRed: '#e60000',
  mapGreen: '#0f8f3f',
  mapGreenDark: '#0a5f2c',
  mapBrown: '#9b5f21',
  mapOrange: '#c27b28',
  mapLine: '#050505',
  cyan: '#72f7ff',
  labelGreen: '#79ff79',
  selectedBackground: '#f2f2f2',
  selectedForeground: '#050505',
  warning: '#ffef9a',
});

/**
 * Canvas-specific theme tokens consumed by mindMapRenderer.js.
 */
export const RETRO_CANVAS_THEME = Object.freeze({
  id: RETRO_THEME_IDS.DOS_COLOR,
  backgroundFillStyle: RETRO_COLORS.background,
  outerRingFillStyle: RETRO_COLORS.mapBrown,
  middleRingFillStyle: RETRO_COLORS.mapGreen,
  innerRingFillStyle: RETRO_COLORS.mapGreenDark,
  circleStrokeStyle: RETRO_COLORS.foreground,
  sectorStrokeStyle: RETRO_COLORS.mapLine,
  labelFillStyle: RETRO_COLORS.labelGreen,
  titleFillStyle: RETRO_COLORS.titleRed,
  markerFillStyle: RETRO_COLORS.markerRed,
  markerStrokeStyle: RETRO_COLORS.foreground,
  markerTextFillStyle: RETRO_COLORS.foreground,
  circleLineWidth: 1,
  sectorLineWidth: 1,
  titleFont: 'bold 18px "Courier New", Consolas, monospace',
  labelFont: '12px "Courier New", Consolas, monospace',
  markerFont: 'bold 13px "Courier New", Consolas, monospace',
});

/**
 * CSS custom properties for the DOM retro layer.
 */
export const RETRO_CSS_VARS = Object.freeze({
  '--mm-retro-bg': RETRO_COLORS.background,
  '--mm-retro-panel-bg': RETRO_COLORS.panelBackground,
  '--mm-retro-fg': RETRO_COLORS.foreground,
  '--mm-retro-muted-fg': RETRO_COLORS.mutedForeground,
  '--mm-retro-dim-fg': RETRO_COLORS.dimForeground,
  '--mm-retro-border': RETRO_COLORS.border,
  '--mm-retro-title': RETRO_COLORS.titleRed,
  '--mm-retro-marker': RETRO_COLORS.markerRed,
  '--mm-retro-cyan': RETRO_COLORS.cyan,
  '--mm-retro-label': RETRO_COLORS.labelGreen,
  '--mm-retro-map-green': RETRO_COLORS.mapGreen,
  '--mm-retro-map-brown': RETRO_COLORS.mapBrown,
  '--mm-retro-selected-bg': RETRO_COLORS.selectedBackground,
  '--mm-retro-selected-fg': RETRO_COLORS.selectedForeground,
  '--mm-retro-warning': RETRO_COLORS.warning,
  '--mm-retro-font': '"Courier New", Consolas, monospace',
});

/**
 * Returns the default retro canvas theme.
 *
 * @returns {typeof RETRO_CANVAS_THEME}
 */
export function getRetroCanvasTheme() {
  return RETRO_CANVAS_THEME;
}

/**
 * Applies retro CSS custom properties to a root element.
 *
 * @param {HTMLElement} rootElement
 * @param {Record<string, string>} [cssVars]
 */
export function applyRetroCssVariables(rootElement, cssVars = RETRO_CSS_VARS) {
  if (!(rootElement instanceof HTMLElement)) {
    throw new TypeError('rootElement must be an HTMLElement');
  }

  for (const [name, value] of Object.entries(cssVars)) {
    rootElement.style.setProperty(name, value);
  }
}

// Ende src/js/ui/retroTheme.js
