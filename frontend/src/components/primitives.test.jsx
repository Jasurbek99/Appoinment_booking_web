import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Btn, Badge, StatusBadge, Empty } from './primitives.jsx';

describe('primitives', () => {
  it('Btn renders with text', () => {
    render(<Btn>Click me</Btn>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy();
  });

  it('Badge renders with kind classes', () => {
    const { container } = render(<Badge kind="danger">x</Badge>);
    expect(container.firstChild.className).toMatch(/rose/);
  });

  it('StatusBadge maps known statuses', () => {
    const { container } = render(<StatusBadge status="approved" label="A" />);
    expect(container.firstChild.className).toMatch(/emerald/);
  });

  it('Empty renders children', () => {
    render(<Empty>nothing</Empty>);
    expect(screen.getByText('nothing')).toBeTruthy();
  });
});
