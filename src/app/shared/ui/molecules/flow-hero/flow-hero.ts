import { Component } from '@angular/core';

/**
 * Header band of a flow (spec §13.5): the large name (`[ccHeroName]`) with the icon and color badge
 * beside it (`[ccHeroBadge]`). It continues the flow's top bar.
 */
@Component({
  selector: 'cc-flow-hero',
  templateUrl: './flow-hero.html',
  styleUrl: './flow-hero.scss',
})
export class FlowHero {}
