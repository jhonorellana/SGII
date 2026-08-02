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
        if (value <= 0) return '';

        const formatted = (prefix || '$') + new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true
        }).format(value);
        const paddedVal = formatted.padStart(12, ' ');
        const line = `${label}${paddedVal}`;

        // Si es el último dataset visible, adjuntar la fila TOTAL como sublínea para mantener alineación vertical perfecta
        if (context.datasetIndex === datasets.length - 1) {
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
          const paddedTotal = formattedTotal.padStart(12, ' ');
          const totalLine = `${totalLabel}${paddedTotal}`;

          return [line, totalLine];
        }

        return line;
      }
    }
  };
}
