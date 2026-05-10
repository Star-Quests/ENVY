// ============================================
// FIXED: Portfolio Chart Functions
// ============================================
// Copy these functions into frontend/js/dashboard.js
// Replace the existing initializeChart, getChartLabels, 
// generateSampleData, updateChartData, and changeChartPeriod functions

initializeChart() {
    const canvas = document.getElementById('portfolioChart');
    if (!canvas) {
        console.warn('Portfolio chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    if (this.chart) {
        this.chart.destroy();
    }
    
    this.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: this.getChartLabels('1W'),
            datasets: [{
                label: 'Portfolio Value',
                data: this.generateSampleData(),
                borderColor: '#9CA3AF',
                backgroundColor: 'rgba(156, 163, 175, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#9CA3AF',
                pointHoverBorderColor: '#0A0A0A',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1A1A1A',
                    titleColor: '#E5E7EB',
                    bodyColor: '#D1D5DB',
                    borderColor: '#9CA3AF',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#6B7280', maxRotation: 0, font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(156, 163, 175, 0.08)' },
                    ticks: {
                        color: '#6B7280',
                        font: { size: 11 },
                        callback: function(value) {
                            if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                            if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K';
                            return '$' + value;
                        }
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
}

getChartLabels(period) {
    const labels = [];
    const now = new Date();
    let points = 7;
    
    switch(period) {
        case '1D': points = 24; break;
        case '1W': points = 7; break;
        case '1M': points = 30; break;
        case '3M': points = 12; break;
        case '1Y': points = 12; break;
        default: points = 7;
    }
    
    for (let i = points - 1; i >= 0; i--) {
        const date = new Date(now);
        
        if (period === '1D') {
            date.setHours(date.getHours() - i);
            labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        } else if (period === '1W') {
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        } else if (period === '1M') {
            date.setDate(date.getDate() - i);
            labels.push(date.getDate().toString());
        } else {
            date.setMonth(date.getMonth() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
        }
    }
    
    return labels;
}

generateSampleData() {
    const baseValue = this.calculateTotalPortfolioValue() || 10000;
    const data = [];
    let current = baseValue * 0.85;
    
    for (let i = 0; i < 7; i++) {
        const change = (Math.random() - 0.3) * (baseValue * 0.03);
        current += change;
        current = Math.max(current, baseValue * 0.7);
        data.push(current);
    }
    
    return data;
}

updateChartData(period) {
    if (!this.chart) {
        this.initializeChart();
        return;
    }
    
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = Array.from(document.querySelectorAll('.time-btn'))
        .find(btn => btn.dataset.period === period);
    if (activeBtn) activeBtn.classList.add('active');
    
    this.chart.data.labels = this.getChartLabels(period);
    this.chart.data.datasets[0].data = this.generateSampleData();
    this.chart.update();
}

changeChartPeriod(period) {
    this.updateChartData(period);
}

