/** Animated lightning bolt that sits in front of a task title. */
export default function Bolt({ size = 24 }: { size?: number }) {
  return (
    <svg className="bolt" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5L13.5 2z" />
    </svg>
  );
}
