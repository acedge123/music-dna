const fs = require("fs");
const path = require("path");

const dimensions = [
  "movement",
  "atmosphere",
  "groove",
  "darkness",
  "hope",
  "nostalgia",
  "transformation",
  "complexity",
  "melody",
  "verbal_cleverness",
  "authenticity",
  "romanticism",
  "energy",
  "dreaminess",
  "community",
];

const laneProfiles = {
  post_punk_new_wave: {
    movement: 78,
    atmosphere: 76,
    groove: 70,
    darkness: 55,
    hope: 56,
    nostalgia: 62,
    transformation: 74,
    complexity: 55,
    melody: 68,
    verbal_cleverness: 58,
    authenticity: 72,
    romanticism: 62,
    energy: 72,
    dreaminess: 58,
    community: 58,
  },
  goth_darkwave: {
    movement: 66,
    atmosphere: 86,
    groove: 62,
    darkness: 88,
    hope: 28,
    nostalgia: 68,
    transformation: 64,
    complexity: 58,
    melody: 62,
    verbal_cleverness: 55,
    authenticity: 76,
    romanticism: 82,
    energy: 58,
    dreaminess: 74,
    community: 42,
  },
  manchester_indie_dance: {
    movement: 84,
    atmosphere: 70,
    groove: 88,
    darkness: 34,
    hope: 78,
    nostalgia: 70,
    transformation: 78,
    complexity: 48,
    melody: 72,
    verbal_cleverness: 54,
    authenticity: 70,
    romanticism: 64,
    energy: 76,
    dreaminess: 58,
    community: 84,
  },
  shoegaze_dreampop: {
    movement: 60,
    atmosphere: 94,
    groove: 54,
    darkness: 46,
    hope: 58,
    nostalgia: 78,
    transformation: 78,
    complexity: 64,
    melody: 66,
    verbal_cleverness: 35,
    authenticity: 70,
    romanticism: 82,
    energy: 58,
    dreaminess: 94,
    community: 42,
  },
  britpop_indiepop: {
    movement: 66,
    atmosphere: 50,
    groove: 54,
    darkness: 34,
    hope: 72,
    nostalgia: 74,
    transformation: 50,
    complexity: 42,
    melody: 86,
    verbal_cleverness: 78,
    authenticity: 62,
    romanticism: 70,
    energy: 64,
    dreaminess: 42,
    community: 78,
  },
  grunge_altrock: {
    movement: 62,
    atmosphere: 62,
    groove: 58,
    darkness: 72,
    hope: 34,
    nostalgia: 64,
    transformation: 56,
    complexity: 52,
    melody: 62,
    verbal_cleverness: 48,
    authenticity: 88,
    romanticism: 52,
    energy: 78,
    dreaminess: 44,
    community: 56,
  },
  electronic_crossover: {
    movement: 88,
    atmosphere: 80,
    groove: 90,
    darkness: 48,
    hope: 64,
    nostalgia: 54,
    transformation: 86,
    complexity: 62,
    melody: 56,
    verbal_cleverness: 34,
    authenticity: 58,
    romanticism: 60,
    energy: 84,
    dreaminess: 72,
    community: 76,
  },
  artrock_experimental: {
    movement: 58,
    atmosphere: 78,
    groove: 52,
    darkness: 58,
    hope: 46,
    nostalgia: 50,
    transformation: 84,
    complexity: 88,
    melody: 58,
    verbal_cleverness: 66,
    authenticity: 72,
    romanticism: 58,
    energy: 62,
    dreaminess: 68,
    community: 38,
  },
  punk_noise_edge: {
    movement: 78,
    atmosphere: 52,
    groove: 58,
    darkness: 60,
    hope: 34,
    nostalgia: 44,
    transformation: 58,
    complexity: 48,
    melody: 46,
    verbal_cleverness: 54,
    authenticity: 86,
    romanticism: 34,
    energy: 94,
    dreaminess: 30,
    community: 62,
  },
  sophistipop_lyric_indie: {
    movement: 50,
    atmosphere: 64,
    groove: 46,
    darkness: 42,
    hope: 54,
    nostalgia: 76,
    transformation: 48,
    complexity: 62,
    melody: 82,
    verbal_cleverness: 90,
    authenticity: 66,
    romanticism: 76,
    energy: 42,
    dreaminess: 56,
    community: 48,
  },
};

