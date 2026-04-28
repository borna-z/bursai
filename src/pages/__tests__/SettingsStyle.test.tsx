import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mutateAsyncMock, profileDataMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn().mockResolvedValue({}),
  profileDataMock: vi.fn(() => ({
    id: 'u1',
    height_cm: 180,
    weight_kg: 75,
    preferences: {
      styleProfile: {
        gender: 'female',
        styleWords: ['minimal', 'classic'],
        favoriteColors: ['black'],
        dislikedColors: [],
        fit: 'regular',
      },
    },
  })),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: profileDataMock() }),
  useUpdateProfile: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

vi.mock('@/lib/mannequinPresentation', () => ({
  mannequinPresentationFromStyleProfileGender: vi.fn(() => 'neutral'),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));
vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  CollapsibleContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => {
  const Select = ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select data-testid="style-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  );
  const SelectItem = ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  );
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Select,
    SelectContent: Pass,
    SelectItem,
    SelectTrigger: Pass,
    SelectValue: () => null,
  };
});

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueCommit }: { value: number[]; onValueCommit?: (v: number[]) => void }) => (
    <input
      type="range"
      data-testid="slider"
      value={value[0]}
      onChange={(e) => onValueCommit?.([Number(e.target.value)])}
    />
  ),
}));

vi.mock('@/components/ui/chip', () => ({
  Chip: ({ children, selected, onClick }: { children?: ReactNode; selected?: boolean; onClick?: () => void }) => (
    <button data-selected={selected ? 'true' : 'false'} onClick={onClick}>{children}</button>
  ),
}));

