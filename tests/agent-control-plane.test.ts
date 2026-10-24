import { describe, expect, it } from "vitest";
import { planNextStage, type ControlContext } from "../src/agents/control-plane";
const base:ControlContext = {
  sourceVerified:true,ownerApprovedCreative:true,verifiedFinancials:true,
  verifiedCapTable:true,ownerApprovedCommercialTerms:false,
  signedAgreementVerified:false,externalRightsCleared:false,
  budgetCapEuro:1,expectedJobCostEuro:0.1,
};
describe("A.D agent control plane",()=>{
  it("plans only bounded internal verification",()=>{
    expect(planNextStage("CAPTURED",base)).toMatchObject({status:"PLAN",agents:["VERIFY"],mode:"RUN_PRIVATE"});
  });
  it("rejects exceeding authorised cost cap",()=>{
    expect(planNextStage("CAPTURED",{...base,budgetCapEuro:0})).toMatchObject({status:"HOLD"});
  });
  it("rejects unsupported creative facts",()=>{
    expect(planNextStage("QUALIFIED",{...base,sourceVerified:false})).toMatchObject({status:"HOLD"});
  });
  it("never silently sends an offer or a signed contract",()=>{
    expect(planNextStage("OFFER_DRAFT",base).status).toBe("HOLD");
    expect(planNextStage("LEGAL_REVIEW",base).status).toBe("HOLD");
    expect(planNextStage("APPROVED",base).status).toBe("HOLD");
    expect(planNextStage("WON",base).status).toBe("HOLD");
  });
  it("allows a draft after commercial owner approval only",()=>{
    expect(planNextStage("OFFER_DRAFT",{...base,ownerApprovedCommercialTerms:true}))
      .toMatchObject({status:"PLAN",mode:"DRAFT",agents:["LEGAL_DRAFTER","CONTROLLER"]});
  });
  it("allows delivery planning only when signed and rights verified",()=>{
    expect(planNextStage("DELIVERY",base).status).toBe("HOLD");
    expect(planNextStage("DELIVERY",{...base,signedAgreementVerified:true,externalRightsCleared:true}))
      .toMatchObject({status:"PLAN",mode:"DRAFT"});
  });
  it("prevents equity automation when source financials are missing",()=>{
    const route=planNextStage("FINANCIAL_REVIEW",{...base,verifiedCapTable:false});
    expect(route).toMatchObject({status:"PLAN",mode:"DRAFT"});
    expect(route.reason).toMatch(/equity reste non évaluable/);
  });
});
