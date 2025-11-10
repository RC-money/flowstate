export function NoiseOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.06] mix-blend-soft-light"
      style={{
        backgroundImage:
          "url('https://grainy-gradients.vercel.app/noise.svg')",
        backgroundSize: "300px 300px",
        animation: "noiseShift 1.5s steps(8) infinite",
      }}
    ></div>
  );
}
