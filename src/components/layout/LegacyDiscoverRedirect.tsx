import { Navigate, useLocation } from 'react-router-dom';

export function LegacyDiscoverRedirect() {
  const location = useLocation();

  return (
    <Navigate
      replace
      to={{
        pathname: '/gaps',
        search: location.search,
        hash: location.hash,
      }}
    />
  );
}
