// Light or dark: follows the system until the visitor picks one, then remembers it.
const dark = window.matchMedia('(prefers-color-scheme: dark)');

const effective = () => document.documentElement.dataset.theme ?? (dark.matches ? 'dark' : 'light');

export function setUpThemeToggle() {
  const button = document.querySelector<HTMLButtonElement>('.theme-toggle');
  if (!button) return;

  const label = () => button.setAttribute('aria-label', `Switch to ${effective() === 'dark' ? 'light' : 'dark'} theme`);
  label();
  dark.addEventListener('change', label);

  button.addEventListener('click', () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this page only.
    }
    label();
  });
}
