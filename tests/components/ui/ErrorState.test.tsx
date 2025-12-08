import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../tests/setup/test-utils';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '@/components/ui/ErrorState';

describe('ErrorState', () => {
  it('should render with default props', () => {
    const onAction = vi.fn();
    render(<ErrorState onAction={onAction} />);
    expect(screen.getByText('Unable to load content')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Please try again or contact support if the issue persists.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should render with custom title', () => {
    render(<ErrorState title="Custom Error Title" />);
    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
  });

  it('should render with custom description', () => {
    render(<ErrorState description="Custom error description" />);
    expect(screen.getByText('Custom error description')).toBeInTheDocument();
  });

  it('should render with custom action label', () => {
    const onAction = vi.fn();
    render(<ErrorState actionLabel="Try Again" onAction={onAction} />);
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should call onAction when button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<ErrorState onAction={onAction} />);

    const button = screen.getByText('Retry');
    await user.click(button);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('should not render action button when onAction is not provided', () => {
    render(<ErrorState onAction={undefined} />);
    const button = screen.queryByText('Retry');
    expect(button).not.toBeInTheDocument();
  });
});

