import { useId } from "react";
import { useCelestialPrefs } from "../hooks/useCelestialPrefs";

interface NovaStarProps {
  /** Earned subtasks burn in the full palette; the rest stay recessed. */
  filled: boolean;
  /** Rendered height in px. Width follows at 4:3, since the horizontal ray is longer. */
  size?: number;
  /** Overrides the star's core colour; defaults to the user's chosen one. */
  color?: string;
}

/**
 * The four-point starburst used for subtask stars on board chips: a long
 * horizontal ray crossed by a shorter vertical one, pinched to a waist at the
 * centre so the arms read as light rather than as a plus sign.
 *
 * The fill falls from cold blue at the top tip through gold and ember to
 * magenta at the bottom, so even at 11px the star has a temperature to it
 * instead of being a flat gold blob.
 */
const NovaStar = ({ filled, size = 11, color }: NovaStarProps) => {
  // useId emits colons, which are not safe inside a url(#...) reference.
  const gradientId = `nova-${useId().replace(/:/g, "")}`;
  const [prefs] = useCelestialPrefs();
  const core = color ?? prefs.starColor;

  return (
    <svg
      width={Math.round(size * 1.34)}
      height={size}
      viewBox="0 0 32 24"
      aria-hidden="true"
      focusable="false"
      style={
        filled ? { filter: "drop-shadow(0 0 3px rgba(255, 170, 90, 0.75))" } : undefined
      }
    >
      {filled ? (
        <defs>
          <linearGradient
            id={gradientId}
            x1="16"
            y1="0"
            x2="16"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            {/* The chosen colour owns the body of the star; the cold tip and
                the deep base stay put so the shape keeps its temperature. */}
            <stop offset="0" stopColor="#60a5ff" />
            <stop offset="0.3" stopColor={core} />
            <stop offset="0.5" stopColor={core} />
            <stop offset="0.72" stopColor="#e23a80" />
            <stop offset="1" stopColor="#7e34d1" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M16 0 C17.3 9.4 19.6 11.1 32 12 C19.6 12.9 17.3 14.6 16 24 C14.7 14.6 12.4 12.9 0 12 C12.4 11.1 14.7 9.4 16 0 Z"
        fill={filled ? `url(#${gradientId})` : "#3d425f"}
      />
    </svg>
  );
};

export default NovaStar;
