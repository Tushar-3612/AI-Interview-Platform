import { useCallback, useEffect, useState } from "react";

/**
 * Mouse parallax hook — returns normalized x/y offsets for layered animations.
 */
export function useMouseParallax(intensity = 1) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * intensity;
      const y = (e.clientY / window.innerHeight - 0.5) * intensity;
      setOffset({ x, y });
    },
    [intensity]
  );

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return offset;
}
