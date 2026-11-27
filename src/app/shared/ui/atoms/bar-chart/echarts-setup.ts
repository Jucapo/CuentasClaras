// The only module that imports ECharts: `cc-bar-chart` loads it on demand, so the library stays out
// of the initial chunks (spec §2). It registers just what the stacked bars use.
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

export { echarts };
