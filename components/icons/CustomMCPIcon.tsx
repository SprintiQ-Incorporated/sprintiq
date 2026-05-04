interface CustomMCPIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function CustomMCPIcon({ 
  size = 24, 
  color = "#10B981",
  className = "" 
}: CustomMCPIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke={color} strokeWidth="1.5">
        {/* Central node */}
        <circle cx="12" cy="12" r="2" fill={color} />
        
        {/* Connected nodes */}
        <circle cx="6" cy="6" r="1.5" fill={color} />
        <circle cx="18" cy="6" r="1.5" fill={color} />
        <circle cx="6" cy="18" r="1.5" fill={color} />
        <circle cx="18" cy="18" r="1.5" fill={color} />
        
        {/* Connection lines */}
        <line x1="12" y1="12" x2="6" y2="6" />
        <line x1="12" y1="12" x2="18" y2="6" />
        <line x1="12" y1="12" x2="6" y2="18" />
        <line x1="12" y1="12" x2="18" y2="18" />
        
        {/* Outer ring */}
        <circle cx="12" cy="12" r="9" strokeDasharray="2 2" opacity="0.5" />
      </g>
    </svg>
  );
}
