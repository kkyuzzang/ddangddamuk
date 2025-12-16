import { GameState, Player, Land, CombatEvent } from '../types';
import { COIN_COSTS } from '../constants';

// Helper to generate initial map
export const generateMap = (size: number): Land[] => {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    ownerId: null,
    isLocked: false,
  }));
};

// Assign lands to players initially (4 each)
export const assignInitialLands = (lands: Land[], players: Player[]): Land[] => {
  const newLands = [...lands];
  const availableIndices = newLands.map((_, i) => i);
  
  // Shuffle available indices
  for (let i = availableIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
  }

  let head = 0;
  players.forEach(p => {
    p.lands = [];
    for (let k = 0; k < 4; k++) {
      if (head < availableIndices.length) {
        const landIndex = availableIndices[head];
        newLands[landIndex].ownerId = p.id;
        p.lands.push(landIndex);
        head++;
      }
    }
  });

  return newLands;
};

export const resolveTurn = (currentState: GameState): { nextState: GameState, messages: string[] } => {
  const nextState = JSON.parse(JSON.stringify(currentState)) as GameState;
  const messages: string[] = [];
  const combatEvents: CombatEvent[] = [];

  // 1. Reset Defenses & Locks from previous rounds visual
  nextState.lands.forEach(l => l.isLocked = false);

  // 2. Process Shop & Defense Declarations first
  nextState.players.forEach(p => {
    if (p.selectedAction === 'DEFEND') {
      p.isDefending = true;
      messages.push(`${p.name}님이 방어 태세를 갖췄습니다!`);
    } else {
      p.isDefending = false;
    }

    // Shop: Buy Land (Revival or Expansion)
    if (p.pendingShop === 'BUY_LAND') {
      if (p.coins >= COIN_COSTS.BUY_LAND) {
        // Find a random empty land
        const emptyLands = nextState.lands.filter(l => l.ownerId === null);
        if (emptyLands.length > 0) {
           const target = emptyLands[Math.floor(Math.random() * emptyLands.length)];
           target.ownerId = p.id;
           p.coins -= COIN_COSTS.BUY_LAND;
           messages.push(`${p.name}님이 빈 땅(Land #${target.id + 1})을 구매했습니다!`);
           combatEvents.push({ landId: target.id, type: 'CONQUERED' });
        } else {
           messages.push(`${p.name}님이 땅을 구매하려 했으나 빈 땅이 없습니다.`);
           p.coins += 0; 
        }
      }
    }
  });

  // 3. Process Attacks
  // Group attacks by target land
  const attacksOnLand: Record<number, { attackerId: string, hasPierce: boolean }[]> = {};

  nextState.players.forEach(attacker => {
    attacker.pendingAttacks.forEach(landId => {
      if (!attacksOnLand[landId]) attacksOnLand[landId] = [];
      const hasPierce = attacker.pendingShop === 'PIERCE' && attacker.coins >= COIN_COSTS.PIERCE_DEFENSE;
      
      attacksOnLand[landId].push({ attackerId: attacker.id, hasPierce });
    });

    // Deduct coins for pierce if it was active
    if (attacker.pendingShop === 'PIERCE' && attacker.coins >= COIN_COSTS.PIERCE_DEFENSE) {
       attacker.coins -= COIN_COSTS.PIERCE_DEFENSE;
       messages.push(`${attacker.name}님이 [방어 관통] 아이템을 사용했습니다!`);
    }
  });

  // Resolve conflicts
  Object.keys(attacksOnLand).forEach(landIdStr => {
    const landId = parseInt(landIdStr);
    const attacks = attacksOnLand[landId];
    const land = nextState.lands[landId];
    const currentOwner = nextState.players.find(p => p.id === land.ownerId);

    // Filter out blocked attacks
    const validAttacks = attacks.filter(atk => {
      // If land is empty, attack is valid
      if (!currentOwner) return true;
      // If attacker is owner, ignore
      if (atk.attackerId === currentOwner.id) return false;
      
      // Check defense
      if (currentOwner.isDefending) {
        if (atk.hasPierce) {
          messages.push(`땅 #${landId + 1}에 대한 공격이 방어를 뚫었습니다!`);
          combatEvents.push({ landId, type: 'PIERCED' });
          return true;
        } else {
          messages.push(`땅 #${landId + 1} 공격이 ${currentOwner.name}님의 방어에 막혔습니다.`);
          combatEvents.push({ landId, type: 'DEFENDED' });
          return false;
        }
      }
      return true;
    });

    if (validAttacks.length > 0) {
      // Pick random winner among valid attackers
      const winnerIndex = Math.floor(Math.random() * validAttacks.length);
      const winnerId = validAttacks[winnerIndex].attackerId;
      const winner = nextState.players.find(p => p.id === winnerId);
      
      if (winner) {
        // Change ownership
        const oldOwnerName = currentOwner ? currentOwner.name : "주인 없음";
        land.ownerId = winnerId;
        messages.push(`${winner.name}님이 ${oldOwnerName}의 땅 #${landId + 1}을(를) 정복했습니다!`);
        combatEvents.push({ landId, type: 'CONQUERED' });
      }
    } else if (attacks.length > 0 && !combatEvents.find(e => e.landId === landId && e.type === 'DEFENDED')) {
       // All attacks were invalid (e.g. self attacks) or blocked silently?
       // Usually covered by 'DEFENDED', but if multiple people attacked and all blocked, we handled it.
    }
  });

  // 4. Update Player Land Counts & Elimination Status
  nextState.players.forEach(p => {
    p.lands = nextState.lands
      .filter(l => l.ownerId === p.id)
      .map(l => l.id);
    
    // Reset temporary round states
    p.lastAnswerCorrect = undefined;
    p.selectedAction = undefined;
    p.pendingAttacks = [];
    p.pendingShop = null;
    p.isDefending = false;

    // Check elimination
    p.isEliminated = p.lands.length === 0;
  });

  nextState.lastRoundEvents = combatEvents;

  return { nextState, messages };
};