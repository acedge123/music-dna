# Lovable Prompt: MusicDNA Lane Engine MVP

## Mission

Implement the MusicDNA Lane Engine MVP.

Do not build "MusicDNA for Alan." Build a reusable taste engine with lane-specific matchup universes.

MusicDNA has two separate concepts:

- **MusicDNA Engine**: shared dimensions, scoring, evidence reasoning, archetypes, instrumentation.
- **MusicDNA Lanes**: culturally specific song catalogs and pairings used to test the same dimensions.

Genres are not the product model. Lanes are routing universes for the same underlying taste engine.

## MVP Lanes

Support exactly these lane slugs for this pass:

```ts
type MusicDnaLane =
  | "alternative"
  | "pop"
  | "hip_hop"
  | "electronic"
  | "classic_rock"
  | "general";
```

`general` is a fallback lane only. Do not silently dump all pairings into a session.

## Active Dimensions

Keep the current 15 active dimensions:

- `movement`
- `atmosphere`
- `groove`
- `darkness`
- `hope`
- `nostalgia`
- `transformation`
- `complexity`
- `melody`
- `verbal_cleverness`
- `authenticity`
- `romanticism`
- `energy`
- `dreaminess`
- `community`

Do not add `immersion` or `scale` to scoring yet. They remain candidate dimensions until schema, scoring, charting, seeds, archetypes, and pairings are all updated together.

## Required Product Flow

1. User enters/selects three songs in onboarding.
2. App classifies the user's lane from those three songs.
3. App shows:
   - one short user-facing hypothesis
   - lane label
   - confidence
4. App starts a session with that lane.
5. App selects only active pairings for that lane.
6. User completes up to 20 choices.
7. Result remains cross-lane: archetypes are shared across all lanes.

Example:

```json
{
  "lane": "hip_hop",
  "confidence": 0.99,
  "secondary_lanes": ["pop"],
  "reasoning": [
    "Three of five opening songs are hip-hop anchors.",
    "Money Trees, Runaway, and Shook Ones Pt II point to hip-hop as the strongest diagnostic lane."
  ],
  "hypothesis": "You seem to reward atmosphere, narrative pressure, and emotional scale. Let's see if that holds."
}
```

## Schema Changes

Add these columns to `profiles`:

```sql
opening_lane text;
opening_lane_confidence numeric;
opening_analysis_json jsonb not null default '{}'::jsonb;
```

Add these columns to `sessions`:

```sql
lane text not null default 'general';
lane_confidence numeric not null default 0;
```

Add this column to `pairings`:

```sql
lane text not null default 'alternative';
```

Add useful indexes:

```sql
create index if not exists pairings_lane_active_weight_idx
on public.pairings (lane, active, diagnostic_weight desc);

create index if not exists sessions_user_lane_idx
on public.sessions (user_id, lane, started_at desc);
```

Do not remove existing song `lane`; song lane and pairing lane may be the same now, but pairing lane is the routing contract.

### Song Lane Contract

Songs need two lane fields:

```sql
lane text not null;
primary_lane text not null default 'alternative';
```

- `songs.lane` is the granular diagnostic catalog lane or sub-lane, such as `post_punk_new_wave`, `goth_darkwave`, `shoegaze_dreampop`, or `manchester_indie_dance`.
- `songs.primary_lane` is the top-level MusicDNA routing lane: `alternative`, `pop`, `hip_hop`, `electronic`, `classic_rock`, or `general`.
- `pairings.lane` must match both songs' `primary_lane`, not necessarily their granular `lane`.

For example, an Alternative pairing can have:

```json
{
  "pairing_lane": "alternative",
  "song_a_lane": "post_punk_new_wave",
  "song_a_primary_lane": "alternative",
  "song_b_lane": "goth_darkwave",
  "song_b_primary_lane": "alternative"
}
```

This is valid. Do not split the Alternative pairing universe into seven sub-lanes for MVP routing.

Use this validation shape:

```sql
select p.id
from public.pairings p
join public.songs sa on sa.id = p.song_a_id
join public.songs sb on sb.id = p.song_b_id
where p.lane <> sa.primary_lane
   or p.lane <> sb.primary_lane;
```

Do not validate `pairings.lane = songs.lane`; that will falsely reject useful cross-sub-lane diagnostic pairings.

### Diagnostic Power Scoring

Add curator-scored song fields:

```sql
canon_score int not null default 50 check (canon_score between 0 and 100);
polarization int not null default 0 check (polarization between 0 and 25);
tradeoff_richness int not null default 0 check (tradeoff_richness between 0 and 20);
pairing_density int not null default 0 check (pairing_density between 0 and 15);
identity_signaling int not null default 0 check (identity_signaling between 0 and 15);
longevity int not null default 0 check (longevity between 0 and 10);
cross_genre_mapping int not null default 0 check (cross_genre_mapping between 0 and 15);
```

Keep existing `diagnostic_power`, but calculate it from the component fields:

```text
diagnostic_power =
  polarization
+ tradeoff_richness
+ pairing_density
+ identity_signaling
+ longevity
+ cross_genre_mapping
```

`diagnostic_power` is not song greatness. It answers:

> If somebody puts this in their Top 5, what do we learn?

`canon_score` is separate and should capture influence, popularity, critical recognition, and longevity.

Admin UI requirements:

- Show the six DPS component fields.
- Show calculated `diagnostic_power`.
- Show editable `canon_score`.
- Make it obvious that high canon score and high diagnostic power are different concepts.
- Do not ask curators "is this a great song?" Ask "what does choosing this song teach us?"

## Server Function Changes

