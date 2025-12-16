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
  type: 'CONQUERED' | 'DEFENDED' | 'FAILED_ATTACK' | 'PIERCED';
  attackerName?: string;
  defenderName?: string;
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

export const AVATARS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'];
export const COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500'
];