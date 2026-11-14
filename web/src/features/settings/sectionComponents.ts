import type { ComponentType } from "react";
import type { SettingsSectionId } from "./meta";
import { AccountSection, BoxSection, ProfileSection, StyleSection } from "./sections";

export const SECTION_COMPONENTS: Record<SettingsSectionId, ComponentType> = {
  profile: ProfileSection,
  box: BoxSection,
  style: StyleSection,
  account: AccountSection,
};
