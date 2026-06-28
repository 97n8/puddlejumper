export default function ZeroState({ message = 'Nothing here yet.' }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <p className="text-sm">{message}</p>
    </div>
  );
}
