// =====================================================================
// src/js/ui/retroTheme.js – Retro Mind Mirror visual theme tokens
// =====================================================================

/**
 * Stable theme identifiers.
 */
export const RETRO_THEME_IDS = Object.freeze({
  DOS_MONO: 'dos_mono',
});

/**
 * Monochrome palette inspired by the PC DOS Mind Mirror interface.
 *
 * The original game used a stark high-contrast raster look. The PWA keeps
 * the same visual language, but exposes the values as tokens so that the
 * modern UI remains maintainable and testable.
 */
export const RETRO_COLORS = Object.freeze({
  background: '#050505',
  panelBackground: '#101010',
  foreground: '#f2f2f2',
  mutedForeground: '#b8b8b8',
  dimForeground: '#777777',
  border: '#f2f2f2',
  markerFill: '#050505',
  markerStroke: '#f2f2f2',
  markerText: '#f2f2f2',
  selectedBackground: '#f2f2f2',
  selectedForeground: '#050505',
  warning: '#ffef9a',
});

/**
 * Canvas-specific theme tokens consumed by mindMapRenderer.js.
 */
export const RETRO_CANVAS_THEME = Object.freeze({
  id: RETRO_THEME_IDS.DOS_MONO,
  backgroundFillStyle: RETRO_COLORS.background,
  circleStrokeStyle: RETRO_COLORS.foreground,
  sectorStrokeStyle: RETRO_COLORS.mutedForeground,
  labelFillStyle: RETRO_COLORS.foreground,
  titleFillStyle: RETRO_COLORS.foreground,
  markerFillStyle: RETRO_COLORS.background,
  markerStrokeStyle: RETRO_COLORS.foreground,
  markerTextFillStyle: RETRO_COLORS.foreground,
  circleLineWidth: 1,
  sectorLineWidth: 1,
  titleFont: 'bold 16px "Courier New", monospace',
  labelFont: '11px "Courier New", monospace',
  markerFont: 'bold 12px "Courier New", monospace',
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
