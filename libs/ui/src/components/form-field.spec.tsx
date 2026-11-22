import { render, screen } from '@testing-library/react';
import { axeViolations } from '../test/axe';
import { FormField } from './form-field';
import { Input } from './input';

describe('FormField', () => {
  it('connects the label to the control', () => {
    render(
      <FormField label="Email">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Email')).toBeInstanceOf(HTMLInputElement);
  });

  it('describes the control with the hint', () => {
    render(
      <FormField label="Email" hint="Use your work address">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Use your work address',
    );
  });

  it('marks the control invalid and describes it with the error', () => {
    render(
      <FormField
        label="Email"
        hint="Use your work address"
        error="Enter a valid email"
      >
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Use your work address Enter a valid email',
    );
  });

  it('keeps an id the caller set', () => {
    render(
      <FormField label="Email">
        <Input id="login-email" />
      </FormField>,
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'login-email');
  });

  it('has no accessibility violations with an error showing', async () => {
    const { container } = render(
      <FormField label="Email" error="Enter a valid email">
        <Input />
      </FormField>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
