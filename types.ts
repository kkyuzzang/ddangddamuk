
export type GamePhase = 'LOBBY' | 'QUIZ' | 'ACTION_SELECT' | 'ACTION_EXECUTE' | 'ROUND_RESULT' | 'GAME_OVER';

export interface Quiz {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  coins: number;
  lands: number[]; // Array of Land IDs
  isEliminated: boolean;
  lastPing?: number; // For connection monitoring
  
  // Round specific state
  lastAnswerCorrect?: boolean;
  selectedAction?: 'ATTACK' | 'DEFEND' | 'WAITING';
  pendingAttacks: number[]; // Land IDs they are attacking
  pendingShop?: 'BUY_LAND' | 'PIERCE' | null;
  isDefending: boolean; // Active for the round
}

export interface Land {
  id: number;
  ownerId: string | null; // Player ID or null if empty
  isLocked: boolean; // Visual effect for defense
}

export interface CombatEvent {
  landId: number;
  type: 'CONQUERED' | 'DEFENDED' | 'FAILED_ATTACK' | 'PIERCED' | 'BOUGHT';
  attackerName?: string; // The winner or the single attacker
  defenderName?: string; // The previous owner
  allAttackers?: string[]; // List of names of everyone who attacked this land
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  round: number;
  totalLands: number;
  quizDuration: number; // Configurable timer duration
  players: Player[];
  lands: Land[];
  quizzes: Quiz[];
  currentQuizIndex: number;
  timer: number;
  logs: string[];
  lastRoundEvents: CombatEvent[]; // For visual effects
}

export interface BroadcastMessage {
  type: 'STATE_UPDATE' | 'PLAYER_JOIN' | 'PLAYER_ACTION' | 'HOST_ACTION' | 'HEARTBEAT' | 'HEARTBEAT_ACK';
  payload: any;
}

export const AVATARS = [
  "https://lh3.googleusercontent.com/d/1FHgOiNWDBEiHMG9uuE8C0h31ug-tDlT5",
  "https://lh3.googleusercontent.com/d/1mm4XmcuQoUZWUxPCE4CqWctoGj2XU9xa",
  "https://lh3.googleusercontent.com/d/1WRrHVRPQ7POtrnnHWeikrMoQ7hODX6uT",
  "https://lh3.googleusercontent.com/d/19o9S2cq6pY3AzRFY3mCyiE1RobX5_3tu",
  "https://lh3.googleusercontent.com/d/1CVLrRjEidQKPPWw1kx4zCg8WD996gKBi",
  "https://lh3.googleusercontent.com/d/1NSzmCDfE7iM9fohk4UzW_lWFuDBDNhZ-",
  "https://lh3.googleusercontent.com/d/1MGPZ7_DTILkzlCOZG9IvpgFgA0ROwYYX",
  "https://lh3.googleusercontent.com/d/1JtoSrYxHNBAnIdd95eMDWBV17rPmXOn8",
  "https://lh3.googleusercontent.com/d/1J_pTBN-i8fEWt9qmHQ1zXOJfWjCVtjGk",
  "https://lh3.googleusercontent.com/d/1SXHTSA4hSj-s4USB3PG5nqwaD9mIJP1W"
];

export const COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500'
];
