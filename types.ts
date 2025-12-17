
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
  "https://i.namu.wiki/i/OtjbF_gl1Kvfqxhz5H_0rtFeAuxM_fDzJPwgdpDJnAy0ja6l_i16nON3B4uarbB3QV1u8KCpgq6rsaeAXm2tFvRumlKdG0IgEx4iGsgirHAvkBvp0yH5fiDxlm_CmiyHiyl0XkbQOR-jWLRavKne-w.webp",
  "https://i.namu.wiki/i/niaoFVaf219pcwp0UqIutZDgwYl0LiLgL1l3cOGnDHiBm5nWotoGXSoGa3t0gzPsxdmdQ22d4rpln4RLBR6ozWvm6TM43wLrsbYn640MUpT86v8XNR1kL4AIKXP0q2yEOJsoabdjXhF-dEs_0SaiHw.webp",
  "https://i.namu.wiki/i/99QNadKAuNeiTnlUnua0p5Br16nVJOIOmh1Ocj8Sg6hsf7bz1zDMeZm1j6FAgwKW8wIfSaV3F6ndwu05PjT06qSvm8E0dYXVl73hbXZNZKrF5g4Vj5ncZrud2d0RrqvUJaw3zyPUSX46FThxTCepjg.webp",
  "https://i.namu.wiki/i/i2xlbpdc1cZFZWMfKuDavAnQdUl8R1GmPrY0nUI1DBOuiFLrIhqGWiIt-GwuWlWej0cKXHHs5HgzpXyAoQbse17qXkA_a26b0voylpPTm8y6AkEjDDg1sFbHFp6ZkCfLA-h8TwemeTl81buwe7pY8g.webp",
  "https://i.namu.wiki/i/I9gO9o9zdkBSiDNF3wkhfjclZRVLsI5aCKJfjXDWqvby-Ybcz9RJgiiPvLhB9flsLkI5MkxDEzfor8dK_18n-LOD4LMBdTExMc0guPEsPe7AhMuv_6HcogU24YgWYAK1rGejemFvEBUxmzipJXREkg.webp",
  "https://i.namu.wiki/i/Rpd4ln04OR2oJ17Cxd1_1NtLBkd2WwGJ0uG94BlCmL-wTa_8Dr99nDzWftIRc8yd2muzzSZcNNMipKRzVycO9V0_Sjuls_-E9CmF-n1aYYIpo6tKJOxfrfqW231SAD8u_stdfXoMfm853hVjZG14ww.webp",
  "https://i.namu.wiki/i/Dn387hHeKtWjQjlQCbRcYAZzLfQWhD07aH8rqOfq06KlZBA9zibdZ_C7B-7xklLpo3UA3SWtzOUfhTXeXPJfAQPIvuFEw6WCYpvdkCBLjuzdYAnp4a-ImCiNq6N11S2ZkH6HQXdA6O9E2R61ptlU6w.webp",
  "https://i.namu.wiki/i/lDabLKcno7_hdIwUR8hB7iN413EJ5kYkvnZsGOoIhjW3oAS0kPLT6RZAmoV7K8ztkyEflipUkxLuymyxawEgknNt75MItyH59QWvwh4l85WNszEukHfW-udYjdmR-zMCdcjmXB2skkQ18ynSiqto7Q.webp",
  "https://i.namu.wiki/i/Lc3VGCVUfaZ7q_u960p_b3lbhadQA5u5-GMS24E4JUVI6SaYMajmYB8MSU6YqOOdw4EmxEciVl05MXu6yP2uil3C1i-nefsR31GjjkOBlOE8-BaORAFvvilYCMwaXCm76Jhicamgwi3DKvB8JwZ6UQ.webp",
  "https://i.namu.wiki/i/TpKYELoyfQeFWWa-pIwFVyw9GtalO5cOqDSUpiDvA5N36f8w3B0t3x3nO3SEo6-aTYrYI_LkGs0L-WDB5hj3NyUHsoIEvVYTAWE6XcJ3RTqcHeHsQT9m0OexMqbAA8Wp79rZwSGRWsr6SudDpz0tNw.webp"
];

export const COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500'
];