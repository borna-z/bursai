import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LinkImportForm } from '@/components/LinkImportForm';

const { invalidateQueriesMock, invokeMock } = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/hooks/useSubscription', () => ({
  PLAN_LIMITS: { free: { maxGarments: 10 } },
  useSubscription: () => ({
    canAddGarment: () => true,
    subscription: { garments_count: 0 },
    isPremium: true,
  }),
}));

vi.mock('@/components/PaywallModal', () => ({
  PaywallModal: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ then: vi.fn((cb: () => void) => { cb(); }) }) }),
    }),
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  };
});

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LinkImportForm />
    </QueryClientProvider>
  );
}

describe('LinkImportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue({
      data: { results: [{ status: 'ok', title: 'Imported garment' }] },
      error: null,
    });
  });

  it('invalidates ai suggestions after a successful link import', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText('import.paste_links'), { target: { value: 'https://example.com/item' } });
    fireEvent.click(screen.getByRole('button', { name: 'import.import_links' }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['garments', 'user-1'] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['garments-count', 'user-1'] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['ai-suggestions'] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['subscription', 'user-1'] });
  });
});
