import { useEffect, useState } from "react";
import { ArrowUpRight, RefreshCcw } from "lucide-react";
import type { RemoteSaver } from "../remote-saver";
type Inquiry = {
  id:string; name:string; email:string; brand:string; website:string|null;
  sector:string; challenge:string; stage:string; created_at:string; updated_at:string;
  notes:string; source_path:string;
};
const stages=["NEW","REVIEWING","QUALIFIED","DISCOVERY","PROPOSAL","WON","LOST","CLOSED"];
export function StudioLeadsPanel({remote}:{remote:RemoteSaver}) {
  const [list,setList]=useState<Inquiry[]>([]);
  const [status,setStatus]=useState("");
  const [loading,setLoading]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  function refresh(){
    if(!remote.connected)return;
    setLoading(true);setStatus("");
    void remote.reader<{items:Inquiry[]}>("/api/studio/inquiries")
      .then(v=>setList(v.items||[]))
      .catch(()=>setStatus("Le CRM Studio n’est pas configuré ou votre session a expiré."))
      .finally(()=>setLoading(false));
  }
  useEffect(()=>{
    if(remote.connected)refresh();
    else {setList([]);setStatus("");}
  },[remote.connected]);
  async function changeStage(item:Inquiry,stage:string) {
    if(!stages.includes(stage) || stage===item.stage)return;
    setEditing(item.id);setStatus("");
    try {
      await remote.reader("/api/studio/inquiries","PATCH",{
        id:item.id,expectedStage:item.stage,stage,note:item.notes||"",
      });
      setList(prev=>prev.map(i=>i.id===item.id?{...i,stage}:i));
      setStatus(item.brand+" : statut actualisé.");
    } catch {setStatus("Mise à jour refusée ou dossier modifié. Recharger avant de réessayer.");}
    finally{setEditing(null);}
  }
  return <section className="ad-studio-inbox" aria-label="Prospects Studio privés">
    <div className="section-label">
      <h2>Demandes A.D Studio</h2>
      <button type="button" onClick={refresh} disabled={!remote.connected||loading} aria-label="Actualiser les demandes"><RefreshCcw size={16}/></button>
    </div>
    {!remote.connected?<p className="ad-v2-no-content">Connectez votre compte propriétaire pour voir les demandes commerciales.</p>
      :loading?<p className="ad-v2-no-content">Chargement des demandes…</p>
      :list.length===0?<p className="ad-v2-no-content">Aucune demande enregistrée, ou CRM non disponible.</p>
      :<div className="ad-studio-inbox-list">{list.slice(0,10).map(v=>
        <article key={v.id} className="ad-studio-inbox-row">
          <div className="ad-studio-inbox-copy">
            <strong>{v.brand}</strong><small>{v.name} · {new Date(v.created_at).toLocaleDateString("fr-FR")}</small>
            <p>{v.challenge}</p>
            <a href={"mailto:"+encodeURIComponent(v.email)+"?subject="+encodeURIComponent("A.D Studio — "+v.brand)}>
              Répondre à la demande <ArrowUpRight size={14}/>
            </a>
          </div>
          <select aria-label={"Statut de "+v.brand} value={v.stage} disabled={editing===v.id}
            onChange={e=>void changeStage(v,e.target.value)}>
            {stages.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </article>)}</div>}
    {!!status&&<p role="status" className="ad-studio-inbox-status">{status}</p>}
    <p className="ad-v2-no-content">Les demandes reçues ne constituent ni une réservation ni une vente. La signature, la facturation et le paiement sont gérés séparément.</p>
  </section>;
}
