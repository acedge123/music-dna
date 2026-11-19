import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadShareImage, shareImage } from "./share-image";

const decode = vi.fn();
const click = vi.fn();
const remove = vi.fn();
const drawImage = vi.fn();
const toBlob = vi.fn();
let fetcher: ReturnType<typeof vi.fn>;
let create: ReturnType<typeof vi.spyOn>;
let revoke: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetAllMocks();
  create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:qa");
  revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  fetcher = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response("<svg/>", { headers: { "content-type": "image/svg+xml; charset=utf-8" } }),
    );
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 1080;
      naturalHeight = 1920;
      src = "";
      decode = decode;
    },
  );
  decode.mockResolvedValue(undefined);
  toBlob.mockImplementation((callback: (blob: Blob) => void) =>
    callback(new Blob(["png"], { type: "image/png" })),
  );
  vi.stubGlobal("document", {
    body: { appendChild: vi.fn() },
    createElement: (tag: string) =>
      tag === "canvas" ? { getContext: () => ({ drawImage }), toBlob } : { click, remove },
  });
  vi.stubGlobal("navigator", {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const prepare = () => loadShareImage("token /?", "story", new AbortController().signal);
const png = () => new File(["png"], "musicdna-story.png", { type: "image/png" });

describe("image preparation", () => {
  it("requests a fresh published SVG and releases its conversion URL", async () => {
    const result = await prepare();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/share/token%20%2F%3F/card?format=story",
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
    expect(result.name).toBe("musicdna-story.png");
    expect(result.type).toBe("image/png");
    expect(drawImage).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:qa");
  });
  it.each([
    [404, "image/svg+xml"],
    [500, "text/html"],
    [200, "text/html"],
    [200, "application/json"],
  ])("refuses HTTP %i / %s before decoding", async (status, contentType) => {
    fetcher.mockResolvedValue(
      new Response("not a card", { status, headers: { "content-type": contentType } }),
    );
    await expect(prepare()).rejects.toThrow("Card unavailable");
    expect(decode).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it("surfaces a decode failure, cleans its URL, and permits an explicit retry", async () => {
    decode.mockRejectedValueOnce(new Error("decode"));
    await expect(prepare()).rejects.toThrow("decode");
    expect(revoke).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce(); // No automatic retry.
    await expect(prepare()).resolves.toMatchObject({ name: "musicdna-story.png" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects a different size instead of creating an unbounded canvas", async () => {
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 999999;
        naturalHeight = 1;
        src = "";
        decode = decode;
      },
    );
    await expect(prepare()).rejects.toThrow("Invalid card size");
    expect(drawImage).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledOnce();
  });
  it("reports PNG conversion failure and cleans up", async () => {
    toBlob.mockImplementation((callback: (blob: null) => void) => callback(null));
    await expect(prepare()).rejects.toThrow("Image conversion failed");
    expect(revoke).toHaveBeenCalledOnce();
  });
  it("bounds hung image preparation and releases the temporary URL", async () => {
    vi.useFakeTimers();
    decode.mockReturnValue(new Promise(() => {}));
    const result = expect(prepare()).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(15001);
    await result;
    expect(revoke).toHaveBeenCalledOnce();
  });
});
describe("sharing and fallback", () => {
  it("calls sharing in the tap's synchronous stack", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: () => true, share });
    const result = shareImage(png());
    expect(share).toHaveBeenCalledOnce();
    expect(await result).toBe("shared");
    expect(click).not.toHaveBeenCalled();
  });
  it("treats share-sheet cancellation quietly without downloading", async () => {
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: () => Promise.reject({ name: "AbortError" }),
    });
    expect(await shareImage(png())).toBe("cancelled");
    expect(click).not.toHaveBeenCalled();
  });
  it.each(["unsupported", "failed", "canShare throws"])(
    "downloads and cleans its URL when %s",
    async (scenario) => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "navigator",
        scenario === "unsupported"
          ? {}
          : {
              canShare: () => {
                if (scenario === "canShare throws") throw new Error("platform");
                return true;
              },
              share: () => Promise.reject(new Error("platform")),
            },
      );
      expect(await shareImage(png())).toBe(scenario === "unsupported" ? "downloaded" : "fallback");
      expect(click).toHaveBeenCalledOnce();
      expect(remove).toHaveBeenCalledOnce();
      expect(revoke).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      expect(revoke).toHaveBeenCalledWith("blob:qa");
    },
  );
  it("reports a failed download once and still releases its URL", async () => {
    vi.useFakeTimers();
    click.mockImplementation(() => {
      throw new Error("download blocked");
    });
    await expect(shareImage(png())).rejects.toThrow("download blocked");
    expect(click).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000);
    expect(revoke).toHaveBeenCalledOnce();
  });
});
