import NetInfo from '@react-native-community/netinfo';

import { log } from '../log';

export async function isOnlineNow(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return false;
    if (state.isInternetReachable === false) return false;
    return true;
  } catch (err) {
    log.error(err, { context: 'offlineQueue.connectivity.netinfo_probe_failed' });
    return true;
  }
}
