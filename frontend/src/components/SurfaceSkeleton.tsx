export function SurfaceSkeleton(): JSX.Element {
  return (
    <>
      <style>
        {`
          @keyframes surface-skeleton-pulse {
            0%,
            100% {
              opacity: 0.6;
            }

            50% {
              opacity: 1;
            }
          }
        `}
      </style>
      <div
        aria-hidden="true"
        style={{
          minHeight: "100%",
          width: "100%",
          borderRadius: "24px",
          background: "var(--surface-2)",
          animation: "surface-skeleton-pulse 1.2s ease-in-out infinite",
        }}
      />
    </>
  );
}

export default SurfaceSkeleton;
