import { describe, expect, it } from "vitest";
import {
  sourceClaim, dealRecord, agentArtifact, mayTransition, autonomousAllowed,
  projectEquity, preliminaryRoute, type RouteInput,
} from "../src/deals/engine";

const base: RouteInput = {
  opportunityVerified: true,
  financialStatementsVerified: true,
  capTableVerified: true,
  rightsVerified: true,
  funded: true,
  scalable: true,
  contributionBeyondServices: true,
  ethicalOrLegalBlocker: false,
};

describe("A.D Deal-to-Ownership rules", () => {
  it("rejects a fabricated verified claim without source", () => {
    expect(sourceClaim.safeParse({statement:"Ventes multipliées par dix",state:"VERIFIED",uncertainty:""}).success).toBe(false);
    expect(sourceClaim.safeParse({statement:"Ouverture annoncée",state:"HYPOTHESIS",uncertainty:"À vérifier"}).success).toBe(true);
  });
  it("validates strictly scoped typed deal records", () => {
    const valid = {
      id:"35750718-1234-4123-8123-111111111111",ownerId:"owner-a",companyId:null,
      name:"Entreprise fictive",relationship:"NEW",stage:"CAPTURED",model:null,
      claims:[],version:1,createdAt:"2026-10-20T10:00:00.000Z",updatedAt:"2026-10-20T10:00:00.000Z",
    };
    expect(dealRecord.safeParse(valid).success).toBe(true);
    expect(dealRecord.safeParse({...valid,unexpected:"field"}).success).toBe(false);
  });
  it("rejects unauthorized leaps and sensitive approvals", () => {
    expect(mayTransition("CAPTURED","APPROVED",true)).toBe(false);
    expect(mayTransition("READY_FOR_APPROVAL","APPROVED",false)).toBe(false);
    expect(mayTransition("READY_FOR_APPROVAL","APPROVED",true)).toBe(true);
  });
  it("keeps all outward and monetary actions outside agent automation", () => {
    for (const action of ["SEND_EXTERNAL","PUBLISH_PUBLIC","SPEND_MONEY","HIRE","SIGN","BUY_SECURITIES","ISSUE_CONTRACT"] as const)
      expect(autonomousAllowed(action)).toBe(false);
    expect(autonomousAllowed("DRAFT_CREATIVE")).toBe(true);
  });
  it("does not turn a draft document into a signed instrument", () => {
    const artifact = {
      artifactId:"35750718-1234-4123-8123-111111111111",
      dealId:"35750718-1234-4123-8123-222222222222",
      agentId:"LEGAL_DRAFTER",agentVersion:"v1",status:"DRAFT",claims:[],
      missingData:["Numéro d'immatriculation"],createdAt:"2026-10-20T10:00:00.000Z",
    };
    expect(agentArtifact.parse(artifact).status).toBe("DRAFT");
    expect(agentArtifact.safeParse({...artifact, action:"SIGN"}).success).toBe(false);
  });
  it("calculates fully diluted payout and explicit hypothetical expected value", () => {
    const x = projectEquity({
      foregoneCashEuro:20000,equityExitValueEuro:8_000_000,initialStakePct:2,
      totalFurtherDilutionPct:40,yearsUntilExit:5,annualDiscountPct:20,
      probabilityOfExitPct:15,
    });
    expect(x.finalStakePct).toBeCloseTo(1.2);
    expect(x.grossExitEuro).toBeCloseTo(96000);
    expect(x.expectedPresentEuro).toBeCloseTo(14400 / (1.2**5));
    expect(x.hypotheticalOnly).toBe(true);
  });
  it("never invents an exit probability when unknown", () => {
    expect(projectEquity({
      foregoneCashEuro:10000,equityExitValueEuro:2_000_000,initialStakePct:1,
      totalFurtherDilutionPct:0,yearsUntilExit:5,annualDiscountPct:20,probabilityOfExitPct:null,
    }).expectedPresentEuro).toBe(null);
  });
  it("routes missing verified financials to cash, not equity", () => {
    expect(preliminaryRoute({...base,financialStatementsVerified:false}).model).toBe("CASH");
    expect(preliminaryRoute({...base,capTableVerified:false}).model).toBe("CASH");
    expect(preliminaryRoute({...base,rightsVerified:false}).model).toBe("CASH");
    expect(preliminaryRoute({...base,funded:false}).model).toBe("CASH");
    expect(preliminaryRoute({...base,contributionBeyondServices:false}).model).toBe("CASH");
  });
  it("recommends review only, not a binding equity agreement", () => {
    const x=preliminaryRoute(base);
    expect(x.model).toBe("CASH_PLUS_EQUITY");
    expect(x.reason).toContain("examiner");
  });
  it("rejects blockers and unverified leads", () => {
    expect(preliminaryRoute({...base,ethicalOrLegalBlocker:true}).model).toBe("NO_DEAL");
    expect(preliminaryRoute({...base,opportunityVerified:false}).model).toBe("NO_DEAL");
  });
});
