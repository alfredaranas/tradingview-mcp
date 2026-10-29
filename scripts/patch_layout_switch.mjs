import fs from 'fs';
const p = 'src/core/ui.js';
let s = fs.readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error('anchor count ' + n + ' for: ' + a.slice(0, 60));
  s = s.replace(a, () => b);
}
// 1. helper that resolves the chartList entry object (loadChart needs the object, not an id)
rep(
  String.raw`var target = ${'$'}{escaped};`,
  String.raw`var target = ${'$'}{escaped};` + nl +
  String.raw`        var __ld=function(id){var l=window.TradingViewApi._loadChartService;var st=l.state();if(st&&st.value)st=st.value();var e=(st.chartList||[]).filter(function(c){return String(c.id)===String(id);})[0];if(!e)throw new Error('layout id '+id+' not in chartList');l.loadChart(e,false);return e.url;};`
);
// 2. numeric-id branch
rep(
  "window.TradingViewApi.loadChartFromServer(target); resolve({success: true, method: 'loadChartFromServer', id: target, source: 'internal_api'});",
  "var sid=__ld(target); resolve({success: true, method: 'loadChart', id: target, sid: sid, source: 'internal_api'});"
);
// 3. name branch
rep("window.TradingViewApi.loadChartFromServer(chartId);", "var sid=__ld(chartId);");
rep(
  "resolve({success: true, method: 'loadChartFromServer', id: chartId, name: match.name || match.title, source: 'internal_api'});",
  "resolve({success: true, method: 'loadChart', id: chartId, sid: sid, name: match.name || match.title, source: 'internal_api'});"
);
// 4. verify the switch really happened (old code reported success unconditionally)
rep(
  "if (dismissed) await new Promise(r => setTimeout(r, 1000));",
  "if (dismissed) await new Promise(r => setTimeout(r, 1000));" + nl +
  "  const verifyJs = '(function(){var s=window.TradingViewApi._saveChartService;var v=typeof s.layoutId===\"function\"?s.layoutId():s.layoutId;if(v&&typeof v===\"object\"&&v.value)v=v.value();return String(v)===' + JSON.stringify(String(result.sid)) + ';})()';" + nl +
  "  let landed = false;" + nl +
  "  for (let i = 0; i < 20 && !landed; i++) { await new Promise(r => setTimeout(r, 500)); landed = await evaluate(verifyJs); }" + nl +
  "  if (!landed) throw new Error('layout switch did not take effect (layoutId never became ' + result.sid + ')');"
);
fs.writeFileSync(p, s);
console.log('patched ok');
