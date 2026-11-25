/** App-only content wrapper (phone width; no website max-width/breakpoint padding). */
export const Container = ({ children, className = '' }) => <div className={`w-full px-4 ${className}`}>{children}</div>;
