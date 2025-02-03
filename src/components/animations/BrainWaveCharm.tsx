import React from 'react';
import { Brain } from 'lucide-react';

interface BrainWaveCharmProps {
  isLoading?: boolean;
}

const BrainWaveCharm: React.FC<BrainWaveCharmProps> = ({ isLoading = false }) => {
  return (
    <div className="flex items-center">
      <div className="relative font-bold tracking-wider text-3xl text-teal-600 dark:text-teal-400 flex items-center">
        <div className="relative inline-flex items-center mr-4">
          <Brain 
            size={32} 
            className={`text-teal-500 dark:text-teal-300 ${isLoading ? 'animate-pulse' : ''}`} 
          />
          {isLoading && [1, 2, 3].map((ring) => (
            <div
              key={ring}
              className="absolute inset-0 border-2 border-teal-200 dark:border-teal-600 rounded-full animate-ripple"
              style={{
                animationDelay: `${ring * 0.3}s`
              }}
            />
          ))}
        </div>
        <span className="inline-flex items-center">CHARM</span>
      </div>
    </div>
  );
};

export default BrainWaveCharm; 