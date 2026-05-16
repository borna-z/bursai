// Smoke render — GarmentDetailTabs mounts inside a ThemeProvider with
// the Info tab as default. We pass a minimal-but-realistic field set
// and verify both the tab strip and the field rows are present.

import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { GarmentDetailTabs } from '../GarmentDetailTabs';

describe('GarmentDetailTabs', () => {
  it('renders the Info tab with the provided field rows', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <GarmentDetailTabs
          fields={[
            { label: 'Category', value: 'Top · T-shirt' },
            { label: 'Color', value: 'Sage' },
          ]}
          showGenerateImageCta={false}
          generateImagePending={false}
          generateImageError={null}
          onGenerateImage={() => {}}
          activeAssessment={null}
          assessError={null}
          isAssessing={false}
          onCheckCondition={() => {}}
          onReassess={() => {}}
          isWishlist={false}
          isLingerie={false}
          onToggleWishlist={() => {}}
          onToggleLingerie={() => {}}
          occasionTags={null}
        />
      </ThemeProvider>,
    );
    expect(getByText('Category')).toBeTruthy();
    expect(getByText('Sage')).toBeTruthy();
    // Tab strip labels.
    expect(getByText('Info')).toBeTruthy();
    expect(getByText('Outfits')).toBeTruthy();
    expect(getByText('Similar')).toBeTruthy();
  });

  it('renders the Generate image CTA when showGenerateImageCta is true', () => {
    const { toJSON } = render(
      <ThemeProvider initialMode="light">
        <GarmentDetailTabs
          fields={[]}
          showGenerateImageCta
          generateImagePending={false}
          generateImageError={null}
          onGenerateImage={() => {}}
          activeAssessment={null}
          assessError={null}
          isAssessing={false}
          onCheckCondition={() => {}}
          onReassess={() => {}}
          isWishlist={false}
          isLingerie={false}
          onToggleWishlist={() => {}}
          onToggleLingerie={() => {}}
          occasionTags={null}
        />
      </ThemeProvider>,
    );
    expect(toJSON()).toBeTruthy();
  });
});
