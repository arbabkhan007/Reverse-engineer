/**
 * Pattern library.
 *
 * Two kinds of entry, both honest about their origin:
 *  - curated: complete hand-written instructions shipped with the app
 *  - generated: built from a shape spec on demand, with instructions that the
 *    checker re-parses and verifies, so no entry is a stub
 */

import type {
  CatalogPattern,
  Category,
  Craft,
  PatternShapeSpec,
  SkillLevel,
} from '../shared/types.ts';
import { generateFromShape } from './patternGenerator.ts';

type Seed = {
  name: string;
  shape: PatternShapeSpec['kind'];
  stitch: string;
  category: Category;
  level: SkillLevel;
  minutes: number;
  craft?: Craft;
  tags?: string[];
  collection?: string;
  tenMinute?: boolean;
};

const s = (
  name: string,
  shape: PatternShapeSpec['kind'],
  stitch: string,
  category: Category,
  level: SkillLevel,
  minutes: number,
  extra: Partial<Seed> = {},
): Seed => ({ name, shape, stitch, category, level, minutes, ...extra });

/* ------------------------------------------------------------- curated */

interface CuratedSeed {
  id: string;
  title: string;
  category: Category;
  level: SkillLevel;
  minutes: number;
  blurb: string;
  tags: string[];
  shape: PatternShapeSpec;
  collection?: string;
  tenMinute?: boolean;
}

const CURATED: CuratedSeed[] = [
  {
    id: 'curated-granny-coaster',
    title: 'Five-Minute Granny Coaster',
    category: 'Kitchen',
    level: 'beginner',
    minutes: 8,
    blurb: 'The classic four-round granny square, sized for a mug. The friendliest first project there is.',
    tags: ['granny', 'quick', 'scrap-yarn'],
    shape: { kind: 'granny-square', stitch: 'dc', rows: 4 },
    tenMinute: true,
  },
  {
    id: 'curated-magic-ring-circle',
    title: 'Magic Ring Practice Circle',
    category: 'Home Decor',
    level: 'beginner',
    minutes: 10,
    blurb: 'Six rounds of single crochet increases. Learn the magic ring and flat-circle maths in one go.',
    tags: ['magic-ring', 'circle', 'foundation'],
    shape: { kind: 'flat-circle', stitch: 'sc', rows: 6, start: 6, increasePerRound: 6 },
    tenMinute: true,
  },
  {
    id: 'curated-buddy-ball',
    title: 'Pocket Buddy Ball',
    category: 'Amigurumi',
    level: 'beginner',
    minutes: 45,
    blurb: 'A seamless sphere worked in continuous rounds - the backbone of every amigurumi shape.',
    tags: ['amigurumi', 'sphere', 'continuous-rounds'],
    shape: { kind: 'amigurumi-sphere', stitch: 'sc', rows: 12, start: 6 },
  },
  {
    id: 'curated-ear-warmer',
    title: 'Chunky Ear Warmer',
    category: 'Wearables',
    level: 'beginner',
    minutes: 40,
    blurb: 'A ribbed headband in half double crochet back-loop-only. Two hours of telly and it is done.',
    tags: ['ribbed', 'headband', 'blo'],
    shape: { kind: 'ear-warmer', stitch: 'hdc', rows: 22, width: 10 },
    collection: 'winter',
  },
  {
    id: 'curated-bookmark',
    title: 'Beaded Bookmark',
    category: 'Gifts',
    level: 'beginner',
    minutes: 15,
    blurb: 'A narrow strip of single and double crochet with a hanging loop. Perfect for using up scraps.',
    tags: ['scrap-yarn', 'quick', 'gift'],
    shape: { kind: 'bookmark', stitch: 'sc', rows: 24, width: 6 },
    tenMinute: true,
  },
  {
    id: 'curated-coaster-set',
    title: 'Weekend Coaster Set of Four',
    category: 'Home Decor',
    level: 'beginner',
    minutes: 60,
    blurb: 'Four matching circles with a slip-stitch border. The full set takes about an hour.',
    tags: ['set', 'cotton', 'table'],
    shape: { kind: 'coaster-set', stitch: 'sc', rows: 5 },
  },
  {
    id: 'curated-basket',
    title: 'Sturdy Scrap Basket',
    category: 'Home Decor',
    level: 'easy',
    minutes: 90,
    blurb: 'A flat base worked in back loops only to make the sides stand up. Holds a surprising amount.',
    tags: ['basket', 'storage', 'stiff'],
    shape: { kind: 'basket', stitch: 'sc', rows: 14, start: 6, increasePerRound: 6 },
  },
  {
    id: 'curated-tote',
    title: 'Everyday Market Tote',
    category: 'Bags',
    level: 'easy',
    minutes: 180,
    blurb: 'A dense single crochet panel, seamed up the sides, with two sturdy handles.',
    tags: ['bag', 'market', 'cotton'],
    shape: { kind: 'tote', stitch: 'sc', rows: 26, width: 32 },
  },
  {
    id: 'curated-ripple',
    title: 'Ripple Baby Blanket Swatch',
    category: 'Blankets',
    level: 'intermediate',
    minutes: 150,
    blurb: 'The chevron repeat broken down stitch by stitch, so the peaks and valleys finally make sense.',
    tags: ['chevron', 'ripple', 'repeat'],
    shape: { kind: 'chevron', stitch: 'dc', rows: 12, start: 5 },
  },
  {
    id: 'curated-hat',
    title: 'Top-Down Simple Hat',
    category: 'Wearables',
    level: 'easy',
    minutes: 120,
    blurb: 'Start with a flat circle for the crown, then stop increasing and the hat builds itself.',
    tags: ['hat', 'in-the-round', 'top-down'],
    shape: { kind: 'hat-in-the-round', stitch: 'dc', rows: 18, start: 12 },
    collection: 'winter',
  },
];

