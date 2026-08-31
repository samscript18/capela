"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

export function SessionLoadingGate() {
  const reduceMotion = useReducedMotion();
  const identifier = useId().replaceAll(":", "");
  const wordClipId = `capela-word-${identifier}`;
  const liquidGradientId = `capela-liquid-${identifier}`;

  return (
    <main aria-busy="true" className="grid min-h-svh place-items-center overflow-hidden bg-[#070807] px-5 text-white">
      <p className="sr-only" role="status">
        Capela is restoring your authenticated session.
      </p>

      <motion.div
        animate={
          reduceMotion
            ? undefined
            : {
                filter: [
                  "drop-shadow(0 0 18px rgba(159,173,124,.16))",
                  "drop-shadow(0 0 42px rgba(159,173,124,.42))",
                  "drop-shadow(0 0 18px rgba(159,173,124,.16))",
                ],
                opacity: [0.86, 1, 0.86],
                scale: [0.975, 1.035, 0.975],
              }
        }
        className="w-[min(88vw,42rem)]"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
        transition={{ duration: reduceMotion ? 0 : 3.4, ease: "easeInOut", repeat: Infinity }}
      >
        <svg aria-hidden="true" className="block h-auto w-full overflow-visible" role="img" viewBox="0 0 640 190">
          <defs>
            <clipPath id={wordClipId}>
              <text
                dominantBaseline="middle"
                fontFamily="var(--font-sans), Arial, sans-serif"
                fontSize="132"
                fontWeight="780"
                letterSpacing="-8"
                textAnchor="middle"
                x="320"
                y="95"
              >
                Capela
              </text>
            </clipPath>
            <linearGradient id={liquidGradientId} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#eef2df" />
              <stop offset="34%" stopColor="#c8d1aa" />
              <stop offset="68%" stopColor="#9fad7c" />
              <stop offset="100%" stopColor="#79b493" />
            </linearGradient>
          </defs>

          <text
            dominantBaseline="middle"
            fill="rgba(255,255,255,.12)"
            fontFamily="var(--font-sans), Arial, sans-serif"
            fontSize="132"
            fontWeight="780"
            letterSpacing="-8"
            stroke="rgba(255,255,255,.2)"
            strokeWidth="1.2"
            textAnchor="middle"
            x="320"
            y="95"
          >
            Capela
          </text>

          <g clipPath={`url(#${wordClipId})`}>
            <motion.path
              animate={reduceMotion ? undefined : { x: [0, -600], y: [8, -8, 8] }}
              d="M-620 104 C-520 70-420 138-320 104 S-120 70-20 104 S180 138 280 104 S480 70 580 104 S780 138 880 104 S1080 70 1180 104 V220 H-620 Z"
              fill={`url(#${liquidGradientId})`}
              transition={{ duration: reduceMotion ? 0 : 4.8, ease: "linear", repeat: Infinity }}
            />
            <motion.path
              animate={reduceMotion ? undefined : { x: [-560, 40], y: [-3, 7, -3] }}
              d="M-620 118 C-470 88-370 148-220 118 S30 88 180 118 S430 148 580 118 S830 88 980 118 S1230 148 1380 118 V220 H-620 Z"
              fill="rgba(255,255,255,.18)"
              transition={{ duration: reduceMotion ? 0 : 6.2, ease: "linear", repeat: Infinity }}
            />
          </g>
        </svg>
      </motion.div>
    </main>
  );
}
