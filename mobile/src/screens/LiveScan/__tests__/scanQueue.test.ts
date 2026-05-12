import { createScanQueue } from '../scanQueue';

describe('scanQueue', () => {
  it('runs jobs in parallel up to limit', async () => {
    const queue = createScanQueue({ maxConcurrent: 2 });
    const inFlight = { value: 0, max: 0 };
    const job = () =>
      new Promise<void>((resolve) => {
        inFlight.value += 1;
        if (inFlight.value > inFlight.max) inFlight.max = inFlight.value;
        setTimeout(() => {
          inFlight.value -= 1;
          resolve();
        }, 20);
      });
    await Promise.all([queue.enqueue(job), queue.enqueue(job), queue.enqueue(job), queue.enqueue(job)]);
    expect(inFlight.max).toBe(2);
  });

  it('waits for slots when full', async () => {
    const queue = createScanQueue({ maxConcurrent: 1 });
    const order: number[] = [];
    const make = (n: number) => async () => {
      order.push(n);
      await new Promise((r) => setTimeout(r, 5));
    };
    await Promise.all([queue.enqueue(make(1)), queue.enqueue(make(2)), queue.enqueue(make(3))]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('continues processing when a job throws', async () => {
    const queue = createScanQueue({ maxConcurrent: 1 });
    let secondRan = false;
    await Promise.all([
      queue.enqueue(async () => { throw new Error('boom'); }).catch(() => {}),
      queue.enqueue(async () => { secondRan = true; }),
    ]);
    expect(secondRan).toBe(true);
  });
});
