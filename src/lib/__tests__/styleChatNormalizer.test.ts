import { describe, expect, it } from "vitest";

import {
  buildStyleChatFallbackOutfitIds,
  isCompleteStyleChatOutfitIds,
  normalizeStyleChatAssistantReply,
  pickStyleChatOutfitIdsFromText,
  type StyleChatActiveLookContext,
  type StyleChatGarmentLike,
} from "../styleChatNormalizer";

function garment(id: string, title: string, category: string): StyleChatGarmentLike {
  return { id, title, category };
}

const TOP = garment("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "White Tee", "top");
const BOTTOM = garment("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", "Black Trousers", "bottom");
const DRESS = garment("cccccccc-cccc-4ccc-8ccc-ccccccccccc3", "Slip Dress", "dress");
const SHOES = garment("dddddddd-dddd-4ddd-8ddd-ddddddddddd4", "Loafers", "shoes");
const OUTERWEAR = garment("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5", "Blazer", "outerwear");

const EMPTY_ACTIVE_LOOK: StyleChatActiveLookContext = {
  summary: "",
  garmentIds: [],
  source: null,
  garmentLines: [],
};

describe("styleChatNormalizer", () => {
  it("does not manufacture an outfit tag from top + bottom without shoes", () => {
    const reply = normalizeStyleChatAssistantReply({
      rawText: `Try ${TOP.title} [[garment:${TOP.id}]] with ${BOTTOM.title} [[garment:${BOTTOM.id}]].`,
      validGarmentIds: new Set([TOP.id, BOTTOM.id]),
      rankedGarments: [TOP, BOTTOM],
      anchor: TOP,
      activeLook: EMPTY_ACTIVE_LOOK,
      includeOutfitTag: true,
    });

    expect(reply.outfitIds).toEqual([]);
    expect(reply.outfitTag).toBeNull();
    expect(reply.text).not.toContain("[[outfit:");
  });

  it("does not manufacture an outfit tag from a dress without shoes", () => {
    const reply = normalizeStyleChatAssistantReply({
      rawText: `Lead with the ${DRESS.title}.`,
      validGarmentIds: new Set([DRESS.id]),
      rankedGarments: [DRESS],
      anchor: DRESS,
      activeLook: EMPTY_ACTIVE_LOOK,
      includeOutfitTag: true,
    });

    expect(reply.outfitIds).toEqual([]);
    expect(reply.outfitTag).toBeNull();
  });

  it("ignores an incomplete active look during fallback", () => {
    const fallbackIds = buildStyleChatFallbackOutfitIds(
      [TOP, BOTTOM],
      null,
      {
        summary: `${TOP.title} + ${BOTTOM.title}`,
        garmentIds: [TOP.id, BOTTOM.id],
        source: "assistant_outfit_tag",
        garmentLines: [],
      },
    );

    expect(fallbackIds).toEqual([]);
  });

  it("ignores parsed outfit tags when the ids are incomplete", () => {
    const parsed = pickStyleChatOutfitIdsFromText(
      `[[outfit:${TOP.id},${BOTTOM.id}|Almost there]]`,
      new Set([TOP.id, BOTTOM.id]),
      [TOP, BOTTOM],
    );

    expect(parsed).toBeNull();
  });

  it("keeps valid complete separates authoritative", () => {
    const reply = normalizeStyleChatAssistantReply({
      rawText: `Best option: [[outfit:${TOP.id},${BOTTOM.id},${SHOES.id}|Balanced separates with clean grounding]]`,
      validGarmentIds: new Set([TOP.id, BOTTOM.id, SHOES.id]),
      rankedGarments: [TOP, BOTTOM, SHOES],
      anchor: null,
      activeLook: EMPTY_ACTIVE_LOOK,
      includeOutfitTag: true,
    });

    expect(reply.outfitIds).toEqual([TOP.id, BOTTOM.id, SHOES.id]);
    expect(reply.outfitTag).toContain(`[[outfit:${TOP.id},${BOTTOM.id},${SHOES.id}|`);
    expect(isCompleteStyleChatOutfitIds(reply.outfitIds, [TOP, BOTTOM, SHOES])).toBe(true);
  });

  it("keeps valid complete dress looks authoritative", () => {
    const reply = normalizeStyleChatAssistantReply({
      rawText: `Center the ${DRESS.title}.`,
      validGarmentIds: new Set([DRESS.id, SHOES.id, OUTERWEAR.id]),
      rankedGarments: [DRESS, SHOES, OUTERWEAR],
      anchor: DRESS,
      activeLook: EMPTY_ACTIVE_LOOK,
      includeOutfitTag: true,
    });

    expect(reply.outfitTag).not.toBeNull();
    expect(reply.outfitIds).toContain(DRESS.id);
    expect(reply.outfitIds).toContain(SHOES.id);
    expect(isCompleteStyleChatOutfitIds(reply.outfitIds, [DRESS, SHOES, OUTERWEAR])).toBe(true);
  });

  it("prefers authoritative outfit ids from unified stylist engine", () => {
    const reply = normalizeStyleChatAssistantReply({
      rawText: `Let's sharpen this with ${OUTERWEAR.title}.`,
      validGarmentIds: new Set([TOP.id, BOTTOM.id, SHOES.id, OUTERWEAR.id]),
      rankedGarments: [TOP, BOTTOM, SHOES, OUTERWEAR],
      anchor: OUTERWEAR,
      activeLook: EMPTY_ACTIVE_LOOK,
      includeOutfitTag: true,
      authoritativeOutfitIds: [TOP.id, BOTTOM.id, SHOES.id],
      authoritativeExplanation: "Unified engine selected this look",
    });

    expect(reply.outfitIds).toEqual([TOP.id, BOTTOM.id, SHOES.id]);
    expect(reply.outfitTag).toContain("Unified engine selected this look");
  });

  it("emits exactly one authoritative outfit tag when raw text contains a conflicting tag", () => {
    const reply = normalizeStyleChatAssistantReply({
      rawText: `Try this [[outfit:${DRESS.id},${SHOES.id}|Model guessed dress look]].`,
      validGarmentIds: new Set([TOP.id, BOTTOM.id, DRESS.id, SHOES.id]),
      rankedGarments: [TOP, BOTTOM, DRESS, SHOES],
      anchor: null,
      activeLook: EMPTY_ACTIVE_LOOK,
      includeOutfitTag: true,
      authoritativeOutfitIds: [TOP.id, BOTTOM.id, SHOES.id],
      authoritativeExplanation: "Unified look wins",
    });

    const tags = reply.text.match(/\[\[outfit:[^\]]+\]\]/g) || [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain(`${TOP.id},${BOTTOM.id},${SHOES.id}`);
    expect(tags[0]).toContain("Unified look wins");
  });
});
