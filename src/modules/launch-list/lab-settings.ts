// Made-up Form settings for the lab demos only. The Form id does not exist: a real submit ends on Google's 404.
import type { FormConfig } from '../../config/site.ts';

export const labForm: FormConfig = {
  mode: 'post',
  action: 'https://docs.google.com/forms/d/e/LAB-DEMO-formularz-nie-istnieje/formResponse',
  entries: { email: 'entry.1000001', consent: 'entry.1000002', source: 'entry.1000003' },
  consentValue: 'Zgadzam się, by zespół MONSUN wysłał mi jeden e-mail o starcie marki albo o zakończeniu projektu.',
};

export const labContact = 'wearmonsun@gmail.com';
export const labDeleteBy = '2027-02-28';
