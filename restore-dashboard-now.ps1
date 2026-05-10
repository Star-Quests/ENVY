# RESTORE DASHBOARD IMMEDIATELY

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    RESTORING DASHBOARD                " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$currentDir = Get-Location
$dashboardHtml = Join-Path $currentDir "frontend\dashboard.html"

# Find the most recent backup
$backupDirs = Get-ChildItem -Directory -Filter "backup_*" | Sort-Object LastWriteTime -Descending

if ($backupDirs.Count -gt 0) {
    $latestBackup = $backupDirs[0].FullName
    Write-Host "Found backup: $latestBackup" -ForegroundColor Green
    
    $backupDashboard = Join-Path $latestBackup "dashboard.html"
    if (Test-Path $backupDashboard) {
        Copy-Item $backupDashboard $dashboardHtml -Force
        Write-Host "Dashboard restored from backup!" -ForegroundColor Green
        Write-Host "Hard refresh your browser: Ctrl+Shift+R" -ForegroundColor Yellow
    } else {
        Write-Host "No dashboard.html found in backup" -ForegroundColor Red
    }
} else {
    Write-Host "No backups found!" -ForegroundColor Red
}