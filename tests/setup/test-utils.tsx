import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { vi } from 'vitest';

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  Authenticated: ({ children }: { children: React.ReactNode }) => children,
  Unauthenticated: () => null,
}));

vi.mock('@convex-dev/auth/react', () => ({
  ConvexAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useConvexAuth: vi.fn(() => ({ isLoading: false, isAuthenticated: false })),
}));

// Custom render function (simplified without Convex providers for now)
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, options);

// Re-export everything from React Testing Library
// eslint-disable-next-line react-refresh/only-export-components -- test helper module, not a component file
export * from '@testing-library/react';
export { customRender as render };

// Helper to create mock Convex hooks
export const createMockUseQuery = <T,>(data: T | undefined = undefined) => {
  return vi.fn(() => data);
};

export const createMockUseMutation = () => {
  return vi.fn(() => vi.fn());
};

// Helper to create mock Convex context
export const mockConvexContext = {
  query: vi.fn(),
  mutation: vi.fn(),
  action: vi.fn(),
};
