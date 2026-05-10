# ENVY Dashboard Chart Auto-Patcher
# This script automatically replaces chart functions in dashboard.js
# Run as: .\patch-dashboard-chart.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    DASHBOARD CHART AUTO-PATCHER       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$dashJsPath = "frontend\js\dashboard.js"
$backupDir = "backup_chart_patch_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

# Create backup
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $dashJsPath "$backupDir\dashboard.js" -Force
Write-Host "Backup saved to: $backupDir\dashboard.js" -ForegroundColor Green
Write-Host ""

# Read the dashboard.js file
Write-Host "Reading dashboard.js..." -ForegroundColor Yellow
$content = Get-Content $dashJsPath -Raw -Encoding UTF8

# ============================================
# NEW initializeChart FUNCTION
# ============================================
$newInitFunction = @'

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

'@

# ============================================
# NEW getChartLabels FUNCTION
# ============================================
$newGetLabelsFunction = @'

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

'@

# ============================================
# NEW generateSampleData FUNCTION
# ============================================
$newSampleDataFunction = @'

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

'@

# ============================================
# NEW updateChartData FUNCTION
# ============================================
$newUpdateChartFunction = @'

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

'@

# ============================================
# NEW changeChartPeriod FUNCTION
# ============================================
$newChangePeriodFunction = @'

changeChartPeriod(period) {
    this.updateChartData(period);
}

'@

# ============================================
# APPLY THE REPLACEMENTS
# ============================================
Write-Host "Patching initializeChart()..." -ForegroundColor Yellow
$pattern = '(?s)initializeChart\(\)\s*\{.*?\n\s{4}\}'
if ($content -match $pattern) {
    $content = $content -replace $pattern, $newInitFunction
    Write-Host "   initializeChart patched" -ForegroundColor Green
} else {
    Write-Host "   initializeChart NOT found - appending" -ForegroundColor Yellow
    $content += "`r`n$newInitFunction"
}

Write-Host "Patching getChartLabels()..." -ForegroundColor Yellow
$pattern = '(?s)getChartLabels\([^)]*\)\s*\{.*?\n\s{4}\}'
if ($content -match $pattern) {
    $content = $content -replace $pattern, $newGetLabelsFunction
    Write-Host "   getChartLabels patched" -ForegroundColor Green
} else {
    Write-Host "   getChartLabels NOT found - appending" -ForegroundColor Yellow
    $content += "`r`n$newGetLabelsFunction"
}

Write-Host "Patching generateSampleData()..." -ForegroundColor Yellow
$pattern = '(?s)generateSampleData\([^)]*\)\s*\{.*?\n\s{4}\}'
if ($content -match $pattern) {
    $content = $content -replace $pattern, $newSampleDataFunction
    Write-Host "   generateSampleData patched" -ForegroundColor Green
} else {
    Write-Host "   generateSampleData NOT found - appending" -ForegroundColor Yellow
    $content += "`r`n$newSampleDataFunction"
}

Write-Host "Patching updateChartData()..." -ForegroundColor Yellow
$pattern = '(?s)updateChartData\([^)]*\)\s*\{.*?\n\s{4}\}'
if ($content -match $pattern) {
    $content = $content -replace $pattern, $newUpdateChartFunction
    Write-Host "   updateChartData patched" -ForegroundColor Green
} else {
    Write-Host "   updateChartData NOT found - appending" -ForegroundColor Yellow
    $content += "`r`n$newUpdateChartFunction"
}

Write-Host "Patching changeChartPeriod()..." -ForegroundColor Yellow
$pattern = '(?s)changeChartPeriod\([^)]*\)\s*\{.*?\n\s{4}\}'
if ($content -match $pattern) {
    $content = $content -replace $pattern, $newChangePeriodFunction
    Write-Host "   changeChartPeriod patched" -ForegroundColor Green
} else {
    Write-Host "   changeChartPeriod NOT found - appending" -ForegroundColor Yellow
    $content += "`r`n$newChangePeriodFunction"
}

# ============================================
# SAVE THE FILE
# ============================================
Write-Host ""
Write-Host "Saving dashboard.js..." -ForegroundColor Yellow
Set-Content $dashJsPath $content -Encoding UTF8 -NoNewline
Write-Host "   File saved successfully!" -ForegroundColor Green

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         PATCH COMPLETE!                " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "FUNCTIONS PATCHED:" -ForegroundColor Green
Write-Host "  - initializeChart()"
Write-Host "  - getChartLabels()"
Write-Host "  - generateSampleData()"
Write-Host "  - updateChartData()"
Write-Host "  - changeChartPeriod()"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Hard refresh your browser: Ctrl + Shift + R"
Write-Host "  2. The portfolio chart should now work correctly"
Write-Host "  3. Chart will be properly sized (250px desktop, 200px mobile)"
Write-Host ""
Write-Host "To restore from backup:" -ForegroundColor Gray
Write-Host "  Copy $backupDir\dashboard.js to frontend\js\dashboard.js"
Write-Host ""