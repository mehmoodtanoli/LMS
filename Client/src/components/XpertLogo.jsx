import React from "react";

/**
 * Xpert Clinical Laboratory Logo
 * Authentic microscope cradled by medical caring hands
 */
export function XpertLabLogo({ size = 48, color = "#134b7f", className = "", style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      {/* Microscope Group */}
      <g fill={color}>
        {/* Eyepiece & Tube */}
        <path
          d="M38 18 L44 12 L49 17 L43 23 Z"
          fill={color}
        />
        <rect
          x="41"
          y="20"
          width="7"
          height="18"
          rx="1.5"
          transform="rotate(35 41 20)"
          fill={color}
        />
        {/* Nosepiece & Objectives */}
        <circle cx="53" cy="37" r="4.5" fill={color} />
        <rect
          x="51"
          y="40"
          width="3.5"
          height="7"
          rx="1"
          transform="rotate(15 51 40)"
          fill={color}
        />
        <rect
          x="55"
          y="39"
          width="3"
          height="6"
          rx="1"
          transform="rotate(-20 55 39)"
          fill={color}
        />
        {/* Microscope Arm & Adjustment Knob */}
        <path
          d="M57 26 C64 28, 68 35, 66 44 C64 51, 60 55, 54 58 L54 62 C63 60, 71 53, 72 41 C73 30, 66 22, 57 20 Z"
          fill={color}
        />
        <circle cx="63" cy="37" r="3.2" fill={color} />
        <circle cx="63" cy="37" r="1.5" fill="#ffffff" />

        {/* Stage & Specimen Slide */}
        <rect x="42" y="47" width="22" height="3" rx="1" fill={color} />
        <rect x="47" y="45.5" width="10" height="1.5" rx="0.5" fill="#ffffff" opacity="0.8" />

        {/* Condenser / Substage */}
        <path d="M50 50 L56 50 L54 55 L52 55 Z" fill={color} />

        {/* Base Pillar & Foot */}
        <rect x="52" y="58" width="5" height="8" rx="1" fill={color} />
        <path
          d="M36 67 C42 64, 62 64, 68 67 C70 68, 69 70, 66 70 L38 70 C35 70, 34 68, 36 67 Z"
          fill={color}
        />
      </g>

      {/* Cupped Caring Hands Cradling the Base */}
      {/* Left Hand */}
      <path
        d="M12 68 C16 63, 22 61, 28 62 C34 63, 38 67, 43 72 C37 74, 30 74, 24 73 C19 72, 15 70, 12 68 Z"
        fill={color}
      />
      <path
        d="M10 65 C13 58, 19 53, 26 49 C26.5 48.6, 27.5 49.2, 27 50 C22 55, 17 61, 15 67 C13 67, 11 66, 10 65 Z"
        fill={color}
      />
      <path
        d="M16 57 C21 51, 28 47, 34 45 C34.6 44.5, 35.5 45.2, 35 46 C29 49, 23 54, 19 60 C18 59, 17 58, 16 57 Z"
        fill={color}
      />
      <path
        d="M23 70 L34 76 C37 77.5, 41 77.5, 44 76 L48 74 C49 75, 48 76.5, 46 77 C41 79.5, 36 79.5, 31 77.5 L20 72 Z"
        fill={color}
      />

      {/* Right Hand */}
      <path
        d="M88 68 C84 63, 78 61, 72 62 C66 63, 62 67, 57 72 C63 74, 70 74, 76 73 C81 72, 85 70, 88 68 Z"
        fill={color}
      />
      <path
        d="M90 65 C87 58, 81 53, 74 49 C73.5 48.6, 72.5 49.2, 73 50 C78 55, 83 61, 85 67 C87 67, 89 66, 90 65 Z"
        fill={color}
      />
      <path
        d="M84 57 C79 51, 72 47, 66 45 C65.4 44.5, 64.5 45.2, 65 46 C71 49, 77 54, 81 60 C82 59, 83 58, 84 57 Z"
        fill={color}
      />
      <path
        d="M77 70 L66 76 C63 77.5, 59 77.5, 56 76 L52 74 C51 75, 52 76.5, 54 77 C59 79.5, 64 79.5, 69 77.5 L80 72 Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Service 24 Hours circular stamp/seal
 */
export function Service24HoursBadge({ size = 70, color = "#134b7f", className = "" }) {
  return (
    <div
      className={`service-24-badge ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: color,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Circular Ring with Arrow accents */}
        <circle cx="50" cy="50" r="44" stroke={color} strokeWidth="3" strokeDasharray="6 3" />
        <circle cx="50" cy="50" r="38" stroke={color} strokeWidth="1.5" />
        
        {/* Top curved text path */}
        <path
          id="topServicePath"
          d="M24 44 A28 28 0 0 1 76 44"
          fill="none"
        />
        <text
          fill={color}
          fontSize="10"
          fontWeight="800"
          letterSpacing="2.5"
          textAnchor="middle"
        >
          <textPath href="#topServicePath" startOffset="50%">
            SERVICE
          </textPath>
        </text>

        {/* Center 24 */}
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fill={color}
          fontSize="28"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          24
        </text>

        {/* Bottom curved text path */}
        <path
          id="bottomHoursPath"
          d="M26 62 A28 28 0 0 0 74 62"
          fill="none"
        />
        <text
          fill={color}
          fontSize="8.5"
          fontWeight="800"
          letterSpacing="2"
          textAnchor="middle"
        >
          <textPath href="#bottomHoursPath" startOffset="50%">
            HOURS
          </textPath>
        </text>
      </svg>
    </div>
  );
}

/**
 * Blue chevron decorative arrow bar
 */
export function ChevronDecorativeBar({ color = "#134b7f", height = 18, className = "" }) {
  return (
    <div
      className={`xpert-chevron-bar ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: `${height}px`,
        background: color,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1 }} />
      {/* 3 Forward Chevrons on Right */}
      <svg
        width="60"
        height={height}
        viewBox="0 0 60 20"
        preserveAspectRatio="none"
        style={{ marginRight: "12px" }}
      >
        <polygon points="10,0 20,0 30,10 20,20 10,20 20,10" fill="#ffffff" opacity="0.9" />
        <polygon points="25,0 35,0 45,10 35,20 25,20 35,10" fill="#ffffff" opacity="0.9" />
        <polygon points="40,0 50,0 60,10 50,20 40,20 50,10" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>
  );
}
