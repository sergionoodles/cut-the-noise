/** Extension brand mark — logo in the popup header and loading state. */
export function BrandMark({ className = "" }: { className?: string }) {
  const src = chrome.runtime.getURL("icon128.png");

  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <img src={src} alt="" width={38} height={38} draggable={false} />
    </span>
  );
}
