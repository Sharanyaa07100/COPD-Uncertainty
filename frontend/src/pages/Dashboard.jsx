
import { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Dashboard.css';

const API_URL = 'http://localhost:8000';

const fmt = (value, digits = 3) =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toFixed(digits);

const pct = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : `${(Number(value) * 100).toFixed(1)}%`;

const count = (value) =>
  value == null
    ? '—'
    : Number(value).toLocaleString();

export default function Dashboard() {
  const [modelInfo, setModelInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    axios
      .get(`${API_URL}/model-info`)
      .then((response) => {
        if (active) setModelInfo(response.data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.detail ||
              'Could not reach the model dashboard API. Check that the backend is running.'
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="message error-message" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!modelInfo) {
    return (
      <div className="dashboard-page">
        <p className="loading-state">
          Loading model performance…
        </p>
      </div>
    );
  }

  const sample = modelInfo.sample || {};
  const test = modelInfo.test || {};
  const calibration = Array.isArray(modelInfo.calibration)
    ? modelInfo.calibration
    : [];
  const subgroups = modelInfo.subgroups || [];
  const coefficients = modelInfo.coefficients;
  const conformal = modelInfo.conformal || {};
  const setSizes = conformal.set_sizes || {};

  return (
    <div className="dashboard-page">
      {/* Page introduction */}
      <section className="page-intro">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          MODEL TRANSPARENCY
        </div>

        <h1>Performance at a glance.</h1>

        <p>
          Read-only summary of the model evaluation returned by
          the research API.
        </p>
      </section>

      {/* Model performance overview */}
      <section
        className="dashboard-section performance-overview"
        aria-labelledby="overview-heading"
      >
        <div className="section-heading">
          <div>
            <h2 id="overview-heading">
              Model performance overview
            </h2>
            <p>Key results from the held-out test sample.</p>
          </div>
        </div>

        <div className="metric-grid">
          <Metric
            label="ROC-AUC"
            value={fmt(test.roc_auc)}
            detail={
              test.roc_auc_ci_low == null ||
              test.roc_auc_ci_high == null
                ? 'Area under the ROC curve'
                : `95% CI: ${fmt(
                    test.roc_auc_ci_low
                  )}–${fmt(test.roc_auc_ci_high)}`
            }
          />

          <Metric
            label="Test coverage"
            value={
              conformal.test_coverage_percent == null
                ? '—'
                : `${conformal.test_coverage_percent}%`
            }
            detail="Observed conformal coverage"
          />

          <Metric
            label="Test sample"
            value={count(test.n)}
            detail="Evaluated observations"
          />

          <Metric
            label="COPD cases"
            value={count(test.cases)}
            detail="Cases in the test sample"
          />
        </div>

        <p className="table-note">
          ROC-AUC measures how well the model distinguishes
          between outcomes. Test coverage measures how often
          the conformal prediction set contains the true
          outcome. These metrics describe different properties
          of the model.
        </p>
      </section>

      {/* 01 — Sample and test set */}
      <section className="dashboard-section">
        <div className="section-heading">
          <span className="section-number">01</span>
          <div>
            <h2>Sample and test set</h2>
            <p>Counts reported by the backend.</p>
          </div>
        </div>

        <div className="metric-grid">
          <Metric
            label="Study sample"
            value={count(sample.adults_20plus)}
            detail="Adults aged 20+"
          />

          <Metric
            label="Complete cases"
            value={count(sample.complete_cases)}
            detail="Records with complete model inputs"
          />

          <Metric
            label="COPD cases in sample"
            value={count(sample.copd_cases)}
            detail={`${sample.copd_percent ?? '—'}% of study sample`}
          />

          <Metric
            label="Test set size"
            value={count(test.n)}
            detail={`${count(test.cases)} COPD cases in test set`}
          />
        </div>
      </section>

      {/* 02 — Test performance */}
      <section className="dashboard-section">
        <div className="section-heading">
          <span className="section-number">02</span>
          <div>
            <h2>Test-set performance</h2>
            <p>
              Discrimination metrics for the held-out test set.
            </p>
          </div>
        </div>

        <div className="metric-grid metric-grid-two">
          <Metric
            label="ROC-AUC"
            value={
              test.roc_auc == null
                ? '—'
                : `${fmt(test.roc_auc)} (95% CI ${fmt(
                    test.roc_auc_ci_low
                  )}–${fmt(test.roc_auc_ci_high)})`
            }
            detail="Area under the receiver operating characteristic curve"
          />

          <Metric
            label="PR-AUC vs chance PR-AUC"
            value={`${fmt(test.pr_auc)} vs ${fmt(
              test.chance_pr_auc
            )}`}
            detail="Precision-recall area compared with the test-set baseline"
          />
        </div>
      </section>

      {/* 03 — Calibration and chart */}
      <section className="dashboard-section">
        <div className="section-heading">
          <span className="section-number">03</span>
          <div>
            <h2>Calibration</h2>
            <p>
              Compare predicted probabilities with observed
              COPD frequencies.
            </p>
          </div>
        </div>

        <p className="table-note">
          Each point represents a calibration group returned
          by the backend. The diagonal represents perfect
          agreement between predicted and observed rates.
        </p>

        {calibration.length > 0 ? (
          <>
            <CalibrationChart data={calibration} />

            <div className="calibration-legend">
              <span>
                <span className="legend-dot" />
                Observed calibration groups
              </span>
              <span>
                <span className="legend-line" />
                Perfect calibration reference
              </span>
            </div>
          </>
        ) : (
          <p className="empty-cell">
            No calibration values were returned, so the chart
            cannot be displayed.
          </p>
        )}

        <h3 className="conformal-subtitle">
          Calibration values
        </h3>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Predicted (%)</th>
                <th>Observed (%)</th>
              </tr>
            </thead>

            <tbody>
              {calibration.map((row, index) => (
                <tr
                  key={`${row.predicted}-${row.observed}-${index}`}
                >
                  <td>{pct(row.predicted)}</td>
                  <td>{pct(row.observed)}</td>
                </tr>
              ))}

              {calibration.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-cell">
                    No calibration values were returned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 04 — Subgroups */}
      <section className="dashboard-section">
        <div className="section-heading">
          <span className="section-number">04</span>
          <div>
            <h2>Subgroup performance</h2>
            <p>
              Performance summaries for groups represented
              in the test sample.
            </p>
          </div>
        </div>

        <p className="table-note">
          Subgroups with few COPD cases give unstable estimates.
          These results do not establish fairness. They only
          show how performance varies across groups in this sample.
        </p>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group type</th>
                <th>Group</th>
                <th>Sample (n)</th>
                <th>Cases</th>
                <th>ROC-AUC</th>
                <th>PR-AUC</th>
              </tr>
            </thead>

            <tbody>
              {subgroups.map((group, index) => {
                const tooFew = Number(group.cases) < 10;

                return (
                  <tr
                    key={`${group.group_type}-${group.group}-${index}`}
                  >
                    <td>{group.group_type}</td>
                    <td>{group.group}</td>
                    <td>{count(group.n)}</td>
                    <td>{count(group.cases)}</td>

                    {tooFew ? (
                      <td colSpan={2} className="too-few-cell">
                        Too few cases to score
                      </td>
                    ) : (
                      <>
                        <td>{fmt(group.roc_auc)}</td>
                        <td>{fmt(group.pr_auc)}</td>
                      </>
                    )}
                  </tr>
                );
              })}

              {subgroups.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No subgroup values were returned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 05 — Model coefficients */}
      {coefficients != null && (
        <section className="dashboard-section">
          <div className="section-heading">
            <span className="section-number">05</span>
            <div>
              <h2>Model coefficients</h2>
              <p>
                Coefficient values returned by the backend.
              </p>
            </div>
          </div>

          {Array.isArray(coefficients) ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(
                      coefficients[0] || {
                        feature: '',
                        coefficient: '',
                      }
                    ).map((key) => (
                      <th key={key}>
                        {key.replaceAll('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {coefficients.map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map(
                        (value, cellIndex) => (
                          <td key={cellIndex}>
                            {typeof value === 'number'
                              ? fmt(value, 4)
                              : String(value ?? '—')}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="coefficient-block">
              {JSON.stringify(coefficients, null, 2)}
            </pre>
          )}
        </section>
      )}

      {/* 06 — Conformal prediction */}
      <section className="dashboard-section conformal-section">
        <div className="section-heading">
          <span className="section-number">06</span>
          <div>
            <h2>Conformal prediction</h2>
            <p>
              Prediction-set coverage and composition on the test sample.
            </p>
          </div>
        </div>

        <div className="metric-grid metric-grid-two">
          <Metric
            label="Target coverage"
            value={
              conformal.target_coverage_percent == null
                ? '—'
                : `${conformal.target_coverage_percent}%`
            }
            detail="Requested conformal coverage"
          />

          <Metric
            label="Test coverage"
            value={
              conformal.test_coverage_percent == null
                ? '—'
                : `${conformal.test_coverage_percent}%`
            }
            detail="Observed coverage on the test set"
          />
        </div>

        <h3 className="conformal-subtitle">
          Prediction-set counts
        </h3>

        <div className="metric-grid">
          <Metric
            label="Both outcomes"
            value={count(setSizes.both)}
            detail="Sets containing both possible labels"
          />

          <Metric
            label="Single outcome"
            value={count(setSizes.one)}
            detail="Sets containing one label"
          />

          <Metric
            label="Empty sets"
            value={count(setSizes.empty)}
            detail="Sets containing neither label"
          />
        </div>

        <p className="conformal-highlight">
          No patient in this sample received a COPD-only prediction set.
        </p>

        <div className="metric-grid metric-grid-two">
          <Metric
            label="Calibration sample size"
            value={count(conformal.calibration_n)}
            detail="Observations used for conformal calibration"
          />

          <Metric
            label="Conformal threshold (qhat)"
            value={fmt(conformal.qhat, 4)}
            detail="Threshold used to construct prediction sets"
          />
        </div>

        <p className="table-note conformal-note">
          Conformal sets target coverage across the population,
          not certainty for an individual patient. The observed
          coverage is an empirical result on this test sample.
        </p>
      </section>

      <p className="dashboard-disclaimer">
        Research prototype only. Model performance on a study
        sample does not establish clinical usefulness or fairness.
      </p>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function CalibrationChart({ data }) {
  const width = 600;
  const height = 370;

  const left = 76;
  const right = 24;
  const top = 24;
  const bottom = 72;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const x = (value) => left + Number(value) * plotWidth;
  const y = (value) => top + (1 - Number(value)) * plotHeight;

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const validData = data.filter(
    (row) =>
      Number.isFinite(Number(row.predicted)) &&
      Number.isFinite(Number(row.observed)) &&
      Number(row.predicted) >= 0 &&
      Number(row.predicted) <= 1 &&
      Number(row.observed) >= 0 &&
      Number(row.observed) <= 1
  );

  if (validData.length === 0) {
    return (
      <p className="empty-cell">
        No valid calibration points are available to plot.
      </p>
    );
  }

  return (
    <div className="calibration-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Calibration plot comparing predicted COPD probabilities with observed COPD frequencies. The diagonal line represents perfect calibration."
        className="calibration-svg"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              y1={y(tick)}
              x2={width - right}
              y2={y(tick)}
              stroke="#e1e9e4"
              strokeWidth="1"
            />

            <line
              x1={x(tick)}
              y1={top}
              x2={x(tick)}
              y2={height - bottom}
              stroke="#e1e9e4"
              strokeWidth="1"
            />

            <text
              x={left - 12}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="12"
              fill="#52675d"
            >
              {Math.round(tick * 100)}%
            </text>

            <text
              x={x(tick)}
              y={height - bottom + 24}
              textAnchor="middle"
              fontSize="12"
              fill="#52675d"
            >
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}

        {/* Perfect calibration reference */}
        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(1)}
          y2={y(1)}
          stroke="#84958b"
          strokeWidth="2"
          strokeDasharray="7 6"
        />

        {/* Actual calibration observations */}
        {validData.map((row, index) => (
          <circle
            key={`${row.predicted}-${row.observed}-${index}`}
            cx={x(row.predicted)}
            cy={y(row.observed)}
            r="6"
            fill="#176b53"
            stroke="#ffffff"
            strokeWidth="2"
          >
            <title>
              Predicted: {pct(row.predicted)}; Observed:{' '}
              {pct(row.observed)}
            </title>
          </circle>
        ))}

        <line
          x1={left}
          y1={top}
          x2={left}
          y2={height - bottom}
          stroke="#82948a"
          strokeWidth="1.5"
        />

        <line
          x1={left}
          y1={height - bottom}
          x2={width - right}
          y2={height - bottom}
          stroke="#82948a"
          strokeWidth="1.5"
        />

        <text
          x={left + plotWidth / 2}
          y={height - 17}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill="#183b30"
        >
          Predicted COPD probability
        </text>

        <text
          transform={`translate(19 ${top + plotHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill="#183b30"
        >
          Observed COPD frequency
        </text>
      </svg>

      <p className="table-note">
        Points closer to the dashed diagonal show closer agreement
        between predicted and observed rates. Each point represents
        a calibration group, not an individual patient.
      </p>
    </div>
  );
}
