// Type definitions for chart configurations
// Compatible with both Chart.js (during migration) and ECharts
// The Chart.svelte component automatically converts Chart.js configs to ECharts options

export type ChartType = 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter';

export interface ChartDataset {
  label?: string;
  data: (number | null | undefined)[];
  borderColor?: string | string[];
  backgroundColor?: string | string[];
  fill?: boolean;
  tension?: number;
  pointRadius?: number | number[];
  pointHoverRadius?: number;
  pointBackgroundColor?: string | string[];
  stepped?: 'before' | 'after' | false;
  borderWidth?: number;
  yAxisID?: string;
  type?: ChartType;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartScale {
  type?: 'linear' | 'logarithmic' | 'time' | 'category';
  display?: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
  min?: number;
  max?: number;
  beginAtZero?: boolean;
  title?: {
    display?: boolean;
    text?: string;
    color?: string;
  };
  ticks?: {
    color?: string;
    font?: { size?: number };
    maxRotation?: number;
    minRotation?: number;
    maxTicksLimit?: number;
    stepSize?: number;
    callback?: (value: string | number) => string;
  };
  grid?: {
    color?: string;
    display?: boolean;
    drawOnChartArea?: boolean;
    drawBorder?: boolean;
  };
}

export interface ChartScales {
  x?: ChartScale;
  y?: ChartScale;
  y1?: ChartScale;
}

export interface ChartTooltip {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  titleColor?: string;
  bodyColor?: string;
  textStyle?: { color?: string };
  callbacks?: {
    label?: (context: any) => string | string[];
    title?: (contexts: any[]) => string | string[];
  };
}

export interface ChartLegend {
  display?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  labels?: {
    color?: string;
    usePointStyle?: boolean;
    padding?: number;
  };
}

export interface ChartPlugins {
  legend?: ChartLegend;
  tooltip?: ChartTooltip;
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  animation?: {
    duration?: number;
    easing?: string;
  };
  interaction?: {
    mode?: 'index' | 'point' | 'nearest' | 'x' | 'y';
    intersect?: boolean;
  };
  plugins?: ChartPlugins;
  scales?: ChartScales;
}

export interface ChartConfiguration<T extends ChartType = ChartType> {
  type: T;
  data: ChartData;
  options?: ChartOptions;
}

// Re-export for backward compatibility
export type { ChartConfiguration };
