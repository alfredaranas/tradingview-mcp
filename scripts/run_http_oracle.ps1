$ErrorActionPreference = 'SilentlyContinue'
$repo = 'C:\Tools\tradingview-mcp'
$run = 'C:\Tools\tradingview-mcp-run'
$logFile = Join-Path $run 'http_server.log'
function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Out-File -FilePath $logFile -Append -Encoding utf8 }
if (Get-NetTCPConnection -LocalPort 9663 -State Listen) { exit 0 }
$env:TV_MCP_TOKEN = (Get-Content (Join-Path $run 'token.txt') -Raw).Trim()
$env:TV_MCP_HTTP_PORT = '9663'
Log 'run_http_oracle.ps1 starting (TradingView itself is owned by task TradingViewDesktopAutostart)'
Set-Location $repo
while ($true) {
    Log 'starting src/server_http.js'
    & node src/server_http.js 2>&1 | Out-File -FilePath $logFile -Append -Encoding utf8
    Log 'src/server_http.js exited, restarting in 5s'
    Start-Sleep -Seconds 5
}
