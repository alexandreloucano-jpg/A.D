import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, RefreshCw } from "lucide-react";
import { workspaceSchema, type Workspace } from "../domain";
import { type RemoteSaver } from "../remote-saver";
import { exportBackup } from "../storage";
type Snapshot = {exists:boolean;serverRevision:number;workspace:Workspace|null;updatedAt:string|null};
function validateSnapshot(raw:Snapshot):Snapshot {
  if(raw.exists) {
    if(!raw.workspace||!Number.isInteger(raw.serverRevision)||raw.serverRevision<1)
      throw Error("Sauvegarde cloud invalide.");
    return {...raw,workspace:workspaceSchema.parse(raw.workspace)};
  }
  if(raw.workspace!==null||raw.serverRevision!==0)
    throw Error("Réponse cloud incohérente.");
  return raw;
}
const stats=(s:Workspace)=>[
  s.projects.length+" dossiers",
  s.tasks.length+" actions",
  (s.creativeBoards||[]).length+" traitements",
  s.references.length+" références locales",
].join(" · ");
export function WorkspaceCloudPanel({local,remote,commit,fatal}:{
  local:Workspace;remote:RemoteSaver;fatal:boolean;
  commit:(next:Workspace,message:string)=>boolean;
}){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [confirmUpload,setConfirmUpload]=useState(false);
  const [confirmRestore,setConfirmRestore]=useState(false);
  async function refresh(){
    if(!remote.connected)return;
    setBusy(true);setError("");
    try{
      const next=validateSnapshot(await remote.reader<Snapshot>("/api/workspace/snapshot"));
      setSnapshot(next);setMessage(next.exists?"Sauvegarde cloud accessible. Comparez les deux versions.":"Aucune sauvegarde cloud. La copie locale est intacte.");
    }catch(e){setSnapshot(null);setError(e instanceof Error?e.message:"Lecture cloud indisponible.");}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    setSnapshot(null);setConfirmUpload(false);setConfirmRestore(false);setMessage("");setError("");
    if(remote.connected)void refresh();
  },[remote.connected]);
  async function upload(){
    if(!snapshot||!confirmUpload||fatal)return;
    setBusy(true);setError("");setMessage("");
    try{
      const saved=await remote.reader<{saved:boolean;serverRevision:number;workspace:Workspace}>(
        "/api/workspace/snapshot","POST",{
          expectedServerRevision:snapshot.serverRevision,
          workspace:workspaceSchema.parse(local),
          explicitUserAction:true,
        });
      if(!saved.saved)throw Error("Écriture cloud non confirmée.");
      // Independent GET read-back prevents a misleading success toast on writes.
      const confirmed=validateSnapshot(await remote.reader<Snapshot>("/api/workspace/snapshot"));
      if(confirmed.serverRevision!==saved.serverRevision ||
        !confirmed.workspace || exportBackup(confirmed.workspace)!==exportBackup(workspaceSchema.parse(local)))
        throw Error("Relecture cloud incohérente. La copie locale a été conservée.");
      setSnapshot(confirmed);setConfirmUpload(false);
      setMessage("Sauvegarde cloud vérifiée (version "+confirmed.serverRevision+"). Copie locale conservée.");
    }catch(e){setError(e instanceof Error?e.message:"Synchronisation non confirmée. Conservez la copie locale.");}
    finally{setBusy(false);}
  }
  function restore(){
    if(!snapshot?.workspace||!confirmRestore||fatal)return;
    // Do not let a stale browser overwrite edits made in another tab.
    const ok=commit(snapshot.workspace,"Sauvegarde cloud relue et restaurée sur cet appareil.");
    if(ok){setConfirmRestore(false);setMessage("Restauration locale confirmée. Le cloud n'a pas été modifié.");}
    else setError("Restauration refusée : le contenu local n'a pas été modifié.");
  }
  return <section className="ad-cloud" aria-label="Sauvegarde cloud des dossiers" style={{borderTop:"1px solid currentColor",paddingTop:16,marginTop:18}}>
    <h3>Sauvegarde cloud des dossiers</h3>
    <p>D'abord une copie locale, puis une copie serveur volontaire. Aucune fusion automatique, aucune suppression et aucun transfert vers un nouveau compte.</p>
    <p><strong>Sur cet appareil :</strong> {stats(local)}</p>
    {!remote.connected?<p>Connectez le compte propriétaire pour accéder à la sauvegarde cloud privée.</p>:
      <>
        {snapshot?.workspace?<p><strong>Dans le cloud (version {snapshot.serverRevision}) :</strong> {stats(snapshot.workspace)} · {snapshot.updatedAt?new Date(snapshot.updatedAt).toLocaleString("fr-FR"):"Date inconnue"}</p>
        :snapshot?<p>Aucune version cloud existante.</p>:null}
        <button type="button" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={15}/> Vérifier les versions</button>
        {!!snapshot&&<>
          <label style={{display:"flex",alignItems:"start",gap:8,marginTop:12}}>
            <input type="checkbox" checked={confirmUpload} onChange={e=>setConfirmUpload(e.target.checked)}/>
            J'ai conservé une exportation JSON. Autoriser la copie locale à remplacer la dernière version cloud après contrôle de conflit.
          </label>
          <button type="button" disabled={busy||fatal||!confirmUpload} onClick={()=>void upload()}>
            <ArrowUpToLine size={15}/> Sauvegarder cette version dans le cloud
          </button>
          {snapshot.workspace&&<>
            <label style={{display:"flex",alignItems:"start",gap:8,marginTop:12}}>
              <input type="checkbox" checked={confirmRestore} onChange={e=>setConfirmRestore(e.target.checked)}/>
              J'ai exporté la version de cet appareil. Je confirme son remplacement local par la copie cloud.
            </label>
            <button type="button" disabled={busy||fatal||!confirmRestore} onClick={restore}>
              <ArrowDownToLine size={15}/> Restaurer le cloud sur cet appareil
            </button>
          </>}
        </>}
      </>}
    {!!error&&<p role="alert">{error}</p>}
    {!!message&&<p role="status">{message}</p>}
    <small>La copie cloud est une fonction bêta désactivée tant que sa migration et sa configuration serveur ne sont pas validées. Ce n'est pas encore une synchronisation automatique multi-appareil.</small>
  </section>;
}
