import mongoose,{Schema,Model,Document}from'mongoose';
import{randomBytes,createHash}from'crypto';

const MONGO_URL=process.env.MONGO_URL;

interface KeyDoc extends Document{code:string;lockedIp:string|null;redeemedAt:Date|null;createdAt:Date;expiresAt:Date|null;note:string}
interface SettingsDoc extends Document{key:string;value:unknown}
interface SessionDoc extends Document{token:string;kind:'admin'|'user';keyCode:string|null;ip:string|null;createdAt:Date;discordId:string|null;discordUsername:string|null;discordAvatarUrl:string|null}

const KeyModel:Model<KeyDoc>=(mongoose.models.AccessKey as Model<KeyDoc>)||mongoose.model<KeyDoc>('AccessKey',new Schema<KeyDoc>({code:{type:String,required:true,unique:true,index:true},lockedIp:{type:String,default:null},redeemedAt:{type:Date,default:null},createdAt:{type:Date,default:()=>new Date()},expiresAt:{type:Date,default:null},note:{type:String,default:''}}));
const SettingsModel:Model<SettingsDoc>=(mongoose.models.Settings as Model<SettingsDoc>)||mongoose.model<SettingsDoc>('Settings',new Schema<SettingsDoc>({key:{type:String,required:true,unique:true},value:Schema.Types.Mixed}));
const SessionModel:Model<SessionDoc>=(mongoose.models.Session as Model<SessionDoc>)||mongoose.model<SessionDoc>('Session',new Schema<SessionDoc>({token:{type:String,required:true,unique:true,index:true},kind:{type:String,enum:['admin','user'],required:true},keyCode:{type:String,default:null},ip:{type:String,default:null},createdAt:{type:Date,default:()=>new Date(),expires:60*60*24*30},discordId:{type:String,default:null},discordUsername:{type:String,default:null},discordAvatarUrl:{type:String,default:null}}));

let connected=false;
async function connect(){if(connected)return;if(!MONGO_URL)throw new Error('MONGO_URL not set');await mongoose.connect(MONGO_URL);connected=true;}

const genCode=()=>{const p=()=>randomBytes(2).toString('hex').toUpperCase();return`${p()}-${p()}-${p()}-${p()}`;};
const genToken=()=>randomBytes(24).toString('hex');
const hashPw=(pw:string)=>createHash('sha256').update(pw).digest('hex');

export type KeyRecord={code:string;lockedIp:string|null;redeemedAt:Date|null;createdAt:Date;expiresAt:Date|null;note:string};
const toRecord=(d:KeyDoc):KeyRecord=>({code:d.code,lockedIp:d.lockedIp??null,redeemedAt:d.redeemedAt??null,createdAt:d.createdAt,expiresAt:d.expiresAt??null,note:d.note??''});

export async function generateKeys(count=1,note='',expiresAt:string|null=null):Promise<KeyRecord[]>{
  await connect();const made:KeyRecord[]=[];
  for(let i=0;i<count;i++){const doc=await KeyModel.create({code:genCode(),note,expiresAt:expiresAt?new Date(expiresAt):null});made.push(toRecord(doc));}
  return made;
}
export async function listKeys():Promise<KeyRecord[]>{await connect();return(await KeyModel.find().sort({createdAt:-1})).map(toRecord);}
export async function deleteKey(code:string):Promise<boolean>{await connect();return(await KeyModel.deleteOne({code})).deletedCount>0;}
export async function unlockKey(code:string):Promise<boolean>{await connect();return(await KeyModel.updateOne({code},{$set:{lockedIp:null,redeemedAt:null}})).modifiedCount>0;}

export type RedeemResult={ok:true;token:string;key:KeyRecord}|{ok:false;reason:string};
export async function
