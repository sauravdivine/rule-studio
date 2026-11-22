import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '../test/axe';
import { THEME_STORAGE_KEY } from '../lib/theme';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  it('switches to dark from the keyboard and remembers it', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    screen.getByRole('button', { name: /change theme/i }).focus();
    await user.keyboard('{Enter}');
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Dark' }),
    );

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(
      screen.getByRole('button', { name: /theme: dark/i }),
    ).toBeInTheDocument();
  });

  it('marks the current choice in the menu', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /change theme/i }));
    expect(
      await screen.findByRole('menuitemradio', { name: 'Light' }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('has no accessibility violations when open', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /change theme/i }));
    await screen.findByRole('menu');
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