const songsByLane = {
  post_punk_new_wave: [
    ["Ceremony", "New Order", 1981],
    ["Temptation", "New Order", 1982],
    ["Age of Consent", "New Order", 1983],
    ["Blue Monday", "New Order", 1983],
    ["Dreaming of Me", "Depeche Mode", 1981],
    ["Just Can't Get Enough", "Depeche Mode", 1981],
    ["Never Let Me Down Again", "Depeche Mode", 1987],
    ["Enjoy the Silence", "Depeche Mode", 1990],
    ["Love Will Tear Us Apart", "Joy Division", 1980],
    ["Transmission", "Joy Division", 1979],
    ["Disorder", "Joy Division", 1979],
    ["Once in a Lifetime", "Talking Heads", 1980],
    ["This Must Be the Place", "Talking Heads", 1983],
    ["Psycho Killer", "Talking Heads", 1977],
    ["Road to Nowhere", "Talking Heads", 1985],
    ["Making Plans for Nigel", "XTC", 1979],
    ["Senses Working Overtime", "XTC", 1982],
    ["Kid", "The Pretenders", 1979],
    ["Brass in Pocket", "The Pretenders", 1979],
    ["Spellbound", "Siouxsie and the Banshees", 1981],
    ["Hong Kong Garden", "Siouxsie and the Banshees", 1978],
    ["The Cutter", "Echo & the Bunnymen", 1983],
    ["Reward", "The Teardrop Explodes", 1981],
    ["Love My Way", "The Psychedelic Furs", 1982],
    ["Pretty in Pink", "The Psychedelic Furs", 1981],
  ],
  goth_darkwave: [
    ["A Forest", "The Cure", 1980],
    ["Pictures of You", "The Cure", 1989],
    ["Lovesong", "The Cure", 1989],
    ["Plainsong", "The Cure", 1989],
    ["The Killing Moon", "Echo & the Bunnymen", 1984],
    ["Bring on the Dancing Horses", "Echo & the Bunnymen", 1985],
    ["Bela Lugosi's Dead", "Bauhaus", 1979],
    ["She's in Parties", "Bauhaus", 1983],
    ["Lucretia My Reflection", "Sisters of Mercy", 1987],
    ["This Corrosion", "Sisters of Mercy", 1987],
    ["Cities in Dust", "Siouxsie and the Banshees", 1985],
    ["Christine", "Siouxsie and the Banshees", 1980],
    ["Kangaroo", "This Mortal Coil", 1984],
    ["Song to the Siren", "This Mortal Coil", 1983],
    ["Cuts You Up", "Peter Murphy", 1989],
    ["In Between Days", "The Cure", 1985],
    ["Charlotte Sometimes", "The Cure", 1981],
    ["Atmosphere", "Joy Division", 1980],
    ["She's Lost Control", "Joy Division", 1979],
    ["The Mercy Seat", "Nick Cave & the Bad Seeds", 1988],
    ["Red Right Hand", "Nick Cave & the Bad Seeds", 1994],
    ["Into My Arms", "Nick Cave & the Bad Seeds", 1997],
    ["The Ship Song", "Nick Cave & the Bad Seeds", 1990],
    ["Tower of Strength", "The Mission", 1988],
    ["Martha's Harbour", "All About Eve", 1988],
  ],
  manchester_indie_dance: [
    ["Fools Gold", "The Stone Roses", 1989],
    ["I Wanna Be Adored", "The Stone Roses", 1989],
    ["She Bangs the Drums", "The Stone Roses", 1989],
    ["Waterfall", "The Stone Roses", 1989],
    ["Made of Stone", "The Stone Roses", 1989],
    ["Loaded", "Primal Scream", 1990],
    ["Movin' on Up", "Primal Scream", 1991],
    ["Come Together", "Primal Scream", 1991],
    ["Step On", "Happy Mondays", 1990],
    ["Kinky Afro", "Happy Mondays", 1990],
    ["Wrote for Luck", "Happy Mondays", 1988],
    ["The Only One I Know", "The Charlatans", 1990],
    ["Opportunity", "The Charlatans", 1990],
    ["Then", "The Charlatans", 1990],
    ["Sit Down", "James", 1991],
    ["Come Home", "James", 1989],
    ["There She Goes", "The La's", 1988],
    ["Groovy Train", "The Farm", 1990],
    ["All Together Now", "The Farm", 1990],
    ["Pacific State", "808 State", 1989],
    ["Voodoo Ray", "A Guy Called Gerald", 1988],
    ["Hallelujah", "Happy Mondays", 1989],
    ["Rocks", "Primal Scream", 1994],
    ["Can You Dig It?", "The Mock Turtles", 1991],
    ["I'm Free", "The Soup Dragons", 1990],
  ],
  shoegaze_dreampop: [
    ["Vapour Trail", "Ride", 1990],
    ["Leave Them All Behind", "Ride", 1992],
    ["Taste", "Ride", 1990],
    ["Drive Blind", "Ride", 1990],
    ["Only Shallow", "My Bloody Valentine", 1991],
    ["Sometimes", "My Bloody Valentine", 1991],
    ["Soon", "My Bloody Valentine", 1990],
    ["When You Sleep", "My Bloody Valentine", 1991],
    ["Alison", "Slowdive", 1993],
    ["When the Sun Hits", "Slowdive", 1993],
    ["Machine Gun", "Slowdive", 1993],
    ["Souvlaki Space Station", "Slowdive", 1993],
    ["Pearl", "Chapterhouse", 1991],
    ["Breather", "Chapterhouse", 1990],
    ["For Love", "Lush", 1992],
    ["Sweetness and Light", "Lush", 1990],
    ["De-Luxe", "Lush", 1990],
    ["Crushed", "Cocteau Twins", 1985],
    ["Heaven or Las Vegas", "Cocteau Twins", 1990],
    ["Cherry-Coloured Funk", "Cocteau Twins", 1990],
    ["Lorelei", "Cocteau Twins", 1984],
    ["Blue Flower", "Mazzy Star", 1990],
    ["Fade Into You", "Mazzy Star", 1993],
    ["Winona", "Drop Nineteens", 1992],
    ["Delaware", "Drop Nineteens", 1992],
  ],
  britpop_indiepop: [
    ["This Charming Man", "The Smiths", 1983],
    ["There Is a Light That Never Goes Out", "The Smiths", 1986],
    ["Bigmouth Strikes Again", "The Smiths", 1986],
    ["How Soon Is Now?", "The Smiths", 1984],
    ["Common People", "Pulp", 1995],
    ["Disco 2000", "Pulp", 1995],
    ["Babies", "Pulp", 1992],
    ["Sorted for E's & Wizz", "Pulp", 1995],
    ["Live Forever", "Oasis", 1994],
    ["Supersonic", "Oasis", 1994],
    ["Wonderwall", "Oasis", 1995],
    ["Champagne Supernova", "Oasis", 1995],
    ["Girls & Boys", "Blur", 1994],
    ["Parklife", "Blur", 1994],
    ["The Universal", "Blur", 1995],
    ["Beetlebum", "Blur", 1997],
    ["Animal Nitrate", "Suede", 1993],
    ["The Wild Ones", "Suede", 1994],
    ["Trash", "Suede", 1996],
    ["Connection", "Elastica", 1994],
    ["Stutter", "Elastica", 1993],
    ["Slight Return", "The Bluetones", 1995],
    ["Alright", "Supergrass", 1995],
    ["Caught by the Fuzz", "Supergrass", 1994],
    ["Good Enough", "Dodgy", 1996],
  ],
  grunge_altrock: [
    ["Smells Like Teen Spirit", "Nirvana", 1991],
    ["Come as You Are", "Nirvana", 1991],
    ["Lithium", "Nirvana", 1991],
    ["Something in the Way", "Nirvana", 1991],
    ["Heart-Shaped Box", "Nirvana", 1993],
    ["Would?", "Alice in Chains", 1992],
    ["Rooster", "Alice in Chains", 1992],
    ["Man in the Box", "Alice in Chains", 1990],
    ["Black Hole Sun", "Soundgarden", 1994],
    ["Fell on Black Days", "Soundgarden", 1994],
    ["Outshined", "Soundgarden", 1991],
    ["Alive", "Pearl Jam", 1991],
    ["Black", "Pearl Jam", 1991],
    ["Jeremy", "Pearl Jam", 1991],
    ["Cannonball", "The Breeders", 1993],
    ["Velouria", "Pixies", 1990],
    ["Where Is My Mind?", "Pixies", 1988],
    ["Monkey Gone to Heaven", "Pixies", 1989],
    ["Gigantic", "Pixies", 1988],
    ["Today", "The Smashing Pumpkins", 1993],
    ["Cherub Rock", "The Smashing Pumpkins", 1993],
    ["Mayonaise", "The Smashing Pumpkins", 1993],
    ["Spaceboy", "The Smashing Pumpkins", 1993],
    ["1979", "The Smashing Pumpkins", 1995],
    ["Loser", "Beck", 1993],
  ],
  electronic_crossover: [
    ["Born Slippy .NUXX", "Underworld", 1995],
    ["Cowgirl", "Underworld", 1994],
    ["Rez", "Underworld", 1993],
    ["Dark & Long", "Underworld", 1994],
    ["Teardrop", "Massive Attack", 1998],
    ["Unfinished Sympathy", "Massive Attack", 1991],
    ["Angel", "Massive Attack", 1998],
    ["Protection", "Massive Attack", 1994],
    ["Glory Box", "Portishead", 1994],
    ["Sour Times", "Portishead", 1994],
    ["Roads", "Portishead", 1994],
    ["Only You", "Portishead", 1997],
    ["Firestarter", "The Prodigy", 1996],
    ["Breathe", "The Prodigy", 1996],
    ["Out of Space", "The Prodigy", 1992],
    ["Setting Sun", "The Chemical Brothers", 1996],
    ["Block Rockin' Beats", "The Chemical Brothers", 1997],
    ["Leave Home", "The Chemical Brothers", 1995],
    ["Born of Frustration", "James", 1992],
    ["Connected", "Stereo MC's", 1992],
    ["Little Fluffy Clouds", "The Orb", 1990],
    ["Halcyon and On and On", "Orbital", 1992],
    ["Chime", "Orbital", 1989],
    ["Go", "Moby", 1991],
    ["Porcelain", "Moby", 1999],
  ],
  artrock_experimental: [
    ["Paranoid Android", "Radiohead", 1997],
    ["Karma Police", "Radiohead", 1997],
    ["No Surprises", "Radiohead", 1997],
    ["Just", "Radiohead", 1995],
    ["Street Spirit", "Radiohead", 1995],
    ["Fake Plastic Trees", "Radiohead", 1995],
    ["Creep", "Radiohead", 1992],
    ["Bachelorette", "Bjork", 1997],
    ["Hyperballad", "Bjork", 1995],
    ["Human Behaviour", "Bjork", 1993],
    ["Army of Me", "Bjork", 1995],
    ["Enjoy", "Bjork", 1995],
    ["Debaser", "Pixies", 1989],
    ["Here Comes Your Man", "Pixies", 1989],
    ["Birdhouse in Your Soul", "They Might Be Giants", 1990],
    ["Ana Ng", "They Might Be Giants", 1988],
    ["Cut Your Hair", "Pavement", 1994],
    ["Gold Soundz", "Pavement", 1994],
    ["Range Life", "Pavement", 1994],
    ["Summer Babe", "Pavement", 1992],
    ["Blue", "The Verve", 1993],
    ["History", "The Verve", 1995],
    ["Bittersweet Symphony", "The Verve", 1997],
    ["Lucky Man", "The Verve", 1997],
    ["The Drugs Don't Work", "The Verve", 1997],
  ],
  punk_noise_edge: [
    ["New Noise", "Refused", 1998],
    ["Rather Be Dead", "Refused", 1996],
    ["Waiting Room", "Fugazi", 1988],
    ["Repeater", "Fugazi", 1990],
    ["Suggestion", "Fugazi", 1988],
    ["Teen Age Riot", "Sonic Youth", 1988],
    ["Schizophrenia", "Sonic Youth", 1987],
    ["Kool Thing", "Sonic Youth", 1990],
    ["Bull in the Heather", "Sonic Youth", 1994],
    ["Touch Me I'm Sick", "Mudhoney", 1988],
    ["Suck You Dry", "Mudhoney", 1992],
    ["Seether", "Veruca Salt", 1994],
    ["Pretend We're Dead", "L7", 1992],
    ["Shitlist", "L7", 1992],
    ["Violet", "Hole", 1994],
    ["Miss World", "Hole", 1994],
    ["Rebel Girl", "Bikini Kill", 1993],
    ["Rid of Me", "PJ Harvey", 1993],
    ["Divine Hammer", "The Breeders", 1993],
    ["Here Comes Sickness", "Mudhoney", 1989],
    ["Unsatisfied", "The Replacements", 1984],
    ["Bastards of Young", "The Replacements", 1985],
    ["Alex Chilton", "The Replacements", 1987],
    ["Personality Crisis", "New York Dolls", 1973],
    ["Search and Destroy", "The Stooges", 1973],
  ],
  sophistipop_lyric_indie: [
    ["Lloyd, I'm Ready to Be Heartbroken", "Camera Obscura", 2006],
    ["The State I Am In", "Belle and Sebastian", 1996],
    ["Like Dylan in the Movies", "Belle and Sebastian", 1996],
    ["Get Me Away from Here, I'm Dying", "Belle and Sebastian", 1996],
    ["Legal Man", "Belle and Sebastian", 2000],
    ["Oblivious", "Aztec Camera", 1983],
    ["Somewhere in My Heart", "Aztec Camera", 1987],
    ["The Boy with the Thorn in His Side", "The Smiths", 1985],
    ["Heaven Knows I'm Miserable Now", "The Smiths", 1984],
    ["Ask", "The Smiths", 1986],
    ["A New England", "Billy Bragg", 1983],
    ["Between the Wars", "Billy Bragg", 1985],
    ["Shipbuilding", "Elvis Costello", 1982],
    ["Oliver's Army", "Elvis Costello", 1979],
    ["Everyday I Write the Book", "Elvis Costello", 1983],
    ["Perfect Skin", "Lloyd Cole and the Commotions", 1984],
    ["Rattlesnakes", "Lloyd Cole and the Commotions", 1984],
    ["Brand New Friend", "Lloyd Cole and the Commotions", 1985],
    ["Dignity", "Deacon Blue", 1987],
    ["Real Gone Kid", "Deacon Blue", 1988],
    ["When Love Breaks Down", "Prefab Sprout", 1984],
    ["Cars and Girls", "Prefab Sprout", 1988],
    ["The King of Rock 'n' Roll", "Prefab Sprout", 1988],
    ["Missing", "Everything But The Girl", 1994],
    ["Walking Wounded", "Everything But The Girl", 1996],
  ],
};

