# MusicDNA Archetype Bible — v1.0

**Status: sacred documentation.** Do not add, remove, rename, or re-scope archetypes without an explicit product decision. New archetypes are born only when residual analysis consistently surfaces listeners that none of these ten can explain.

## Core distinction

These are **aesthetic archetypes**, not personality archetypes. They describe **what a listener is seeking from art**, not who they are as a person. This distinction is what keeps MusicDNA from drifting into Myers-Briggs territory.

## The Ten

Every archetype carries four database fields the commentary engine leans on:

- `core_question` — the one-line question that defines the archetype.
- `signature_tradeoffs` — the tradeoffs most predictive of this archetype (Journey > Snapshot, Atmosphere > Statement, etc.).
- `commentary_keywords` — 20–40 adjectives/verbs the Critic can draw from without repeating.
- `confidence_thresholds` — hedge ladder at four **fit tiers** (20 / 50 / 80 / 95) so the Critic's voice tracks the strength of fit. The tier numbers are bucket labels from cosine similarity, not probabilities that the archetype is correct — see `docs/musicdna/prior-weighting.md` and `src/musicdna/engine/scoring.ts#fitTier`. The field name is kept for backwards compatibility with existing archetype rows.

### 1. The Architect — "How well is it built?"
Admires craftsmanship, structure, and intentional design. Seeks elegant construction, clever songwriting, layered arrangements. Rewards: respect, curiosity, admiration. Opposes: Hedonist, Anthemist. Adjacent: Seeker, Atmospherist. Artists: Tool, Radiohead, Steely Dan, Kendrick Lamar, Fiona Apple.

### 2. The Romantic — "How deeply does it feel?"
Values emotional honesty over perfection. Seeks emotional truth, fragility, yearning. Rewards: empathy, nostalgia, heartbreak. Opposes: Architect. Adjacent: Witness, Atmospherist. Artists: Jeff Buckley, Adele, Sade, Patsy Cline, Cigarettes After Sex.

### 3. The Atmospherist — "Where does it take me?"
Listens for worlds rather than songs. Seeks atmosphere, dreaminess, sonic landscapes. Rewards: wonder, calm, mystery. Opposes: Anthemist. Adjacent: Romantic, Architect. Artists: Cocteau Twins, Slowdive, Brian Eno, Sigur Rós, Massive Attack.

### 4. The Anthemist — "Who can I share this with?"
Wants music that becomes bigger than the individual. Seeks big choruses, shared moments, stadium energy. Rewards: joy, belonging, triumph. Opposes: Witness, Atmospherist. Adjacent: Hedonist, Believer. Artists: U2, Queen, Oasis, Springsteen, Coldplay.

### 5. The Transformer — "Does it change me?"
Values journeys over snapshots. Seeks dynamic songs, long builds, emotional payoff. Rewards: catharsis, surprise, renewal. Opposes: Architect. Adjacent: Seeker, Atmospherist. Artists: Tool, Godspeed You! Black Emperor, Talk Talk, Pink Floyd, Arcade Fire.

### 6. The Seeker — "What truth is it chasing?"
Values questions more than answers. Seeks big ideas, spiritual searching, existential themes. Rewards: curiosity, humility, insight. Opposes: Hedonist. Adjacent: Architect, Witness. Artists: Pink Floyd, Sturgill Simpson, Marvin Gaye, Radiohead, Leonard Cohen.

### 7. The Storyteller — "What story is it telling?"
Listens for characters, journeys, narrative. Seeks story songs, vivid lyrics, places. Rewards: recognition, empathy, imagination. Opposes: Hedonist. Adjacent: Witness, Romantic. Artists: Jason Isbell, Springsteen, Tracy Chapman, Dylan, Kendrick Lamar.

### 8. The Hedonist — "How good does it feel?"
Values pleasure without apology. Seeks rhythm, dance, swagger, sensuality. Rewards: confidence, freedom, pleasure. Opposes: Architect, Seeker. Adjacent: Anthemist, Romantic. Artists: Prince, Beyoncé, Bruno Mars, Daft Punk, Earth Wind & Fire.

### 9. The Believer — "What does it stand for?"
Wants music with conviction. Seeks moral clarity, principles, defiance, hope. Rewards: inspiration, courage, resolve. Opposes: Seeker. Adjacent: Anthemist, Witness. Artists: Johnny Cash, Marvin Gaye, U2, Nina Simone, Rage Against the Machine.

### 10. The Witness — "What does it notice?"
Values observation over performance. Seeks quiet truths, everyday beauty, restraint. Rewards: peace, recognition, acceptance. Opposes: Anthemist. Adjacent: Storyteller, Romantic. Artists: Willie Nelson, Tracy Chapman, Bill Withers, Nick Drake, Phoebe Bridgers.

## Confidence ladder (applies to every archetype)

| Confidence | Voice |
|---|---|
| ~20% | "I wonder if…" |
| ~50% | "I'm starting to think…" |
| ~80% | "I'm fairly confident…" |
| ~95% | "One thing I'm convinced of…" |

Per-archetype `confidence_thresholds` may tune the exact phrasing to match its voice (the Believer speaks with resolve earlier; the Seeker hedges longer).

## Growth discipline

New archetypes are added only when the residual review queue (see the Ontology dashboard) consistently surfaces listeners that none of the current ten explain — and only when the residual cluster has a clear, distinct *core question* of its own. Genre expansion is not a reason to add an archetype.
