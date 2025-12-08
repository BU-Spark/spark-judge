import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../tests/setup/test-utils';
import { LoadingState } from '@/components/ui/LoadingState';

describe('LoadingState', () => {
  it('should render with default label', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    render(<LoadingState label="Fetching data..." />);
    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
  });

  it('should render spinner element', () => {
    const { container } = render(<LoadingState />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

