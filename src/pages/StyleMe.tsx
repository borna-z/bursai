import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StyleMe() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/ai/generate', { replace: true });
  }, [navigate]);

  return null;
}
