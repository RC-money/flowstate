interface ProgressProps {
  total: number;
  completed: number;
  colorFrom: string;
  colorTo: string;
}

export function ProgressIndicator({ total, completed, colorFrom, colorTo }: ProgressProps) {
  const percent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="w-full h-2 bg-slate-700/40 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(to right, ${colorFrom}, ${colorTo})`,
        }}
      />
    </div>
  );
}

