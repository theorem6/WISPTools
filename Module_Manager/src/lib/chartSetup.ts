// Global Chart.js configuration and registration
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartConfiguration
} from 'chart.js';

// Register all Chart.js components globally
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Global chart defaults
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
Chart.defaults.color = 'rgb(156, 163, 175)';
Chart.defaults.borderColor = 'rgba(75, 85, 99, 0.2)';

// Default responsive options
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

export { Chart, type ChartConfiguration };

