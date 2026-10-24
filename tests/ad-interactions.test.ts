import { describe,expect,it } from "vitest";
import { rankCommands } from "../src/ui/CommandPalette";
import { marketTimelinePoints } from "../src/scout-market/MarketTimeline";
import type { Finding } from "../src/scout-market/schema";
const rows=[
 {id:"1",title:"Maison François Premier",detail:"Dossier",keywords:"hospitality paris"},
 {id:"2",title:"Paris Hospitality",detail:"Référence",keywords:"hôtel"},
 {id:"3",title:"Vêtement",detail:"Référence",keywords:"fashion"},
];
const finding={
 publishedAt:"2026-10-20T08:00:00.000Z",
 firstSeenAt:"2026-10-21T11:00:00.000Z",
 lastSeenAt:"2026-10-22T11:00:00.000Z",
 eventDate:"2026-11-01",
 canonicalUrl:"https://example.org/news",
 reportedFact:"L'ouverture est annoncée dans la publication.",
} as Finding;
describe("A.D V3 user interactions",()=>{
 it("ranks accent-insensitive exact title before keyword-only results",()=>{
   const found=rankCommands(rows,"francois premier");
   expect(found[0].id).toBe("1");
   expect(rankCommands(rows,"restaurant")).toEqual([]);
   expect(rankCommands(rows,"paris").map(r=>r.id)).toEqual(["2","1"]);
 });
 it("builds a chronology from actual source, observation and decision dates",()=>{
   const points=marketTimelinePoints(finding,[{event:"accepted",reason:"Dossier intéressant",occurredAt:"2026-10-23T12:00:00.000Z"}]);
   expect(points.map(p=>p.type)).toEqual(["source","observed","observed","decision","planned"]);
   expect(points[0].sourceUrl).toBe(finding.canonicalUrl);
   expect(points[3].summary).toBe("Dossier intéressant");
   expect(points[4].summary).toContain("ne prouve pas");
 });
 it("does not fabricate dates for records without a timestamp",()=>{
   const missing=marketTimelinePoints({...finding,publishedAt:null,eventDate:null,firstSeenAt:"",lastSeenAt:""},[]);
   expect(missing).toEqual([]);
 });
});
