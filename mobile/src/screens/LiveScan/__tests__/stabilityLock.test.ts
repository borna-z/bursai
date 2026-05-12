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
    // First fire happens on the 8th update (buffer just filled, no prior lock).
    let firstFireSeen = false;
    for (let i = 0; i < 8; i++) {
      if (lock.update(0.95)) firstFireSeen = true;
    }
    expect(firstFireSeen).toBe(true);
    // Still within the 700 ms cooldown — must not fire again.
    expect(lock.update(0.95)).toBe(false);
    t = 500;
    expect(lock.update(0.95)).toBe(false);
    // After the cooldown AND a below-floor dip re-arms the lock, the next
    // stable burst fires again.
    t = 1500;
    expect(lock.update(0.5)).toBe(false); // below-floor sample re-arms
    for (let i = 0; i < 7; i++) lock.update(0.95);
    t = 2500;
    expect(lock.update(0.95)).toBe(true);
  });

  it('does not re-fire while score stays stable after a lock', () => {
    let t = 0;
    const now = jest.fn(() => t);
    const lock = createStabilityLock({ now });
    // First 7 fill the buffer to size 7; the 8th call fills the buffer
    // and is the first fire.
    for (let i = 0; i < 7; i++) lock.update(0.95);
    expect(lock.update(0.95)).toBe(true);          // first fire (8th sample)
    t = 1500;                                       // way past 700 ms cooldown
    expect(lock.update(0.95)).toBe(false);          // still stable → no re-fire
    // Drop below floor — re-arm
    expect(lock.update(0.5)).toBe(false);           // dip clears the lock + buffer guard
    // Rebuild buffer with above-floor samples (need 7 more to push the 0.5 out).
    for (let i = 0; i < 7; i++) lock.update(0.95);
    t = 5000;
    expect(lock.update(0.95)).toBe(true);           // re-armed, fires again
  });
});
