import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Sun, Moon, Monitor, Accessibility } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';
type AccessibilityMode = 'normal' | 'high-contrast';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  accessibilityMode: AccessibilityMode;
  setTheme: (theme: Theme) => void;
  setAccessibilityMode: (mode: AccessibilityMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('dbx-theme') as Theme) ?? 'system';
    }
    return 'system';
  });

  const [accessibilityMode, setAccessibilityMode] = useState<AccessibilityMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('dbx-a11y') as AccessibilityMode) ?? 'normal';
    }
    return 'normal';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function resolve() {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      setResolvedTheme(isDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', isDark);
    }

    resolve();
    localStorage.setItem('dbx-theme', theme);
    mediaQuery.addEventListener('change', resolve);
    return () => mediaQuery.removeEventListener('change', resolve);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('dbx-a11y', accessibilityMode);
    document.documentElement.classList.toggle('high-contrast', accessibilityMode === 'high-contrast');
  }, [accessibilityMode]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, accessibilityMode, setTheme, setAccessibilityMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

// ---- Theme Selector Component ----

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
];

export function ThemeSelector() {
  const { theme, setTheme, accessibilityMode, setAccessibilityMode } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {/* Theme toggle */}
      <div className="flex items-center rounded-lg bg-white/10 p-0.5">
        {themeOptions.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            title={label}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-[var(--motion-fast)] ${
              theme === value
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-white/60 hover:text-white/90'
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Accessibility toggle */}
      <button
        onClick={() => setAccessibilityMode(accessibilityMode === 'normal' ? 'high-contrast' : 'normal')}
        title={`Accessibility: ${accessibilityMode === 'high-contrast' ? 'High Contrast' : 'Normal'}`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-[var(--motion-fast)] ${
          accessibilityMode === 'high-contrast'
            ? 'bg-[var(--accent-info)] text-white'
            : 'bg-white/10 text-white/60 hover:text-white/90'
        }`}
      >
        <Accessibility size={14} />
      </button>
    </div>
  );
}
