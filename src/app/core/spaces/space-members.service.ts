import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { SpaceMember } from './space.models';
import { SpaceService } from './space.service';
import { SpacesApi } from './spaces.api';

/** Members of the active space with their display names, e.g. for the person filter (spec §7). */
@Injectable({ providedIn: 'root' })
export class SpaceMembersService {
  private readonly api = inject(SpacesApi);
  private readonly spaces = inject(SpaceService);
  private readonly changes = signal(0);

  private readonly store = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      return spaceId ? { spaceId, revision: this.changes() } : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.api.fetchMembers(params.spaceId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  readonly members = computed<readonly SpaceMember[]>(() =>
    this.store.hasValue() ? this.store.value() : [],
  );

  /** Loads the members again, e.g. after someone changed their name. */
  reload(): void {
    this.changes.update((value) => value + 1);
  }
}
