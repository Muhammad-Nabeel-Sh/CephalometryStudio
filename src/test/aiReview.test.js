import { describe, it, expect, beforeEach } from "vitest";
import { confidenceTier, markMovedAiPoints, markReviewed, aiReviewSummary, provenanceOf } from "../workspace/aiReview.js";
import { buildDetectionMarkups } from "../workspace/autoTrace.js";
import { useSessionStore } from "../state/sessionStore.js";

const aiPoint = (id, conf, x = 10) => ({ id, type: "point", label: id, points: [{ x, y: 20 }], placed: true, visible: true, aiPlaced: true, aiReviewed: false, aiConfidence: conf });

describe("AI review helpers", () => {
  it("tiers confidence", () => {
    expect(confidenceTier(0.9)).toBe("high");
    expect(confidenceTier(0.5)).toBe("medium");
    expect(confidenceTier(0.1)).toBe("low");
    expect(confidenceTier(undefined)).toBe("unknown");
  });

  it("new AI detections start unreviewed", () => {
    const { points } = buildDetectionMarkups([{ symbol: "S", x: 1, y: 2, confidence: 0.8 }], null, [], "cepha29");
    expect(points[0].aiReviewed).toBe(false);
  });

  it("moving a pending AI point marks it reviewed + adjusted; others untouched", () => {
    const prev = [aiPoint("A", 0.9), aiPoint("B", 0.2)];
    const next = [{ ...prev[0], points: [{ x: 12, y: 20 }] }, prev[1]];
    const out = markMovedAiPoints(prev, next);
    expect(out[0]).toMatchObject({ aiReviewed: true, aiAdjusted: true });
    expect(out[1].aiReviewed).toBe(false);
    expect(markMovedAiPoints(prev, prev)).toBe(prev);
  });

  it("summary, confirm and provenance", () => {
    const ms = [aiPoint("A", 0.9), aiPoint("B", 0.2), { id: "C", type: "point", points: [{ x: 0, y: 0 }] }];
    expect(aiReviewSummary(ms)).toEqual({ total: 2, pending: 2, pendingLow: 1, adjusted: 0 });
    const one = markReviewed(ms, ["B"]);
    expect(aiReviewSummary(one).pending).toBe(1);
    expect(aiReviewSummary(markReviewed(ms)).pending).toBe(0);
    expect(provenanceOf(ms[0])).toBe("AI, NOT reviewed (confidence 90%)");
    expect(provenanceOf(one[1])).toBe("AI, reviewed (confidence 20%)");
    expect(provenanceOf(ms[2])).toBe("manual");
  });
});

describe("session store integration", () => {
  beforeEach(() => useSessionStore.getState().loadFromSession({ markups: [aiPoint("A", 0.5)] }));

  it("dragging an AI landmark through updMarkup confirms it", () => {
    const st = useSessionStore.getState();
    st.updMarkup("A", { points: [{ x: 40, y: 20 }] });
    const m = useSessionStore.getState().markups[0];
    expect(m.aiReviewed).toBe(true);
    expect(m.aiAdjusted).toBe(true);
  });

  it("non-geometric edits do not count as review", () => {
    useSessionStore.getState().updMarkup("A", { color: "#fff" });
    expect(useSessionStore.getState().markups[0].aiReviewed).toBe(false);
  });
});
