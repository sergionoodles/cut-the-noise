import { brandIcons, type BrandIconKey } from "../icons/brands";

interface BrandIconProps {
  name: BrandIconKey;
  className?: string;
  title?: string;
}

export function BrandIcon({ name, className = "", title }: BrandIconProps) {
  const icon = brandIcons[name];
  return (
    <svg
      className={`brand-icon ${className}`.trim()}
      role="img"
      viewBox={icon.viewBox}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path d={icon.path} fill="currentColor" />
    </svg>
  );
}
