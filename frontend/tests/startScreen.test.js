// =====================================================================
// tests/startScreen.test.js – Retro start menu tests
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStartMenuItems, renderRetroStartScreen } from '../src/js/ui/startScreen.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('createStartMenuItems', () => {
  it('keeps Inter-Play disabled until at least two profiles exist', () => {
    expect(createStartMenuItems([]).find((item) => item.id === 'compare_profiles')?.enabled).toBe(false);
    expect(createStartMenuItems([
      /** @type {never} */ ({ id: 'one' }),
      /** @type {never} */ ({ id: 'two' }),
    ]).find((item) => item.id === 'compare_profiles')?.enabled).toBe(true);
  });
});

describe('renderRetroStartScreen', () => {
  it('renders the DOS-like start menu and activates new profile', () => {
    const container = document.createElement('div');
    const onNewProfile = vi.fn();
    const controller = renderRetroStartScreen(container, { onNewProfile });

    expect(container.querySelector('.retro-start-title')?.textContent).toBe('MIND MIRROR');
    expect(container.querySelectorAll('.retro-start-menu__item')).toHaveLength(3);

    /** @type {HTMLButtonElement} */ (container.querySelector('[data-menu-id="new_profile"]')).click();
    expect(onNewProfile).toHaveBeenCalledOnce();

    controller.destroy();
  });

  it('supports keyboard navigation and selection', () => {
    const container = document.createElement('div');
    const onSavedProfiles = vi.fn();
    const controller = renderRetroStartScreen(container, { onSavedProfiles });

    controller.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(controller.getSelectedItem().id).toBe('saved_profiles');
    controller.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSavedProfiles).toHaveBeenCalledOnce();

    controller.destroy();
  });
});

// Ende tests/startScreen.test.js
