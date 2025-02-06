import React from 'react';
import { Brain } from 'lucide-react';

interface BrainWaveCharmProps {
  isLoading?: boolean;
}

const BrainWaveCharm: React.FC<BrainWaveCharmProps> = ({ isLoading = false }) => {
  return (
    <div className="flex items-center">
      <div className="relative font-bold tracking-wider flex items-center">
        <div className="relative inline-flex items-center mr-4">
          <Brain 
            size={32} 
            className={`stroke-[#4F46E5] stroke-2 ${isLoading ? 'animate-pulse' : ''}`} 
          />
          {isLoading && [1, 2, 3].map((ring) => (
            <div
              key={ring}
              className="absolute inset-0 border-2 border-[#4F46E5]/20 dark:border-[#4F46E5]/30 rounded-full animate-ripple"
              style={{
                animationDelay: `${ring * 0.3}s`
              }}
            />
          ))}
        </div>
        <span className="inline-flex items-center bg-gradient-to-r from-[#4F46E5] to-[#6366F1] bg-clip-text text-transparent text-3xl">CHARM GPT</span>
      </div>
    </div>
  );
};

export default BrainWaveCharm; 