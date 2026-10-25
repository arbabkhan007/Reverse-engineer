/**
 * Crochet chart symbols, drawn as SVG.
 *
 * Shapes follow standard international chart notation so the symbols are
 * recognisable to anyone who has read a stitch chart: a plus for single
 * crochet, a T for half double, T with one slash for double, and so on.
 */

const stroke = 'currentColor';

export function StitchSymbol({
  code,
  size = 28,
  title,
}: {
  code: string;
  size?: number;
  title?: string;
}) {
  const label = title ?? code;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke={stroke}
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <Glyph code={code} />
    </svg>
  );
}

function Glyph({ code }: { code: string }) {
  switch (code) {
    case 'ch':
      // Chain: an open oval.
      return <ellipse cx="16" cy="16" rx="9" ry="5.5" />;

    case 'slst':
      // Slip stitch: a small filled dot.
      return <circle cx="16" cy="16" r="4" fill={stroke} stroke="none" />;

    case 'sc':
      // Single crochet: a plus sign.
      return (
        <>
          <path d="M16 5v22" />
          <path d="M5 16h22" />
        </>
      );

    case 'hdc':
      // Half double: a T.
      return (
        <>
          <path d="M6 8h20" />
          <path d="M16 8v19" />
        </>
      );

    case 'dc':
      // Double crochet: a T with one slash.
      return (
        <>
          <path d="M6 8h20" />
          <path d="M16 8v19" />
          <path d="M21 10 25 26" />
        </>
      );

    case 'tr':
      // Treble: a T with two slashes.
      return (
        <>
          <path d="M5 8h18" />
          <path d="M13 8v19" />
          <path d="M18 10 21 26" />
          <path d="M23 12 25 24" />
        </>
      );

    case 'inc':
      // Increase: two stitches from one base (a V).
      return (
        <>
          <path d="M16 27 7 7" />
          <path d="M16 27 25 7" />
        </>
      );

    case 'dec':
      // Decrease: two stitches closed at the top (an inverted V).
      return (
        <>
          <path d="M7 25 16 7" />
          <path d="M25 25 16 7" />
        </>
      );

    case 'bobble':
      return (
        <>
          <circle cx="16" cy="17" r="7.5" fill={stroke} stroke="none" />
          <path d="M16 26v3" />
        </>
      );

    case 'puff':
      return (
        <>
          <ellipse cx="16" cy="16" rx="7" ry="9.5" fill="none" />
          <path d="M13 10v12M19 10v12" />
        </>
      );

    case 'shell':
      // Shell: a fan of three double crochets.
      return (
        <>
          <path d="M16 27 6 10" />
          <path d="M16 27v-17" />
          <path d="M16 27 26 10" />
          <path d="M4 8h8M12 8h8M20 8h8" />
        </>
      );

    case 'k':
      // Knit: a V shape.
      return (
        <>
          <path d="M11 6 16 26" />
          <path d="M21 6 16 26" />
        </>
      );

    case 'p':
      // Purl: a horizontal bump.
      return (
        <>
          <path d="M6 16c0-6 5-8 10-8s10 2 10 8-5 8-10 8-10-2-10-8z" />
        </>
      );

    default:
      return <circle cx="16" cy="16" r="6" strokeDasharray="3 3" />;
  }
}

/** A small decorative ball of yarn for headers and empty states. */
export function YarnBall({ size = 120, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="presentation">
      <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.85" />
      <path d="M22 48c22-14 55-14 76 4" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.75" />
      <path d="M18 68c26-10 58-6 84 10" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.75" />
      <path d="M34 26c8 26 16 50 30 72" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.6" />
      <path d="M74 20c-8 26-14 52-12 80" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.6" />
      <path d="M100 44c-16 8-28 20-34 36" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.6" />
      <path d="M104 78c12 6 14 16 6 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}
