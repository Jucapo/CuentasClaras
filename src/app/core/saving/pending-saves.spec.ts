import { TestBed } from '@angular/core/testing';
import { ACTION_OK, actionFailed, ActionResult } from '../action-result';
import { PendingSaves } from './pending-saves';

/** A save the test ends by hand. */
function deferredSave() {
  let finish!: (result: ActionResult) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<ActionResult>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}

describe('PendingSaves', () => {
  let saves: PendingSaves;

  beforeEach(() => {
    saves = TestBed.inject(PendingSaves);
  });

  it('settles right away without saves', async () => {
    expect(saves.busy()).toBe(false);
    await expect(saves.settle()).resolves.toEqual(ACTION_OK);
  });

  it('waits for the running saves and reports the first failure', async () => {
    const first = deferredSave();
    const second = deferredSave();
    void saves.track(first.promise);
    void saves.track(second.promise);
    expect(saves.busy()).toBe(true);

    let settled: ActionResult | null = null;
    const settling = saves.settle().then((result) => (settled = result));
    first.finish(ACTION_OK);
    await Promise.resolve();
    expect(settled).toBeNull();

    second.finish(actionFailed('No se pudo guardar.'));
    await settling;
    expect(settled).toEqual(actionFailed('No se pudo guardar.'));
    expect(saves.busy()).toBe(false);
  });

  it('counts a rejected save as failed', async () => {
    const save = deferredSave();
    const tracked = saves.track(save.promise);
    save.fail(new Error('network'));
    expect((await tracked).ok).toBe(false);
    expect((await saves.settle()).ok).toBe(true);
  });

  it('forgets saves that already ended', async () => {
    await saves.track(Promise.resolve(actionFailed('Antes.')));
    await expect(saves.settle()).resolves.toEqual(ACTION_OK);
  });
});
