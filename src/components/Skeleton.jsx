/**
 * Skeleton loading components with shimmer animation
 */

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// Inject keyframes into document head (once)
if (typeof document !== 'undefined' && !document.getElementById('skeleton-styles')) {
  const style = document.createElement('style');
  style.id = 'skeleton-styles';
  style.textContent = shimmerKeyframes;
  document.head.appendChild(style);
}

const baseStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '4px'
};

/**
 * Basic skeleton line
 */
export function SkeletonText({ width = '100%', height = '16px', style = {} }) {
  return (
    <div style={{ ...baseStyle, width, height, ...style }} />
  );
}

/**
 * Skeleton for a card/box
 */
export function SkeletonCard({ width = '100%', height = '80px', style = {} }) {
  return (
    <div style={{
      ...baseStyle,
      width,
      height,
      borderRadius: '10px',
      ...style
    }} />
  );
}

/**
 * Skeleton for table row
 */
export function SkeletonTableRow({ columns = 4 }) {
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonText
          key={i}
          width={i === 0 ? '40%' : `${60 / (columns - 1)}%`}
          height="14px"
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for inventory item
 */
export function SkeletonInventoryItem() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '10px',
      padding: '15px',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SkeletonText width="60%" height="18px" style={{ marginBottom: '8px' }} />
          <SkeletonText width="40%" height="14px" />
        </div>
        <SkeletonText width="80px" height="30px" style={{ borderRadius: '6px' }} />
      </div>
    </div>
  );
}

/**
 * Skeleton for receipt history item
 */
export function SkeletonReceiptItem() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '10px',
      padding: '15px',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <SkeletonText width="100px" height="16px" />
        <SkeletonText width="80px" height="16px" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <SkeletonText width="150px" height="14px" />
        <SkeletonText width="60px" height="14px" />
      </div>
    </div>
  );
}

/**
 * Full page loading skeleton
 */
export function SkeletonPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '20px',
      fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <SkeletonCard width="50px" height="50px" style={{ borderRadius: '12px' }} />
          <div>
            <SkeletonText width="180px" height="24px" style={{ marginBottom: '6px' }} />
            <SkeletonText width="120px" height="14px" />
          </div>
        </div>
        <SkeletonText width="100px" height="36px" style={{ borderRadius: '8px' }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
        {[1, 2, 3, 4].map(i => (
          <SkeletonText key={i} width="100px" height="40px" style={{ borderRadius: '8px' }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', gap: '30px' }}>
        {/* Left panel */}
        <div style={{ flex: 1 }}>
          <SkeletonCard height="200px" style={{ marginBottom: '20px' }} />
          <SkeletonCard height="300px" />
        </div>
        {/* Right panel */}
        <div style={{ width: '350px' }}>
          <SkeletonCard height="400px" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for loading list items
 */
export function SkeletonList({ count = 5, type = 'inventory' }) {
  const Component = type === 'receipt' ? SkeletonReceiptItem : SkeletonInventoryItem;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </>
  );
}
