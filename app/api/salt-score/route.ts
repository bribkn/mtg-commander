import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define cache file path inside the project workspace
const CACHE_PATH = path.join(process.cwd(), 'lib', 'salt-cache.json');

// Helper to normalize card name to EDHREC card slug format
function getEdhrecCardSlug(name: string): string {
  const frontFace = name.includes('//') ? name.split('//')[0].trim() : name;
  return frontFace
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove punctuation except space/hyphen
    .trim()
    .replace(/\s+/g, '-');
}

// Initial pre-seeded cache to avoid fetching common cards
const PRESEEDED_CACHE: Record<string, number> = {
  "stasis": 3.76,
  "winter orb": 3.69,
  "static orb": 3.48,
  "armageddon": 3.55,
  "cyclonic rift": 3.12,
  "tergrid, god of fright": 3.25,
  "jin-gitaxias, core augur": 3.32,
  "vorinclex, voice of hunger": 3.14,
  "drannith magistrate": 2.81,
  "opposition agent": 2.76,
  "smothering tithe": 2.45,
  "rhystic study": 2.12,
  "ruination": 3.05,
  "blood moon": 2.88,
  "back to basics": 3.01,
  "humility": 3.15,
  "decree of annihilation": 3.44,
  "obliterate": 3.42,
  "ravages of war": 3.49,
  "catastrophe": 3.02,
  "jokulhaups": 3.22,
  "sol ring": 0.22,
  "mana crypt": 1.45,
  "gaea's cradle": 1.58,
  "the one ring": 1.62,
  "dockside extortionist": 2.52,
  "mana drain": 1.88,
  "sensi's divining top": 1.25,
  "demonic tutor": 1.15,
  "vampiric tutor": 1.12,
  "expropriate": 3.52,
  "time stretch": 2.25,
  "narset, parter of veils": 2.65,
  "grand arbiter augustin iv": 3.18,
  "contamination": 3.28,
  "smokestack": 3.22,
  "tangle wire": 2.85,
  "sphere of resistance": 2.15,
  "trinisphere": 2.62,
  "thorn of amethysts": 1.85,
  "chalice of the void": 2.05,
  "nether void": 3.12,
  "abyss": 2.95,
  "chains of mephistopheles": 2.78,
  "aura shards": 2.32,
  "grave pact": 1.95,
  "dictate of erebos": 1.88,
  "butcher of malakir": 1.45,
  "mindslaver": 2.89,
  "isochron scepter": 1.76,
  "dramatic reversal": 1.12,
  "hullbreaker horror": 2.35,
  "consecrated sphinx": 2.12,
  "cabal coffers": 0.98,
  "urborg, tomb of yawgmoth": 0.85,
  "yawgmoth's will": 1.15,
  "underworld breach": 1.25,
  "lion's eye diamond": 1.68,
  "lotus petal": 0.65,
  "mox diamond": 1.42,
  "chrome mox": 1.35,
  "mox opal": 1.28,
  "force of will": 1.62,
  "force of negation": 1.12,
  "pact of negation": 1.32,
  "swords to plowshares": 0.45,
  "path to exile": 0.38,
  "beast within": 0.42,
  "chaos warp": 0.35,
  "assassin's trophy": 0.52,
  "toxic deluge": 1.05,
  "wrath of god": 0.88,
  "blasphemous act": 0.65,
  "farewell": 2.85
};

export async function POST(request: Request) {
  try {
    const { cardNames } = await request.json();
    if (!Array.isArray(cardNames)) {
      return NextResponse.json({ error: 'cardNames must be an array' }, { status: 400 });
    }

    // Load or initialize cache
    let cache: Record<string, number> = { ...PRESEEDED_CACHE };
    if (fs.existsSync(CACHE_PATH)) {
      try {
        const fileContent = fs.readFileSync(CACHE_PATH, 'utf-8');
        cache = JSON.parse(fileContent);
      } catch (err) {
        console.error('Error reading salt cache file:', err);
      }
    } else {
      const dir = path.dirname(CACHE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
    }

    const result: Record<string, number> = {};
    const cardsToFetch: string[] = [];

    // Check cache
    for (const name of cardNames) {
      const key = name.toLowerCase().trim();
      if (key in cache) {
        result[name] = cache[key];
      } else {
        cardsToFetch.push(name);
      }
    }

    // Fetch missing card salt scores in the background slowly
    if (cardsToFetch.length > 0) {
      let updated = false;
      for (const name of cardsToFetch) {
        const slug = getEdhrecCardSlug(name);
        const url = `https://json.edhrec.com/pages/cards/${slug}.json`;

        try {
          const res = await fetch(url, {
            next: { revalidate: 86400 }, // Cache on CDN for 24h
          });

          let saltScore = 0;
          if (res.ok) {
            const data = await res.json();
            saltScore = data.container?.json_dict?.card?.salt || 0;
          }

          const key = name.toLowerCase().trim();
          cache[key] = saltScore;
          result[name] = saltScore;
          updated = true;

          // Rate-limiting delay of 150ms between sequential external calls
          await new Promise((r) => setTimeout(r, 150));
        } catch (err) {
          console.error(`Error fetching salt score for ${name}:`, err);
          result[name] = 0;
        }
      }

      if (updated) {
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
      }
    }

    return NextResponse.json({ saltScores: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
