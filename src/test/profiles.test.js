import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

// ═════════════════════════════════════════════════════════════════
// Profiles: separate local data per profile, the default profile keeps
// the original storage names (no migration), and a sign-in handed over
// across the profile-switch reload is used once.
// ═════════════════════════════════════════════════════════════════

async function visit() {
  vi.resetModules();
  return {
    profiles: await import("../storage/profiles.js"),
    store: await import("../storage/projectStore.js"),
  };
}
const mkCase = (id) => ({ id, name: `Case ${id}`, modified: 1, sessions: [{ id: `s${id}`, markups: [], images: [] }] });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  sessionStorage.clear();
});

describe("profiles", () => {
  it("the default profile keeps the original database and key names", async () => {
    const { profiles } = await visit();
    expect(profiles.activeProfileId()).toBe("default");
    expect(profiles.storageNames()).toEqual({ db: "Cephalometry Studio", keyId: "autosave_v1", legacyKey: "cephalometry_projects" });
    expect(profiles.storageNames("abc")).toEqual({ db: "Cephalometry Studio::abc", keyId: "profile_abc", legacyKey: "cephalometry_projects::abc" });
  });

  it("each profile sees only its own cases", async () => {
    const first = await visit();
    await first.store.loadProjects();
    await first.store.saveProjects([mkCase("a")]);
    const other = first.profiles.addProfile({ name: "Clinic" });
    // switchProfile reloads the page; here: set active, then a new "visit".
    localStorage.setItem("cephalo_profiles_v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("cephalo_profiles_v1")), activeId: other.id }));
    const second = await visit();
    expect(second.profiles.activeProfile().name).toBe("Clinic");
    expect(await second.store.loadProjects()).toEqual([]);
    await second.store.saveProjects([mkCase("b")]);

    localStorage.setItem("cephalo_profiles_v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("cephalo_profiles_v1")), activeId: "default" }));
    const back = await visit();
    expect((await back.store.loadProjects()).map((p) => p.id)).toEqual(["a"]);

    // Removing the other profile deletes only its data.
    await back.store.deleteProfileData(other.id);
    back.profiles.removeProfile(other.id);
    expect(back.profiles.listProfiles().map((p) => p.id)).toEqual(["default"]);
    expect((await (await visit()).store.loadProjects()).map((p) => p.id)).toEqual(["a"]);
  });

  it("clearing one profile's data keeps the other profiles readable", async () => {
    const first = await visit();
    await first.store.loadProjects();
    await first.store.saveProjects([mkCase("a")]);
    const other = first.profiles.addProfile({ name: "Clinic" });
    localStorage.setItem("cephalo_profiles_v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("cephalo_profiles_v1")), activeId: other.id }));
    const second = await visit();
    await second.store.loadProjects();
    await second.store.saveProjects([mkCase("b")]);
    await second.store.clearAllLocalData();

    localStorage.setItem("cephalo_profiles_v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("cephalo_profiles_v1")), activeId: "default" }));
    expect((await (await visit()).store.loadProjects()).map((p) => p.id)).toEqual(["a"]); // still decryptable
  });

  it("finds profiles by Google account and hands a sign-in over once", async () => {
    const { profiles } = await visit();
    const p = profiles.addProfile({ email: "Someone@Example.com" });
    expect(profiles.profileForEmail("someone@example.com").id).toBe(p.id);
    sessionStorage.setItem("cephalo_token_handoff", JSON.stringify({ value: "tok", expiresAt: Date.now() + 3600000, profileId: p.id }));
    localStorage.setItem("cephalo_profiles_v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("cephalo_profiles_v1")), activeId: p.id }));
    const next = await visit();
    expect(next.profiles.takeTokenHandoff()).toMatchObject({ value: "tok" });
    expect(next.profiles.takeTokenHandoff()).toBeNull(); // used once
  });
});
