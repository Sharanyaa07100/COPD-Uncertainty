import { useState } from 'react';
import axios from 'axios';
import { FIELDS } from '../config/features';
import '../styles/Predict.css';

const API_URL = 'http://localhost:8000';
const EMPTY = Object.fromEntries(FIELDS.map((f) => [f.key, '']));

const isVisible = (f, vals) =>
  !f.required_if || vals[f.required_if.key] === String(f.required_if.value);

export default function Predict() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  const handleChange = (key, value) => {
    const next = { ...values, [key]: value };
    // Clear hidden follow-up questions so stale answers are not sent
    FIELDS.forEach((f) => { if (!isVisible(f, next)) next[f.key] = ''; });
    setValues(next);
    setErrors((e) => ({ ...e, [key]: undefined }));
    setResult(null);
  };

  const validate = () => {
    const next = {};
    for (const f of FIELDS) {
      if (!isVisible(f, values)) continue;
      const raw = values[f.key];
      if (raw === '') { next[f.key] = 'Please answer this question.'; continue; }
      if (f.type === 'number') {
        const n = Number(raw);
        if (Number.isNaN(n) || n < f.min || n > f.max) {
          next[f.key] = `Enter a value between ${f.min} and ${f.max}.`;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const body = {};
    for (const f of FIELDS) {
      body[f.key] = isVisible(f, values) && values[f.key] !== ''
        ? Number(values[f.key]) : null;
    }

    setLoading(true);
    setApiError(null);
    setResult(null);
    try {
      const { data } = await axios.post(`${API_URL}/predict`, body);
      setResult(data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setApiError(typeof detail === 'string'
        ? detail
        : err.response
          ? 'Check the entries and try again.'
          : 'Cannot reach the research API. Is the backend running on port 8000?');
    } finally {
      setLoading(false);
    }
  };

  const percentText = (p) => (p < 1 ? '<1' : p.toFixed(1));

  return (
    <div className="predict-layout">
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <span className="step-label">PATIENT INPUT</span>
            <h2>Study variables</h2>
          </div>
          <span className="field-count">{FIELDS.filter((f) => isVisible(f, values)).length} fields</span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {FIELDS.filter((f) => isVisible(f, values)).map((f, i) => (
              <div className="field" key={f.key}>
                <label htmlFor={f.key} className="field-label">
                  <span className="field-index">{String(i + 1).padStart(2, '0')}</span>
                  {f.label}
                </label>

                {f.type === 'number' ? (
                  <input id={f.key} type="number" name={f.key}
                    min={f.min} max={f.max} step={f.step}
                    value={values[f.key]}
                    aria-invalid={!!errors[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)} />
                ) : (
                  <select id={f.key} name={f.key} value={values[f.key]}
                    aria-invalid={!!errors[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}>
                    <option value="">Choose an answer</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}

                {errors[f.key]
                  ? <small className="field-error">{errors[f.key]}</small>
                  : f.hint && <small>{f.hint}</small>}
              </div>
            ))}
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Estimating…' : 'Estimate probability'} <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>

      <aside className="context-card">
        <div className="context-icon" aria-hidden="true">i</div>
        <h2>Before you begin</h2>
        <p>This prototype uses a logistic regression model developed from a study sample of adults aged 20 and older.</p>
        <ul>
          <li>Answer using the information requested.</li>
          <li>Sex and race are not prediction inputs.</li>
          <li>The estimate is a screening aid, not a diagnosis.</li>
        </ul>
        <div className="context-rule"></div>
        <p className="context-small">Spirometry is the diagnostic standard for COPD. Discuss health concerns with a qualified healthcare professional.</p>
      </aside>

      <section className="results-wrap" aria-live="polite" aria-atomic="true">
        {apiError && <div className="message error-message">{apiError}</div>}
        {loading && <p className="loading-state">Calculating estimate…</p>}

              {result && (
          <>
            <div className={`panel result-panel referral-panel ${result.refer_to_spirometry ? 'refer' : 'no-refer'}`}>
              <span className="step-label">RECOMMENDATION</span>
              <h2>
  {result.refer_to_spirometry
    ? 'Refer for spirometry'
    : result.referral_uncertain
      ? 'Referral decision uncertain'
      : 'No referral on this estimate'}
</h2>
              <p className="summary-line">
                Estimated probability {percentText(result.percent)}% against a screening cutoff of {result.referral_cutoff_percent}%.
              </p>
              <p className="summary-line">{result.referral_text}</p>
              {result.referral_uncertain && (
                <div className="caution-box" role="note">
                  Referral decision uncertain: the 95% range spans the cutoff.
                </div>
              )}
            </div>

            <div className="panel result-panel">
              <div className="result-topline">
                <div>
                  <span className="step-label">MODEL OUTPUT</span>
                  <h2>Estimated COPD probability</h2>
                </div>
                <span className="result-tag">Research estimate</span>
              </div>

              <div className="probability-row">
                <div className="probability-number">
                  {percentText(result.percent)}<span>%</span>
                </div>
                <div className="probability-context">
                  <span>Population rate in study</span>
                  <strong>{result.population_percent}%</strong>
                  <small>For context only. It is not a diagnostic threshold.</small>
                </div>
              </div>

              <div className="result-divider"></div>

              <h3>Probability interval (95% confidence)</h3>
              <p className="subheading">
                {result.probability_interval_percent[0]}% to {result.probability_interval_percent[1]}%
              </p>

              <h3>Label reliability (90% coverage)</h3>
              <p className="subheading">{result.prediction_set_text}</p>

              <h3>Factors returned by the model</h3>
              <p className="subheading">Associations in the model, not explanations of cause.</p>
              <ul className="factor-list">
                {result.factors.map((f) => (
                  <li key={f.name}>
                    <span>{f.name}</span>
                    <span className="factor-effect">{f.effect}</span>
                  </li>
                ))}
              </ul>

              <p className="disclaimer">{result.disclaimer}</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}