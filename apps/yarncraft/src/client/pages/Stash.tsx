import { useMemo, useState } from 'react';
import {
  formatLength,
  planSkeins,
  toMetres,
  type GaugeInput,
  type YarnEstimate,
} from '../../domain/yarn.ts';
import { estimateYarn } from '../../domain/yarn.ts';
import { parsePattern } from '../../domain/patternParser.ts';
import { YARN_WEIGHTS } from '../../domain/gauge.ts';
import { useStore } from '../store.tsx';
import { useToast } from '../components/ui.tsx';
import { navigate } from '../lib/router.ts';

export function StashPage() {
  const { state, addStashYarn, updateStashYarn, deleteStashYarn, saveYarnPlan } = useStore();
  const toast = useToast();

  const [patternText, setPatternText] = useState(
    'Row 1: ch 21, sc in 2nd ch from hook and each ch across (20)\nRow 2: ch 1, turn, sc in each st across (20)',
  );
  const [stitchesPer10cm, setStitchesPer10cm] = useState(16);
  const [skeinInput, setSkeinInput] = useState({ metres: 200, unit: 'm' as 'm' | 'yd', price: 6, waste: 10 });

  const [draft, setDraft] = useState({
    name: '',
    brand: '',
    weight: 'worsted',
    skeinMetres: 200,
    unit: 'm' as 'm' | 'yd',
    skeins: 3,
    colour: '',
    pricePerSkein: 6,
  });

  const parsed = useMemo(() => (patternText.trim() ? parsePattern(patternText) : null), [patternText]);

  const gauge: GaugeInput = { stitchesPer10cm };
  const estimate = useMemo<YarnEstimate | null>(() => {
    if (!parsed) return null;
    const result = estimateYarn(parsed, gauge);
    return result.ok ? result : null;
  }, [parsed, stitchesPer10cm]);

  const problem = useMemo(() => {
    if (!parsed) return null;
    const result = estimateYarn(parsed, gauge);
    return result.ok ? null : result.problem;
  }, [parsed, stitchesPer10cm]);

  const skeinMetres = toMetres(skeinInput.metres, skeinInput.unit === 'yd' ? 'yd' : 'm');
  const plan = useMemo(() => {
    if (!estimate) return null;
    const result = planSkeins({
      neededMetres: estimate.totalMetres,
      skeinMetres,
      waste: skeinInput.waste / 100,
      pricePerSkein: skeinInput.price,
    });
    return result.ok ? result : null;
  }, [estimate, skeinMetres, skeinInput.waste, skeinInput.price]);

  const stashMetres = useMemo(
    () => state.stash.reduce((sum, yarn) => sum + yarn.skeinMetres * yarn.skeins, 0),
    [state.stash],
  );

  const totalValue = useMemo(
    () => state.stash.reduce((sum, yarn) => sum + (yarn.pricePerSkein ?? 0) * yarn.skeins, 0),
    [state.stash],
  );

  const addYarn = () => {
    if (!draft.name.trim()) {
      toast.show('Give the yarn a name so you can find it later.');
      return;
    }
    addStashYarn({
      name: draft.name.trim(),
      brand: draft.brand.trim() || undefined,
      weight: draft.weight,
      skeinMetres: toMetres(draft.skeinMetres, draft.unit === 'yd' ? 'yd' : 'm'),
      skeins: draft.skeins,
      colour: draft.colour.trim() || undefined,
      pricePerSkein: draft.pricePerSkein || undefined,
    });
    setDraft((current) => ({ ...current, name: '', brand: '', colour: '' }));
    toast.show('Added to your stash.');
  };

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Yarn stash &amp; planner</div>
        <h1>Will this take more yarn than I have?</h1>
        <p className="lead">
          Price a pattern from your own gauge, then see how many skeins that means. The estimate is a
          model of stitch geometry, so it is labelled as an estimate everywhere — a measured swatch is
          the authoritative number, and this says so rather than pretending otherwise.
        </p>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <h2 className="card-title">1. Your gauge</h2>
          <p className="muted small">
            Measure a blocked swatch. Yarn per stitch scales with stitch width, so without a gauge the
            estimate is meaningless — this refuses to guess one.
          </p>
          <label className="field">
            <span>Stitches per 10 cm</span>
            <input
              type="number"
              min={1}
              max={200}
              value={stitchesPer10cm}
              onChange={(event) => setStitchesPer10cm(Number(event.target.value))}
            />
          </label>
          {problem ? <div className="callout warn">{problem}</div> : null}
        </section>

        <section className="card">
          <h2 className="card-title">2. Your yarn</h2>
          <label className="field">
            <span>Skein length</span>
            <div className="row">
              <input
                type="number"
                min={1}
                value={skeinInput.metres}
                onChange={(event) => setSkeinInput({ ...skeinInput, metres: Number(event.target.value) })}
              />
              <select
                value={skeinInput.unit}
                onChange={(event) => setSkeinInput({ ...skeinInput, unit: event.target.value as 'm' | 'yd' })}
              >
                <option value="m">metres</option>
                <option value="yd">yards</option>
              </select>
            </div>
          </label>
          <div className="grid grid-2">
            <label className="field">
              <span>Price per skein</span>
              <input
                type="number"
                min={0}
                step="0.5"
                value={skeinInput.price}
                onChange={(event) => setSkeinInput({ ...skeinInput, price: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>Allowance %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={skeinInput.waste}
                onChange={(event) => setSkeinInput({ ...skeinInput, waste: Number(event.target.value) })}
              />
            </label>
          </div>
          <p className="tiny faint">
            {formatLength(skeinMetres)} per skein. The allowance covers a swatch and joins; it is
            reported separately so you can see when it changes the number of skeins you buy.
          </p>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">3. Your pattern</h2>
        <label className="field">
          <span>Paste the rows</span>
          <textarea
            rows={8}
            className="mono"
            value={patternText}
            onChange={(event) => setPatternText(event.target.value)}
            placeholder="Row 1: ch 21, sc in 2nd ch from hook and each ch across (20)"
          />
        </label>

        {estimate ? (
          <>
            <div className="grid grid-3" style={{ marginTop: 16 }}>
              <div className="stat">
                <b>{formatLength(estimate.totalMetres)}</b>
                <span>estimated yarn</span>
              </div>
              <div className="stat">
                <b>{Math.round(estimate.totalYards)} yd</b>
                <span>in yards</span>
              </div>
              <div className="stat">
                <b>{plan ? plan.skeins : '—'}</b>
                <span>skeins to buy</span>
              </div>
            </div>

            {plan ? (
              <div className={plan.wasteChangedCount ? 'callout warn' : 'callout'}>
                {plan.wasteChangedCount ? (
                  <>
                    <b>Buy {plan.skeins}, not {plan.skeins - 1}.</b> The {Math.round(plan.wasteFraction * 100)}%
                    allowance is what pushes this over a skein boundary. Without it you would come up{' '}
                    {formatLength(plan.withWasteMetres - plan.neededMetres)} short.
                  </>
                ) : (
                  <>
                    <b>{plan.skeins} skein{plan.skeins === 1 ? '' : 's'}</b> ={' '}
                    {formatLength(plan.purchasedMetres)}, leaving{' '}
                    {formatLength(plan.leftoverMetres)} ({Math.round(plan.leftoverFraction * 100)}%) spare.
                  </>
                )}
                {plan.cost !== undefined ? <> About {plan.cost.toFixed(2)} total.</> : null}
              </div>
            ) : null}

            {estimate.fallbackCodes.length ? (
              <p className="tiny faint">
                Priced with a fallback for: {estimate.fallbackCodes.join(', ')}. Treat the total as a
                floor, not a precise figure.
              </p>
            ) : null}
            {estimate.incomplete ? (
              <p className="tiny faint">
                Some steps could not be read, so this total excludes them. Run the pattern through the
                checker first.
              </p>
            ) : null}

            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn"
                onClick={() => {
                  saveYarnPlan({
                    name: `Estimate ${new Date().toLocaleDateString()}`,
                    neededMetres: estimate.totalMetres,
                    skeinMetres,
                    skeins: plan?.skeins ?? 0,
                  });
                  toast.show('Plan saved.');
                }}
              >
                Save this plan
              </button>
              <button className="btn ghost" onClick={() => navigate('/checker')}>
                Check the counts first
              </button>
            </div>

            <details style={{ marginTop: 16 }}>
              <summary>Per-row breakdown</summary>
              <table className="table">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Stitches</th>
                    <th>Yarn</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.steps.map((step) => (
                    <tr key={step.index}>
                      <td>{step.label}</td>
                      <td className="mono">{step.stitches}</td>
                      <td className="mono">{formatLength(step.cm / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <div className="empty">Paste a few rows to see an estimate.</div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2 className="card-title">Your stash</h2>
          <div className="row-tight">
            <span className="chip">{state.stash.length} yarns</span>
            <span className="chip">{formatLength(stashMetres)}</span>
            <span className="chip">{totalValue.toFixed(0)} value</span>
          </div>
        </div>

        <div className="grid grid-4">
          <label className="field">
            <span>Name</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Soft Merino" />
          </label>
          <label className="field">
            <span>Brand</span>
            <input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} />
          </label>
          <label className="field">
            <span>Weight</span>
            <select value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value })}>
              {YARN_WEIGHTS.map((weight) => (
                <option key={weight.key} value={weight.key}>
                  {weight.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Colour</span>
            <input value={draft.colour} onChange={(event) => setDraft({ ...draft, colour: event.target.value })} />
          </label>
          <label className="field">
            <span>Skein length</span>
            <input
              type="number"
              min={1}
              value={draft.skeinMetres}
              onChange={(event) => setDraft({ ...draft, skeinMetres: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Unit</span>
            <select value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value as 'm' | 'yd' })}>
              <option value="m">metres</option>
              <option value="yd">yards</option>
            </select>
          </label>
          <label className="field">
            <span>Skeins</span>
            <input
              type="number"
              min={0}
              value={draft.skeins}
              onChange={(event) => setDraft({ ...draft, skeins: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Price each</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={draft.pricePerSkein}
              onChange={(event) => setDraft({ ...draft, pricePerSkein: Number(event.target.value) })}
            />
          </label>
        </div>
        <button className="btn" onClick={addYarn}>
          Add to stash
        </button>

        {estimate && stashMetres >= estimate.totalMetres && state.stash.length > 0 ? (
          <div className="callout" style={{ marginTop: 12 }}>
            Your stash already holds {formatLength(stashMetres)}, which covers the estimated{' '}
            {formatLength(estimate.totalMetres)}. Check the weight matches before you start.
          </div>
        ) : null}

        {state.stash.length === 0 ? (
          <div className="empty">Nothing in the stash yet. Add what you have and this page will tell you when a pattern is already covered.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Yarn</th>
                <th>Weight</th>
                <th>Skeins</th>
                <th>Length</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.stash.map((yarn) => (
                <tr key={yarn.id}>
                  <td>
                    {yarn.name}
                    {yarn.brand ? <span className="faint"> · {yarn.brand}</span> : null}
                    {yarn.colour ? <span className="chip" style={{ marginLeft: 8 }}>{yarn.colour}</span> : null}
                  </td>
                  <td>{YARN_WEIGHTS.find((weight) => weight.key === yarn.weight)?.name ?? yarn.weight}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      style={{ width: 70 }}
                      value={yarn.skeins}
                      onChange={(event) => updateStashYarn(yarn.id, { skeins: Number(event.target.value) })}
                    />
                  </td>
                  <td className="mono">{formatLength(yarn.skeinMetres * yarn.skeins)}</td>
                  <td>
                    <button className="btn ghost sm" onClick={() => deleteStashYarn(yarn.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {state.yarnPlans.length ? (
        <section className="card">
          <h2 className="card-title">Saved plans</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Needed</th>
                <th>Skeins</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.yarnPlans.map((saved) => (
                <tr key={saved.id}>
                  <td>{saved.name}</td>
                  <td className="mono">{formatLength(saved.neededMetres)}</td>
                  <td className="mono">{saved.skeins}</td>
                  <td>
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        setSkeinInput((current) => ({ ...current, metres: saved.skeinMetres }));
                        toast.show('Loaded into the planner.');
                      }}
                    >
                      Reuse
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
