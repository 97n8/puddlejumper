import type { FKFormField } from '@/services/pjApi'

export const FORMKEY_DEMO_FIELDS: FKFormField[] = [
  { id: 'full_name', label: 'Full Name', type: 'text', required: true, order: 0, pii: true, sensitive: false, dlpExempt: false, consentCovered: true },
  { id: 'email', label: 'Email', type: 'text', required: true, order: 1, pii: true, sensitive: false, dlpExempt: false, consentCovered: true },
  { id: 'category', label: 'Category', type: 'select', required: true, order: 2, pii: false, sensitive: false, dlpExempt: false, consentCovered: false, validation: { allowedValues: ['Noise', 'Parking', 'Sidewalk', 'Other'] } },
  { id: 'details', label: 'Description', type: 'textarea', required: true, order: 3, pii: false, sensitive: false, dlpExempt: false, consentCovered: false },
  { id: 'consent', label: 'I consent to processing for this request', type: 'checkbox', required: true, order: 4, pii: false, sensitive: false, dlpExempt: false, consentCovered: true },
]

export const FORMKEY_DEMO_SUBMISSIONS = [
  {
    submitterId: 'demo-jane',
    preview: 'Noise complaint · 10:42 AM',
    fields: {
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      category: 'Noise',
      details: 'Loud music and engine revving after 10 PM near the common.',
      consent: true,
    },
  },
  {
    submitterId: 'demo-carlos',
    preview: 'Parking complaint · 11:08 AM',
    fields: {
      full_name: 'Carlos Alvarez',
      email: 'carlos@example.com',
      category: 'Parking',
      details: 'Cars are blocking the crosswalk at Main and School during pickup.',
      consent: true,
    },
  },
  {
    submitterId: 'demo-rina',
    preview: 'Sidewalk complaint · 1:15 PM',
    fields: {
      full_name: 'Rina Patel',
      email: 'rina@example.com',
      category: 'Sidewalk',
      details: 'The sidewalk panel is lifted and dangerous for strollers.',
      consent: true,
    },
  },
] as const
