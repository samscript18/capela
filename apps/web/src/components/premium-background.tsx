export function PremiumBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="aurora-orb absolute -left-[16%] -top-[28%] size-[46rem] rounded-full bg-[#9fad7c]/[.045] blur-[140px]" />
      <div className="aurora-orb absolute -right-[18%] top-[12%] size-[42rem] rounded-full bg-[#79b493]/[.04] blur-[150px]" />
      <div className="aurora-orb absolute bottom-[-30%] left-[20%] size-[38rem] rounded-full bg-[#879b67]/[.025] blur-[140px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#080b09_78%)] opacity-45" />
      <div className="ambient-noise absolute inset-0 opacity-[.018] mix-blend-soft-light" />
    </div>
  );
}
