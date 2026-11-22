import { render, screen } from '@testing-library/react';
import { axeViolations } from '../test/axe';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  const page = (
    <AppShell
      brand="Rule Studio"
      nav={<a href="/rulesets">Rulesets</a>}
      actions={<button>Menu</button>}
    >
      <h1>Rulesets</h1>
    </AppShell>
  );

  it('has a skip link that targets the main content', () => {
    render(page);
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('labels the navigation', () => {
    render(page);
    expect(screen.getByRole('navigation', { name: 'Main' })).toContainElement(
      screen.getByRole('link', { name: 'Rulesets' }),
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(page);
    expect(await axeViolations(container)).toEqual([]);
  });
});
