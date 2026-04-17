import React from 'react';

interface SpinnerProps {
  message?: string;
  light?: boolean;
}

export const Spinner: React.FC<SpinnerProps> = ({ message, light }) => {
  return (
    <div className="loading-row inline-flex items-center justify-center">
      <div className={`spinner ${light ? 'border-white/30 border-t-white' : ''}`} />
      {message && <span className="ml-2">{message}</span>}
    </div>
  );
};