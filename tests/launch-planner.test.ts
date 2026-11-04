import { describe, expect, it } from "vitest";
import { emptyWorkspace, workspaceSchema } from "../src/domain";
import { exportBackup, parseBackup, WorkspaceRepository, STORAGE_KEY } from "../src/storage";
import { evaluateLaunchPlan, newLaunchPlan, launchPlanSchema, exportLaunchPlan } from "../src/creative/launch";

const projectId = "6d2742bd-99cf-492a-b8ab-e1fdb6679e46";
function fixture() {
  return { id: projectId, title: "Campaign Research", updatedAt: new Date().toISOString() };
}
describe("Launch Thesis : internal editorial gate", () => {
  it("requires human review and never predicts or publishes virality", () => {
    const plan = newLaunchPlan(projectId);
    expect(evaluateLaunchPlan(plan).readyForHumanReview).toBe(false);
    expect(evaluateLaunchPlan(plan).missing.length).toBe(5);
    expect(exportLaunchPlan(plan)).toContain("Aucun contact sollicité automatiquement");
  });
  it("rejects invented file or credential-bearing source links", () => {
    const p = newLaunchPlan(projectId);
    expect(launchPlanSchema.safeParse({ ...p, proofUrl: "file:///secret" }).success).toBe(false);
    expect(launchPlanSchema.safeParse({ ...p, proofUrl: "https://joe:password@example.org/" }).success).toBe(false);
    expect(launchPlanSchema.safeParse({ ...p, proofUrl: "https://example.org/proof" }).success).toBe(true);
  });
  it("distinguishes complete editorial fields from independent proof verification", () => {
    const p = {
      ...newLaunchPlan(projectId),
      audience:"Emerging founders looking for better brand launches",
      problem:"Nobody wants another generic launch announcement",
      differentiator:"Real customer proof, not a fabricated success rate",
      proofClaim:"Documented results shown in an accessible demonstration",
      proofUrl:"https://example.org/proof",
      demoPlan:"Run the product live in front of a skeptical viewer",
      hooks:Array(5).fill("The documented difference is visible in one take"),
      distributionContacts:"Founders with documented audience alignment",
      successMetric:"Qualified conversations after visits",
    };
    const res = evaluateLaunchPlan(launchPlanSchema.parse(p));
    expect(res.readyForHumanReview).toBe(true);
    expect(exportLaunchPlan(p)).toContain("Le lien de preuve n’est pas automatiquement validé");
  });
  it("roundtrips launch plans in the regular workspace backup without corrupting old workspaces", () => {
    const s = emptyWorkspace();
    const old={...s};
    delete (old as Partial<typeof s>).launchPlans;
    expect(workspaceSchema.safeParse(old).success).toBe(true);
    s.projects=[fixture()];
    const plan=newLaunchPlan(projectId);
    s.launchPlans=[plan];
    const imported=parseBackup(exportBackup(s));
    expect(imported.launchPlans?.[0].id).toBe(plan.id);
    const mem=new Map<string,string>();
    const repo=new WorkspaceRepository({getItem:(k)=>mem.get(k)||null,setItem:(k,v)=>{mem.set(k,v)}});
    repo.read();repo.commit(s);
    expect(mem.get(STORAGE_KEY)).toContain(plan.id);
    expect(repo.read().launchPlans?.[0].projectId).toBe(projectId);
  });
  it("rejects plans for missing projects or duplicate project plans", () => {
    const p=newLaunchPlan(projectId);
    expect(workspaceSchema.safeParse({...emptyWorkspace(),launchPlans:[p]}).success).toBe(false);
    expect(workspaceSchema.safeParse({...emptyWorkspace(),projects:[fixture()],launchPlans:[p,{...p,id:crypto.randomUUID()}]}).success).toBe(false);
  });
});

