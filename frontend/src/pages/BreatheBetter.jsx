
import { useState } from 'react';
import './BreatheBetter.css';

const topics = [
  { id: 'daily', label: 'Daily habits', icon: '🌿' },
  { id: 'copd', label: 'Living with COPD', icon: '🫁' },
  { id: 'protect', label: 'Protect your lungs', icon: '🛡️' },
  { id: 'signs', label: 'Know your signs', icon: '🚦' },
];

const advice = {
  daily: [
    {
      icon: '🚭',
      tag: 'START HERE',
      title: 'Make smoke-free your superpower',
      description:
        'Avoid smoking and second-hand smoke. If you smoke, support is available to help you quit.',
      action:
        'Ask a healthcare professional about a quit plan, counselling, or suitable stop-smoking treatments.',
      color: 'mint',
    },
    {
      icon: '🚶',
      tag: 'ONE STEP AT A TIME',
      title: 'Move at your pace',
      description:
        'Gentle, regular movement can support general health and help maintain fitness.',
      action:
        'Choose an activity you can comfortably manage. Build up gradually, rest when needed, and follow your clinician’s advice.',
      color: 'peach',
    },
    {
      icon: '🌬️',
      tag: 'CHECK BEFORE YOU GO',
      title: 'Be air-aware',
      description:
        'Dust, fumes, smoke, and poor outdoor air quality can irritate your lungs.',
      action:
        'Check local air-quality updates. On poor-air days, reduce strenuous outdoor activity and follow local health guidance.',
      color: 'blue',
    },
    {
      icon: '🛌',
      tag: 'SMALL ROUTINES COUNT',
      title: 'Give yourself recovery time',
      description:
        'Rest, regular sleep, and a manageable routine can support your overall wellbeing.',
      action:
        'Keep a comfortable sleep schedule and allow breaks between demanding activities.',
      color: 'lavender',
    },
  ],

  copd: [
    {
      icon: '💊',
      tag: 'FOLLOW YOUR PLAN',
      title: 'Use medicines as prescribed',
      description:
        'COPD treatments are chosen for each person. Do not change or stop prescribed medicines on your own.',
      action:
        'Ask your clinician or pharmacist to review your inhaler technique and explain when each medicine should be used.',
      color: 'mint',
    },
    {
      icon: '🫁',
      tag: 'BUILD CONFIDENCE',
      title: 'Learn to manage breathlessness',
      description:
        'Pacing yourself and using breathing techniques taught by a professional may help you manage everyday activities.',
      action:
        'Ask about pulmonary rehabilitation and breathing techniques suitable for you. Stop and seek advice if activity causes unusual symptoms.',
      color: 'blue',
    },
    {
      icon: '📋',
      tag: 'BE PREPARED',
      title: 'Know your action plan',
      description:
        'A written COPD action plan can help you recognize changes and know whom to contact.',
      action:
        'Ask your healthcare team what to do if breathing, coughing, or phlegm changes, and when to seek urgent care.',
      color: 'peach',
    },
    {
      icon: '🩺',
      tag: 'STAY CONNECTED',
      title: 'Keep up with your care',
      description:
        'Regular reviews help your care team assess symptoms, treatment, and changing needs.',
      action:
        'Discuss recommended vaccinations, pulmonary rehabilitation, nutrition, and follow-up visits with your clinician.',
      color: 'lavender',
    },
  ],

  protect: [
    {
      icon: '🚭',
      tag: 'PROTECT YOUR SPACE',
      title: 'Keep indoor air smoke-free',
      description:
        'Smoke from cigarettes and other tobacco products can harm lung health, including through second-hand exposure.',
      action:
        'Keep your home and vehicle smoke-free. Seek support to stop smoking if you need it.',
      color: 'mint',
    },
    {
      icon: '🧹',
      tag: 'REDUCE IRRITANTS',
      title: 'Watch dust and fumes',
      description:
        'Dust, strong fumes, and some cleaning products may irritate the airways.',
      action:
        'Use safer products where possible, ventilate spaces when appropriate, and follow workplace protection guidance.',
      color: 'peach',
    },
    {
      icon: '🌫️',
      tag: 'CHECK THE FORECAST',
      title: 'Make a plan for polluted days',
      description:
        'Air pollution can worsen respiratory symptoms, particularly in people with existing lung disease.',
      action:
        'Check reliable local air-quality information and adjust outdoor activity according to conditions and your healthcare advice.',
      color: 'blue',
    },
    {
      icon: '💉',
      tag: 'ASK YOUR CLINICIAN',
      title: 'Stay up to date on prevention',
      description:
        'Respiratory infections can be more serious for some people with chronic lung disease.',
      action:
        'Ask which vaccinations are recommended for your age, health, and local guidelines. Practise hand hygiene and avoid close contact with people who are ill when possible.',
      color: 'lavender',
    },
  ],

  signs: [
    {
      icon: '🗣️',
      tag: 'NOTICE THE PATTERN',
      title: 'A cough that keeps returning',
      description:
        'A persistent cough, especially with phlegm, deserves medical assessment.',
      action:
        'Arrange a clinical review if a cough persists, worsens, or comes with other breathing symptoms.',
      color: 'mint',
    },
    {
      icon: '🌬️',
      tag: 'LISTEN TO YOUR BODY',
      title: 'Breathlessness or wheezing',
      description:
        'Breathing difficulty and wheezing can have several causes, including COPD and asthma.',
      action:
        'Seek medical assessment for persistent or worsening symptoms. Spirometry may be used to evaluate airflow.',
      color: 'blue',
    },
    {
      icon: '📈',
      tag: 'SPOT A CHANGE',
      title: 'Symptoms getting worse?',
      description:
        'For someone with COPD, increased breathlessness, more coughing, or changes in phlegm may signal a flare-up.',
      action:
        'Follow your personal action plan and contact your healthcare team promptly if symptoms worsen.',
      color: 'peach',
    },
    {
      icon: '🆘',
      tag: 'ACT URGENTLY',
      title: 'Know the emergency signs',
      description:
        'Severe or sudden breathing difficulty is not something to wait out.',
      action:
        'Seek emergency medical help for severe breathing difficulty, blue or grey lips or skin, new confusion, or fainting. Do not wait for an app result.',
      color: 'lavender',
    },
  ],
};

