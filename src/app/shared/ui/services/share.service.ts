import { DOCUMENT, inject, Injectable } from '@angular/core';

/** What a share sheet sends. */
export interface ShareContent {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

/** Copying text and opening the system share sheet, e.g. for an invitation link. */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly navigator = inject(DOCUMENT).defaultView?.navigator;

  /** Whether the device has a share sheet (phones and some desktops). */
  readonly canShare = typeof this.navigator?.share === 'function';

  /** Copies text to the clipboard; call it from a tap so Safari allows it. */
  async copy(text: string): Promise<boolean> {
    try {
      await this.navigator?.clipboard.writeText(text);
      return this.navigator?.clipboard !== undefined;
    } catch {
      return false;
    }
  }

  /** Opens the share sheet; false if it is missing or the user closed it. */
  async share(content: ShareContent): Promise<boolean> {
    if (!this.canShare) {
      return false;
    }
    try {
      await this.navigator?.share(content);
      return true;
    } catch {
      return false;
    }
  }
}
