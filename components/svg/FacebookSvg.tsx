export const FacebookSvg = ({ color = "currentColor" }: { color?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill={color}
      className="stroke-current"
    >
      <path d="M25.638 48H2.65A2.65 2.65 0 0 1 0 45.35V2.65A2.649 2.649 0 0 1 2.65 0h42.7A2.649 2.649 0 0 1 48 2.65v42.7A2.65 2.65 0 0 1 45.35 48H33.119V29.412h6.24l.934-7.244h-7.174v-4.625c0-2.098.583-3.527 3.587-3.527l3.836-.002V7.535c-.663-.088-2.94-.285-5.944-.285-5.886 0-9.92 3.593-9.92 10.184v5.343h-6.255v7.244h6.255V48Z" />
    </svg>
  );
};
