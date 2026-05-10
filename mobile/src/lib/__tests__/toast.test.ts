// N3b — Tests for the toast helper wrapper.
//
// Asserts (1) showToast forwards kind + message + description with the right
// position/timing knobs, (2) showToast swallows underlying lib failures so a
// missing host can't crash the app, and (3) hideToast forwards.

import Toast from 'react-native-toast-message';

import { hideToast, showToast } from '../toast';

const mockShow = Toast.show as jest.Mock;
const mockHide = Toast.hide as jest.Mock;

beforeEach(() => {
  mockShow.mockReset();
  mockHide.mockReset();
});

describe('showToast', () => {
  it('forwards type + text1 + text2 with bottom positioning', () => {
    showToast('success', 'Saved', 'Outfit added to plan');

    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        text1: 'Saved',
        text2: 'Outfit added to plan',
        position: 'bottom',
      }),
    );
  });

  it('uses 4 s visibility for errors and 3 s for success/info', () => {
    showToast('error', 'Failed');
    showToast('success', 'Saved');
    showToast('info', 'Heads up');

    expect(mockShow.mock.calls[0][0].visibilityTime).toBe(4000);
    expect(mockShow.mock.calls[1][0].visibilityTime).toBe(3000);
    expect(mockShow.mock.calls[2][0].visibilityTime).toBe(3000);
  });

  it('swallows underlying lib failures rather than throwing', () => {
    mockShow.mockImplementationOnce(() => {
      throw new Error('host not mounted');
    });

    expect(() => showToast('error', 'oops')).not.toThrow();
  });
});

describe('hideToast', () => {
  it('forwards to Toast.hide', () => {
    hideToast();
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('swallows underlying lib failures', () => {
    mockHide.mockImplementationOnce(() => {
      throw new Error('host not mounted');
    });

    expect(() => hideToast()).not.toThrow();
  });
});