const SIZE_VARIANTS = [
  { prefix: 'Mini ', scale: 0.6, minutes: 0.55 },
  { prefix: '', scale: 1, minutes: 1 },
  { prefix: 'Classic ', scale: 1.25, minutes: 1.35 },
  { prefix: 'Oversized ', scale: 1.6, minutes: 1.85 },
];

/** 126 themed seeds; each expands to 4 sizes, giving 504 generated patterns. */
const SEEDS: Seed[] = [
  s('Cloud Nine Beanie', 'hat-in-the-round', 'dc', 'Wearables', 'easy', 110, { collection: 'winter' }),
  s('Slouchy Sunday Hat', 'hat-in-the-round', 'hdc', 'Wearables', 'easy', 95, { collection: 'winter' }),
  s('Fisherman Rib Beanie', 'hat-in-the-round', 'dc', 'Wearables', 'intermediate', 130, { collection: 'winter' }),
  s('Chunky Pom Hat', 'hat-in-the-round', 'dc', 'Wearables', 'beginner', 80, { collection: 'winter' }),
  s('Cable Look Headband', 'ear-warmer', 'hdc', 'Wearables', 'beginner', 45, { collection: 'winter' }),
  s('Twisted Ear Warmer', 'ear-warmer', 'hdc', 'Wearables', 'easy', 50, { collection: 'winter' }),
  s('Frosty Ear Warmer', 'ear-warmer', 'sc', 'Wearables', 'beginner', 40, { collection: 'winter' }),
  s('Weekend Beret', 'hat-in-the-round', 'dc', 'Wearables', 'intermediate', 140, { collection: 'winter' }),
  s('Sunhat with Brim', 'hat-in-the-round', 'sc', 'Wearables', 'intermediate', 160, { collection: 'summer' }),
  s('Bucket Hat', 'hat-in-the-round', 'hdc', 'Wearables', 'easy', 120, { collection: 'summer' }),

  s('Cozy Mug Hug', 'flat-panel', 'sc', 'Kitchen', 'beginner', 25, { collection: 'winter' }),
  s('Striped Potholder', 'flat-panel', 'sc', 'Kitchen', 'beginner', 55),
  s('Dishcloth Duo', 'flat-panel', 'sc', 'Kitchen', 'beginner', 45),
  s('Farmhouse Towel Topper', 'flat-panel', 'hdc', 'Kitchen', 'easy', 60),
  s('Tea Cozy', 'flat-panel', 'dc', 'Kitchen', 'easy', 70, { collection: 'winter' }),
  s('Jam Jar Cover', 'flat-circle', 'dc', 'Kitchen', 'beginner', 20, { tenMinute: true }),
  s('Bread Warmer Wrap', 'flat-panel', 'dc', 'Kitchen', 'easy', 85),
  s('Egg Cozy Pair', 'flat-circle', 'sc', 'Kitchen', 'beginner', 30, { collection: 'spring' }),

  s('Classic Granny Square', 'granny-square', 'dc', 'Blankets', 'beginner', 15),
  s('Solid Granny Square', 'granny-square', 'dc', 'Blankets', 'easy', 20),
  s('Sunburst Granny', 'granny-square', 'dc', 'Blankets', 'intermediate', 35),
  s('Ripple Throw', 'chevron', 'dc', 'Blankets', 'intermediate', 900, { collection: 'winter' }),
  s('Chevron Lap Blanket', 'chevron', 'dc', 'Blankets', 'intermediate', 480),
  s('Baby Ripple', 'chevron', 'hdc', 'Baby', 'easy', 380),
  s('Sampler Squares Blanket', 'granny-square', 'dc', 'Blankets', 'advanced', 1200),
  s('Stash Buster Blanket', 'flat-panel', 'dc', 'Blankets', 'easy', 720),

  s('Tiny Bear Head', 'amigurumi-sphere', 'sc', 'Amigurumi', 'beginner', 35),
  s('Pocket Bunny', 'amigurumi-sphere', 'sc', 'Amigurumi', 'beginner', 55),
  s('Baby Octopus', 'amigurumi-sphere', 'sc', 'Amigurumi', 'easy', 70),
  s('Chubby Cat', 'amigurumi-sphere', 'sc', 'Amigurumi', 'easy', 85),
  s('Sleepy Fox', 'amigurumi-sphere', 'sc', 'Amigurumi', 'intermediate', 120),
  s('Mini Mushroom', 'amigurumi-sphere', 'sc', 'Amigurumi', 'beginner', 30),
  s('Tiny Turtle', 'amigurumi-sphere', 'sc', 'Amigurumi', 'easy', 75),
  s('Desk Buddy Dino', 'amigurumi-sphere', 'sc', 'Amigurumi', 'easy', 90),
  s('Amigurumi Pumpkin', 'amigurumi-sphere', 'sc', 'Seasonal', 'beginner', 45, { collection: 'autumn' }),
  s('Little Ghost', 'amigurumi-sphere', 'sc', 'Seasonal', 'beginner', 40, { collection: 'autumn' }),
  s('Snowman Buddy', 'amigurumi-sphere', 'sc', 'Seasonal', 'easy', 60, { collection: 'winter' }),
  s('Tiny Santa', 'amigurumi-sphere', 'sc', 'Seasonal', 'intermediate', 95, { collection: 'winter' }),

  s('Market Tote', 'tote', 'sc', 'Bags', 'easy', 190),
  s('Mesh Produce Bag', 'tote', 'dc', 'Bags', 'beginner', 70),
  s('Crossbody Pouch', 'tote', 'sc', 'Bags', 'intermediate', 160),
  s('Beach Bag', 'tote', 'hdc', 'Bags', 'easy', 230, { collection: 'summer' }),
  s('Phone Sling', 'flat-panel', 'sc', 'Bags', 'beginner', 60),

  s('Storage Basket', 'basket', 'sc', 'Home Decor', 'easy', 95),
  s('Nesting Baskets', 'basket', 'sc', 'Home Decor', 'easy', 130),
  s('Plant Pot Cover', 'basket', 'sc', 'Home Decor', 'beginner', 50),
  s('Coaster Stack', 'coaster-set', 'sc', 'Home Decor', 'beginner', 60),
  s('Doily Circle', 'flat-circle', 'dc', 'Home Decor', 'intermediate', 110),
  s('Placemat Pair', 'flat-panel', 'hdc', 'Home Decor', 'easy', 120),
  s('Table Runner', 'flat-panel', 'dc', 'Home Decor', 'intermediate', 200),
  s('Pillow Cover', 'flat-panel', 'hdc', 'Home Decor', 'easy', 210),
  s('Hanging Planter', 'basket', 'dc', 'Home Decor', 'intermediate', 85),

  s('Simple Bookmark', 'bookmark', 'sc', 'Gifts', 'beginner', 12),
  s('Keychain Charm', 'bookmark', 'sc', 'Gifts', 'beginner', 15),
  s('Gift Card Holder', 'flat-panel', 'sc', 'Gifts', 'beginner', 30),
  s('Wine Bottle Gift Bag', 'basket', 'sc', 'Gifts', 'easy', 60),
  s('Mini Bouquet Wrap', 'flat-circle', 'dc', 'Gifts', 'easy', 45),

  s('Baby Bootie', 'flat-panel', 'sc', 'Baby', 'intermediate', 70),
  s('Newborn Beanie', 'hat-in-the-round', 'hdc', 'Baby', 'beginner', 40),
  s('Baby Blanket Squares', 'granny-square', 'dc', 'Baby', 'easy', 420),
  s('Tiny Mittens', 'flat-panel', 'sc', 'Baby', 'intermediate', 80),
  s('Baby Bib', 'flat-panel', 'sc', 'Baby', 'easy', 55),

  s('Autumn Leaf Coaster', 'flat-circle', 'sc', 'Seasonal', 'beginner', 20, { collection: 'autumn' }),
  s('Pumpkin Coaster Set', 'coaster-set', 'sc', 'Seasonal', 'beginner', 65, { collection: 'autumn' }),
  s('Candy Cane Ornament', 'bookmark', 'sc', 'Seasonal', 'beginner', 18, { collection: 'winter' }),
  s('Tree Decoration', 'amigurumi-sphere', 'sc', 'Seasonal', 'easy', 35, { collection: 'winter' }),
  s('Spring Flower Motif', 'flat-circle', 'dc', 'Seasonal', 'beginner', 22, { collection: 'spring' }),
  s('Easter Egg Cover', 'flat-circle', 'sc', 'Seasonal', 'beginner', 25, { collection: 'spring' }),
  s('Summer Sun Coaster', 'flat-circle', 'dc', 'Seasonal', 'beginner', 20, { collection: 'summer' }),
  s('Spider Web Doily', 'flat-circle', 'dc', 'Seasonal', 'intermediate', 70, { collection: 'autumn' }),
  s('Heart Garland Motif', 'flat-circle', 'sc', 'Seasonal', 'beginner', 15, { collection: 'spring' }),

  s('Textured Washcloth', 'flat-panel', 'sc', 'Kitchen', 'beginner', 50),
  s('Ribbed Spa Cloth', 'flat-panel', 'hdc', 'Home Decor', 'beginner', 55),
  s('Face Scrubby', 'flat-circle', 'sc', 'Home Decor', 'beginner', 25),
  s('Soap Saver Bag', 'flat-panel', 'sc', 'Home Decor', 'beginner', 35),
  s('Hanging Towel', 'flat-panel', 'dc', 'Kitchen', 'easy', 90),

  s('Lacy Bookmark', 'bookmark', 'dc', 'Gifts', 'easy', 25),
  s('Pot Holder Set', 'flat-panel', 'sc', 'Kitchen', 'easy', 75),
  s('Chair Socks', 'flat-panel', 'hdc', 'Home Decor', 'beginner', 40),
  s('Cup Sleeve', 'flat-panel', 'hdc', 'Accessories', 'beginner', 30),
  s('Water Bottle Sling', 'tote', 'sc', 'Accessories', 'easy', 65),

  s('Fingerless Gloves', 'flat-panel', 'sc', 'Accessories', 'intermediate', 90, { collection: 'winter' }),
  s('Chunky Scarf', 'flat-panel', 'dc', 'Accessories', 'beginner', 150, { collection: 'winter' }),
  s('Scarf with Pockets', 'flat-panel', 'hdc', 'Accessories', 'intermediate', 200, { collection: 'winter' }),
  s('Slouch Beanie', 'hat-in-the-round', 'dc', 'Accessories', 'easy', 100, { collection: 'winter' }),
  s('Wrist Warmers', 'flat-panel', 'sc', 'Accessories', 'easy', 60, { collection: 'winter' }),
  s('Neck Warmer', 'hat-in-the-round', 'dc', 'Accessories', 'beginner', 70, { collection: 'winter' }),
  s('Summer Market Cap', 'hat-in-the-round', 'sc', 'Accessories', 'easy', 110, { collection: 'summer' }),
  s('Belt Bag', 'tote', 'sc', 'Accessories', 'intermediate', 140),
  s('Hair Scrunchie', 'bookmark', 'sc', 'Accessories', 'beginner', 12),
  s('Head Scarf', 'flat-panel', 'dc', 'Accessories', 'easy', 95),

  s('Doily Star', 'flat-circle', 'dc', 'Home Decor', 'advanced', 130),
  s('Mandala Wall Art', 'flat-circle', 'dc', 'Home Decor', 'advanced', 260),
  s('Lace Table Mat', 'flat-circle', 'tr', 'Home Decor', 'advanced', 210),
  s('Pineapple Motif', 'flat-circle', 'dc', 'Home Decor', 'advanced', 180),
  s('Snowflake Ornament', 'flat-circle', 'dc', 'Seasonal', 'intermediate', 40, { collection: 'winter' }),
  s('Angel Ornament', 'amigurumi-sphere', 'sc', 'Seasonal', 'intermediate', 60, { collection: 'winter' }),

  s('Granny Cardigan Square', 'granny-square', 'dc', 'Wearables', 'intermediate', 220),
  s('Granny Tote', 'granny-square', 'dc', 'Bags', 'easy', 190),
  s('Granny Cushion', 'granny-square', 'dc', 'Home Decor', 'beginner', 150),
  s('Granny Blanket Border', 'granny-square', 'dc', 'Blankets', 'easy', 90),

  s('Bobble Baby Hat', 'hat-in-the-round', 'dc', 'Baby', 'intermediate', 95),
  s('Bobble Blanket Square', 'flat-panel', 'dc', 'Blankets', 'intermediate', 120),
  s('Puff Stitch Cowl', 'hat-in-the-round', 'hdc', 'Accessories', 'easy', 85, { collection: 'winter' }),
  s('Shell Stitch Scarf', 'flat-panel', 'dc', 'Accessories', 'easy', 130, { collection: 'winter' }),
  s('Shell Edge Blanket', 'flat-panel', 'dc', 'Blankets', 'intermediate', 600),
  s('Treble Lace Wrap', 'flat-panel', 'tr', 'Accessories', 'advanced', 240),
  s('Open Weave Shawl', 'flat-panel', 'tr', 'Wearables', 'advanced', 300),
  s('Net Beach Cover', 'flat-panel', 'dc', 'Wearables', 'intermediate', 260, { collection: 'summer' }),
  s('Ribbed Cardigan Panel', 'flat-panel', 'hdc', 'Wearables', 'advanced', 520),
  s('Cropped Vest Panel', 'flat-panel', 'hdc', 'Wearables', 'advanced', 380),

  s('Tiny Star Motif', 'flat-circle', 'sc', 'Gifts', 'beginner', 14),
  s('Flower Applique', 'flat-circle', 'dc', 'Gifts', 'beginner', 16),
  s('Heart Applique', 'flat-circle', 'sc', 'Gifts', 'beginner', 16),
  s('Leaf Applique', 'flat-circle', 'sc', 'Gifts', 'beginner', 14),
  s('Butterfly Motif', 'flat-circle', 'dc', 'Gifts', 'intermediate', 30),
  s('Bag Charm', 'amigurumi-sphere', 'sc', 'Gifts', 'beginner', 25),
  s('Pencil Topper', 'amigurumi-sphere', 'sc', 'Gifts', 'beginner', 20),
  s('Fridge Magnet Set', 'flat-circle', 'sc', 'Gifts', 'beginner', 30),
  s('Gift Bow', 'flat-circle', 'dc', 'Gifts', 'beginner', 12),
  s('Mini Stocking', 'flat-panel', 'sc', 'Seasonal', 'easy', 55, { collection: 'winter' }),
  s('Granny Hexagon Motif', 'flat-circle', 'dc', 'Blankets', 'intermediate', 40),
  s('Sunburst Square', 'granny-square', 'dc', 'Home Decor', 'easy', 45),
  s('Cozy Fingerless Mitts', 'flat-panel', 'sc', 'Accessories', 'intermediate', 95),
  s('Tiny Bunny Ears', 'bookmark', 'sc', 'Gifts', 'beginner', 12),
  s('Hanging Basket Trio', 'basket', 'sc', 'Home Decor', 'easy', 120),
  s('Ribbed Hot Pad', 'flat-panel', 'hdc', 'Kitchen', 'beginner', 40),
  s('Lacy Window Valance', 'flat-panel', 'tr', 'Home Decor', 'advanced', 210),
  s('Baby Hat with Ears', 'hat-in-the-round', 'hdc', 'Baby', 'easy', 55),
];

