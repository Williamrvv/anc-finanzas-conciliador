window.DashboardLogic = {
    chartEvo: null,
    chartEst: null,

    init: async function() {
        console.log("Inicializando Dashboard Analítico...");
        
        // Manejo de Fechas por defecto (Últimos 7 días)
        const inputDesde = document.getElementById('dash-desde');
        const inputHasta = document.getElementById('dash-hasta');
        
        if (!inputDesde.value || !inputHasta.value) {
            const hoy = new Date();
            const hace7 = new Date(hoy);
            hace7.setDate(hoy.getDate() - 7);
            
            inputHasta.value = hoy.toISOString().split('T')[0];
            inputDesde.value = hace7.toISOString().split('T')[0];
        }

        const fDesde = inputDesde.value;
        const fHasta = inputHasta.value;

        document.getElementById('dash-loading').classList.remove('hidden');
        document.getElementById('dash-content').classList.add('hidden');

        try {
            const res = await fetch(`api/get_dashboard_stats_cc.php?desde=${fDesde}&hasta=${fHasta}`);
            const data = await res.json();
            
            if(!data.success) throw new Error(data.error);

            document.getElementById('dash-loading').classList.add('hidden');
            document.getElementById('dash-content').classList.remove('hidden');
            document.getElementById('dash-content').classList.add('flex');

            this.renderKPIs(data.kpis);
            this.renderCharts(data.graficos);

        } catch (e) {
            console.error("Error Dashboard:", e);
            document.getElementById('dash-loading').innerHTML = `<div class="text-red-500 font-bold p-10 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">Error al cargar datos del Dashboard: ${e.message}</div>`;
        }
    },

    renderKPIs: function(kpis) {
        document.getElementById('kpi-hoy-crc').innerText = `₡${parseFloat(kpis.hoy_crc).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('kpi-hoy-usd').innerText = `$${parseFloat(kpis.hoy_usd).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('kpi-tickets').innerText = kpis.tickets_activos;
        document.getElementById('kpi-tx').innerText = parseInt(kpis.tx_7d).toLocaleString('en-US');
    },

    renderCharts: function(graficos) {
        // Configuraciones globales para adaptarse a Modo Claro / Oscuro
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";

        // -----------------------------------------------------
        // 1. Gráfico de Evolución (Barras)
        // -----------------------------------------------------
        const ctxEvo = document.getElementById('chartEvolucion').getContext('2d');
        if (this.chartEvo) this.chartEvo.destroy(); // Evitar superposiciones

        this.chartEvo = new Chart(ctxEvo, {
            type: 'bar',
            data: {
                labels: graficos.evolucion.map(d => d.Fecha),
                datasets: [
                    {
                        label: 'Colones (CRC)',
                        data: graficos.evolucion.map(d => parseFloat(d.CRC)),
                        backgroundColor: '#4f46e5', // Indigo 600
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `₡${ctx.raw.toLocaleString('en-US', {minimumFractionDigits: 2})}`
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        grid: { color: gridColor },
                        ticks: {
                            callback: (val) => '₡' + (val / 1000000).toFixed(1) + 'M' // Mostrar en Millones
                        }
                    }
                }
            }
        });

        // -----------------------------------------------------
        // 2. Gráfico de Estados (Dona)
        // -----------------------------------------------------
        const ctxEst = document.getElementById('chartEstados').getContext('2d');
        if (this.chartEst) this.chartEst.destroy();

        if (graficos.estados.length === 0) {
            document.getElementById('chart-empty').classList.remove('hidden');
        } else {
            document.getElementById('chart-empty').classList.add('hidden');
            
            // Mapear colores según estado para que tenga sentido visual
            const colorMap = {
                'NO_REPORTADO': '#f59e0b', // Ambar
                'PENDIENTE_VISTO_BUENO': '#8b5cf6', // Morado
                'PENDIENTE_RESOLUCION': '#3b82f6', // Azul
                'RESUELTO': '#10b981' // Verde
            };

            const labelsFormateados = graficos.estados.map(d => d.Estado.replace(/_/g, ' '));
            const bgColors = graficos.estados.map(d => colorMap[d.Estado] || '#64748b');

            this.chartEst = new Chart(ctxEst, {
                type: 'doughnut',
                data: {
                    labels: labelsFormateados,
                    datasets: [{
                        data: graficos.estados.map(d => d.Cantidad),
                        backgroundColor: bgColors,
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, padding: 20 } }
                    }
                }
            });
        }
    }
};