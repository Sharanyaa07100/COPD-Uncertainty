
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import Predict from './pages/Predict';
import Dashboard from './pages/Dashboard';
import BreatheBetter from './pages/BreatheBetter';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              +
            </span>

            <span>
              <strong>AeroLens</strong>
              <small>COPD screening prototype</small>
            </span>
          </Link>

          <nav className="nav-links" aria-label="Main navigation">
            <NavLink to="/" end>
              Screening estimate
            </NavLink>

            <NavLink to="/breathe-better">
              Breathe Better
            </NavLink>

            <NavLink to="/dashboard">
              Model dashboard
            </NavLink>
          </nav>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Predict />} />
            <Route path="/breathe-better" element={<BreatheBetter />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Predict />} />
          </Routes>
        </main>

        <footer className="footer">
          <span>
            Research prototype · CMR College of Engineering &amp; Technology
          </span>
          <span>Not a diagnostic tool</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}
