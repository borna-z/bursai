// Re-export so screens can `import { useAuth } from '../hooks/useAuth'` —
// keeps the import surface consistent with other hooks (useMockRefresh etc.).
export { useAuth } from '../contexts/AuthContext';