const overrides = {
  "New Order|Ceremony": {
    movement: 95,
    atmosphere: 88,
    groove: 72,
    darkness: 42,
    hope: 90,
    nostalgia: 70,
    transformation: 100,
    complexity: 48,
    melody: 75,
    verbal_cleverness: 42,
    authenticity: 86,
    romanticism: 84,
    energy: 78,
    dreaminess: 68,
    community: 74,
  },
  "New Order|Temptation": {
    movement: 96,
    atmosphere: 82,
    groove: 88,
    darkness: 30,
    hope: 92,
    nostalgia: 68,
    transformation: 90,
    complexity: 45,
    melody: 76,
    verbal_cleverness: 36,
    authenticity: 80,
    romanticism: 86,
    energy: 84,
    dreaminess: 62,
    community: 86,
  },
  "The Smiths|This Charming Man": {
    movement: 72,
    atmosphere: 38,
    groove: 45,
    darkness: 28,
    hope: 70,
    nostalgia: 72,
    transformation: 42,
    complexity: 46,
    melody: 94,
    verbal_cleverness: 96,
    authenticity: 66,
    romanticism: 72,
    energy: 70,
    dreaminess: 34,
    community: 78,
  },
  "The Cure|A Forest": {
    movement: 88,
    atmosphere: 92,
    groove: 78,
    darkness: 86,
    hope: 22,
    nostalgia: 70,
    transformation: 76,
    complexity: 54,
    melody: 62,
    verbal_cleverness: 34,
    authenticity: 82,
    romanticism: 72,
    energy: 66,
    dreaminess: 76,
    community: 40,
  },
  "Echo & the Bunnymen|The Killing Moon": {
    movement: 54,
    atmosphere: 92,
    groove: 52,
    darkness: 76,
    hope: 38,
    nostalgia: 78,
    transformation: 66,
    complexity: 58,
    melody: 82,
    verbal_cleverness: 68,
    authenticity: 78,
    romanticism: 96,
    energy: 54,
    dreaminess: 82,
    community: 54,
  },
  "Underworld|Born Slippy .NUXX": {
    movement: 98,
    atmosphere: 82,
    groove: 96,
    darkness: 50,
    hope: 78,
    nostalgia: 58,
    transformation: 94,
    complexity: 60,
    melody: 45,
    verbal_cleverness: 24,
    authenticity: 62,
    romanticism: 62,
    energy: 96,
    dreaminess: 70,
    community: 90,
  },
  "Massive Attack|Teardrop": {
    movement: 48,
    atmosphere: 96,
    groove: 64,
    darkness: 58,
    hope: 44,
    nostalgia: 68,
    transformation: 74,
    complexity: 62,
    melody: 78,
    verbal_cleverness: 40,
    authenticity: 72,
    romanticism: 80,
    energy: 38,
    dreaminess: 92,
    community: 42,
  },
  "Ride|Vapour Trail": {
    movement: 78,
    atmosphere: 90,
    groove: 66,
    darkness: 24,
    hope: 82,
    nostalgia: 78,
    transformation: 88,
    complexity: 54,
    melody: 78,
    verbal_cleverness: 32,
    authenticity: 74,
    romanticism: 86,
    energy: 72,
    dreaminess: 90,
    community: 58,
  },
  "The Smashing Pumpkins|Spaceboy": {
    movement: 46,
    atmosphere: 82,
    groove: 40,
    darkness: 58,
    hope: 42,
    nostalgia: 72,
    transformation: 82,
    complexity: 56,
    melody: 72,
    verbal_cleverness: 34,
    authenticity: 82,
    romanticism: 88,
    energy: 42,
    dreaminess: 86,
    community: 34,
  },
  "The Charlatans|Opportunity": {
    movement: 86,
    atmosphere: 66,
    groove: 84,
    darkness: 26,
    hope: 86,
    nostalgia: 70,
    transformation: 76,
    complexity: 42,
    melody: 70,
    verbal_cleverness: 44,
    authenticity: 68,
    romanticism: 62,
    energy: 78,
    dreaminess: 54,
    community: 82,
  },
};

