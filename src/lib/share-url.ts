// Share links always use the branded domain so recipients see musicdna.fm,
// whichever host (preview, Vercel, app) published the reading.
export const SHARE_ORIGIN = "https://www.musicdna.fm";
export const shareUrl = (token: string) => `${SHARE_ORIGIN}/s/${encodeURIComponent(token)}`;
