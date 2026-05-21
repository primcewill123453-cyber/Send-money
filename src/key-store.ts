import mongoose, { Schema, Model, Document } from 'mongoose';
import { randomBytes, createHash } from 'crypto';

const MONGO_URL = process.env.MONGO_URL;

interface KeyDoc extends Document { code:string; lockedIp:string|null; redeemedAt:Date|null; createdAt:Date; expiresAt:Date|null; note:string; }
interface SettingsDoc extends Document { key:string; value:unknown; }
interface SessionDoc extends Document { token:string; kind:'admin'|'user'; keyCode:string|null; ip:string|null; createdAt:Date; discordId:string|null; discordUsername:string|null; discordAvatarUrl:string|null; }

const KeyModel:Model<KeyDoc> = (mongoose.models.AccessKey as Model<KeyDoc>)||mongoose.model<KeyDoc>('AccessKey',new Schema<KeyDoc>({code:{type:String,required:true,unique:true,index:true},lockedIp:{type:String,default:null},redeemedAt:{type:Date,default:null},createdAt:{type:Date,default:()=>new Date()},expiresAt:{type:Date,default:null},note:{type:String,default:''}}));
const SettingsModel:Model<SettingsDoc> = (mongoose.models.Settings as Model<SettingsDoc>)||mongoose.model<SettingsDoc>('Settings',new Schema<SettingsDoc>({key:{type:String,required:true,unique:true},value:Schema.Types.Mixed}));
const SessionModel:Model<SessionDoc> = (mongoose.models.Session as Model<SessionDoc>)||mongoose.model<SessionDoc>('Session',new Schema<SessionDoc>({token:{type:String,required:true,unique:true,index:true},kind:{type:String,enum:['admin','user'],required:true},keyCode:{type:String,default:null},ip:{type:String,default:null},createdAt:{type:Date,default:()=>new Date(),expires:60*60*24*30},discordId:{type:String,default:null},discordUsername:{type:String,default:null},discordAvatarUrl:{type:String,default:null}}));

let connected=false;
export async function ensureConnected(){if(connected)return;if(!MONGO_URL)throw new Error('MONGO_URL not set');await mongoose.connect(MONGO_URL);connected=true;}

const genCode=()=>{const p=()=>randomBytes(2).toString('hex').toUpperCase();return `${p()}-${p()}-${p()}-${p()}`;};
const genToken=()=>randomBytes(24).toString('hex');

export type KeyRecord={code:string;lockedIp:string|null;redeemedAt:Date|null;createdAt:Date;expiresAt:Date|null;note:string};
const toRecord=(d:KeyDoc):KeyRecord=>({code:d.code,lockedIp:d.lockedIp??null,redeemedAt:d.redeemedAt??null,createdAt:d.createdAt,expiresAt:d.expiresAt??null,note:d.note??''});

export async function generateKeys(count=1,note='',expiresAt:string|null=null):Promise<KeyRecord[]>{
  await ensureConnected();
  const made:KeyRecord[]=[];
  for(let i=0;i<count;i++){
    const code=genCode();
    const doc=await KeyModel.create({code,note,expiresAt:expiresAt?new Date(expiresAt):null});
    made.push(toRecord(doc));
  }
  return made;
}
export async function listKeys():Promise<KeyRecord[]>{await ensureConnected();return (await KeyModel.find().sort({createdAt:-1})).map(toRecord);}
export async function deleteKey(code:string):Promise<boolean>{await ensureConnected();return (await KeyModel.deleteOne({code})).deletedCount>0;}
export async function unlockKey(code:string):Promise<boolean>{await ensureConnected();return (await KeyModel.updateOne({code},{$set:{lockedIp:null,redeemedAt:null}})).modifiedCount>0;}

export type RedeemResult={ok:true;token:string;key:KeyRecord;reason?:undefined}|{ok:false;reason:string;token?:undefined;key?:undefined};
export async function redeemKey(code:string,ip:string):Promise<RedeemResult>{
  await ensureConnected();
  const key=await KeyModel.findOne({code});
  if(!key)return{ok:false,reason:'invalid'};
  if(key.expiresAt&&key.expiresAt.getTime()<Date.now())return{ok:false,reason:'expired'};
  if(key.lockedIp&&key.lockedIp!==ip)return{ok:false,reason:'ip-locked'};
  if(!key.lockedIp){key.lockedIp=ip;key.redeemedAt=new Date();await key.save();}
  const token=genToken();
  await SessionModel.create({token,kind:'user',keyCode:code,ip});
  return{ok:true,token,key:toRecord(key)};
}

export type UserSession={key:KeyRecord;discord:{id:string|null;username:string|null;avatarUrl:string|null}};
export async function validateUserSession(token:string,ip:string):Promise<UserSession|null>{
  await ensureConnected();
  const sess=await SessionModel.findOne({token,kind:'user'});
  if(!sess)return null;
  if(sess.ip&&sess.ip!==ip)return null;
  const key=await KeyModel.findOne({code:sess.keyCode});
  if(!key)return null;
  if(key.expiresAt&&key.expiresAt.getTime()<Date.now())return null;
  return{key:toRecord(key),discord:{id:sess.discordId,username:sess.discordUsername,avatarUrl:sess.discordAvatarUrl}};
}

export async function linkDiscordToSession(token:string,discord:{id:string;username:string;avatarUrl:string}):Promise<boolean>{
  await ensureConnected();
  return (await SessionModel.updateOne({token,kind:'user'},{$set:{discordId:discord.id,discordUsername:discord.username,discordAvatarUrl:discord.avatarUrl}})).modifiedCount>0;
}

const hashPw=(pw:string)=>createHash('sha256').update(pw).digest('hex');
export async function adminLogin(password:string):Promise<string|null>{await ensureConnected();const e=process.env.ADMIN_PASSWORD;if(!e)return null;if(hashPw(password)!==hashPw(e))return null;const token=genToken();await SessionModel.create({token,kind:'admin'});return token;}
export async function isAdmin(token:string|undefined|null):Promise<boolean>{if(!token)return false;await ensureConnected();return !!(await SessionModel.findOne({token,kind:'admin'}));}
export async function getPaused():Promise<boolean>{await ensureConnected();return !!(await SettingsModel.findOne({key:'paused'}))?.value;}
export async function setPaused(paused:boolean):Promise<void>{await ensureConnected();await SettingsModel.updateOne({key:'paused'},{$set:{value:paused}},{upsert:true});}