const diagnosticOverrides = {
  "New Order|Ceremony": {
    diagnostic_power: 96,
    primary_dimensions: ["transformation", "hope", "movement"],
    archetype_signals: ["forward_motion_romantic", "rebirth_seeker"],
  },
  "New Order|Temptation": {
    diagnostic_power: 95,
    primary_dimensions: ["movement", "groove", "hope"],
    archetype_signals: ["forward_motion_romantic", "bassline_mystic"],
  },
  "Depeche Mode|Dreaming of Me": {
    diagnostic_power: 91,
    primary_dimensions: ["melody", "movement", "nostalgia"],
    archetype_signals: ["synth_charmist", "melody_maximalist"],
  },
  "The Cure|A Forest": {
    diagnostic_power: 96,
    primary_dimensions: ["darkness", "atmosphere", "movement"],
    archetype_signals: ["beautiful_doom_seeker", "bassline_mystic"],
  },
  "Echo & the Bunnymen|The Killing Moon": {
    diagnostic_power: 94,
    primary_dimensions: ["romanticism", "atmosphere", "darkness"],
    archetype_signals: ["beautiful_doom_seeker", "cinematic_romantic"],
  },
  "The Stone Roses|Fools Gold": {
    diagnostic_power: 95,
    primary_dimensions: ["groove", "movement", "community"],
    archetype_signals: ["bassline_mystic", "communal_lift_seeker"],
  },
  "Underworld|Born Slippy .NUXX": {
    diagnostic_power: 96,
    primary_dimensions: ["movement", "groove", "energy"],
    archetype_signals: ["catharsis_engine", "bassline_mystic"],
  },
  "The Smiths|This Charming Man": {
    diagnostic_power: 94,
    primary_dimensions: ["verbal_cleverness", "melody", "community"],
    archetype_signals: ["melody_maximalist", "lyrical_wit_seeker"],
  },
  "Ride|Vapour Trail": {
    diagnostic_power: 93,
    primary_dimensions: ["dreaminess", "atmosphere", "transformation"],
    archetype_signals: ["texture_astronaut", "forward_motion_romantic"],
  },
  "The Charlatans|Opportunity": {
    diagnostic_power: 90,
    primary_dimensions: ["groove", "hope", "community"],
    archetype_signals: ["communal_lift_seeker", "bassline_mystic"],
  },
  "Oasis|Wonderwall": {
    diagnostic_power: 38,
    primary_dimensions: ["melody", "community"],
    archetype_signals: ["melody_maximalist"],
  },
  "Nirvana|Smells Like Teen Spirit": {
    diagnostic_power: 42,
    primary_dimensions: ["energy", "community"],
    archetype_signals: ["catharsis_engine"],
  },
};

