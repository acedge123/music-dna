import {describe,it,expect} from "vitest";
import {allowExperienceRequest} from "./experience-gate";
describe("parity release gate",()=>{
  it("disables header-selected V1 by default",()=>expect(allowExperienceRequest(new Request("https://musicdna.fm/api/v1/session/new",{headers:{"X-MusicDNA-Experience":"1"}}),{})).toBe(false));
  it("preserves V0",()=>expect(allowExperienceRequest(new Request("https://musicdna.fm/api/v1/session/new"),{})).toBe(true));
  it("blocks V1-only chat without a header",()=>expect(allowExperienceRequest(new Request("https://musicdna.fm/api/v1/session/test/chat"),{})).toBe(false));
  it("requires both explicit private acceptance mode and matching key",()=>{
    const r=new Request("https://musicdna.fm/api/v1/session/test/chat",{headers:{"x-musicdna-acceptance-key":"test-only"}});
    expect(allowExperienceRequest(r,{harnessKey:"test-only"})).toBe(false);
    expect(allowExperienceRequest(r,{acceptance:"1",harnessKey:"different"})).toBe(false);
    expect(allowExperienceRequest(r,{acceptance:"1",harnessKey:"test-only"})).toBe(true);
  });
});