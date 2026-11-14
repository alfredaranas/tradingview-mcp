# Oracle-win host setup (2026-11-14)

Rebuild steps for running this connector on oracle-win (NucBox), desktop user `NUCBOX_EVO-T1\Alfred Aranas`.

1. TradingView Desktop: copy the Store package to `C:\Tools\TradingView-local` (Store apps cannot take the debug flag).
   Task `TradingViewDesktopAutostart`: that user, Interactive, AtLogOn + repeat every 5 min, IgnoreNew,
   action `C:\Tools\TradingView-local\TradingView.exe --remote-debugging-port=9222`. Sign in once by hand.
2. Repo at `C:\Tools\tradingview-mcp`, `cmd /c npm.cmd ci` (npm.ps1 is blocked by execution policy).
3. `C:\Tools\tradingview-mcp-run\`: copy `scripts/run_http_oracle.ps1` here; `token.txt` holds TV_MCP_TOKEN
   (ACL: Administrators + SYSTEM full, desktop user read). Log: `http_server.log`.
4. Task `TradingViewMCPHttp`: same user, Interactive, AtLogOn + repeat every 5 min, IgnoreNew,
   `powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Tools\tradingview-mcp-run\run_http_oracle.ps1`.
   The script exits when :9663 already listens, so the 5-min repeat is the watchdog.
5. Firewall rule `TradingView MCP 9663 tailnet`: inbound TCP 9663, remote 100.64.0.0/10 only.
6. Verify: POST http://100.86.195.121:9663/mcp tools/call tv_health_check with the bearer token; no token must give 401.

Known gap: the watchdog restarts a dead TradingView or connector, not a hung one.
