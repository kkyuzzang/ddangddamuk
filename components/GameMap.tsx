import React from 'react';
import { Land, Player, CombatEvent } from '../types';

interface GameMapProps {
  lands: Land[];
  players: Player[];
  myPlayerId?: string;
  onLandClick?: (landId: number) => void;
  selectable?: boolean;
  selectedLandIds?: number[];
  combatEvents?: CombatEvent[]; // For animations
}

export const GameMap: React.FC<GameMapProps> = ({ 
  lands, 
  players, 
  myPlayerId, 
  onLandClick, 
  selectable,
  selectedLandIds = [],
  combatEvents = []
}) => {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 p-4 bg-gray-200 rounded-xl shadow-inner max-h-[60vh] overflow-y-auto">
      {lands.map((land) => {
        const owner = players.find(p => p.id === land.ownerId);
        const isMine = owner?.id === myPlayerId;
        const isSelected = selectedLandIds.includes(land.id);
        
        let bgColor = 'bg-white';
        let borderColor = 'border-gray-300';
        
        if (owner) {
           bgColor = owner.color;
           borderColor = 'border-white';
        }

        // Animation logic based on combat events
        const event = combatEvents.find(e => e.landId === land.id);
        let animationClass = '';
        let overlayContent = null;

        if (event) {
          if (event.type === 'CONQUERED') {
            animationClass = 'animate-bounce ring-4 ring-yellow-300 z-20';
            overlayContent = <span className="text-2xl animate-ping absolute">💥</span>;
          } else if (event.type === 'DEFENDED') {
            animationClass = 'animate-pulse ring-4 ring-blue-400 z-20';
            overlayContent = <span className="text-3xl absolute scale-150">🛡️</span>;
          } else if (event.type === 'PIERCED') {
             animationClass = 'animate-shake ring-4 ring-red-500 z-20';
             overlayContent = <span className="text-3xl absolute">💔</span>;
          }
        }

        return (
          <button
            key={land.id}
            onClick={() => onLandClick && onLandClick(land.id)}
            disabled={!selectable}
            className={`
              relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-300
              ${bgColor} 
              ${borderColor}
              ${isSelected ? 'ring-4 ring-yellow-400 z-10 scale-105' : 'hover:opacity-90'}
              ${!owner ? 'opacity-50' : ''}
              ${selectable ? 'cursor-pointer' : 'cursor-default'}
              ${animationClass}
            `}
          >
            <span className="text-xs font-bold text-white/80 absolute top-1 left-1">#{land.id + 1}</span>
            
            {owner && (
              <span className={`text-2xl shadow-sm filter drop-shadow-md transition-transform duration-500 ${event?.type === 'CONQUERED' ? 'scale-125' : ''}`}>
                {owner.avatar}
              </span>
            )}

            {isMine && !event && (
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-white rounded-full animate-pulse" />
            )}
            
            {land.isLocked && !event && (
               <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
                  <span className="text-xl">🛡️</span>
               </div>
            )}

            {overlayContent}
          </button>
        );
      })}
    </div>
  );
};