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

  // 2. Validate Actions based on Quiz Result
  nextState.players.forEach(p => {
    // Rule Enforcement
    if (p.lastAnswerCorrect) {
        // Correct: Can Defend OR Attack up to 2.
        // Logic handled in UI, but strictly: if defending, set flag.
        if (p.selectedAction === 'DEFEND') {
             p.isDefending = true;
             messages.push(`🛡️ ${p.name}: 정답 보너스로 방어 태세!`);
        }
    } else {
        // Incorrect: Cannot Defend. Max 1 Attack.
        p.isDefending = false; 
        if (p.selectedAction === 'DEFEND') {
            p.selectedAction = 'WAITING'; // Force cancel defense if incorrect
            messages.push(`❌ ${p.name}: 오답이라 방어 실패.`);
        }
        if (p.pendingAttacks.length > 1) {
            p.pendingAttacks = [p.pendingAttacks[0]]; // Force reduce attacks to 1
        }
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
           messages.push(`💰 ${p.name}: 빈 땅(No.${target.id + 1}) 구매 성공!`);
           combatEvents.push({ landId: target.id, type: 'CONQUERED', attackerName: p.name });
        } else {
           messages.push(`💸 ${p.name}: 빈 땅이 없어 구매 취소 (코인 반환).`);
           // Refund implies simply not deducting
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
       messages.push(`🗡️ ${attacker.name}: [방어 관통] 아이템 사용!`);
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
          messages.push(`💥 ${landId + 1}번 땅: 방어 관통!`);
          combatEvents.push({ landId, type: 'PIERCED', defenderName: currentOwner.name });
          return true;
        } else {
          messages.push(`🛡️ ${landId + 1}번 땅: ${currentOwner.name}님이 방어 성공!`);
          combatEvents.push({ landId, type: 'DEFENDED', defenderName: currentOwner.name });
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
        messages.push(`🚩 ${winner.name}님이 ${oldOwnerName}의 땅(${landId + 1})을 점령!`);
        combatEvents.push({ landId, type: 'CONQUERED', attackerName: winner.name, defenderName: currentOwner?.name });
      }
    } else if (attacks.length > 0 && !combatEvents.find(e => e.landId === landId && e.type === 'DEFENDED')) {
       // Silent failure (e.g. owner attacked own land without logic handling, or defense blocked all silently)
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