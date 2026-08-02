export function createStackedTooltipOptions(prefix: string = '$') {
  return {
    mode: 'index',
    intersect: false,
    displayColors: true,
    padding: 10,
    backgroundColor: 'rgba(33, 37, 41, 0.95)',
    titleFont: {
      family: "'Inter', sans-serif",
      weight: 'bold',
      size: 12
    },
    bodyFont: {
      family: 'Consolas, "Courier New", monospace',
      size: 11
    },
    callbacks: {
      title: function(tooltipItems: any) {
        return tooltipItems && tooltipItems.length ? tooltipItems[0].label : '';
      },
      label: function(context: any) {
        const datasets = context.chart.data.datasets || [];
        const dataIndex = context.dataIndex;
        const maxLen = Math.max(
          ...datasets.map((d: any) => (d.label || '').length),
          6 // 'TOTAL:'
        );

        const rawLabel = context.dataset.label || '';
        const label = (rawLabel + ':').padEnd(maxLen + 2, ' ');
        const value = Number(context.raw) || 0;

        const formatted = (prefix || '$') + new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true
        }).format(value);
        const paddedVal = formatted.padStart(16, ' ');
        const line = value > 0 ? `${label}${paddedVal}` : '';

        // Buscar si este es el último dataset visible (con valor > 0) para la columna actual
        const activeIndices = datasets
          .map((d: any, idx: number) => (Number(d.data[dataIndex]) > 0 ? idx : -1))
          .filter((idx: number) => idx !== -1);
        const lastActiveIndex = activeIndices.length > 0 ? activeIndices[activeIndices.length - 1] : datasets.length - 1;

        if (context.datasetIndex === lastActiveIndex) {
          let total = 0;
          datasets.forEach((ds: any) => {
            total += Number(ds.data[dataIndex]) || 0;
          });

          const totalLabel = 'TOTAL:'.padEnd(maxLen + 2, ' ');
          const formattedTotal = (prefix || '$') + new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
          }).format(total);
          const paddedTotal = formattedTotal.padStart(16, ' ');
          const totalLine = `${totalLabel}${paddedTotal}`;

          return line ? [line, totalLine] : totalLine;
        }

        return line;
      }
    }
  };
}
