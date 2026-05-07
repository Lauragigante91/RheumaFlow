import React from "react";

/**
 * RheumaFlow brand mark — uses the official square icon (R + heartbeat,
 * blue→purple gradient) from /public/rheumaflow-mark.png.
 *
 * Pass `size` in tailwind units (e.g. "w-10 h-10") via className.
 */
export default function BrandMark({ className = "w-10 h-10", testid = "brand-mark" }) {
  return (
    <img
      src="/rheumaflow-mark.png"
      alt="RheumaFlow"
      className={`${className} object-contain rounded-md`}
      data-testid={testid}
      draggable={false}
    />
  );
}

/**
 * Wordmark with the official two-tone styling: "Rheuma" in dark navy +
 * "Flow" in violet. Useful wherever the full brand should appear.
 */
export function BrandWordmark({ className = "" }) {
  return (
    <span className={`font-heading font-black tracking-tighter ${className}`}>
      <span className="text-[#0A2540]">Rheuma</span>
      <span className="text-violet-600">Flow</span>
    </span>
  );
}
