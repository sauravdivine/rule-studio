import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '../test/axe';
import { Button } from './button';

describe('Button', () => {
  it('is a type="button" by default, so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('lets a caller class win over a built-in one', () => {
    render(<Button className="px-8">Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-8');
    expect(button).not.toHaveClass('px-4');
  });

  it('renders its child instead of a <button> with asChild', () => {
    render(
      <Button asChild>
        <a href="/rulesets">Rulesets</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Rulesets' })).toHaveClass(
      'bg-primary',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no accessibility violations, including an icon-only button with a label', async () => {
    const { container } = render(
      <>
        <Button>Text</Button>
        <Button size="icon" aria-label="Close">
          <svg aria-hidden="true" />
        </Button>
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
