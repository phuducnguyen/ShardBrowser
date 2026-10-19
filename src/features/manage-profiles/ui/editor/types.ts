import type { ProfileForm } from "../../../../entities/profile";

export type EditorTab = "overview" | "proxy" | "extensions" | "locale" | "privacy" | "location" | "advanced" | "cookies";

export type Update = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;

/// What every tab receives: the form, and the two ways to change it. `patch` sets several fields at
/// once (two `u` calls in a row would each start from the same stale form).
export type TabProps = {
  f: ProfileForm;
  u: Update;
  patch: (changes: Partial<ProfileForm>) => void;
};
