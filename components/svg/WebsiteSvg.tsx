export const WebsiteSvg = ({ color = "currentColor" }: { color?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill={color}
      className="stroke-current"
    >
      <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4zm-2 32h4v-4h-4v4zm0-8h4V16h-4v12z" />
    </svg>
  );
};
