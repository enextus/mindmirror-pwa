// =====================================================================
// src/js/ui/retroTextScreen.js – Retro text screen DOM factory
// =====================================================================

/**
 * @typedef {object} RetroTextScreenOptions
 * @property {string} [title]
 * @property {readonly string[]} [paragraphs]
 * @property {string} [footer]
 * @property {string} [className]
 */

/**
 * @param {Document} documentRef
 * @param {string} tagName
 * @param {string} className
 * @param {string} [textContent]
 * @returns {HTMLElement}
 */
function createElement(documentRef, tagName, className, textContent = '') {
  const element = documentRef.createElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {readonly string[]}
 */
function resolveStringArray(value, name) {
  if (value === undefined) {
    return Object.freeze([]);
  }

  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array of strings`);
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string') {
      throw new TypeError(`${name}[${index}] must be a string`);
    }
  }

  return value;
}

/**
 * Creates a reusable DOS-like text screen.
 *
 * @param {RetroTextScreenOptions} [options]
 * @param {Document} [documentRef]
 * @returns {HTMLElement}
 */
export function createRetroTextScreen(options = {}, documentRef = document) {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }

  const screen = createElement(
    documentRef,
    'section',
    `mm-retro-screen mm-retro-text-screen ${options.className ?? ''}`.trim(),
  );

  if (typeof options.title === 'string' && options.title.trim().length > 0) {
    screen.append(createElement(documentRef, 'h2', 'mm-retro-title', options.title));
  }

  const body = createElement(documentRef, 'div', 'mm-retro-text-body');
  const paragraphs = resolveStringArray(options.paragraphs, 'options.paragraphs');

  for (const paragraph of paragraphs) {
    body.append(createElement(documentRef, 'p', 'mm-retro-paragraph', paragraph));
  }

  screen.append(body);

  if (typeof options.footer === 'string' && options.footer.trim().length > 0) {
    screen.append(createElement(documentRef, 'footer', 'mm-retro-footer', options.footer));
  }

  return screen;
}

// Ende src/js/ui/retroTextScreen.js
