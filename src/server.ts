import express,{Request,Response,NextFunction} from 'express';
import {randomBytes} from 'crypto';
import {RobloxProxy} from './roblox-proxy.js';
import {generateKeys,listKeys,deleteKey,unlockKey,redeemKey,validateUserSession,linkDiscordToSession,adminLogin,isAdmin,getPaused,setPaused} from './key-store.js';
import {DISCORD_ENABLED,buildAuthUrl,exchangeCode,fetchSelf,fetchGuildMember,findGuildMemberByName} from './discord.js';

const app=express();
app.use(express.json());
app.set('trust proxy',true);

const ORIGINS=(process.env.ALLOWED_ORIGINS||'*').split(',').map(s=>s.trim()).filter(Boolean);
app.use((req:Request,res:Response,next:NextFunction)=>{
  const o=req.headers.origin||'';
  if(ORIGINS.includes('*')||(o&&ORIGINS.includes(o))){res.setHeader('Access-Control-Allow-Origin',o||'*');res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,X-Admin-Token,X-User-Token');
  if(req.method==='OPTIONS'){res.sendStatus(204);return;}
  next();
});

const proxy=RobloxProxy.from();
const PORT=Number(process.env.PORT||3000);
const send=(res:Response,p:{status:number;body:string})=>res.status(p.status).type('application/json').send(p.body);
const ip=(req:Request)=>((req.headers['x-forwarded-for']||'') as string).split(',')[0]?.trim()||req.ip||'unknown';
const auth=async(req:Request,res:Response)=>{const t=(req.headers['x-admin-token'] as string)||(req.headers.authorization||'').replace(/^Bearer /,'');if(!(await isAdmin(t))){res.status(401).json({error:'unauthorized'});return false;}return true;};

app.get('/health',(_,res)=>res.json({ok:true}));
app.get('/search',async(req,res)=>{const k=String(req.query.keyword||'');if(!k)return res.status(400).json({error:'keyword required'});try{send(res,await proxy.search(k,Number(req.query.limit||10)))}catch(e){res.status(502).json({error:String(e)})}});
app.post('/lookup',async(req,res)=>{const u=req.body?.usernames||[];if(!u.length)return res.status(400).json({error:'usernames required'});try{send(res,await proxy.lookupByUsernames(u))}catch(e){res.status(502).json({error:String(e)})}});
app.get('/user/:id',async(req,res)=>{try{send(res,await proxy.lookupById(req.params.id))}catch(e){res.status(502).json({error:String(e)})}});
app.get('/avatars',async(req,res)=>{const u=String(req.query.userIds||'');if(!u)return res.status(400).json({error:'userIds required'});try{send(res,await proxy.avatars(u))}catch(e){res.status(502).json({error:String(e)})}});
app.get('/friends/count/:id',async(req,res)=>{try{send(res,await proxy.friendCount(req.params.id))}catch(e){res.status(502).json({error:String(e)})}});
app.get('/resolve/:username',async(req,res)=>{try{send(res,await proxy.resolveByName(req.params.username))}catch(e){res.status(502).json({error:String(e)})}});
app.get('/site/status',async(_,res)=>{try{res.json({paused:await getPaused()})}catch(e){res.status(500).json({error:String(e)})}});

app.post('/keys/redeem',async(req,res)=>{
  const code=String(req.body?.code||'').trim(),du=String(req.body?.discordUsername||'').trim();
  if(!code)return res.status(400).json({error:'code required'});
  try{
    if(await getPaused())return res.status(503).json({error:'site is paused'});
    let dm=null;
    if(du&&DISCORD_ENABLED){try{dm=await findGuildMemberByName(du)}catch{}if(!dm)return res.status(403).json({error:'discord-not-found'});}
    const r=await redeemKey(code,ip(req));
    if(!r.ok)return res.status(403).json({error:r.reason});
    if(dm){try{await linkDiscordToSession(r.token,{id:dm.user.id,username:dm.user.globalName||dm.user.username,avatarUrl:dm.user.avatarUrl})}catch{}}
    res.json({token:r.token,key:r.key});
  }catch(e){res.status(500).json({error:String(e)})}
});

app.get('/keys/me',async(req,res)=>{
  const t=(req.headers['x-user-token'] as string)||String(req.query.token||'');
  if(!t)return res.status(401).json({error:'no token'});
  try{
    const s=await validateUserSession(t,ip(req));
    if(!s)return res.status(401).json({error:'invalid'});
    const m=s.discord.id?await fetchGuildMember(s.discord.id).catch(()=>null):null;
    res.json({key:s.key,discord:s.discord,member:m,discordEnabled:DISCORD_ENABLED});
  }catch(e){res.status(500).json({error:String(e)})}
});

const states=new Map<string,{token:string;createdAt:number}>();
const ruri=(req:Request)=>`${(req.headers['x-forwarded-proto'] as string)||req.protocol}://${req.headers.host}/auth/discord/callback`;

app.get('/auth/discord/login',(req,res)=>{
  if(!DISCORD_ENABLED)return res.status(503).json({error:'discord not configured'});
  const t=(req.headers['x-user-token'] as string)||String(req.query.token||'');
  if(!t)return res.status(401).json({error:'redeem a key first'});
  const now=Date.now();for(const[k,v]of states)if(now-v.createdAt>600000)states.delete(k);
  const state=randomBytes(16).toString('hex');states.set(state,{token:t,createdAt:Date.now()});
  res.redirect(buildAuthUrl(ruri(req),state));
});

app.get('/auth/discord/callback',async(req,res)=>{
  const code=String(req.query.code||''),state=String(req.query.state||'');
  const e=states.get(state);states.delete(state);
  if(!code||!e)return res.status(400).send('Invalid Discord callback');
  try{
    const at=await exchangeCode(code,ruri(req));if(!at)throw new Error('exchange failed');
    const self=await fetchSelf(at);if(!self)throw new Error('fetch self failed');
    await linkDiscordToSession(e.token,{id:self.id,username:self.globalName||self.username,avatarUrl:self.avatarUrl});
    res.send(`<!doctype html><body style="background:#000;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px"><div style="font-size:20px;font-weight:700">Discord linked!</div><div style="color:#8a8a8a">You can close this window.</div><script>setTimeout(()=>{try{window.opener&&window.opener.postMessage('discord-linked','*');window.close()}catch(e){}},600)</script></body>`);
  }catch(err){res.status(500).send(`Discord login failed: ${String(err)}`)}
});

app.post('/admin/login',async(req,res)=>{const p=String(req.body?.password||'');if(!p)return res.status(400).json({error:'password required'});try{const t=await adminLogin(p);if(!t)return res.status(401).json({error:'invalid password'});res.json({token:t})}catch(e){res.status(500).json({error:String(e)})}});
app.get('/admin/keys',async(req,res)=>{if(!(await auth(req,res)))return;try{res.json({keys:await listKeys()})}catch(e){res.status(500).json({error:String(e)})}});
app.post('/admin/keys',async(req,res)=>{if(!(await auth(req,res)))return;try{res.json({keys:await generateKeys(Math.max(1,Math.min(100,Number(req.body?.count||1))),String(req.body?.note||''))})}catch(e){res.status(500).json({error:String(e)})}});
app.delete('/admin/keys/:code',async(req,res)=>{if(!(await auth(req,res)))return;try{res.json({ok:await deleteKey(req.params.code)})}catch(e){res.status(500).json({error:String(e)})}});
app.post('/admin/keys/:code/unlock',async(req,res)=>{if(!(await auth(req,res)))return;try{res.json({ok:await unlockKey(req.params.code)})}catch(e){res.status(500).json({error:String(e)})}});
app.post('/admin/site/pause',async(req,res)=>{if(!(await auth(req,res)))return;const p=!!req.body?.paused;try{await setPaused(p);res.json({ok:true,paused:p})}catch(e){res.status(500).json({error:String(e)})}});

app.listen(PORT,()=>console.log(`🚀 Robux proxy ready on port ${PORT}`));
