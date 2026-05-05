/**
 * Official Slack mark (the four-color pinwheel). Inlined SVG so we don't pull
 * an icon library for a single brand glyph.
 */
export function SlackMark({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#E01E5A"
        d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2S.8 87.3.8 80s5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2S60.2 72.7 60.2 80v33c0 7.3-5.9 13.2-13.2 13.2S33.8 120.3 33.8 113V80z"
      />
      <path
        fill="#36C5F0"
        d="M47 27.2c-7.3 0-13.2-5.9-13.2-13.2S39.7.8 47 .8s13.2 5.9 13.2 13.2v13.2H47zm0 6.6c7.3 0 13.2 5.9 13.2 13.2S54.3 60.2 47 60.2H14c-7.3 0-13.2-5.9-13.2-13.2S6.7 33.8 14 33.8h33z"
      />
      <path
        fill="#2EB67D"
        d="M100.8 47c0-7.3 5.9-13.2 13.2-13.2s13.2 5.9 13.2 13.2-5.9 13.2-13.2 13.2h-13.2V47zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2S67.8 54.3 67.8 47V14C67.8 6.7 73.7.8 81 .8s13.2 5.9 13.2 13.2v33z"
      />
      <path
        fill="#ECB22E"
        d="M81 100.8c7.3 0 13.2 5.9 13.2 13.2S88.3 127.2 81 127.2s-13.2-5.9-13.2-13.2v-13.2H81zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2S73.7 67.8 81 67.8h33c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2H81z"
      />
    </svg>
  );
}
