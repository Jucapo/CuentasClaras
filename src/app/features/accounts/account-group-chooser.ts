import { Params } from '@angular/router';
import {
  ACCOUNT_GROUP_CHOICES,
  CreatableAccountGroup,
} from '../../core/config/catalog.constants';
import { ACCOUNT_QUERY_PARAMS } from '../../core/routing/app-paths';
import { OptionPanel, OptionPanelData } from '../../shared/ui/molecules/option-panel/option-panel';
import { OverlayService } from '../../shared/ui/services/overlay.service';

/** "¿Qué vas a crear?" (spec §7): resolves with the chosen group, or undefined when dismissed. */
export function chooseAccountGroup(
  overlay: OverlayService,
): Promise<CreatableAccountGroup | undefined> {
  const groups = Object.keys(ACCOUNT_GROUP_CHOICES) as CreatableAccountGroup[];
  return overlay.open<CreatableAccountGroup, OptionPanelData<CreatableAccountGroup>>(OptionPanel, {
    label: '¿Qué vas a crear?',
    data: {
      title: '¿Qué vas a crear?',
      mode: 'action',
      prominent: true,
      options: groups.map((value) => ({
        value,
        label: ACCOUNT_GROUP_CHOICES[value].label,
        description: ACCOUNT_GROUP_CHOICES[value].example,
        icon: ACCOUNT_GROUP_CHOICES[value].icon,
        color: ACCOUNT_GROUP_CHOICES[value].color,
      })),
    },
  });
}

/** Query params of the new account screen for a group. */
export function newAccountQueryParams(group: CreatableAccountGroup): Params {
  return { [ACCOUNT_QUERY_PARAMS.group]: ACCOUNT_GROUP_CHOICES[group].param };
}