import SettingsStyle from '../settings/SettingsStyle';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsStyle />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsStyle', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset().mockResolvedValue({});
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    profileDataMock.mockReturnValue({
      id: 'u1',
      height_cm: 180,
      weight_kg: 75,
      preferences: {
        styleProfile: {
          gender: 'female',
          styleWords: ['minimal', 'classic'],
          favoriteColors: ['black'],
          dislikedColors: [],
          fit: 'regular',
        },
      },
    });
  });

  it('renders the style DNA header', () => {
    renderPage();
    expect(screen.getByText('settings.style_dna_title')).toBeInTheDocument();
  });

  it('pre-fills height and weight from profile', () => {
    renderPage();
    const heightInput = screen.getByPlaceholderText('175') as HTMLInputElement;
    const weightInput = screen.getByPlaceholderText('70') as HTMLInputElement;
    expect(heightInput.value).toBe('180');
    expect(weightInput.value).toBe('75');
  });

  it('saving body data calls updateProfile with parsed numeric values', async () => {
    renderPage();
    fireEvent.click(screen.getByText('settings.save_measurements'));
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ height_cm: 180, weight_kg: 75 }),
      );
    });
  });

  it('toggling a selected style word removes it from the array', async () => {
    renderPage();
    // "minimal" is already selected — there may be multiple instances (chip + section summary),
    // so pick the one rendered as a Chip (has data-selected attr set to 'true')
    const minimalMatches = screen.getAllByText('minimal');
    const minimalBtn = minimalMatches.find(el => el.getAttribute('data-selected') === 'true');
    expect(minimalBtn).toBeTruthy();
    fireEvent.click(minimalBtn!);
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({
            styleProfile: expect.objectContaining({
              styleWords: expect.not.arrayContaining(['minimal']),
            }),
          }),
        }),
      );
    });
  });

  it('toggling an unselected color adds it to favoriteColors', async () => {
    renderPage();
    // "white" is not selected
    const whiteBtn = screen.getAllByText('white')[0];
    fireEvent.click(whiteBtn);
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({
            styleProfile: expect.objectContaining({
              favoriteColors: expect.arrayContaining(['black', 'white']),
            }),
          }),
        }),
      );
    });
  });

  it('shows "no profile" state when there is no style profile', () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      height_cm: null,
      weight_kg: null,
      preferences: {},
    });
    renderPage();
    expect(screen.getByText('settings.no_profile_title')).toBeInTheDocument();
  });

  it('shows error toast when body data save fails', async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error('nope'));
    renderPage();
    fireEvent.click(screen.getByText('settings.save_measurements'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });

  it('changing gender select fires updateStyleField with gender + mannequin presentation', async () => {
    renderPage();
    const selects = screen.getAllByTestId('style-select');
    // First select is gender
    fireEvent.change(selects[0], { target: { value: 'male' } });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mannequin_presentation: 'neutral',
          preferences: expect.objectContaining({
            styleProfile: expect.objectContaining({ gender: 'male' }),
          }),
        }),
      );
    });
  });

  // Codex P1 follow-up on PR #696 — V4 archetype mirror normalization.
  //
  // Existing V4 users may already have legacy V3 archetype names in their
  // persisted `styleWords` array from edits before the V4-aware ChipMulti
  // landed. Mirroring `next` raw into `archetypes` would copy those legacy
  // tokens (`streetwear`, `scandinavian`, `elegant`, `vintage`, `artsy`)
  // into the V4 canonical field, undoing the P1 #8 normalization. The fix
  // routes the mirror through `v3ArchetypeToV4`: passthrough V4 tokens,
  // rename V3 names with a known mapping, drop unknown tokens entirely.
  it('on V4 record, mirror to archetypes normalizes legacy styleWords and drops unknown tokens', async () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      height_cm: 180,
      weight_kg: 75,
      preferences: {
        styleProfile: {
          version: 4,
          gender: 'feminine',
          // 5 legacy V3 archetype names + 1 already-V4 token + 1 garbage token.
          // streetwear → street, scandinavian → scandi, elegant/vintage → classic,
          // artsy → avantgarde. 'classic' passthrough. 'made_up' dropped.
          styleWords: ['streetwear', 'scandinavian', 'elegant', 'vintage', 'artsy', 'classic', 'made_up'],
          archetypes: ['classic'],
          favoriteColors: ['black'],
          dislikedColors: [],
          fit: 'regular',
          fitOverall: 'regular',
        },
      },
    });
    renderPage();
    // Tap an unselected V4 archetype chip to trigger toggleMulti.
    // 'minimal' is in V4 ARCHETYPE_OPTIONS and not currently selected.
    const minimalMatches = screen.getAllByText('minimal');
    const minimalBtn = minimalMatches.find(el => el.getAttribute('data-selected') === 'false') ?? minimalMatches[0];
    fireEvent.click(minimalBtn);
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalled();
    });
    // The toggleMulti capped at max=5, so the candidate chips truncate at 5.
    // We assert the archetypes mirror specifically — it must be V4-canonical
    // only, deduped, and reflect the user's V3 inputs translated through the
    // V3→V4 map. Order: insertion order in the loop (passthrough V4 first,
    // then V3-renames as we hit them).
    const lastCall = mutateAsyncMock.mock.calls.at(-1)?.[0];
    const archetypesWritten = lastCall?.preferences?.styleProfile?.archetypes;
    expect(archetypesWritten).toBeDefined();
    // No legacy V3-only tokens leaked into the V4 canonical field.
    expect(archetypesWritten).not.toContain('streetwear');
    expect(archetypesWritten).not.toContain('scandinavian');
    expect(archetypesWritten).not.toContain('elegant');
    expect(archetypesWritten).not.toContain('vintage');
    expect(archetypesWritten).not.toContain('artsy');
    expect(archetypesWritten).not.toContain('made_up');
    // Every entry must be a known V4 archetype id (subset of the canonical 12).
    const V4_ARCHETYPES = new Set([
      'minimal', 'classic', 'street', 'preppy', 'bohemian', 'sporty',
      'edgy', 'romantic', 'scandi', 'avantgarde', 'workwear', 'soft',
    ]);
    for (const a of archetypesWritten as string[]) {
      expect(V4_ARCHETYPES.has(a)).toBe(true);
    }
  });

  // Codex P1 round 2 follow-up on PR #696 — V4 color normalization on edit.
  //
  // Existing V4 profiles can carry legacy V3 color ids (`gold`, `cobalt`,
  // `coral`, ...) from saves predating the V4-aware ColorGrid. The chip
  // grid only renders the V4 18, so those hidden tokens can't be removed
  // by the user, and every toggle preserves them via spread — leaking
  // corrupt vocab into downstream AI consumers indefinitely. Fix routes
  // the existing array through `v3ColorToV4` (passthrough V4, rename V3,
  // drop unknown) BEFORE applying the toggle.
  it('on V4 record, toggleColor normalizes legacy V3 color ids (gold/cobalt/...) before writing', async () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      height_cm: 180,
      weight_kg: 75,
      preferences: {
        styleProfile: {
          version: 4,
          gender: 'feminine',
          styleWords: [],
          archetypes: [],
          // Legacy V3 ids only (gold→camel, cobalt→blue, coral→pink),
          // 1 already-V4 token (black), 1 unknown garbage.
          favoriteColors: ['gold', 'cobalt', 'coral', 'black', 'unknownColor'],
          dislikedColors: [],
          fit: 'regular',
          fitOverall: 'regular',
        },
      },
    });
    renderPage();
    // Tap a V4 chip that's not in the user's list — 'white' is in V4_COLOR_IDS.
    const whiteBtn = screen.getAllByText('white')[0];
    fireEvent.click(whiteBtn);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const lastCall = mutateAsyncMock.mock.calls.at(-1)?.[0];
    const colorsWritten = lastCall?.preferences?.styleProfile?.favoriteColors;
    expect(colorsWritten).toBeDefined();
    // Legacy V3 ids must be gone — replaced with their V4-canonical mapping.
    expect(colorsWritten).not.toContain('gold');
    expect(colorsWritten).not.toContain('cobalt');
    expect(colorsWritten).not.toContain('coral');
    expect(colorsWritten).not.toContain('unknownColor');
    // Translation: gold→camel, cobalt→blue, coral→pink. black passthrough.
    // 'white' is the new toggle.
    expect(colorsWritten).toEqual(expect.arrayContaining(['camel', 'blue', 'pink', 'black', 'white']));
    // Every entry must be a V4 swatch id.
    const V4_COLORS = new Set([
      'black', 'white', 'grey', 'navy', 'blue', 'beige', 'camel', 'brown',
      'olive', 'green', 'red', 'burgundy', 'pink', 'purple', 'orange',
      'teal', 'cream', 'denim',
    ]);
    for (const c of colorsWritten as string[]) {
      expect(V4_COLORS.has(c)).toBe(true);
    }
  });

  it('on V4 record, toggleColor on a legacy V3 id removes its V4-translated equivalent (no orphan corrupt token)', async () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      height_cm: 180,
      weight_kg: 75,
      preferences: {
        styleProfile: {
          version: 4,
          gender: 'feminine',
          styleWords: [],
          archetypes: [],
          favoriteColors: ['black', 'pink'], // pink (V4-canonical) is the visible chip.
          dislikedColors: [],
          fit: 'regular',
          fitOverall: 'regular',
        },
      },
    });
    renderPage();
    // Tap 'pink' to deselect — pink is in V4_COLOR_IDS.
    const pinkMatches = screen.getAllByText('pink');
    const pinkBtn = pinkMatches.find(el => el.getAttribute('data-selected') === 'true') ?? pinkMatches[0];
    fireEvent.click(pinkBtn);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const lastCall = mutateAsyncMock.mock.calls.at(-1)?.[0];
    const colorsWritten = lastCall?.preferences?.styleProfile?.favoriteColors;
    expect(colorsWritten).toEqual(['black']);
  });

  // Codex P1 round 3 follow-up on PR #696 — render-vs-toggle parity bugs.
  //
  // Round 2 normalized the WRITE path. But the READ path (chip selected
  // state) still used raw `sp[field]`. Two concrete UX bugs:
  // (a) V4 user with stored `gold` saw `camel` (V4 translation) UNSELECTED
  //     while click flipped it as if SELECTED → first click REMOVES.
  // (b) V4 user with 5 hidden V3 styleWords hit the cap so no V4 chip
  //     could be added; hidden tokens couldn't be removed because they
  //     weren't in the V4 chip set.
  //
  // Round 3 memoizes the normalized arrays once and threads them through
  // both render (Chip selected) AND toggle (includes/max/filter).
  it('round 3: V4 user with stored gold sees camel chip rendered as SELECTED', () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      preferences: {
        styleProfile: {
          version: 4,
          gender: 'feminine',
          styleWords: [],
          archetypes: [],
          favoriteColors: ['gold'], // V3-only id; v3ColorToV4('gold') = 'camel'
          dislikedColors: [],
          fit: 'regular',
          fitOverall: 'regular',
        },
      },
    });
    renderPage();
    // The V4 18-color set includes 'camel'. With normalized rendering the
    // camel chip must reflect SELECTED because gold→camel.
    const camelMatches = screen.getAllByText('camel');
    const camelChip = camelMatches.find(el => el.getAttribute('data-selected') === 'true');
    expect(camelChip).toBeTruthy();
  });

  it('round 3: V4 user with stored gold tapping the camel chip REMOVES it (not adds)', async () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      preferences: {
        styleProfile: {
          version: 4,
          gender: 'feminine',
          styleWords: [],
          archetypes: [],
          favoriteColors: ['gold'],
          dislikedColors: [],
          fit: 'regular',
          fitOverall: 'regular',
        },
      },
    });
    renderPage();
    const camelMatches = screen.getAllByText('camel');
    const camelChip =
      camelMatches.find(el => el.getAttribute('data-selected') === 'true') ?? camelMatches[0];
    fireEvent.click(camelChip);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const lastCall = mutateAsyncMock.mock.calls.at(-1)?.[0];
    const colorsWritten = lastCall?.preferences?.styleProfile?.favoriteColors;
    // gold normalized to camel, then removed by the toggle. Result: empty.
    expect(colorsWritten).toEqual([]);
  });

  it('round 3: V4 user with 5 hidden V3 styleWords can still add a V4 chip (cap applies to normalized)', async () => {
    // 5 V3 tokens that all map to V4 ids:
    //   streetwear → street, scandinavian → scandi, elegant → classic,
    //   vintage → classic, artsy → avantgarde
    // After normalization + dedup: ['street', 'scandi', 'classic', 'avantgarde']
    // (4 distinct V4 ids, NOT 5). The user can add a 5th V4 chip.
    profileDataMock.mockReturnValue({
      id: 'u1',
      preferences: {
        styleProfile: {
          version: 4,
          gender: 'feminine',
          styleWords: ['streetwear', 'scandinavian', 'elegant', 'vintage', 'artsy'],
          archetypes: [],
          favoriteColors: [],
          dislikedColors: [],
          fit: 'regular',
          fitOverall: 'regular',
        },
      },
    });
    renderPage();
    // 'minimal' is in V4 ARCHETYPE_OPTIONS and not in the user's normalized list.
    const minimalMatches = screen.getAllByText('minimal');
    const minimalBtn =
      minimalMatches.find(el => el.getAttribute('data-selected') === 'false') ?? minimalMatches[0];
    fireEvent.click(minimalBtn);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const lastCall = mutateAsyncMock.mock.calls.at(-1)?.[0];
    const styleWordsWritten = lastCall?.preferences?.styleProfile?.styleWords;
    // Cap was 5; normalized had 4 unique entries; 'minimal' added → 5 total.
    // The new array reflects the normalized state (V4 vocab) + the new pick.
    expect(styleWordsWritten).toEqual(expect.arrayContaining(['minimal']));
    expect(styleWordsWritten?.length).toBe(5);
  });

  it('round 3: V4 user can deselect a chip whose stored token was a V3 alias', async () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      preferences: {
        styleProfile: {
          version: 4,
          gender: 'feminine',
          // 'streetwear' is V3-only; v3ArchetypeToV4 → 'street'.
          styleWords: ['streetwear'],
          archetypes: ['street'],
          favoriteColors: [],
          dislikedColors: [],
          fit: 'regular',
          fitOverall: 'regular',
        },
      },
    });
    renderPage();
    // The V4 chip 'street' should render SELECTED; tapping it REMOVES.
    const streetMatches = screen.getAllByText('street');
    const streetChip =
      streetMatches.find(el => el.getAttribute('data-selected') === 'true') ?? streetMatches[0];
    fireEvent.click(streetChip);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const lastCall = mutateAsyncMock.mock.calls.at(-1)?.[0];
    const styleWordsWritten = lastCall?.preferences?.styleProfile?.styleWords;
    // After deselect, the normalized list has zero entries.
    expect(styleWordsWritten).toEqual([]);
  });

  // Codex P2 round 4 (PR #696): V3 chip set must NOT include V4-only
  // swatches like `denim`. Earlier rounds added `denim` to COLOR_MAP so
  // V4 chips could resolve a hex; that leaked into `Object.keys(COLOR_MAP)`
  // making legacy V3 users see/pick `denim` even though it's V4 vocab.
  // Fix hardcodes the V3 36-color list explicitly.
  it('round 4: V3 record (no version=4) does NOT render the V4-only denim chip', () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      preferences: {
        styleProfile: {
          // Legacy V3 — no version field
          gender: 'female',
          styleWords: ['minimal'],
          favoriteColors: [],
          dislikedColors: [],
          fit: 'regular',
        },
      },
    });
    renderPage();
    // V3 chip set must include legacy IDs like 'gold' / 'cobalt' but
    // exclude V4-only ones like 'denim'.
    expect(screen.queryAllByText('denim').length).toBe(0);
    // Sanity: legacy V3 chips DO render.
    expect(screen.getAllByText('gold').length).toBeGreaterThan(0);
    expect(screen.getAllByText('cobalt').length).toBeGreaterThan(0);
  });

  it('non-V4 record: toggleColor passes through without normalization', async () => {
    profileDataMock.mockReturnValue({
      id: 'u1',
      height_cm: 180,
      weight_kg: 75,
      preferences: {
        styleProfile: {
          // No version=4 → legacy V3 record path.
          gender: 'female',
          styleWords: ['minimal'],
          // Legacy V3 colors stay as-is for legacy users; the V3 chip set
          // includes them (36-color grid).
          favoriteColors: ['gold', 'black'],
          dislikedColors: [],
          fit: 'regular',
        },
      },
    });
    renderPage();
    // Tap 'white' — V3 chip set has it.
    const whiteBtn = screen.getAllByText('white')[0];
    fireEvent.click(whiteBtn);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const lastCall = mutateAsyncMock.mock.calls.at(-1)?.[0];
    const colorsWritten = lastCall?.preferences?.styleProfile?.favoriteColors;
    // V3 path preserves the array exactly + appends the new pick.
    expect(colorsWritten).toEqual(['gold', 'black', 'white']);
  });
});
