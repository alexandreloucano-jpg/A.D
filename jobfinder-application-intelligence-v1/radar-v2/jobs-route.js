import {NextResponse} from 'next/server';
import {fetchRadar} from '../../lib/radarSources.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(){
 try{
  const result=await fetchRadar();
  return NextResponse.json(result,{headers:{'cache-control':'private, max-age=0, s-maxage=900, stale-while-revalidate=3600'}})
 }catch(e){console.error('Radar collection failure:',e?.message);return NextResponse.json({jobs:[],watchlist:[],sources:[],stats:{shown:0,activeSources:0,sourceCount:0},error:'Sources indisponibles. Réessaie.'},{status:503});}
}