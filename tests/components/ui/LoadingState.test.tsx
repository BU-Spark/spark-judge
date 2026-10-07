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

  it('should announce loading status politely', () => {
    render(<LoadingState />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Loading...');
  });
});
