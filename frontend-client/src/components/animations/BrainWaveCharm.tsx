import React, { useEffect } from 'react';
import { Brain } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

// Remove isLoading from props since we'll get it from store
interface BrainWaveCharmProps {}

// C(-.-.)-H(....)-A(.-)-R(.-.)-M(--) GPT(--./.--./-) 
const morseWidths = [
  // C: -.-.
  'border-4', 'border', 'border-4', 'border',
  // H: ....
  'border', 'border', 'border', 'border',
  // A: .-
  'border', 'border-4',
  // R: .-.
  'border', 'border-4', 'border',
  // M: --
  'border-4', 'border-4',
  // Space
  'border-0',
  // G: --.
  'border-4', 'border-4', 'border',
  // P: .--.
  'border', 'border-4', 'border-4', 'border',
  // T: -
  'border-4'
];

const BrainWaveCharm: React.FC<BrainWaveCharmProps> = () => {
  // Get isLoading directly from store
  const isLoading = useChatStore(state => state.isLoading);
  
  
  return (
    <div className="flex items-center">
      <div className="relative font-bold tracking-wider flex items-center">
        <div className="relative inline-flex items-center mr-4">
          <Brain 
            size={32} 
            className={`stroke-[#4F46E5] stroke-2 ${isLoading ? 'animate-pulse' : ''}`} 
          />
          {isLoading && morseWidths.map((width, index) => (
            <div
              key={index}
              className={`absolute inset-0 ${width} border-[#4F46E5]/20 dark:border-[#4F46E5]/30 rounded-full animate-ripple`}
              style={{
                animationDelay: `${index * 0.5}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
        <span className="inline-flex items-center bg-gradient-to-r from-[#4F46E5] to-[#6366F1] bg-clip-text text-transparent text-3xl">CHARM-MCP</span>
      </div>
    </div>
  );
};

export default BrainWaveCharm; 