import React from 'react';
import { Brain } from 'lucide-react';

const BrainWaveCharmStatic: React.FC = () => {
  return (
    <div className="flex items-center">
      <div className="relative font-bold tracking-wider flex items-center">
        <div className="relative inline-flex items-center">
          <Brain 
            size={24} 
            className="stroke-[#4F46E5] stroke-2" 
          />
        </div>
        <span className="ml-2 text-xl font-semibold bg-gradient-to-r from-[#4F46E5] to-[#6366F1] bg-clip-text text-transparent">CHARM GPT</span>
      </div>
    </div>
  );
};

export default BrainWaveCharmStatic; 