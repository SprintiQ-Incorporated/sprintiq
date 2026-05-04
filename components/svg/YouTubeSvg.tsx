export const YouTubeSvg = ({ color = "currentColor" }: { color?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill={color}
      className="stroke-current"
    >
      <path d="M47.16 14.28c-.59-2.21-2.32-3.94-4.53-4.53C39.31 9 24 9 24 9S8.69 9 5.37 9.75c-2.21.59-3.94 2.32-4.53 4.53C.5 17.62.5 24 .5 24s0 6.38.34 9.72c.59 2.21 2.32 3.94 4.53 4.53C8.69 39 24 39 24 39s15.31 0 18.63-.75c2.21-.59 3.94-2.32 4.53-4.53.34-3.34.34-9.72.34-9.72s0-6.38-.34-9.72zM19.5 30.75V17.25L31.5 24l-12 6.75z" />
    </svg>
  );
};
