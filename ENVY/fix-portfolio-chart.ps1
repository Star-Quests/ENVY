# ENVY Portfolio Chart Fix Script
# Run as: .\fix-portfolio-chart.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    PORTFOLIO CHART FIX SCRIPT         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create backup folder
$backupDir = "backup_chart_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "Backup folder: $backupDir" -ForegroundColor Green
Write-Host ""

# ============================================
# FIX 1: Update Dashboard CSS - Chart Sizing
# ============================================
Write-Host "Fixing dashboard.css - Chart sizing..." -ForegroundColor Yellow

$dashboardCssPath = "frontend\css\dashboard.css"
if (Test-Path $dashboardCssPath) {
    Copy-Item $dashboardCssPath "$backupDir\dashboard.css" -Force
    
    $chartCss = @"

/* ============================================ */
/* FIXED: Portfolio Chart Sizing                */
/* ============================================ */

.portfolio-chart-section {
    width: 100% !important;
    margin-bottom: var(--spacing-lg) !important;
}

.chart-container {
    padding: var(--spacing-lg) !important;
    border-radius: var(--radius-xl) !important;
    width: 100% !important;
    max-width: 100% !important;
    overflow: hidden !important;
}

.chart-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: var(--spacing-md) !important;
    flex-wrap: wrap !important;
    gap: var(--spacing-sm) !important;
}

.chart-header h3 {
    color: var(--accent-hover) !important;
    font-size: 16px !important;
    margin: 0 !important;
}

.chart-controls {
    display: flex !important;
    gap: 4px !important;
    background: var(--glass-bg) !important;
    padding: 3px !important;
    border-radius: var(--radius-full) !important;
}

.time-btn {
    padding: 6px 12px !important;
    background: transparent !important;
    border: none !important;
    color: var(--accent-muted) !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    border-radius: var(--radius-full) !important;
    transition: all var(--transition-fast) !important;
    white-space: nowrap !important;
}

.time-btn:hover {
    color: var(--accent-hover) !important;
    background: var(--bg-elevated) !important;
}

.time-btn.active {
    background: var(--accent-primary) !important;
    color: var(--bg-primary) !important;
}

#portfolioChart {
    width: 100% !important;
    height: 250px !important;
    max-height: 250px !important;
}

@media (max-width: 768px) {
    .chart-container {
        padding: var(--spacing-md) !important;
    }
    
    #portfolioChart {
        height: 200px !important;
        max-height: 200px !important;
    }
    
    .chart-header {
        flex-direction: column !important;
        align-items: flex-start !important;
    }
    
    .chart-controls {
        width: 100% !important;
        justify-content: space-between !important;
    }
    
    .time-btn {
        padding: 5px 8px !important;
        font-size: 11px !important;
    }
}

@media (max-width: 480px) {
    #portfolioChart {
        height: 180px !important;
        max-height: 180px !important;
    }
    
    .time-btn {
        padding: 4px 6px !important;
        font-size: 10px !important;
    }
}

"@
    
    Add-Content $dashboardCssPath "`r`n$chartCss" -Encoding UTF8
    Write-Host "   Added chart sizing CSS to dashboard.css" -ForegroundColor Green
}

# ============================================
# FIX 2: Create JavaScript fix file
# ============================================
Write-Host ""
Write-Host "Creating chart JavaScript fix file..." -ForegroundColor Yellow

$jsFixContent = @"
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

"@

$jsFixPath = "fix-portfolio-chart.js"
Set-Content $jsFixPath $jsFixContent -Encoding UTF8
Write-Host "   Created: $jsFixPath" -ForegroundColor Green

# ============================================
# FIX 3: Create HTML structure reference
# ============================================
Write-Host ""
Write-Host "Creating HTML structure reference..." -ForegroundColor Yellow

$htmlFixContent = @"
<!-- ============================================ -->
<!-- FIXED: Portfolio Chart HTML Structure        -->
<!-- ============================================ -->
<!-- Make sure your dashboard.html has this exact structure -->

<div class="portfolio-chart-section">
    <div class="chart-container glass-morphism">
        <div class="chart-header">
            <h3>Portfolio Performance</h3>
            <div class="chart-controls">
                <button class="time-btn" data-period="1D">1D</button>
                <button class="time-btn active" data-period="1W">1W</button>
                <button class="time-btn" data-period="1M">1M</button>
                <button class="time-btn" data-period="3M">3M</button>
                <button class="time-btn" data-period="1Y">1Y</button>
            </div>
        </div>
        <canvas id="portfolioChart"></canvas>
    </div>
</div>

"@

$htmlFixPath = "fix-portfolio-chart.html"
Set-Content $htmlFixPath $htmlFixContent -Encoding UTF8
Write-Host "   Created: $htmlFixPath" -ForegroundColor Green

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    PORTFOLIO CHART FIX COMPLETE!       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FILES CREATED:" -ForegroundColor Green
Write-Host "  - fix-portfolio-chart.js   (JavaScript functions)"
Write-Host "  - fix-portfolio-chart.html (HTML reference)"
Write-Host ""
Write-Host "MANUAL STEPS:" -ForegroundColor Yellow
Write-Host "  1. Open fix-portfolio-chart.js"
Write-Host "  2. Copy ALL functions"
Write-Host "  3. Open frontend/js/dashboard.js"
Write-Host "  4. Find and REPLACE these functions:"
Write-Host "     - initializeChart()"
Write-Host "     - getChartLabels()"
Write-Host "     - generateSampleData()"
Write-Host "     - updateChartData()"
Write-Host "     - changeChartPeriod()"
Write-Host "  5. Save dashboard.js"
Write-Host "  6. Hard refresh browser: Ctrl + Shift + R"
Write-Host ""
Write-Host "Backups saved in: $backupDir" -ForegroundColor Gray
Write-Host ""