function sizeSpec(shape: PatternShapeSpec, scale: number): PatternShapeSpec {
  return {
    ...shape,
    rows: Math.max(2, Math.round(shape.rows * scale)),
    ...(shape.width ? { width: Math.max(3, Math.round(shape.width * scale)) } : {}),
    ...(shape.start ? { start: Math.max(2, Math.round(shape.start * scale)) } : {}),
  };
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

let cached: CatalogPattern[] | null = null;

export function buildCatalog(): CatalogPattern[] {
  if (cached) return cached;

  const patterns: CatalogPattern[] = CURATED.map((curated) => ({
    id: curated.id,
    title: curated.title,
    craft: 'crochet',
    category: curated.category,
    level: curated.level,
    minutes: curated.minutes,
    blurb: curated.blurb,
    tags: curated.tags,
    origin: 'generated',
    shape: curated.shape,
    supplies: {
      yarn: 'Worsted weight cotton or acrylic',
      hook: '4.0 mm (G-6)',
      yardage: '30-120 m depending on size',
      gauge: '4 sc per 2.5 cm / 1 in',
    },
    ...(curated.collection ? { collection: curated.collection } : {}),
    ...(curated.tenMinute ? { tenMinute: true } : {}),
  }));

  for (const seed of SEEDS) {
    for (const variant of SIZE_VARIANTS) {
      const title = `${variant.prefix}${seed.name}`.trim();
      const minutes = Math.max(5, Math.round(seed.minutes * variant.minutes));
      const shape = sizeSpec(
        { kind: seed.shape, stitch: seed.stitch, rows: 12 },
        variant.scale,
      );
      patterns.push({
        id: slug(title),
        title,
        craft: seed.craft ?? 'crochet',
        category: seed.category,
        level: seed.level,
        minutes,
        blurb: `${seed.name} in ${variant.prefix ? variant.prefix.trim().toLowerCase() : 'standard'} sizing. Complete written instructions, generated and verified by the stitch-maths checker.`,
        tags: [seed.shape, seed.stitch, seed.category.toLowerCase(), ...(seed.tags ?? [])],
        origin: 'generated',
        shape,
        supplies: {
          yarn: 'Worsted weight yarn',
          hook: '4.0 mm (G-6)',
          yardage: `${Math.max(10, Math.round(minutes * 1.6))} m`,
          gauge: '4 sc per 2.5 cm / 1 in',
        },
        ...(seed.collection ? { collection: seed.collection } : {}),
        ...(minutes <= 10 ? { tenMinute: true } : {}),
      });
    }
  }

  cached = patterns;
  return patterns;
}

export function patternText(pattern: CatalogPattern): string {
  if (!pattern.shape) return '';
  const { text } = generateFromShape(pattern.shape, {
    title: pattern.title,
    supplies: Object.entries(pattern.supplies)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => `${key[0]!.toUpperCase()}${key.slice(1)}: ${value}`),
  });
  return text;
}

export function findPattern(id: string): CatalogPattern | undefined {
  return buildCatalog().find((p) => p.id === id);
}

export const COLLECTIONS = [
  { key: 'winter', label: 'Winter Warmers', emoji: '❄️' },
  { key: 'spring', label: 'Spring Blooms', emoji: '🌷' },
  { key: 'summer', label: 'Summer Light', emoji: '☀️' },
  { key: 'autumn', label: 'Autumn Evenings', emoji: '🍂' },
];

/** New arrivals rotate weekly so the library keeps changing, deterministically. */
export function weeklyPicks(date = new Date()): CatalogPattern[] {
  const catalog = buildCatalog();
  const week = Math.floor(date.getTime() / (7 * 24 * 3600 * 1000));
  const picks: CatalogPattern[] = [];
  for (let i = 0; i < 6; i += 1) {
    const index = (week * 7 + i * 13) % catalog.length;
    const pattern = catalog[index];
    if (pattern && !picks.includes(pattern)) picks.push(pattern);
  }
  return picks;
}
