
import { useState } from 'react';
import axios from 'axios';
import '../styles/Predict.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const FIELDS = [
  {
    key: 'RIDAGEYR',
    index: '01',
    label: 'Age (years)',
    type: 'number',
    min: 20,
    max: 80,
    step: 1,
    hint: 'Allowed range: 20–80',
  },
  {
    key: 'SMQ020',
    index: '02',
    label: 'Have you smoked at least 100 cigarettes in your life?',
    type: 'select',
  },
  {
    key: 'MCQ010',
    index: '03',
    label: 'Has a doctor ever told you that you have asthma?',
    type: 'select',
  },
  {
    key: 'BMXBMI',
    index: '04',
    label: 'Body mass index (kg/m²)',
    type: 'number',
    min: 10,
    max: 80,
    step: 0.1,
    hint: 'Allowed range: 10–80 kg/m²',
  },
];

const EMPTY = {
  RIDAGEYR: '',
  SMQ020: '',
  MCQ010: '',
  BMXBMI: '',
};

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number > 0 && number < 1) return '<1%';
  return `${value}%`;
}

function getModelClassification(result) {
  const labels = Array.isArray(result.prediction_set)
    ? result.prediction_set
    : [];

  if (labels.length === 0) {
    return {
      title: "Inconclusive",
      detail: "Neither label was retained by the model's conformal prediction set.",
      status: "inconclusive",
    };
  }

  if (labels.includes("COPD") && labels.includes("No COPD")) {
    return {
      title: "Uncertain",
      detail: "Both COPD and No COPD remain possible outcomes in the prediction set.",
      status: "uncertain",
    };
  }

  if (labels.length === 1 && labels[0] === "COPD") {
    return {
      title: "COPD label retained",
      detail: "Only the COPD label was retained. This is not a confirmed diagnosis.",
      status: "copd",
    };
  }

  if (labels.length === 1 && labels[0] === "No COPD") {
    return {
      title: "No COPD label retained",
      detail: "Only the No COPD label was retained.",
      status: "no-copd",
    };
  }

  return {
    title: "Inconclusive",
    detail: "The prediction set could not be interpreted. Further assessment is needed.",
    status: "inconclusive",
  };
}
function getPredictionSetText(result) {
  if (typeof result.prediction_set_text === 'string') {
    return result.prediction_set_text;
  }

  // Fallback in case the API returns the set before its text field.
  if (Array.isArray(result.prediction_set)) {
    if (
      result.prediction_set.length === 1 &&
      result.prediction_set[0] === 'No COPD'
    ) {
      return 'No COPD';
    }

    if (
      result.prediction_set.length === 1 &&
      result.prediction_set[0] === 'COPD'
    ) {
      return 'COPD';
    }

    if (result.prediction_set.length === 0) {
      return 'Empty prediction set';
    }
  }

  return 'Prediction set unavailable';
}

