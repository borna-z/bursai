import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HomeAskBursRail } from '../HomeAskBursRail';

const suggestions = [
  { id: 'one', text: 'Prompt one', route: 'chat' as const, prefillMessage: 'Prompt one' },
  { id: 'two', text: 'Prompt two', route: 'chat' as const, prefillMessage: 'Prompt two' },
  { id: 'three', text: 'Prompt three', route: 'chat' as const, prefillMessage: 'Prompt three' },
  { id: 'four', text: 'Prompt four', route: 'chat' as const, prefillMessage: 'Prompt four' },
];

describe('HomeAskBursRail', () => {
  it('shows at most three visible suggestions', () => {
    render(
      <HomeAskBursRail
        suggestions={suggestions}
        onSelectSuggestion={vi.fn()}
      />,
    );

    expect(screen.getByText('Prompt one')).toBeInTheDocument();
    expect(screen.getByText('Prompt two')).toBeInTheDocument();
    expect(screen.getByText('Prompt three')).toBeInTheDocument();
    expect(screen.queryByText('Prompt four')).not.toBeInTheDocument();
  });

  it('calls back with the selected suggestion', () => {
    const onSelectSuggestion = vi.fn();

    render(
      <HomeAskBursRail
        suggestions={suggestions}
        onSelectSuggestion={onSelectSuggestion}
      />,
    );

    fireEvent.click(screen.getByText('Prompt two'));
    expect(onSelectSuggestion).toHaveBeenCalledWith(suggestions[1]);
  });
});
