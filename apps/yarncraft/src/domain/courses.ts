/**
 * Five progressive courses, mirroring the "learn step by step" feature:
 * each course moves from a single technique to a finished object.
 */

import type { Course } from '../shared/types.ts';

export const COURSES: Course[] = [
  {
    id: 'course-first-stitches',
    title: 'Your First Stitches',
    subtitle: 'Hook hold, slip knot, chain and single crochet',
    level: 'beginner',
    minutes: 45,
    accent: '#6d8a6a',
    lessons: [
      {
        id: 'hold',
        title: 'Hold the hook and yarn',
        minutes: 5,
        goal: 'Find a grip you can sustain for an hour.',
        steps: [
          {
            title: 'Hold the hook like a pencil or a knife',
            body: 'Pencil grip: hold the hook between thumb and index finger, resting on the middle finger. Knife grip: hold it from above with your whole hand. Both are correct - pick the one that keeps your wrist relaxed.',
            tip: 'If your hand aches after five minutes, your grip is too tight. The hook should rest, not grip.',
          },
          {
            title: 'Tension the yarn',
            body: 'Drape the working yarn over your index finger, under your middle two fingers and around your pinky. Your index finger controls tension; the others stop the ball running away.',
            tip: 'Consistent tension matters more than tight tension.',
          },
        ],
      },
      {
        id: 'slipknot',
        title: 'The slip knot',
        minutes: 5,
        goal: 'Get yarn onto the hook with an adjustable first loop.',
        steps: [
          {
            title: 'Make a loop and pull a loop through',
            body: 'Cross the yarn tail over the working yarn to make a loop, reach through it, catch the working yarn and pull it through. Slide the knot onto the hook and snug it - not tight.',
            diagram: 'ch',
            tip: 'The knot should slide along the hook and along the yarn but not fall off on its own.',
          },
        ],
      },
      {
        id: 'chain',
        title: 'Chain stitch',
        minutes: 10,
        goal: 'Work an even foundation chain of 20.',
        steps: [
          {
            title: 'Yarn over and pull through',
            body: 'Wrap the yarn over the hook (yarn over) and pull it through the loop on the hook. That is one chain. Repeat to 20, keeping each chain the same size.',
            diagram: 'ch',
            tip: 'Do not count the loop on the hook as a chain. Count the V shapes.',
          },
          {
            title: 'Count without twisting',
            body: 'Lay the chain flat. Each chain looks like a small V from the front and a bump from the back. Keep the front facing you so the next row is easy to find.',
          },
        ],
      },
      {
        id: 'sc',
        title: 'Single crochet',
        minutes: 15,
        goal: 'Work one row of 20 single crochet.',
        steps: [
          {
            title: 'Insert, pull up, yarn over, pull through both',
            body: 'Insert the hook into the second chain from the hook. Yarn over, pull up a loop (two loops on hook). Yarn over again and pull through both loops. One single crochet made.',
            diagram: 'sc',
            tip: 'Insert under both top loops of the chain, not into the middle of the chain.',
          },
          {
            title: 'Work across and turn',
            body: 'Single crochet into every remaining chain. You should have 20 stitches. Chain 1, turn your work, and single crochet into each stitch of the row below.',
            diagram: 'sc',
          },
        ],
      },
      {
        id: 'fasten-off',
        title: 'Fasten off and weave in',
        minutes: 10,
        goal: 'Finish cleanly so nothing unravels.',
        steps: [
          {
            title: 'Cut, pull, tighten',
            body: 'Cut the yarn leaving a 15 cm tail. Pull the tail all the way through the last loop and tighten.',
            tip: 'Weave the tail through the back of the fabric in two directions so it cannot work loose.',
          },
        ],
      },
    ],
  },
  {
    id: 'course-shapes',
    title: 'Circles and Shapes',
    subtitle: 'Magic ring, increases, decreases, flat circles',
    level: 'beginner',
    minutes: 60,
    accent: '#c2643c',
    lessons: [
      {
        id: 'magic-ring',
        title: 'The magic ring',
        minutes: 15,
        goal: 'Start a project with no hole in the middle.',
        steps: [
          {
            title: 'Wrap, insert, pull through',
            body: 'Wrap the yarn twice around two fingers to make a ring. Insert the hook into the ring, yarn over, pull up a loop, chain 1 to secure, then work your stitches into the ring itself.',
            diagram: 'sc',
            tip: 'Work over the tail as you go and the centre closes itself when you pull.',
          },
          {
            title: 'Close the ring',
            body: 'Pull the tail firmly. The centre closes to a point. This is the standard amigurumi and coaster start.',
          },
        ],
      },
      {
        id: 'increases',
        title: 'Increasing in the round',
        minutes: 20,
        goal: 'Grow a flat circle without ruffles or cupping.',
        steps: [
          {
            title: 'Two stitches in one',
            body: 'An increase (inc) is simply two stitches worked into the same stitch. To keep a circle flat, add the same number of stitches each round as you started with - six for single crochet.',
            diagram: 'inc',
          },
          {
            title: 'The flat-circle rule',
            body: 'Round 1: 6. Round 2: (inc) x 6 = 12. Round 3: (sc, inc) x 6 = 18. Round 4: (2 sc, inc) x 6 = 24. Each round adds six and the group before the increase grows by one stitch.',
            diagram: 'sc',
            tip: 'Ruffled edge means too many increases. Cupped edge means too few.',
          },
        ],
      },
      {
        id: 'decreases',
        title: 'Decreasing',
        minutes: 15,
        goal: 'Close a shape without gaps.',
        steps: [
          {
            title: 'Standard decrease',
            body: 'Insert into the next stitch, pull up a loop. Insert into the following stitch, pull up a loop. Yarn over and pull through all three loops. Two stitches become one.',
            diagram: 'dec',
          },
          {
            title: 'Invisible decrease',
            body: 'Work into the front loops only of the two stitches. The decrease is tighter and shows less on amigurumi.',
            diagram: 'dec',
            tip: 'In amigurumi, always decrease with the invisible method to avoid holes.',
          },
        ],
      },
    ],
  },
  {
    id: 'course-taller-stitches',
    title: 'Taller Stitches',
    subtitle: 'Half double, double and treble crochet',
    level: 'easy',
    minutes: 50,
    accent: '#d9a13b',
    lessons: [
      {
        id: 'hdc',
        title: 'Half double crochet',
        minutes: 12,
        goal: 'A softer fabric in less time.',
        steps: [
          {
            title: 'Yarn over first',
            body: 'Yarn over, insert the hook, pull up a loop (three loops on hook). Yarn over and pull through all three loops at once.',
            diagram: 'hdc',
            tip: 'Half double crochet needs a turning chain of two.',
          },
        ],
      },
      {
        id: 'dc',
        title: 'Double crochet',
        minutes: 15,
        goal: 'The workhorse stitch for blankets and garments.',
        steps: [
          {
            title: 'Two loops, two loops',
            body: 'Yarn over, insert, pull up a loop (three loops). Yarn over, pull through two. Yarn over, pull through the last two.',
            diagram: 'dc',
          },
          {
            title: 'Turning chain three',
            body: 'A double crochet row starts with chain 3, which counts as the first stitch. Skip the first stitch of the row below only if your pattern says so.',
            diagram: 'ch',
          },
        ],
      },
      {
        id: 'tr',
        title: 'Treble crochet',
        minutes: 13,
        goal: 'Long open stitches for lace and fast growth.',
        steps: [
          {
            title: 'Two yarn overs',
            body: 'Yarn over twice, insert, pull up a loop (four loops). Yarn over and pull through two, three times.',
            diagram: 'tr',
          },
        ],
      },
      {
        id: 'gauge',
        title: 'Gauge: why it matters',
        minutes: 10,
        goal: 'Match a pattern\'s tension so sizes come out right.',
        steps: [
          {
            title: 'Swatch and measure',
            body: 'Work a 15 cm square in the pattern stitch, then measure 10 cm and count the stitches. Compare with the pattern gauge. Too many stitches means your tension is tight - go up a hook size.',
            tip: 'Gauge matters for wearables. For amigurumi, tighter is better and gauge is usually irrelevant.',
          },
        ],
      },
    ],
  },
  {
    id: 'course-in-the-round',
    title: 'Working in the Round',
    subtitle: 'Continuous spirals, joins, colour changes',
    level: 'intermediate',
    minutes: 55,
    accent: '#4b7f96',
    lessons: [
      {
        id: 'spiral',
        title: 'Continuous rounds',
        minutes: 15,
        goal: 'Work a seamless spiral without turning.',
        steps: [
          {
            title: 'Never join, never turn',
            body: 'Work each round directly onto the previous one and keep going. The fabric grows in a spiral with no seam.',
            tip: 'Use a stitch marker in the first stitch of each round - there is no other way to know where a round began.',
          },
        ],
      },
      {
        id: 'joined',
        title: 'Joined rounds',
        minutes: 15,
        goal: 'Finish each round with a flat seam.',
        steps: [
          {
            title: 'Slip stitch to join',
            body: 'Work to the end of the round, then slip stitch into the first stitch. Chain the turning chain for the next round.',
            diagram: 'slst',
            tip: 'Joined rounds stack the join in one line. Continuous rounds spread it out - choose by whether you want a visible seam.',
          },
        ],
      },
      {
        id: 'colour',
        title: 'Changing colour',
        minutes: 15,
        goal: 'A clean colour change with no jog.',
        steps: [
          {
            title: 'Change on the last pull-through',
            body: 'Work the last stitch of the old colour until two loops remain. Drop the old colour, pick up the new, and pull the new colour through both loops. Continue.',
            tip: 'For stripes in continuous rounds the join jogs by one stitch. Join rounds when you need perfectly straight stripes.',
          },
        ],
      },
    ],
  },
  {
    id: 'course-finishing',
    title: 'Finishing Like a Pro',
    subtitle: 'Seaming, blocking, stuffing, weaving in',
    level: 'intermediate',
    minutes: 40,
    accent: '#b5525f',
    lessons: [
      {
        id: 'seaming',
        title: 'Mattress stitch seam',
        minutes: 12,
        goal: 'An invisible seam on flat pieces.',
        steps: [
          {
            title: 'Pick up bars, not stitches',
            body: 'With right sides facing up, pass the needle under the horizontal bar between the edge stitch and the next stitch, alternating sides. Pull snug every few centimetres.',
            tip: 'Mattress stitch is invisible from the front and flat from the back - worth learning properly once.',
          },
        ],
      },
      {
        id: 'stuffing',
        title: 'Stuffing amigurumi',
        minutes: 10,
        goal: 'Firm, even stuffing with no lumps.',
        steps: [
          {
            title: 'Small amounts, corners first',
            body: 'Add stuffing in walnut-sized pieces, pushing it into limbs and corners first. Fill until the fabric is firm but the stitches are not stretched.',
          },
        ],
      },
      {
        id: 'blocking',
        title: 'Blocking',
        minutes: 10,
        goal: 'Make lace open up and edges lie flat.',
        steps: [
          {
            title: 'Wet, pin, dry',
            body: 'Soak in cool water, press gently in a towel, pin to shape on a board and leave to dry fully. Acrylic needs gentle steam instead of soaking.',
          },
        ],
      },
      {
        id: 'weaving',
        title: 'Weaving in ends',
        minutes: 8,
        goal: 'Ends that never come out in the wash.',
        steps: [
          {
            title: 'Two directions, split the yarn',
            body: 'Thread the tail on a needle, run it through the back of several stitches in one direction, then turn and run it back through different stitches. Change direction so friction holds it.',
            tip: 'Never knot. Knots work loose and leave hard lumps.',
          },
        ],
      },
    ],
  },
];

export function findCourse(id: string): Course | undefined {
  return COURSES.find((course) => course.id === id);
}
