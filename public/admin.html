<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Panel</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;min-height:100vh;padding:24px}
.card{background:#111;border:1px solid #222;border-radius:14px;padding:24px;max-width:900px;margin:0 auto}
h1{font-size:22px;font-weight:800;margin-bottom:20px}
input{width:100%;height:42px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:0 12px;color:#fff;font-size:14px;outline:none;margin-bottom:10px}
button{height:42px;padding:0 18px;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px}
.primary{background:#2a3eaa;color:#fff}.danger{background:#5a2424;color:#fff}.warn{background:#2a6bff;color:#fff}.ghost{background:#1a1a1a;color:#fff;border:1px solid #2a2a2a}
.row{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}
.stat{background:#1a1a1a;border-radius:10px;padding:14px}.stat-v{font-size:22px;font-weight:800}.stat-l{font-size:11px;color:#8a8a8a;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #1c1c1c}
th{color:#8a8a8a;font-size:11px;text-transform:uppercase}
.code{font-family:monospace}.muted{color:#555}
.ok{color:#5bff8a;font-size:13px;margin-top:8px}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.badge-live{background:#1a3a1a;color:#5bff8a}.badge-paused{background:#3a1a1a;color:#ff5b6f}
</style>
</head>
<body>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
    <h1>prx scripts — Admin</h1>
    <div style="display:flex;gap:8px;align-items:center">
      <span id="site-badge" class="badge"></span>
      <button class="warn" id="pause-btn" onclick="togglePause()">…</button>
    </div>
  </div>
  <div class="stats"><div class="stat"><div class="stat-v" id="s-total">-</div><div class="stat-l">Total keys</div></div><div class="stat"><div class="stat-v" id="s-used">-</div><div class="stat-l">Redeemed</div></div><div class="stat"><div class="stat-v" id="s-free">-</div><div class="stat-l">Available</div></div></div>
  <div class="row" style="margin-bottom:16px">
    <input type="number" id="gen-count" value="1" min="1" max="100" style="width:80px;margin:0">
    <button class="primary" onclick="genKeys()">Generate keys</button>
    <span id="gen-msg" class="ok" style="margin:0"></span>
  </div>
  <table><thead><tr><th>Code</th><th>Locked IP</th><th>Redeemed</th><th>Actions</th></tr></thead><tbody id="keys-body"></tbody></table>
</div>
<script>
const BASE=window.location.origin;
let paused=false;

async function api(method,path,body){
  const res=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  return{ok:res.ok,data:await res.json().catch(()=>({}))};
}

async function load(){
  const[kr,sr]=await Promise.all([api('GET','/admin/keys'),fetch(BASE+'/site/status').then(r=>r.json())]);
  const keys=kr.data.keys||[];
  paused=!!sr.paused;
  document.getElementById('s-total').textContent=keys.length;
  document.getElementById('s-used').textContent=keys.filter(k=>k.lockedIp).length;
  document.getElementById('s-free').textContent=keys.filter(k=>!k.lockedIp).length;
  document.getElementById('site-badge').textContent=paused?'PAUSED':'LIVE';
  document.getElementById('site-badge').className='badge '+(paused?'badge-paused':'badge-live');
  document.getElementById('pause-btn').textContent=paused?'Resume site':'Pause site';
  const tbody=document.getElementById('keys-body');
  tbody.innerHTML=keys.length===0?'<tr><td colspan="4" style="text-align:center;color:#555;padding:20px">No keys yet</td></tr>':
    keys.map(k=>`<tr><td class="code">${k.code}</td><td>${k.lockedIp||'<span class="muted">—</span>'}</td><td>${k.redeemedAt?new Date(k.redeemedAt).toLocaleDateString():'<span class="muted">—</span>'}</td><td style="display:flex;gap:6px">${k.lockedIp?`<button class="ghost" style="height:28px;padding:0 10px;font-size:12px" onclick="unlockKey('${k.code}')">Unlock</button>`:''}<button class="danger" style="height:28px;padding:0 10px;font-size:12px" onclick="delKey('${k.code}')">Delete</button></td></tr>`).join('');
}

async function genKeys(){const count=Number(document.getElementById('gen-count').value)||1;const r=await api('POST','/admin/keys',{count});document.getElementById('gen-msg').textContent=r.ok?`✅ Created ${r.data.keys?.length} key(s)`:'❌ Failed';if(r.ok)load();}
async function delKey(code){if(!confirm(`Delete ${code}?`))return;await api('DELETE',`/admin/keys/${encodeURIComponent(code)}`);load();}
async function unlockKey(code){await api('POST',`/admin/keys/${encodeURIComponent(code)}/unlock`);load();}
async function togglePause(){await api('POST','/admin/site/pause',{paused:!paused});load();}

load();
</script>
</body>
</html>
