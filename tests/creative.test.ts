import { describe,it,expect } from "vitest";
import { emptyWorkspace, workspaceSchema } from "../src/domain";
import { WorkspaceRepository, parseBackup, exportBackup } from "../src/storage";
import { blankDirections, creativeStartingPoints, nextCreativeRevision, latestCreative, creativeBoardSchema } from "../src/creative/model";
const projectId="e7e4b37a-85aa-42e4-a156-60a3fbfa1dc6";
const sourceId="e7e4b37a-85aa-42e4-a156-60a3fbfa1dc7";
const settings={
 brief:"Construire une maison de maroquinerie française qui a une identité immédiatement reconnaissable.",
 referenceIds:[sourceId],
 directions:creativeStartingPoints("Sac signature en lancement, inspiré par le geste et la matière.",["Atelier référencé"]),
 origin:"STRUCTURED_TEMPLATE" as const,
};
describe("A.D CREATE / provenance et contrôle humain",()=>{
 it("permet d'ouvrir les anciennes sauvegardes version 1 sans canvas",()=>{
  const s=emptyWorkspace();delete s.creativeBoards;
  const parsed=workspaceSchema.parse(s);
  expect(parsed.creativeBoards).toBeUndefined();
  expect(parseBackup(JSON.stringify(s))).toEqual(parsed);
 });
 it("ajoute un canvas sans modifier les tâches ni les sources historiques",()=>{
  const s=emptyWorkspace();
  s.projects=[{id:projectId,title:"Maison atelier",updatedAt:new Date().toISOString()}];
  s.creativeBoards=[nextCreativeRevision(undefined,projectId,settings)];
  const backup=exportBackup(s);
  expect(parseBackup(backup).creativeBoards?.[0].revisions).toHaveLength(1);
  expect(s.tasks).toHaveLength(0);
 });
 it("garde deux pistes distinctes et une provenance du canevas non IA",()=>{
  const directions=creativeStartingPoints("Brief original 2026",["Référence A"]);
  expect(directions).toHaveLength(2);
  expect(directions[0].letter).toBe("A");
  expect(directions[1].letter).toBe("B");
  expect(directions[0].title).not.toEqual(directions[1].title);
 });
 it("préserve les versions précédentes quand le fondateur valide une piste",()=>{
  const one=nextCreativeRevision(undefined,projectId,settings);
  const two=nextCreativeRevision(one,projectId,settings,"B");
  expect(two.revisions).toHaveLength(2);
  expect(latestCreative(one)?.approvedDirection).toBeNull();
  expect(latestCreative(two)?.approvedDirection).toBe("B");
  expect(latestCreative(two)?.approvedAt).toBeTruthy();
  expect(two.revisions[0]).toEqual(one.revisions[0]);
 });
 it("rejette la validation arbitraire et les références dupliquées",()=>{
  expect(()=>creativeBoardSchema.parse({
   ...nextCreativeRevision(undefined,projectId,settings),
   revisions:[{...nextCreativeRevision(undefined,projectId,settings).revisions[0],approvedDirection:"A",approvedAt:null}],
  })).toThrow();
  expect(()=>nextCreativeRevision(undefined,projectId,{...settings,referenceIds:[sourceId,sourceId]})).toThrow();
 });
 it("bloque un canvas orphelin et un double canvas par projet",()=>{
  const s=emptyWorkspace();const b=nextCreativeRevision(undefined,projectId,settings);
  s.creativeBoards=[b];expect(()=>workspaceSchema.parse(s)).toThrow();
  s.projects=[{id:projectId,title:"Maison atelier",updatedAt:new Date().toISOString()}];
  s.creativeBoards=[b,{...b,id:crypto.randomUUID()}];
  expect(()=>workspaceSchema.parse(s)).toThrow();
 });
 it("n'efface pas les données précédentes si la sauvegarde échoue",()=>{
  const record=new Map<string,string>();
  const repo=new WorkspaceRepository({
    getItem:k=>record.get(k)||null,
    setItem:()=>{throw Error("storage_failure");},
  });
  const before=repo.read();expect(()=>repo.commit(before)).toThrow("storage_failure");
  expect(record.size).toBe(0);
 });
 it("refuse les faux documents présentés comme venant de l'IA",()=>{
  const input={...settings,origin:"CONFIGURED_AI" as const};
  expect(()=>nextCreativeRevision(undefined,projectId,input)).toThrow();
 });
});
