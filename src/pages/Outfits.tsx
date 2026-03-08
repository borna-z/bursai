import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OutfitsPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/wardrobe', { replace: true, state: { tab: 'outfits' } });
  }, [navigate]);

  return null;
}
