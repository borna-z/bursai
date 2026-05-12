import { createStabilityLock } from '../stabilityLock';

describe('stabilityLock', () => {
  it('does not fire on first sample', () => {
    const lock = createStabilityLock();
    expect(lock.update(0.95)).toBe(false);
  });

  it('fires after 8 consecutive samples >=0.85', () => {
    const lock = createStabilityLock();
    let fired = false;
    for (let i = 0; i < 8; i++) {
      fired = lock.update(0.95);
    }
    expect(fired).toBe(true);
  });

  it('does not fire when a sample dips below 0.70', () => {
    const lock = createStabilityLock();
    lock.update(0.9); lock.update(0.9); lock.update(0.9);
    lock.update(0.6); // dip
    lock.update(0.9); lock.update(0.9); lock.update(0.9); lock.update(0.9);
    expect(lock.update(0.9)).toBe(false);
  });

  it('fires after the dip rolls out of the window', () => {
    const lock = createStabilityLock();
    lock.update(0.6); // dip first
    let fired = false;
    for (let i = 0; i < 8; i++) {
      fired = lock.update(0.95);
    }
    expect(fired).toBe(true);
  });

  it('honors cooldown — does not re-fire within 700 ms', () => {
    let t = 0;
    const now = jest.fn(() => t);
    const lock = createStabilityLock({ now });
    for (let i = 0; i < 8; i++) lock.update(0.95);
    expect(lock.update(0.95)).toBe(true);
    t = 500;
    expect(lock.update(0.95)).toBe(false);
    t = 1500;
    for (let i = 0; i < 8; i++) lock.update(0.95);
    expect(lock.update(0.95)).toBe(true);
  });
});
