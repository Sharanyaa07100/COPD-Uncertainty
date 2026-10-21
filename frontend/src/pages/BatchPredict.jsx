import React, { useState } from 'react';
import axios from 'axios';
import '../styles/BatchPredict.css';

const API_URL = 'http://localhost:8000';

export default function BatchPredict() {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/predict-batch`, formData);
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Batch prediction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="batch-container">
      <h2>Batch COPD Prediction</h2>

      <form onSubmit={handleSubmit} className="upload-form">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
          className="file-input"
        />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Processing...' : '📤 Upload & Predict'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {results && (
        <div className="results-summary">
          <h3>Summary</h3>
          <div className="summary-grid">
            <div className="card">
              <h4>Total Patients</h4>
              <p>{results.total_patients}</p>
            </div>
            <div className="card copd">
              <h4>COPD Cases</h4>
              <p>{results.copd_cases}</p>
            </div>
            <div className="card">
              <h4>No COPD</h4>
              <p>{results.no_copd_cases}</p>
            </div>
            <div className="card">
              <h4>Mean Probability</h4>
              <p>{(results.mean_probability * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
