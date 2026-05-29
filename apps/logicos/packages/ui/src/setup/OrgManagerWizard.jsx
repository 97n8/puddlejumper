import { useState } from 'react';
import Step1TownProfile  from './steps/Step1TownProfile';
import Step2Identity     from './steps/Step2Identity';
import Step3Staff        from './steps/Step3Staff';
import Step4Bodies       from './steps/Step4Bodies';
import Step5Connectors   from './steps/Step5Connectors';
import Step6Complete     from './steps/Step6Complete';

const STEPS = [
  Step1TownProfile, Step2Identity, Step3Staff,
  Step4Bodies, Step5Connectors, Step6Complete,
];

export default function OrgManagerWizard({ status }) {
  const [step, setStep] = useState((status?.setup_step || 1) - 1);
  const StepComponent = STEPS[Math.min(step, STEPS.length - 1)];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm p-8">
        <div className="mb-6 flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>
        <StepComponent onComplete={() => setStep(s => Math.min(s + 1, STEPS.length - 1))} />
      </div>
    </div>
  );
}
