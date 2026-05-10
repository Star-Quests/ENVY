# IMMEDIATE RESTORE - Run this now

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    RESTORING DASHBOARD NOW            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$currentDir = Get-Location
$dashboardHtml = Join-Path $currentDir "frontend\dashboard.html"

# Find most recent backup
$backups = Get-ChildItem -Directory -Filter "backup_*" | Sort-Object LastWriteTime -Descending

if ($backups.Count -gt 0) {
    $latestBackup = $backups[0].FullName
    Write-Host "Found backup: $latestBackup" -ForegroundColor Green
    
    $backupFile = Join-Path $latestBackup "dashboard.html"
    if (Test-Path $backupFile) {
        Copy-Item $backupFile $dashboardHtml -Force
        Write-Host "✅ Dashboard restored!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Hard refresh browser: Ctrl + Shift + R" -ForegroundColor Yellow