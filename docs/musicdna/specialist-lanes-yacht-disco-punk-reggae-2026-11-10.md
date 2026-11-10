# MusicDNA specialist catalog proposal — Yacht Rock, Disco, Punk, Reggae

**Status:** review-only source catalog; **not inserted into Supabase and not activated**. 2026-11-10. This proposal adds no runtime behavior or migration and is safe to merge while Lovable is working; it does **not** make these songs playable by itself.

## Why small lanes

These are distinct pockets of musical preference, not personality stereotypes. They are designed to sharpen an existing taste reading when opening songs or user feedback point at the edges of the larger catalog. A lane name is a routing container, **not a listener identity**. All ten canonical axes are still scored; each specialist set concentrates its pairings on a few differences that really exist within its genre.

| Specialist lane | New songs | New pairings | Focus axes | Example question (post-pick only) |
|---|---:|---:|---|---|
| Yacht Rock (`yacht_rock`) | 15 | 10 | movement, immersion, community, confidence | “Studio chrome, or open water with no shore in sight?” |
| Disco (`disco`) | 18 | 12 | immersion, confidence, tension, transformation | “The band runs the room, or the machine dreams the future?” |
| Punk (`punk`) | 18 | 12 | immersion, tension, perspective, confidence | “Stand your ground, or admit the ground is moving?” |
| Reggae (`reggae`) | 18 | 12 | atmosphere, community, perspective | “Tell the room it'll be alright, or tell it what must change?” |
| **Total** | **69** | **46** | | |

Files: `data/musicdna/yacht-rock-expansion-2026-11-10.json`, `data/musicdna/disco-expansion-2026-11-10.json`, `data/musicdna/punk-expansion-2026-11-10.json`, `data/musicdna/reggae-expansion-2026-11-10.json`.

Each source row has a stable batch key, track title, artist, year, granular sub-lane, 10 editorial scores, canon/routing scores and interpretive rationale. Each pairing has two batch keys, **1–3 declared valid tests** with at least a 20-point song contrast, a post-choice phrase, an evidence-conscious reason, and weight. Songs are capped at three per artist. These are provisional estimates, **not calibrated results**. A phrase is a literary prompt for the Critic **only after a pick**, not a factual finding about a listener.

### Special caution on the dimensions

- Yacht Rock tracks often have uniformly high refinement (`texture`), so simply opposing polished songs does not test `texture`. The effective contrasts here are immediacy, outward warmth and command.
- Disco tracks almost all move (`movement`), so motion cannot be treated as proof of diagnostic contrast. Slow-burn transformation, danger versus release, or assured versus exposed vocal do more useful work.
- Punk is not shorthand for anger. The probes deliberately contrast vulnerability, satire, political witness, self-command, minimalism and exploratory structures.
- Reggae is not a monolith: early reggae, roots, dub, lovers-rock-adjacent romance, dancehall and modern social commentary are represented. No cultural assumptions should become user-identity claims.

## Critical activation gate

The current web opener has a **hard-coded set** of broad top-level lanes in `src/lib/musicdna.functions.ts` (`LANES`, `ALL_LANES`, the classifier's two strict JSON schemas, and `LANE_RULES`). Adding `yacht_rock`, `disco`, `punk` or `reggae` as active `public.songs.primary_lane` rows alone **does not make the opener reliably route into them**. Catalog-to-lane aliases and any cross-lane probing policy also need independent review; do not silently map all punk to Alternative or disco to Electronic without a product decision.

Recommended sequence for Lovable/Codex after this PR is reviewed:

1. Decide whether these are discoverable top-level lanes, opt-in specialist probes within a broad lane, or both. Keep default fallback behavior unchanged until tested.
2. Add explicit classifier support and routing tests, including mixed three-song openers; verify the selector serves only eligible same-lane pairings. Do not introduce unconsented cross-lane comparisons into an existing session. Six-pick default completion is compatible with 10–12 options, but validate skip/recognition exhaustion before opening a specialist lane to all listeners.
3. Run score/claim audit and a listener-facing read for each specialist lane. Confirm the Critic sees the **selected pairing's** phrase only after choice, and treats interpretations as provisional. Freeze song/test evidence with the vote as usual.
4. Only then import **inactive** rows with a reviewed SQL transaction, audit live metadata, and make an independent, approved activation change. No automatic activation from this PR.

## Local validation and staging SQL

```sh
for f in data/musicdna/{yacht-rock,disco,punk,reggae}-expansion-2026-11-10.json; do
  node tools/musicdna/compile-catalog-expansion.mjs --validate "$f"
done

# SQL is generated to stdout only; no DB connection or writes occur:
node tools/musicdna/compile-catalog-expansion.mjs --sql --stage-specialist data/musicdna/disco-expansion-2026-11-10.json
```

The existing compiler is extended to accept small specialist batches; its **explicit `--stage-specialist` flag** is required to emit specialist SQL, and that SQL inserts all new specialist songs and pairings as **inactive**. Running the script never executes SQL. It aborts on incomplete song/pair counts, invalid tests, or missing metadata. Production execution requires separate operator approval, read-only duplicate inspection, and rollback-only rehearsal first.

## Review checklist

- [ ] Music editor reviews track identity and release year, especially alternate mixes/re-recordings (the songs are named without specific masters).
- [ ] Editorial reviewer signs off the direction and meaningfulness of song axes and pair hooks.
- [ ] Confirm no same-title/artist collisions with current production catalog before staging; do not silently duplicate or overwrite existing songs.
- [ ] Decide lane-routing exposure and skip/fallback UX; run end-to-end tests before activating any row.
- [ ] Preserve Lovable history via normal merge; do not reset or force-push `main`.
