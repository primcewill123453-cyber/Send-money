import{readFileSync,writeFileSync,existsSync,mkdirSync}from'fs';
import{join,dirname}from'path';
import{fileURLToPath}from'url';
import{randomBytes,createHash}from'crypto';

const __dir=dirname(fileURLToPath(import.meta.url));
const DATA=join(__dir,'../data.json');

export type KeyRecord={code:string;lockedIp:string|null;redeemedAt:string|null;createdAt:string;expiresAt:string|null;note:string};
type Session={token:string;kind:'admin'|'user';keyCode:string|null;ip:string|null;createdAt:string;discordId:string|null;discordUsername:string|null;discordAvatarUrl:string|null};
type DB={keys:KeyRecord[];sessions:Session[];paused:boolean};

function read():DB{try{if(existsSync(DATA))return JSON.parse(readFileSync(DATA,'utf8'));}catch{}return{keys:[],sessions:[],paused:false};}
function save(db:DB){writeFileSync(DATA,JSON.stringify(db,null,2));}

const genCode=()=>{const p=()=>randomBytes(2).toString('hex').toUpperCase();return`${p()}-${p()}-${p()}-${p()}`;};
const genToken=()=>randomBytes(24).toString('hex');
const hashPw=(pw:string)=>createHash('sha256').update(pw).digest('hex');

export function generateKeys(count=1,note='',expiresAt:string|null=null):KeyRecord[]{
  const db=read();const made:KeyRecord[]=[];
  for(let i=0;i<count;i++){const k:KeyRecord={code:genCode(),lockedIp:null,redeemedAt:null,createdAt:new Date().toISOString(),expiresAt,note};db.keys.push(k);made.push(k);}
  save(db);return made;
}
export function listKeys():KeyRecord[]{return read().keys.slice().reverse();}
export function deleteKey(code:string):boolean{const db=read();const l=db.keys.length;db.keys=db.keys.filter(k=>k.code!==code);save(db);return db.keys.length<l;}
export function unlockKey(code:string):boolean{const db=read();const k=db.keys.find(k=>k.code===code);if(!k)return false;k.lockedIp=null;k.redeemedAt=null;save(db);return true;}

export type RedeemResult={ok:true;token:string;key:KeyRecord}|{ok:false;reason:string};
export function redeemKey(code:string,ip:string):RedeemResult{
  const db=read();
  const key=db.keys.find(k=>k.code===code);
  if(!key)return{ok:false,reason:'invalid'};
  if(key.expiresAt&&new Date(key.expiresAt).getTime()<Date.now())return{ok:false,reason:'expired'};
  if(key.lockedIp&&key.lockedIp!==ip)return{ok:false,reason:'ip-locked'};
  if(!key.lockedIp){key.lockedIp=ip;key.redeemedAt=new Date().toISOString();}
  const token=genToken();
  db.sessions.push({token,kind:'user',keyCode:code,ip,createdAt:new Date().toISOString(),discordId:null,discordUsername:null,discordAvatarUrl:null});
  save(db);return{ok:true,token,key};
}

export type UserSession={key:KeyRecord;discord:{id:string|null;username:string|null;avatarUrl:string|null}};
export function validateUserSession(token:string,ip:string):UserSession|null{
  const db=read();
  const sess=db.sessions.find(s=>s.token===token&&s.kind==='user');
  if(!sess)return null;
  if(sess.ip&&sess.ip!==ip)return null;
  const key=db.keys.find(k=>k.code===sess.keyCode);
  if(!key)return null;
  if(key.expiresAt&&new Date(key.expiresAt).getTime()<Date.now())return null;
  return{key,discord:{id:sess.discordId,username:sess.discordUsername,avatarUrl:sess.discordAvatarUrl}};
}
export function linkDiscordToSession(token:string,discord:{id:string;username:string;avatarUrl:string}):boolean{
  const db=read();const sess=db.sessions.find(s=>s.token===token&&s.kind==='user');
  if(!sess)return false;sess.discordId=discord.id;sess.discordUsername=discord.username;sess.discordAvatarUrl=discord.avatarUrl;save(db);return true;
}
export function adminLogin(password:string):string|null{
  const expected=process.env.ADMIN_PASSWORD||'admin';
  if(hashPw(password)!==hashPw(expected))return null;
  const db=read();const token=genToken();
  db.sessions.push({token,kind:'admin',keyCode:null,ip:null,createdAt:new Date().toISOString(),discordId:null,discordUsername:null,discordAvatarUrl:null});
  save(db);return token;
}
export function isAdmin(token:string|undefined|null):boolean{if(!token)return false;return read().sessions.some(s=>s.token===token&&s.kind==='admin');}
export function getPaused():boolean{return read().paused;}
export function setPaused(paused:boolean):void{const db=read();db.paused=paused;save(db);}
