interface TravelEmptyStateProps {
  onStartForm: () => void;
}

export function TravelEmptyState({ onStartForm }: TravelEmptyStateProps) {
  return (
    <div
      style={{
        backgroundColor: '#F5F0E8',
        padding: '40px 0 32px',
        textAlign: 'center',
      }}
    >
      <h2 style={{
        fontFamily: '"Playfair Display", serif',
        fontStyle: 'italic',
        fontSize: 26,
        color: '#1C1917',
        marginBottom: 12,
        lineHeight: 1.3,
      }}>
        Pack less. Dress better.
      </h2>
      <p style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 14,
        color: 'rgba(28,25,23,0.5)',
        lineHeight: 1.6,
        maxWidth: 300,
        margin: '0 auto 24px',
      }}>
        Tell us your destination and days — we'll build a capsule from your wardrobe.
      </p>
      <button
        onClick={onStartForm}
        style={{
          backgroundColor: '#1C1917',
          color: 'white',
          border: 'none',
          borderRadius: 0,
          padding: '14px 32px',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Build a capsule
      </button>
    </div>
  );
}
