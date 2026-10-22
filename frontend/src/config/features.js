export const FIELDS = [
  { key: 'RIDAGEYR', label: 'Age (years)', type: 'number',
    min: 20, max: 120, step: 1, hint: 'Allowed range: 20–120' },

  { key: 'SMQ020', label: 'Have you smoked at least 100 cigarettes in your life?',
    type: 'select',
    options: [{ value: 1, label: 'Yes' }, { value: 2, label: 'No' }] },

  { key: 'SMQ040', label: 'Do you now smoke cigarettes?',
    type: 'select', required_if: { key: 'SMQ020', value: 1 },
    options: [{ value: 1, label: 'Every day' }, { value: 2, label: 'Some days' },
              { value: 3, label: 'Not at all' }] },

  { key: 'MCQ010', label: 'Has a doctor ever told you that you have asthma?',
    type: 'select',
    options: [{ value: 1, label: 'Yes' }, { value: 2, label: 'No' }] },
  { key: 'BMXBMI', label: 'Body mass index (BMI)', type: 'number',
    min: 15, max: 70, step: 0.1, hint: 'Allowed range: 15–70' },
];
