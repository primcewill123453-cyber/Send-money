const CLIENT_ID = process.env.DISCORD_CLIENT_ID||'';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET||'';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN||'';
const GUILD_ID = process.env.DISCORD_GUILD_ID||'';

export const DISCORD_ENABLED = !!(CLIENT_ID&&CLIENT_SECRET);
export const DISCORD_BOT_ENABLED = !!(BOT_TOKEN&&GUILD_ID);

export type DiscordUser = {id:string;username:string;globalName:string|null;avatar:string|null;avatarUrl:string};
export type DiscordMember = {inGuild:boolean;nickname:string|null;roles:string[];joinedAt:string|null};
export type GuildMemberMatch = {user:DiscordUser;member:DiscordMember};

function avatarUrlFor(id:string,avatar:string|null):string {
  return avatar?`https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`:`https://cdn.discordapp.com/embed/avatars/${(Number(id)>>22)%6}.png`;
}

export function buildAuthUrl(redirectUri:string,state:string):string {
  return `https://discord.com/api/oauth2/authorize?${new URLSearchParams({client_id:CLIENT_ID,response_type:'code',scope:'identify guilds.members.read',redirect_uri:redirectUri,state}).toString()}`;
}

export async function exchangeCode(code:string,redirectUri:string):Promise<string|null> {
  const res=await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:redirectUri}).toString()});
  if(!res.ok) return null;
  const j=await res.json() as {access_token?:string};
  return j.access_token||null;
}

export async function fetchSelf(accessToken:string):Promise<DiscordUser|null> {
  const res=await fetch('https://discord.com/api/users/@me',{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!res.ok) return null;
  const j=await res.json() as {id:string;username:string;global_name?:string|null;avatar?:string|null};
  return {id:j.id,username:j.username,globalName:j.global_name||null,avatar:j.avatar||null,avatarUrl:avatarUrlFor(j.id,j.avatar||null)};
}

export async function fetchGuildMember(userId:string):Promise<DiscordMember|null> {
  if(!DISCORD_BOT_ENABLED) return null;
  const res=await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`,{headers:{Authorization:`Bot ${BOT_TOKEN}`}});
  if(res.status===404) return {inGuild:false,nickname:null,roles:[],joinedAt:null};
  if(!res.ok) return null;
  const j=await res.json() as {nick?:string;roles?:string[];joined_at?:string};
  return {inGuild:true,nickname:j.nick||null,roles:j.roles||[],joinedAt:j.joined_at||null};
}

export async function findGuildMemberByName(query:string):Promise<GuildMemberMatch|null> {
  if(!DISCORD_BOT_ENABLED) return null;
  const q=query.trim().replace(/^@/,'');
  if(!q) return null;
  const res=await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/search?query=${encodeURIComponent(q)}&limit=25`,{headers:{Authorization:`Bot ${BOT_TOKEN}`}});
  if(!res.ok) return null;
  const list=await res.json() as Array<{user:{id:string;username:string;global_name?:string|null;avatar?:string|null};nick?:string|null;roles?:string[];joined_at?:string|null}>;
  if(!Array.isArray(list)||!list.length) return null;
  const lower=q.toLowerCase();
  const m=list.find(m=>m.user.username.toLowerCase()===lower)||list.find(m=>(m.user.global_name||'').toLowerCase()===lower)||list.find(m=>(m.nick||'').toLowerCase()===lower)||list[0];
  return {user:{id:m.user.id,username:m.user.username,globalName:m.user.global_name||null,avatar:m.user.avatar||null,avatarUrl:avatarUrlFor(m.user.id,m.user.avatar||null)},member:{inGuild:true,nickname:m.nick||null,roles:m.roles||[],joinedAt:m.joined_at||null}};
}
