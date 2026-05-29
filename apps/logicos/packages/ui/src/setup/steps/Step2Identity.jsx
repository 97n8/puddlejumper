export default function Step2Identity({ onComplete }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Identity & SSO</h2>
      <p className="text-sm text-gray-600">Configure Microsoft 365 or Google SSO in your .env file, then continue.</p>
      <button onClick={onComplete} className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium">Continue</button>
    </div>
  );
}
