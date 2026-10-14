import {emptyWorkspace,workspaceSchema,type Workspace} from './domain';
export const STORAGE_KEY='ad.workspace.v1';
export interface StoragePort { getItem(key:string):string|null; setItem(key:string,value:string):void }
export class WorkspaceRepository {
 private raw:string|null=null;
 constructor(private storage:StoragePort){}
 read():Workspace {
  const raw=this.storage.getItem(STORAGE_KEY);
  // Never replace unreadable or incompatible user data with an empty workspace.
  const data=raw===null?emptyWorkspace():workspaceSchema.parse(JSON.parse(raw));
  this.raw=raw; return data;
 }
 commit(next:Workspace):Workspace {
  if(this.storage.getItem(STORAGE_KEY)!==this.raw) throw new Error('Cet espace a changé dans un autre onglet. Rechargez avant de réessayer ; votre brouillon est conservé.');
  const validated=workspaceSchema.parse({...next,revision:next.revision+1});
  const serialized=JSON.stringify(validated);
  this.storage.setItem(STORAGE_KEY,serialized);
  const readback=this.storage.getItem(STORAGE_KEY);
  if(readback!==serialized) throw new Error('La relecture de la sauvegarde a échoué. Conservez votre brouillon.');
  this.raw=readback;
  return workspaceSchema.parse(JSON.parse(readback));
 }
}
export function exportBackup(s:Workspace):string {return JSON.stringify(workspaceSchema.parse(s),null,2)}
export function parseBackup(raw:string):Workspace {
 if(raw.length>20_000_000) throw new Error('Sauvegarde trop volumineuse (20 Mo maximum).');
 return workspaceSchema.parse(JSON.parse(raw));
}
