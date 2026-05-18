// =====================================================================
// tests/sampleEvents.test.js – Clean-room Life Simulation event bank tests
// =====================================================================

import { describe, expect, it } from 'vitest';

import { normalizeLifeSimulationEvent } from '../src/js/core/lifeSimulationEngine.js';
import { REALMS } from '../src/js/data/realms.js';
import { SAMPLE_LIFE_SIMULATION_EVENTS } from '../src/js/data/sampleEvents.js';

describe('SAMPLE_LIFE_SIMULATION_EVENTS', () => {
  it('contains a balanced 32-event MVP bank', () => {
    expect(SAMPLE_LIFE_SIMULATION_EVENTS).toHaveLength(32);

    for (const realm of REALMS) {
      const realmEvents = SAMPLE_LIFE_SIMULATION_EVENTS.filter((event) => event.realm === realm.id);
      expect(realmEvents).toHaveLength(8);
    }
  });

  it('uses valid event records understood by the Life Simulation engine', () => {
    const ids = new Set();

    for (const event of SAMPLE_LIFE_SIMULATION_EVENTS) {
      const normalized = normalizeLifeSimulationEvent(event);
      expect(ids.has(normalized.id)).toBe(false);
      ids.add(normalized.id);
      expect(normalized.axisRow).toBeGreaterThanOrEqual(1);
      expect(normalized.axisRow).toBeLessThanOrEqual(4);
      expect(normalized.choices.length).toBeGreaterThanOrEqual(4);
    }
  });
});

// Ende tests/sampleEvents.test.js
