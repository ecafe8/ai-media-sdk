"use client";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/shadcn/toggle-group";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export type ThemeOption = "light" | "system" | "dark";

const THEME_OPTIONS: ReadonlyArray<{
  readonly value: ThemeOption;
  readonly icon: typeof Sun;
}> = [
  { value: "light", icon: Sun },
  { value: "system", icon: Monitor },
  { value: "dark", icon: Moon },
];

/** Language-neutral defaults; consumers may pass localized labels. */
const DEFAULT_LABELS: Readonly<Record<ThemeOption, string>> = {
  light: "Light",
  system: "System",
  dark: "Dark",
};

export interface ThemeSwitcherProps {
  readonly className?: string;
  /** Localized option labels (tooltip / aria text). */
  readonly labels?: Partial<Record<ThemeOption, string>>;
  /** Localized group aria-label. */
  readonly ariaLabel?: string;
}

/**
 * Light / system / dark segmented theme switcher built on shadcn
 * ToggleGroup; persists the choice via next-themes.
 */
export function ThemeSwitcher({
  className,
  labels,
  ariaLabel,
}: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const labelFor = (option: ThemeOption): string =>
    labels?.[option] ?? DEFAULT_LABELS[option];

  return (
    <ToggleGroup
      aria-label={ariaLabel ?? "Theme"}
      spacing={1}
      value={
        THEME_OPTIONS.some((option) => option.value === theme)
          ? [theme as ThemeOption]
          : ["system"]
      }
      onValueChange={(value) => {
        const next = value[0];
        if (next) setTheme(next);
      }}
      className={
        "rounded-full border border-border bg-muted p-1" +
        (className ? ` ${className}` : "")
      }
    >
      {THEME_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={labelFor(option.value)}
          title={labelFor(option.value)}
          className="size-8 rounded-full text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          <option.icon className="size-4" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
