import type { SVGProps } from "react";

export type IconName =
  | "chevron-right"
  | "chevron-up"
  | "copy"
  | "edit"
  | "eye"
  | "file"
  | "folder"
  | "grip"
  | "more"
  | "pin"
  | "plus"
  | "power"
  | "search"
  | "trash"
  | "x";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  const paths: Record<IconName, React.ReactNode> = {
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    "chevron-up": <path d="m18 15-6-6-6 6" />,
    copy: <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
    edit: <><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18 2.5a2.1 2.1 0 0 1 3 3L12 14.5 8.5 15.5 9.5 12Z" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    file: <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2Z" /><path d="M14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8" /></>,
    folder: <path d="M3 19V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    grip: <><circle cx="9" cy="5" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="19" r="1" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    pin: <><path d="M12 17v5M5 17h14M7 17l1-7-3-3V5h14v2l-3 3 1 7" /></>,
    plus: <><path d="M5 12h14M12 5v14" /></>,
    power: <><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 16H6L5 6M10 11v6M14 11v6" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      {paths[name]}
    </svg>
  );
}