function hash(input) {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreSong(song, lane) {
  const [title, artist] = song;
  const key = `${artist}|${title}`;
  if (overrides[key]) return overrides[key];

  const profile = laneProfiles[lane];
  const scores = {};
  for (const dimension of dimensions) {
    const jitter = (hash(`${key}|${dimension}`) % 13) - 6;
    scores[dimension] = clamp(profile[dimension] + jitter);
  }
  return scores;
}

function topSignalDimensions(scores, count = 3) {
  return dimensions
    .map((dimension) => ({
      dimension,
      extremity: Math.abs(scores[dimension] - 50),
      score: scores[dimension],
    }))
    .sort((a, b) => b.extremity - a.extremity || b.score - a.score)
    .slice(0, count)
    .map((item) => item.dimension);
}

function inferArchetypeSignals(scores, primaryDimensions) {
  const signals = [];
  const has = (dimension) => primaryDimensions.includes(dimension);

  if (scores.movement >= 75 && scores.hope >= 70 && scores.transformation >= 70) {
    signals.push("forward_motion_romantic");
  }
  if (scores.atmosphere >= 78 && scores.dreaminess >= 75) {
    signals.push("texture_astronaut");
  }
  if (scores.darkness >= 72 && scores.atmosphere >= 70) {
    signals.push("beautiful_doom_seeker");
  }
  if (scores.groove >= 78 && scores.movement >= 72) {
    signals.push("bassline_mystic");
  }
  if (scores.energy >= 82 && has("energy")) {
    signals.push("catharsis_engine");
  }
  if (scores.melody >= 78 && scores.verbal_cleverness >= 70) {
    signals.push("melody_maximalist");
  }
  if (scores.community >= 78 && scores.hope >= 68) {
    signals.push("communal_lift_seeker");
  }
  if (scores.romanticism >= 82 && scores.atmosphere >= 70) {
    signals.push("cinematic_romantic");
  }

  return signals.length ? signals.slice(0, 3) : ["open_signal"];
}

function diagnosticMetadata(song, scores) {
  const [title, artist] = song;
  const key = `${artist}|${title}`;
  if (diagnosticOverrides[key]) return diagnosticOverrides[key];

  const primaryDimensions = topSignalDimensions(scores);
  const topExtremity =
    primaryDimensions.reduce((sum, dimension) => {
      return sum + Math.abs(scores[dimension] - 50);
    }, 0) / primaryDimensions.length;
  const contrastBonus = new Set(primaryDimensions).size * 3;
  const diagnosticPower = clamp(38 + topExtremity * 1.15 + contrastBonus);

  return {
    diagnostic_power: diagnosticPower,
    primary_dimensions: primaryDimensions,
    archetype_signals: inferArchetypeSignals(scores, primaryDimensions),
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function buildRows() {
  const rows = [];
  for (const [lane, songs] of Object.entries(songsByLane)) {
    for (const song of songs) {
      const [title, artist, year] = song;
      const scores = scoreSong(song, lane);
      const diagnostic = diagnosticMetadata(song, scores);
      rows.push({
        title,
        artist,
        year,
        lane,
        diagnostic_power: diagnostic.diagnostic_power,
        primary_dimensions: diagnostic.primary_dimensions.join("|"),
        archetype_signals: diagnostic.archetype_signals.join("|"),
        ...scores,
        score_status: overrides[`${artist}|${title}`] ? "curated_override" : "draft_lane_profile",
        curation_status: "unreviewed",
        notes: "",
      });
    }
  }
  return rows;
}

const headers = [
  "title",
  "artist",
  "year",
  "lane",
  "diagnostic_power",
  "primary_dimensions",
  "archetype_signals",
  ...dimensions,
  "score_status",
  "curation_status",
  "notes",
];

const rows = buildRows();
if (rows.length !== 250) {
  throw new Error(`Expected 250 songs, received ${rows.length}`);
}

const csv =
  [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n") + "\n";

const outputPath = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "musicdna",
  "alternative_diagnostic_canon_seed.csv",
);
fs.writeFileSync(outputPath, csv, "utf8");
console.log(`Wrote ${rows.length} songs to ${outputPath}`);
