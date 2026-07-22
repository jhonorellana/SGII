export function createStackedTooltipOptions(suffix: string = 'US$') {
  return {
    mode: 'index',
    intersect: false,
    displayColors: true,
    padding: 8,
    bodyFont: {
      family: 'Consolas, "Courier New", monospace',
      size: 11
    },
    footerFont: {
      family: 'Consolas, "Courier New", monospace',
      weight: 'bold',
      size: 11
    },
    callbacks: {
      title: function(tooltipItems: any) {
        return tooltipItems && tooltipItems.length ? tooltipItems[0].label : '';
      },
      label: function(context: any) {
        const datasets = context.chart.data.datasets || [];
        const maxLen = Math.max(
          ...datasets.map((d: any) => (d.label || '').length),
          5 // Length of 'Total'
        );

        const rawLabel = context.dataset.label || '';
        const label = (rawLabel + ':').padEnd(maxLen + 2, ' ');
        const value = Number(context.raw) || 0;
        const formatted = new Intl.NumberFormat('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true
        }).format(value) + (suffix ? ' ' + suffix.trim() : '');
        const paddedVal = formatted.padStart(15, ' ');
        const line = `${label}${paddedVal}`;

        // Si es el último dataset de la lista, adjuntar la fila del Total para mantener sangría idéntica
        if (context.datasetIndex === datasets.length - 1) {
          let total = 0;
          const dataIndex = context.dataIndex;
          datasets.forEach((ds: any) => {
            total += Number(ds.data[dataIndex]) || 0;
          });

          const totalLabel = 'Total:'.padEnd(maxLen + 2, ' ');
          const formattedTotal = new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
          }).format(total) + (suffix ? ' ' + suffix.trim() : '');
          const paddedTotal = formattedTotal.padStart(15, ' ');
          const totalLine = `${totalLabel}${paddedTotal}`;

          return [line, totalLine];
        }

        return line;
      }
    }
  };
}
