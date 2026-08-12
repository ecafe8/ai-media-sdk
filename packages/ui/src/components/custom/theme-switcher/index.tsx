"use client";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/shadcn/toggle-group";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

type ThemeOption = "light" | "system" | "dark";

const THEME_OPTIONS: ReadonlyArray<{
  readonly value: ThemeOption;
  readonly label: string;
  readonly icon: typeof Sun;
}> = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "dark", label: "深色", icon: Moon },
];

/**
 * Light / system / dark segmented theme switcher built on shadcn
 * ToggleGroup; persists the choice via next-themes.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      aria-label="主题模式"
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
          aria-label={option.label}
          title={option.label}
          className="size-8 rounded-full text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          <option.icon className="size-4" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
