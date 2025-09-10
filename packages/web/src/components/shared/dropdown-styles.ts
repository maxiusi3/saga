// 统一下拉菜单样式（与shadcn/ui风格一致）
// 背景、边框、阴影、圆角、动画均保持一致

export const sagaDropdownPanel =
  "bg-popover text-popover-foreground z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[12rem] origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-x-hidden overflow-y-auto rounded-lg border p-2 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

export const sagaDropdownSectionHeader =
  "px-3 py-2 text-xs font-semibold text-muted-foreground";

export const sagaDropdownItem =
  "flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent/50";

export const sagaDropdownSeparator = "-mx-1 my-2 h-px bg-border";

export const sagaDropdownBadge =
  "ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground";