export default function Predict() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  const handleChange = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const next = {};

    for (const field of FIELDS) {
      const raw = values[field.key];

      if (raw === '') {
        next[field.key] = 'Please answer this question.';
        continue;
      }

      if (field.type === 'number') {
        const number = Number(raw);

        if (
          !Number.isFinite(number) ||
          number < field.min ||
          number > field.max
        ) {
          next[field.key] =
            `Enter a value between ${field.min} and ${field.max}.`;
        }
      }

      if (
        field.type === 'select' &&
        ![1, 2].includes(Number(raw))
      ) {
        next[field.key] = 'Please select Yes or No.';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) return;

    setLoading(true);
    setApiError(null);
    setResult(null);

    const body = {
      RIDAGEYR: Number(values.RIDAGEYR),
      SMQ020: Number(values.SMQ020),
      MCQ010: Number(values.MCQ010),
      BMXBMI: Number(values.BMXBMI),
    };

    try {
      const { data } = await axios.post(`${API_URL}/predict`, body);
      setResult(data);
    } catch (error) {
      setApiError(
        error.response?.data?.detail ||
          'Cannot reach the research API. Check that the backend is running on port 8000.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="predict-layout">
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <span className="step-label">PATIENT INPUT</span>
            <h2>Study variables</h2>
          </div>
          <span className="field-count">4 fields</span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {FIELDS.map((field) => (
              <div className="field" key={field.key}>
                <label htmlFor={field.key} className="field-label">
                  <span className="field-index">{field.index}</span>
                  {field.label}
                </label>

                {field.type === 'number' ? (
                  <input
                    id={field.key}
                    type="number"
                    name={field.key}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={values[field.key]}
                    aria-invalid={!!errors[field.key]}
                    aria-describedby={
                      errors[field.key] ? `${field.key}-error` : undefined
                    }
                    onChange={(event) =>
                      handleChange(field.key, event.target.value)
                    }
                  />
                ) : (
                  <select
                    id={field.key}
                    name={field.key}
                    value={values[field.key]}
                    aria-invalid={!!errors[field.key]}
                    aria-describedby={
                      errors[field.key] ? `${field.key}-error` : undefined
                    }
                    onChange={(event) =>
                      handleChange(field.key, event.target.value)
                    }
                  >
                    <option value="">Choose an answer</option>
                    <option value="1">Yes</option>
                    <option value="2">No</option>
                  </select>
                )}

                {field.hint && !errors[field.key] && (
                  <small>{field.hint}</small>
                )}

                {errors[field.key] && (
                  <small
                    id={`${field.key}-error`}
                    style={{ color: '#8f302c' }}
                  >
                    {errors[field.key]}
                  </small>
                )}
              </div>
            ))}
          </div>

          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Estimatingâ€¦' : 'Estimate probability'}
            <span aria-hidden="true"> →</span>
          </button>

          <p className="form-footnote">
            Values are sent to the local research API for this request only.
          </p>
        </form>
      </section>

      <aside className="context-card">
        <div className="context-icon" aria-hidden="true">i</div>
        <h2>Before you begin</h2>
        <p>
          This prototype uses a logistic regression model developed from a
          study sample of adults aged 20 and older.
        </p>
        <ul>
          <li>Answer using the information requested.</li>
          <li>Sex and race are not prediction inputs.</li>
          <li>The estimate is not a clinical assessment.</li>
        </ul>
        <div className="context-rule"></div>
        <p className="context-small">
          Spirometry is the diagnostic standard for COPD. Discuss health
          concerns with a qualified healthcare professional.
        </p>
      </aside>

      <section
        className="results-wrap"
        aria-live="polite"
        aria-atomic="true"
      >
        {apiError && (
          <div className="message error-message" role="alert">
            {apiError}
          </div>
        )}

        {loading && (
          <p className="loading-state">Calculating estimateâ€¦</p>
        )}

        {result && (
          <div className="panel result-panel">
            <div className="result-topline">
              <div>
                <span className="step-label">MODEL OUTPUT</span>
                <h2>Model result</h2>
              </div>
              <span className="result-tag">Research estimate</span>
            </div>

            {(() => {
              const classification = getModelClassification(result);
              return (
                <div className={`prediction-set-result classification-${classification.status}`}>
                  <span className="classification-eyebrow">MODEL CLASSIFICATION</span>
                  <h3 className="classification-title">{classification.title}</h3>
                  <p className="prediction-set-text">{classification.detail}</p>
                  <p className="classification-set">
                    Conformal prediction set: {"{"}
                    {(Array.isArray(result.prediction_set) ? result.prediction_set : []).join(", ") || "Empty"}
                    {"}"}
                  </p>
                </div>
              );
            })()}

            <div className="probability-row">
              <div className="probability-context">
                <span>Estimated COPD probability</span>
                <strong className="secondary-probability">
                  {formatPercent(result.percent)}
                </strong>
                <small>
                  This probability is secondary to the prediction set.
                </small>
              </div>

              <div className="probability-context">
                <span>Population rate in study</span>
                <strong>{formatPercent(result.population_percent)}</strong>
                <small>
                  Provided for context, not as an individual comparison
                  threshold.
                </small>
              </div>
            </div>

            <div className="result-divider"></div>

            <h3>Factors returned by the model</h3>
            <p className="subheading">
              These are associations in the model, not explanations of cause.
            </p>

            <ul className="factor-list">
              {(Array.isArray(result.factors) ? result.factors : []).map(
                (factor, index) => (
                  <li key={`${factor.name}-${index}`}>
                    <span>{factor.name}</span>
                    <span className="factor-effect">{factor.effect}</span>
                  </li>
                )
              )}
            </ul>
            <div className="uncertainty-panel">
  <div className="uncertainty-heading">
    <h3>Uncertainty assessment</h3>
    <span>
      {result.prediction_set?.length ?? 0} possible outcome(s)
    </span>
  </div>

  <div className="uncertainty-details">
    <div>
      <span className="uncertainty-label">Prediction-set status</span>
      <strong>
        {!result.prediction_set?.length
          ? "Empty set"
          : result.prediction_set.length === 1
            ? "Single outcome"
            : "Uncertain — multiple outcomes"}
      </strong>
    </div>

    <div>
      <span className="uncertainty-label">Coverage target</span>
      <strong>{result.coverage_target_percent}%</strong>
    </div>
  </div>

  <p className="uncertainty-explanation">
  {result.prediction_set?.length === 0
    ? "No labels were retained by the conformal procedure. The result is inconclusive; further clinical assessment is needed."
    : result.prediction_set?.includes("COPD") &&
        result.prediction_set?.includes("No COPD")
      ? "Both labels were retained, indicating uncertainty. Neither outcome should be treated as a diagnosis."
      : result.prediction_set?.length === 1 &&
          result.prediction_set[0] === "COPD"
        ? "Only the COPD label was retained. This is a model output, not a confirmed diagnosis; clinical assessment and spirometry are needed."
        : result.prediction_set?.length === 1 &&
            result.prediction_set[0] === "No COPD"
          ? "Only the No COPD label was retained."
          : "The prediction-set status is unavailable or could not be interpreted. Further assessment is needed."}
</p>
</div>
            <p className="disclaimer">
              {result.disclaimer ||
                'Research prototype. Not a diagnostic tool. Spirometry is the diagnostic standard.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