### Replace/Extend Opening Hypothesis

Conceptually replace `generateOpeningHypothesis` with `analyzeOpeningSongs`.

Input:

```ts
{
  songs: string[];
}
```

Output:

```ts
{
  lane: MusicDnaLane;
  confidence: number;
  secondary_lanes: MusicDnaLane[];
  reasoning: string[];
  hypothesis: string;
}
```

Implementation rules:

- Use deterministic catalog/lane matching first.
- When a catalog match exists, prefer `songs.primary_lane` for routing; fall back to mapping `songs.lane` to a top-level lane.
- Use LLM only to polish the hypothesis and resolve ambiguous cases.
- Clamp confidence to `0 <= confidence <= 1`.
- If confidence is below `0.6`, use lane `general`.
- Store the full structured object in `profiles.opening_analysis_json`.
- Also store `opening_lane`, `opening_lane_confidence`, `opening_songs`, and `opening_hypothesis`.

### Start Session

`startSession` must read the authenticated user's latest profile lane fields.

Insert:

```ts
{
  user_id,
  vector: {},
  lane: profile.opening_lane ?? "general",
  lane_confidence: profile.opening_lane_confidence ?? 0
}
```

### Next Pairing

`nextPairing` must read `sessions.vector` and `sessions.lane`.

Select pairings with:

```ts
active = true
lane = session.lane
```

Fallback rule:

- If no unused active pairings exist for `session.lane`, then and only then select unused active `general` pairings.
- Do not fall back to all lanes.

Return the selected pairing with `lane`.

### Record Choice

Continue storing:

- chosen song
- rejected song
- pairing id
- response time
- reveal text

The reveal must cite the actual tradeoff from the selected pairing/tests.

### Result Generation

Archetype matching stays cross-lane.

Do not create lane-specific archetypes for this pass.

Result copy must reference actual choices and tradeoffs, not lane stereotypes.

## Data Targets

Seed/import support should target:

- Alternative: about 150 songs
- Pop: about 50 songs
- Hip-Hop: about 50 songs
- Electronic: about 25 songs
- Classic Rock: about 25 songs
- Pairings: 60-100 elite diagnostic pairings total

Do not optimize for exhaustive canon size. Optimize for diagnostic quality.

## Cross-Lane Examples

Same dimension, different culture:

| Dimension | Alternative | Hip-Hop | Pop |
|---|---|---|---|
| transformation | `Ceremony` | `Sing About Me, I'm Dying of Thirst` | `The Archer` |
| atmosphere | `A Forest` | `Money Trees` | `Ocean Eyes` |
| groove | `Fools Gold` | `Gin and Juice` | `Levitating` |
| immediacy | `She Bangs the Drums` | `HUMBLE.` | `Shake It Off` |
| immersion | `Breaking Into Heaven` | `Devil in a New Dress` | `All Too Well (10 Minute Version)` |

These examples guide data curation. Do not add `immersion` to the active scoring schema yet.

## Starter Pairing Examples

Alternative:

- `Ceremony` vs `Dreaming of Me`: transformation vs charm/nostalgia
- `A Forest` vs `The Killing Moon`: propulsion vs cinematic romance
- `Breaking Into Heaven` vs `She Bangs the Drums`: immersion/journey vs immediacy/anthem

Pop:

- `Style` vs `Toxic`: cool control vs audacity
- `All Too Well` vs `Rolling in the Deep`: intimacy vs power
- `The Archer` vs `Shake It Off`: inward transformation vs immediacy

Hip-Hop:

- `Money Trees` vs `N.Y. State of Mind`: atmosphere vs realism
- `Runaway` vs `HUMBLE.`: vulnerability vs confidence
- `Devil in a New Dress` vs `Gin and Juice`: immersion/luxury vs groove/social ease

Electronic:

- `Windowlicker` vs `Born Slippy .NUXX`: experimentation vs catharsis
- `Teardrop` vs `Firestarter`: suspended atmosphere vs kinetic aggression

Classic Rock:

- `Gimme Shelter` vs `Kashmir`: tension vs scale
- `Dreams` vs `Baba O'Riley`: glide/intimacy vs anthem/community

## Learning-Ready Instrumentation

Do not implement ML training.

Do implement structured events so future learning is possible.

Track:

- onboarding classification event
- pairing shown event
- choice recorded event
- reveal shown event
- continue-after-reveal event
- session completed event
- result viewed event
- share clicked event

Each event should include:

- `user_id`
- `session_id`
- `event_type`
- `lane`
- `lane_confidence`
- `pairing_id` when relevant
- `chosen_song_id` and `rejected_song_id` when relevant
- `tested_dimensions`
- `response_time_ms`
- `prompt_version` and `model` when AI is involved
- `metadata jsonb`

Store LLM reasoning artifacts separately from final prose, following `docs/musicdna/intelligence_layer.md`.

## Acceptance Criteria

- Alternative opening songs route to `alternative` with high confidence.
- Pop opening songs route to `pop` with high confidence.
- Hip-Hop opening songs route to `hip_hop` with high confidence.
- Mixed opening songs route to `general` or low-confidence lane handling.
- Alternative sessions receive only `alternative` pairings unless falling back to `general`.
- Pop sessions receive only `pop` pairings unless falling back to `general`.
- Hip-Hop sessions receive only `hip_hop` pairings unless falling back to `general`.
- A user should not see `Ceremony` unless the session lane is `alternative` or `general`.
- Archetypes remain shared across lanes.
- Result copy references actual choices and tradeoffs.
- Build passes.
- Fresh user can complete: auth -> three songs -> lane classification -> 20 choices -> result.
