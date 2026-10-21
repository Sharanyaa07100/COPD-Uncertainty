export const FIELDS = [
  { key: 'RIDAGEYR', label: 'Age (years)', type: 'number', min: 20, max: 120, step: 1 },
  {
    key: 'SMQ020',
    label: 'Have you smoked at least 100 cigarettes in your life?',
    type: 'select',
    options: [{ value: 1, label: 'Yes' }, { value: 2, label: 'No' }],
  },
  {
    key: 'MCQ010',
    label: 'Has a doctor ever told you that you have asthma?',
    type: 'select',
    options: [{ value: 1, label: 'Yes' }, { value: 2, label: 'No' }],
  },
  { key: 'BMXBMI', label: 'Body mass index (kg/m²)', type: 'number', min: 10, max: 80, step: 0.1 },
];

export const INITIAL_VALUES = {
  RIDAGEYR: '55',
  SMQ020: '1',
  MCQ010: '2',
  BMXBMI: '27.5',
};
