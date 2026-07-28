import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerHealthTools } from './tools/health.js';
import { registerChartTools } from './tools/chart.js';
import { registerPineTools } from './tools/pine.js';
import { registerDataTools } from './tools/data.js';
import { registerCaptureTools } from './tools/capture.js';
import { registerDrawingTools } from './tools/drawing.js';
import { registerAlertTools } from './tools/alerts.js';
import { registerBatchTools } from './tools/batch.js';
import { registerReplayTools } from './tools/replay.js';
import { registerIndicatorTools } from './tools/indicators.js';
import { registerWatchlistTools } from './tools/watchlist.js';
import { registerUiTools } from './tools/ui.js';
import { registerPaneTools } from './tools/pane.js';
import { registerTabTools } from './tools/tab.js';

const PORT = process.env.TV_MCP_HTTP_PORT ? Number(process.env.TV_MCP_HTTP_PORT) : 9663;
const TOKEN = process.env.TV_MCP_TOKEN;
const BIND = process.env.TV_MCP_HTTP_BIND || '0.0.0.0';

if (!TOKEN) {
  process.stderr.write('TV_MCP_TOKEN not set - refusing to start an unauthenticated internet-facing MCP server.\n');
  process.exit(1);
}

function buildServer() {
  const server = new McpServer(
    {
      name: 'tradingview',
      version: '2.0.0',
      description: 'AI-assisted TradingView chart analysis and Pine Script development via Chrome DevTools Protocol',
    },
    {
      instructions: `TradingView MCP — 84 tools for reading and controlling a live TradingView Desktop chart.

TOOL SELECTION GUIDE — use this to pick the right tool:

Reading your chart:
- chart_get_state — get symbol, timeframe, all indicator names + entity IDs (call first)
- data_get_study_values — get current numeric values from ALL visible indicators (RSI, MACD, BB, EMA, etc.)
- quote_get — get real-time price snapshot (last, OHLC, volume)
- data_get_ohlcv — get price bars. ALWAYS pass summary=true unless you need individual bars

Reading custom Pine indicator output (line.new/label.new/table.new/box.new drawings):
- data_get_pine_lines — horizontal price levels from custom indicators (deduplicated, sorted)
- data_get_pine_labels — text annotations with prices ("PDH 24550", "Bias Long", etc.)
- data_get_pine_tables — table data as formatted rows (session stats, analytics dashboards)
- data_get_pine_boxes — price zones as {high, low} pairs
- ALWAYS pass study_filter to target a specific indicator by name (e.g., study_filter="Profiler")
- Indicators must be VISIBLE on chart for these to work

Changing the chart:
- chart_set_symbol, chart_set_timeframe, chart_set_type — change ticker/resolution/style
- chart_manage_indicator — add/remove studies. USE FULL NAMES: "Relative Strength Index" not "RSI"
- chart_scroll_to_date — jump to a date (ISO format)
- indicator_set_inputs — change indicator settings (length, source, etc.)

Pine Script development:
- pine_set_source — inject code, pine_smart_compile — compile + check errors
- pine_get_errors — read errors, pine_get_console — read log output
- WARNING: pine_get_source can return 200KB+ for complex scripts — avoid unless editing

Screenshots: capture_screenshot — regions: "full", "chart", "strategy_tester"
Replay: replay_start — replay_step — replay_trade — replay_status — replay_stop
Batch: batch_run — run action across multiple symbols/timeframes
Drawing: draw_shape — horizontal_line, trend_line, rectangle, text
Alerts: alert_create, alert_list, alert_delete
Launch: tv_launch — auto-detect and start TradingView with CDP on any platform
Panes: pane_list, pane_set_layout (s, 2h, 2v, 4, 6, 8), pane_focus, pane_set_symbol
Tabs: tab_list, tab_new, tab_close, tab_switch

CONTEXT MANAGEMENT:
- ALWAYS use summary=true on data_get_ohlcv
- ALWAYS use study_filter on pine tools when you know which indicator you want
- NEVER use verbose=true unless user specifically asks for raw data
- Prefer capture_screenshot for visual context over pulling large datasets
- Call chart_get_state ONCE at start, reuse entity IDs`,
    }
  );

  registerHealthTools(server);
  registerChartTools(server);
  registerPineTools(server);
  registerDataTools(server);
  registerCaptureTools(server);
  registerDrawingTools(server);
  registerAlertTools(server);
  registerBatchTools(server);
  registerReplayTools(server);
  registerIndicatorTools(server);
  registerWatchlistTools(server);
  registerUiTools(server);
  registerPaneTools(server);
  registerTabTools(server);

  return server;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

const httpServer = http.createServer(async (req, res) => {
  const auth = req.headers['authorization'] || '';
  const expected = `Bearer ${TOKEN}`;
  if (!auth || !timingSafeEqual(auth, expected)) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

  if (req.url !== '/mcp') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found - use /mcp' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed - stateless POST only' }));
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    let parsed;
    const raw = Buffer.concat(chunks).toString('utf8');
    try {
      parsed = raw ? JSON.parse(raw) : undefined;
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid json' }));
      return;
    }

    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, parsed);
    } catch (err) {
      process.stderr.write(`tradingview-mcp http error: ${err?.stack || err}\n`);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal error' }));
      }
    }
  });
});

httpServer.listen(PORT, BIND, () => {
  process.stderr.write(`tradingview-mcp HTTP (stateless, bearer auth) listening on ${BIND}:${PORT}/mcp\n`);
  process.stderr.write('Unofficial tool. Not affiliated with TradingView Inc. or Anthropic.\n');
});
