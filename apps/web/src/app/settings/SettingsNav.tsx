import { settingsStyles as styles } from "./settings.styles";

const sections = [
  { id: "general", label: "General" },
  { id: "preferences", label: "Investigation preferences" },
  { id: "security", label: "Password and sessions" },
  { id: "access", label: "Wallet and access" },
  { id: "privacy", label: "Privacy" },
] as const;

export type SettingsSection = (typeof sections)[number]["id"];

export default function SettingsNav({
  active,
  onChange,
}: {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
}) {
  return (
    <nav className={styles.settingsNav} aria-label="Settings sections">
      {sections.map((section) => {
        const isActive = section.id === active;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            data-active={isActive}
            key={section.id}
            onClick={() => onChange(section.id)}
            type="button"
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
