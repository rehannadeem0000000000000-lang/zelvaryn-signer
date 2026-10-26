import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={18}
      height={18}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m4 6 5 6-5 6" />
      <path d="M12 18h8" />
    </Base>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 8 8" />
      <path d="m16 16 2-2" />
      <path d="m19 19 2-2" />
    </Base>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5" />
      <path d="M12 12v9" />
    </Base>
  );
}

export function AndroidIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 10a6 6 0 0 1 12 0v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-6Z" />
      <path d="m7 5 1.6 2.4" />
      <path d="m17 5-1.6 2.4" />
      <path d="M9.5 14h.01M14.5 14h.01" />
      <path d="M4 12v4M20 12v4" />
    </Base>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z" />
      <path d="M8 7h8M8 11h6" />
    </Base>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </Base>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Base>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 16V5" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 13 4 4L19 7" />
    </Base>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </Base>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </Base>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M7.5 7.5l2 2M14.5 14.5l2 2M16.5 7.5l-2 2M9.5 14.5l-2 2" />
    </Base>
  );
}
