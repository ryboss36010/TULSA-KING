"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface SwipeToConfirmProps {
  onConfirm: () => void;
  disabled?: boolean;
}

export default function SwipeToConfirm({
  onConfirm,
  disabled,
}: SwipeToConfirmProps) {
  const [confirmed, setConfirmed] = useState(false);
  const x = useMotionValue(0);
  const trackWidth = 280;
  const thumbWidth = 64;
  const maxDrag = trackWidth - thumbWidth;

  const bgOpacity = useTransform(x, [0, maxDrag], [0.3, 1]);
  const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);

  function handleDragEnd() {
    if (x.get() > maxDrag * 0.85) {
      setConfirmed(true);
      if (navigator.vibrate) navigator.vibrate(50);
      onConfirm();
      setTimeout(() => {
        setConfirmed(false);
        x.set(0);
      }, 1500);
    } else {
      x.set(0);
    }
  }

  return (
    <div
      className="relative rounded-full overflow-hidden"
      style={{ width: trackWidth, height: 56 }}
    >
      <motion.div
        className="absolute inset-0 bg-green-600 rounded-full"
        style={{ opacity: bgOpacity }}
      />
      <motion.span
        className="absolute inset-0 flex items-center justify-center text-white font-semibold text-sm pointer-events-none"
        style={{ opacity: textOpacity }}
      >
        {confirmed ? "✓ Bet Placed!" : "Swipe to confirm"}
      </motion.span>
      {!confirmed && (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className={`absolute top-1 left-1 w-12 h-12 rounded-full bg-white flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <span className="text-green-600 font-bold text-lg">→</span>
        </motion.div>
      )}
    </div>
  );
}
