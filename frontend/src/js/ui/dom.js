// =====================================================================
// src/js/ui/dom.js – DOM helper functions for the Mind Mirror PWA
// =====================================================================

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {Document|HTMLElement}
 */
function requireDomRoot(value, name) {
  if (
    value === undefined
    || value === null
    || typeof /** @type {{ querySelector?: unknown }} */ (value).querySelector !== 'function'
  ) {
    throw new TypeError(`${name} must be a DOM root with querySelector()`);
  }

  return /** @type {Document|HTMLElement} */ (value);
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {HTMLElement}
 */
function requireHTMLElement(value, name) {
  if (!(value instanceof HTMLElement)) {
    throw new TypeError(`${name} must be an HTMLElement`);
  }

  return value;
}

/**
 * Removes all children from an element.
 *
 * @param {HTMLElement} element
 * @returns {HTMLElement}
 */
export function clearElement(element) {
  const target = requireHTMLElement(element, 'element');
  target.replaceChildren();
  return target;
}

/**
 * Finds a required element by id.
 *
 * @param {string} id
 * @param {Document|HTMLElement} [root]
 * @returns {HTMLElement}
 */
export function getRequiredElementById(id, root = document) {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new TypeError('id must be a non-empty string');
  }

  const domRoot = requireDomRoot(root, 'root');
  const element = domRoot.querySelector(`#${id}`);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Required element #${id} was not found`);
  }

  return element;
}

/**
 * Creates a regular HTMLElement with common attributes.
 *
 * @param {string} tagName
 * @param {{ className?: string, textContent?: string, attributes?: Record<string, string>, dataset?: Record<string, string> }} [options]
 * @returns {HTMLElement}
 */
export function createDomElement(tagName, options = {}) {
  if (typeof tagName !== 'string' || tagName.trim().length === 0) {
    throw new TypeError('tagName must be a non-empty string');
  }

  const element = document.createElement(tagName);

  if (options.className !== undefined) {
    element.className = options.className;
  }

  if (options.textContent !== undefined) {
    element.textContent = options.textContent;
  }

  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    element.setAttribute(name, value);
  }

  for (const [name, value] of Object.entries(options.dataset ?? {})) {
    element.dataset[name] = value;
  }

  return element;
}

/**
 * Creates a canvas with explicit intrinsic dimensions.
 *
 * @param {number} width
 * @param {number} height
 * @param {{ className?: string, ariaLabel?: string }} [options]
 * @returns {HTMLCanvasElement}
 */
export function createCanvasElement(width, height, options = {}) {
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError('canvas width must be a positive integer');
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError('canvas height must be a positive integer');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  if (options.className !== undefined) {
    canvas.className = options.className;
  }

  if (options.ariaLabel !== undefined) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', options.ariaLabel);
  }

  return canvas;
}

/**
 * Appends a list of child nodes or text values to a parent.
 *
 * @param {HTMLElement} parent
 * @param {readonly (Node|string|null|undefined)[]} children
 * @returns {HTMLElement}
 */
export function appendChildren(parent, children) {
  const target = requireHTMLElement(parent, 'parent');

  for (const child of children) {
    if (child === null || child === undefined) {
      continue;
    }

    if (typeof child === 'string') {
      target.append(document.createTextNode(child));
    } else {
      target.append(child);
    }
  }

  return target;
}

// Ende src/js/ui/dom.js
