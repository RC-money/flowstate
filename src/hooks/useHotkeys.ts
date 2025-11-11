import { useEffect, useRef } from "react";

export type HotkeyCombo = string | string[];

export interface HotkeyConfig {
  combo: HotkeyCombo;
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  allowInInputs?: boolean;
}

interface ParsedCombo {
  key?: string;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  ctrl?: boolean;
  mod?: boolean;
}

interface NormalizedHotkey extends Omit<HotkeyConfig, "combo"> {
  combos: ParsedCombo[];
}

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  return: "enter",
  spacebar: "space",
  space: "space",
  del: "delete",
};

type ModifierKey = Exclude<keyof ParsedCombo, "key">;

const modifierMap: Record<string, ModifierKey> = {
  shift: "shift",
  alt: "alt",
  option: "alt",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  ctrl: "ctrl",
  control: "ctrl",
  mod: "mod",
};

const normalizeKey = (key: string): string => {
  if (!key) return "";
  if (key === " ") return "space";
  const lower = key.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
};

const parseCombo = (combo: string): ParsedCombo | null => {
  if (!combo) return null;
  const parts = combo
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (!parts.length) return null;

  const parsed: ParsedCombo = {};

  for (const part of parts) {
    const modifier = modifierMap[part];
    if (modifier) {
      parsed[modifier] = true;
      continue;
    }
    parsed.key = normalizeKey(part);
  }

  return parsed.key || parsed.shift || parsed.alt || parsed.meta || parsed.ctrl || parsed.mod
    ? parsed
    : null;
};

const modifierMatches = (expected: boolean | undefined, actual: boolean) =>
  expected === undefined ? !actual : expected === actual;

const matchesCombo = (event: KeyboardEvent, combo: ParsedCombo): boolean => {
  if (
    combo.mod
      ? !(event.metaKey || event.ctrlKey)
      : !(
          modifierMatches(combo.meta, event.metaKey) &&
          modifierMatches(combo.ctrl, event.ctrlKey)
        )
  ) {
    return false;
  }

  if (
    !modifierMatches(combo.shift, event.shiftKey) ||
    !modifierMatches(combo.alt, event.altKey)
  ) {
    return false;
  }

  const key = normalizeKey(event.key);
  return combo.key ? combo.key === key : true;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName?.toLowerCase();
  if (!tagName) return false;
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
};

const normalizeHotkeys = (hotkeys: HotkeyConfig[] = []): NormalizedHotkey[] =>
  hotkeys
    .filter(
      (binding): binding is HotkeyConfig =>
        typeof binding?.handler === "function" &&
        Boolean(binding.combo)
    )
    .map((binding) => {
      const combos = (Array.isArray(binding.combo) ? binding.combo : [binding.combo])
        .map(parseCombo)
        .filter((combo): combo is ParsedCombo => Boolean(combo));

      return {
        ...binding,
        combos,
      };
    })
    .filter((binding) => binding.combos.length > 0);

export const useHotkeys = (hotkeys: HotkeyConfig[] = []): void => {
  const hotkeysRef = useRef<NormalizedHotkey[]>([]);

  useEffect(() => {
    hotkeysRef.current = normalizeHotkeys(hotkeys);
  }, [hotkeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      for (const binding of hotkeysRef.current) {
        if (binding.enabled === false) continue;
        if (!binding.allowInInputs && isEditableTarget(target)) continue;

        const matched = binding.combos.some((combo) => matchesCombo(event, combo));
        if (!matched) continue;

        if (binding.preventDefault !== false) {
          event.preventDefault();
        }
        if (binding.stopPropagation) {
          event.stopPropagation();
        }

        binding.handler(event);
        break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
};
