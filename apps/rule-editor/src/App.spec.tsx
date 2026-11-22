import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestHost } from '@rule-studio/host/testing';
import { App } from './App';

// Spec 002 acceptance: a remote rendered with a viewer host shows no edit or
// publish actions. The host is the only thing a remote knows about auth.
describe('rule editor permissions', () => {
  it('shows no edit or publish actions to a viewer', () => {
    render(<App host={createTestHost('VIEWER')} />);
    expect(
      screen.queryByRole('button', { name: /edit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /publish/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create ruleset/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
  });

  it.each(['EDITOR', 'ADMIN'] as const)(
    'shows edit and publish to an %s',
    (role) => {
      render(<App host={createTestHost(role)} />);
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /publish/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    },
  );
});
