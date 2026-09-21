import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const MAX_ROCK_DEGREES = 7;
const MAX_NUDGES = 6;

// The bottle is decorative; the two buttons are the way out and work without it.
export default function NotFound() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const sceneRef = useRef<HTMLDivElement>(null);
  const [rock, setRock] = useState(0);
  const [wobbleKey, setWobbleKey] = useState(0);
  const [nudges, setNudges] = useState(0);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return;

      const bounds = sceneRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const centre = bounds.left + bounds.width / 2;
      const offset = (event.clientX - centre) / (bounds.width / 2);

      setRock(Math.max(-1, Math.min(1, offset)) * MAX_ROCK_DEGREES);
    },
    [prefersReducedMotion],
  );

  const nudge = useCallback(() => {
    if (prefersReducedMotion) return;

    setWobbleKey((key) => key + 1);
    setNudges((count) => Math.min(MAX_NUDGES, count + 1));
  }, [prefersReducedMotion]);

  // Settle upright when the window loses focus, so it is not left leaning.
  useEffect(() => {
    const settle = () => setRock(0);
    window.addEventListener("blur", settle);
    return () => window.removeEventListener("blur", settle);
  }, []);

  const puddleWidth = 150 + nudges * 11;

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
      <style>{`
        @keyframes amrut-drip {
          0%   { transform: translate(0, 0) scale(0.7); opacity: 0; }
          20%  { opacity: 1; }
          85%  { transform: translate(-5px, 30px) scale(1.1); opacity: 1; }
          100% { transform: translate(-6px, 36px) scale(0.3); opacity: 0; }
        }
        @keyframes amrut-wobble {
          0%, 100% { transform: rotate(var(--rock)); }
          30%      { transform: rotate(calc(var(--rock) - 6deg)); }
          65%      { transform: rotate(calc(var(--rock) + 4deg)); }
        }
        @keyframes amrut-ripple {
          0%   { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .amrut-drip, .amrut-ripple { animation: none !important; opacity: 0 !important; }
        }
      `}</style>

      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div
          ref={sceneRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setRock(0)}
          className="relative mb-4 flex h-44 w-full items-center justify-center"
        >
          {/* The spill it has left behind. */}
          <div className="absolute bottom-5 left-1/2 flex translate-x-[-62%] items-center justify-center">
            <span
              className="block rounded-[50%] bg-slate-200 transition-[width] duration-500 ease-out"
              style={{ width: `${puddleWidth}px`, height: "20px" }}
            />
            <span
              key={`ripple-${wobbleKey}`}
              className="amrut-ripple absolute rounded-[50%] border-2 border-slate-300"
              style={{
                width: `${puddleWidth}px`,
                height: "20px",
                animation: wobbleKey ? "amrut-ripple 900ms ease-out" : undefined,
              }}
            />
          </div>

          {/* Drips from the mouth into the puddle. */}
          {Array.from({ length: 3 }).map((_, index) => (
            <span
              key={index}
              className="amrut-drip absolute block h-3 w-1.75 rounded-full bg-slate-300"
              style={{
                left: `calc(50% - ${62 + index * 3}px)`,
                top: "100px",
                animation: `amrut-drip ${2.3 + index * 0.6}s ${index * 0.9}s infinite ease-in`,
              }}
            />
          ))}

          <button
            key={wobbleKey}
            type="button"
            onClick={nudge}
            aria-label="Nudge the bottle"
            className="relative cursor-pointer rounded-xl bg-transparent p-1 focus-visible:ring-2 focus-visible:ring-[#266699] focus-visible:outline-none"
            style={
              {
                "--rock": `${rock}deg`,
                transform: `rotate(${rock}deg)`,
                animation: wobbleKey ? "amrut-wobble 700ms ease-in-out" : undefined,
                transformOrigin: "70% 85%",
              } as React.CSSProperties
            }
          >
            {/* Drawn lying on its side — the bottle has already gone over. */}
            <svg width="230" height="120" viewBox="0 0 230 120" fill="none" aria-hidden="true">
              {/* Cap, knocked off and lying just past the mouth. */}
              <rect x="10" y="76" width="26" height="12" rx="3" fill="#266699" />

              {/* Bottle on its side: mouth left, base right. */}
              <path
                d="M52 44h26l30-14h88a14 14 0 0 1 14 14v32a14 14 0 0 1-14 14h-88l-30-14H52a16 16 0 0 1 0-32Z"
                fill="#F1F5F9"
                stroke="#CBD5E1"
                strokeWidth="2.5"
              />

              {/* What milk is left, settled along the lower side. */}
              <path
                d="M110 74h96v2a14 14 0 0 1-14 14h-82l-18-8Z"
                fill="#E2E8F0"
              />
            </svg>
          </button>
        </div>

        <p className="text-6xl font-semibold tracking-tight text-slate-900 sm:text-7xl">
          404
        </p>

        <h1 className="mt-2 text-lg font-semibold text-slate-800 sm:text-xl">
          This page has been spilt
        </h1>

        <p className="mt-2 max-w-sm text-sm text-slate-500">
          {nudges >= MAX_NUDGES
            ? "That is quite enough of that. The page still isn't here."
            : "We couldn't find what you were looking for. It may have been moved, or the link may be wrong."}
        </p>

        <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link to={isAuthenticated ? "/dashboard" : "/login"}>
              <Home className="mr-2 h-4 w-4" />
              {isAuthenticated ? "Back to dashboard" : "Go to sign in"}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