const reminders = [
  {
    letter: 'P',
    title: 'Protect',
    text: 'Avoid smoke and reduce lung irritants.',
    icon: '🛡️',
  },
  {
    letter: 'P',
    title: 'Pace',
    text: 'Balance activity with rest.',
    icon: '🚶',
  },
  {
    letter: 'P',
    title: 'Plan',
    text: 'Know your care plan and when to seek help.',
    icon: '🗓️',
  },
];

export default function BreatheBetter() {
  const [activeTopic, setActiveTopic] = useState('daily');
  const [expandedCard, setExpandedCard] = useState(null);

  const selectedTopic = topics.find((topic) => topic.id === activeTopic);
  const cards = advice[activeTopic];

  function selectTopic(id) {
    setActiveTopic(id);
    setExpandedCard(null);
  }

  return (
    <div className="breathe-page">
      {/* Hero */}
      <section className="breathe-hero">
        <div className="breathe-hero-copy">
          <div className="breathe-eyebrow">
            <span aria-hidden="true">✳</span>
            HEALTH EDUCATION
          </div>

          <h1>
            Small steps.
            <br />
            <span>Stronger lungs.</span>
          </h1>

          <p>
            Practical habits for protecting your breathing,
            whether you have COPD or want to look after your lungs.
          </p>

          <a className="breathe-hero-link" href="#advice">
            Explore your guide <span aria-hidden="true">↓</span>
          </a>
        </div>

        <div className="lung-art" aria-label="Lung health illustration" role="img">
          <div className="lung-art-circle" />
          <span className="lung-leaf leaf-one">🌿</span>
          <span className="lung-leaf leaf-two">🍃</span>
          <span className="lung-leaf leaf-three">🌱</span>
          <div className="lung-art-icon">🫁</div>
          <span className="lung-art-spark spark-one">✳</span>
          <span className="lung-art-spark spark-two">✦</span>
          <p>Your lungs work for you. Care for them daily.</p>
        </div>
      </section>

      {/* Quick reminders */}
      <section className="breathe-reminder-strip" aria-label="Quick reminders">
        <span className="reminder-bulb" aria-hidden="true">💡</span>
        <div className="reminder-intro">
          <span className="breathe-mini-label">YOUR DAILY MEMORY TRICK</span>
          <h2>Remember the 3 Ps</h2>
        </div>

        {reminders.map((item) => (
          <div className="reminder-item" key={item.title}>
            <span className="reminder-icon" aria-hidden="true">
              {item.icon}
            </span>
            <div>
              <strong>
                {item.letter} — {item.title}
              </strong>
              <p>{item.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Topic selector */}
      <section className="breathe-advice-section" id="advice">
        <div className="breathe-section-heading">
          <div>
            <span className="breathe-mini-label">YOUR POCKET GUIDE</span>
            <h2>What would you like help with?</h2>
            <p>
              Pick a topic to find practical steps you can remember and use.
            </p>
          </div>

          <span className="topic-count">
            {topics.findIndex((topic) => topic.id === activeTopic) + 1} / {topics.length}
          </span>
        </div>

        <div className="breathe-topic-tabs" role="tablist" aria-label="Health advice topics">
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              role="tab"
              id={`topic-tab-${topic.id}`}
              aria-selected={activeTopic === topic.id}
              aria-controls="breathe-advice-panel"
              className={`breathe-topic-tab ${
                activeTopic === topic.id ? 'active' : ''
              }`}
              onClick={() => selectTopic(topic.id)}
            >
              <span aria-hidden="true">{topic.icon}</span>
              {topic.label}
              <span className="topic-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>

        <div
          id="breathe-advice-panel"
          role="tabpanel"
          aria-labelledby={`topic-tab-${activeTopic}`}
          className="breathe-card-grid"
        >
          {cards.map((card, index) => {
            const isExpanded = expandedCard === `${activeTopic}-${index}`;

            return (
              <article
                className={`breathe-advice-card ${card.color}`}
                key={`${activeTopic}-${card.title}`}
              >
                <div className="advice-card-top">
                  <span className="advice-card-icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <span className="advice-tag">{card.tag}</span>
                </div>

                <h3>{card.title}</h3>
                <p className="advice-description">{card.description}</p>

                {isExpanded && (
                  <div className="advice-action">
                    <strong>Try this</strong>
                    <p>{card.action}</p>
                  </div>
                )}

                <button
                  type="button"
                  className="advice-expand"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedCard(isExpanded ? null : `${activeTopic}-${index}`)
                  }
                >
                  {isExpanded ? 'Show less' : 'Make it practical'}
                  <span aria-hidden="true">{isExpanded ? '↑' : '→'}</span>
                </button>
              </article>
            );
          })}
        </div>

        <p className="topic-footnote">
          Showing: <strong>{selectedTopic.label}</strong>. Select another topic
          above to explore more advice.
        </p>
      </section>

      {/* Memorable routine */}
      <section className="breathe-routine">
        <div className="routine-symbol" aria-hidden="true">🌱</div>
        <div className="routine-copy">
          <span className="breathe-mini-label">KEEP IT SIMPLE</span>
          <h2>One small step today is a good start.</h2>
          <p>
            Pick one habit that fits your life. Build a routine gradually
            rather than trying to change everything at once.
          </p>
        </div>
        <button
          type="button"
          className="routine-button"
          onClick={() => {
            selectTopic('daily');
            document.getElementById('advice')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }}
        >
          Explore daily habits <span aria-hidden="true">→</span>
        </button>
      </section>

      {/* Safety note */}
      <aside className="breathe-safety" aria-label="Important health information">
        <span className="safety-icon" aria-hidden="true">ⓘ</span>
        <div>
          <strong>A gentle but important reminder</strong>
          <p>
            This guide provides general health education, not a diagnosis
            or personalized treatment plan. An AeroLens screening estimate
            cannot confirm or rule out COPD. Seek assessment from a qualified
            healthcare professional; spirometry is used to confirm COPD.
          </p>
          <p className="emergency-note">
            <strong>Emergency:</strong> If you or someone else has severe or
            sudden breathing difficulty, blue or grey lips or skin, or new
            confusion, seek emergency medical help immediately.
          </p>
        </div>
      </aside>
    </div>
  );
}
