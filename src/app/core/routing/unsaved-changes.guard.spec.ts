import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConfirmService } from '../../shared/ui/services/confirm.service';
import {
  HasUnsavedChanges,
  UNSAVED_CHANGES_CONFIRM,
  unsavedChangesGuard,
} from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const confirm = vi.fn<(options: unknown) => Promise<boolean>>();

  beforeEach(() => {
    confirm.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: ConfirmService, useValue: { confirm } }],
    });
  });

  function runGuard(dirty: boolean) {
    const component: HasUnsavedChanges = { hasUnsavedChanges: () => dirty };
    const state = {} as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as ActivatedRouteSnapshot, state, state),
    );
  }

  it('lets the user leave right away without changes', () => {
    expect(runGuard(false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before discarding changes and follows the answer', async () => {
    confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(runGuard(true)).resolves.toBe(false);
    await expect(runGuard(true)).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: UNSAVED_CHANGES_CONFIRM.title, destructive: true }),
    );
  });
});
