$ErrorActionPreference = 'SilentlyContinue'
$repo = 'C:\Users\WinTrader\tradingview-mcp'
$logDir = 'C:\Users\WinTrader\tv-mcp-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'http_server.log'

function Log($msg) {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "$ts $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}

Log 'run_http_persistent.ps1 starting'

$tvRunning = Get-Process | Where-Object { $_.Name -like '*TradingView*' }
if (-not $tvRunning) {
    Log 'TradingView not running, launching via tv CLI'
    Push-Location $repo
    & node src/cli/index.js launch 2>&1 | Out-File -FilePath $logFile -Append -Encoding utf8
    Pop-Location
    Start-Sleep -Seconds 15
} else {
    Log "TradingView already running ($($tvRunning.Count) processes)"
}

while ($true) {
    Log 'starting src/server_http.js'
    Push-Location $repo
    & node src/server_http.js 2>&1 | Out-File -FilePath $logFile -Append -Encoding utf8
    Pop-Location
    Log 'src/server_http.js exited, restarting in 5s'
    Start-Sleep -Seconds 5
}
