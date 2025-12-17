import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import { GameState, Player, BroadcastMessage, GamePhase, Quiz, AVATARS, COLORS } from './types';
import { DEFAULT_QUIZZES, COIN_COSTS } from './constants';
import { generateMap, assignInitialLands, resolveTurn } from './utils/gameLogic';
import { GameMap } from './components/GameMap';
import { Button } from './components/Button';

// -- Sub-Components --

const PlayerStatusTable = ({ players, phase }: { players: Player[], phase: GamePhase }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">📜 학생 현황판</h3>
                <span className="text-xs text-gray-500 font-mono">총 {players.length}명</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-4 py-2">플레이어</th>
                            <th className="px-4 py-2 text-center">땅 / 코인</th>
                            <th className="px-4 py-2 text-center">퀴즈 결과</th>
                            <th className="px-4 py-2 text-center">행동</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {players.map(p => {
                            let actionText = '-';
                            if (phase === 'ACTION_SELECT' || phase === 'ROUND_RESULT') {
                                if (p.selectedAction === 'DEFEND') actionText = '🛡️ 방어';
                                else if (p.pendingAttacks.length > 0) actionText = `⚔️ 공격 (${p.pendingAttacks.length})`;
                                else if (p.pendingShop === 'BUY_LAND') actionText = '💰 땅 구매';
                                else actionText = '대기중';
                            }
                            
                            return (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center shadow-sm text-xs text-white font-bold`}>
                                            {p.avatar}
                                        </div>
                                        <span className={`font-bold ${p.isEliminated ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                            {p.name}
                                        </span>
                                        {p.isEliminated && <span className="text-xs bg-red-100 text-red-600 px-1 rounded">탈락</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="font-mono">
                                            <span className="text-indigo-600 font-bold">{p.lands.length}땅</span>
                                            <span className="mx-2 text-gray-300">|</span>
                                            <span className="text-yellow-600 font-bold">{p.coins}💰</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {p.lastAnswerCorrect === true && <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">⭕ 정답 (+1💰)</span>}
                                        {p.lastAnswerCorrect === false && <span className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">❌ 오답</span>}
                                        {p.lastAnswerCorrect === undefined && <span className="text-gray-400">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-gray-600">
                                        {actionText}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const LobbyView = ({ 
  isHost, 
  players, 
  onStart, 
  roomCode, 
  connectionStatus,
  totalQuizzes,
  setTotalQuizzes,
  maxQuizzes
}: { 
  isHost: boolean, 
  players: Player[], 
  onStart: () => void, 
  roomCode: string, 
  connectionStatus: string,
  totalQuizzes: number,
  setTotalQuizzes: (n: number) => void,
  maxQuizzes: number
}) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8">
    <div className="text-center">
      <h2 className="text-4xl font-extrabold text-indigo-900 mb-2 tracking-tight">방 코드: <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border-2 border-indigo-100">{roomCode}</span></h2>
      <p className="text-gray-500 text-lg">학생들이 입장하기를 기다리고 있습니다...</p>
      {connectionStatus && <p className="text-sm text-orange-600 mt-2 font-mono font-bold bg-orange-50 inline-block px-2 py-1 rounded">{connectionStatus}</p>}
    </div>
    
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
      {players.map(p => (
        <div key={p.id} className="bg-white p-4 rounded-xl shadow-md flex items-center space-x-3 animate-fade-in border-b-4 border-indigo-100">
          <div className={`w-10 h-10 rounded-full ${p.color} flex items-center justify-center text-xl shadow-sm text-white font-bold`}>
            {p.avatar}
          </div>
          <span className="font-bold text-gray-700">{p.name}</span>
        </div>
      ))}
      {players.length === 0 && <div className="col-span-full text-center text-gray-400 py-8">아직 참가자가 없습니다.</div>}
    </div>

    {isHost && (
      <div className="w-full max-w-md space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700">게임 설정</h3>
          <div>
            <label className="text-sm font-bold text-indigo-900 block mb-1">진행할 라운드(문제) 수</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" min="1" max={maxQuizzes} step="1"
                className="w-full accent-indigo-600"
                value={totalQuizzes}
                onChange={(e) => setTotalQuizzes(parseInt(e.target.value))}
              />
              <span className="font-mono font-bold w-12 text-right">{totalQuizzes}개</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">총 {maxQuizzes}개의 준비된 문제 중 {totalQuizzes}개를 사용합니다.</p>
          </div>
          
          <Button 
            onClick={onStart} 
            disabled={players.length < 2}
            className="w-full text-xl py-4 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            variant="success"
          >
            게임 시작 ({players.length}명 대기중)
          </Button>
      </div>
    )}
    {!isHost && <div className="text-indigo-600 animate-pulse font-bold text-lg">선생님이 곧 게임을 시작합니다...</div>}
  </div>
);

const QuizView = ({ quiz, timeRemaining, isHost, onAnswer }: { quiz: Quiz, timeRemaining: number, isHost: boolean, onAnswer: (idx: number) => void }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    setSelectedIdx(null);
    setIsSubmitted(false);
  }, [quiz.id]);

  const handleSubmit = () => {
    if (selectedIdx === null || isSubmitted || isHost) return;
    setIsSubmitted(true);
    onAnswer(selectedIdx);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-xl border-t-8 border-indigo-500">
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-3 py-1 rounded-full">현재 문제</span>
        <span className={`text-3xl font-mono font-bold ${timeRemaining < 5 ? 'text-red-500 animate-pulse' : 'text-indigo-600'}`}>
          {timeRemaining}초
        </span>
      </div>
      
      <h3 className="text-2xl font-bold text-gray-800 mb-8 leading-relaxed break-keep">{quiz.question}</h3>
      
      <div className="grid grid-cols-1 gap-4 mb-6">
        {quiz.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => !isSubmitted && setSelectedIdx(idx)}
            disabled={isHost || isSubmitted}
            className={`
              p-5 rounded-xl text-left font-bold text-lg transition-all border-2
              ${selectedIdx === idx 
                ? 'bg-indigo-100 border-indigo-500 text-indigo-900 shadow-inner ring-2 ring-indigo-200' 
                : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-indigo-300 hover:shadow-md text-gray-700'}
              disabled:cursor-default disabled:opacity-80
            `}
          >
            {opt}
          </button>
        ))}
      </div>

      {!isHost && (
        <div className="flex flex-col items-center">
          <Button 
            onClick={handleSubmit} 
            disabled={selectedIdx === null || isSubmitted}
            className="w-full sm:w-auto px-8 py-3 text-lg"
          >
            {isSubmitted ? '제출 완료! (다른 친구들 기다리는 중...)' : '정답 제출하기'}
          </Button>
          {isSubmitted && <p className="mt-4 text-gray-500 animate-pulse">모든 친구들이 제출하면 바로 넘어갑니다.</p>}
        </div>
      )}

      {isHost && (
          <div className="mt-6 text-center">
             <p className="text-gray-400 italic mb-2">진행자 화면: 정답을 선택할 수 없습니다.</p>
             <p className="text-indigo-600 font-bold">학생들이 모두 제출하면 자동으로 다음으로 넘어갑니다.</p>
          </div>
      )}
    </div>
  );
};

// Extracted to avoid Hook Rules Violation in renderGuestDashboard
const GuestActionView = ({ 
    me, 
    gameState, 
    myPlayerId, 
    actionLocked, 
    selectedLandIds, 
    toggleLandSelection, 
    handleConfirmAttack, 
    handleDefend,
    canDefend,
    allowedAttacks,
    onShopItemSelect,
    pendingShopItem
}: any) => {

    return (
        <div className="p-4 max-w-4xl mx-auto pb-24">
          <div className="bg-white p-4 rounded-xl shadow-md mb-4 flex justify-between items-center sticky top-0 z-20 border-b-4 border-indigo-100">
             <div>
               <div className="text-xs text-gray-500 font-bold">보유 코인</div>
               <div className="text-2xl font-bold text-yellow-500 flex items-center drop-shadow-sm">
                 💰 {me.coins}
               </div>
             </div>
             <div className="text-right">
               <div className="text-xs text-gray-500 font-bold">퀴즈 결과</div>
               <div className={`font-bold text-lg ${me.lastAnswerCorrect ? 'text-green-600' : 'text-red-500'}`}>
                 {me.lastAnswerCorrect ? '정답! (+1 코인)' : '오답'}
               </div>
             </div>
          </div>

          {!actionLocked ? (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded text-center text-sm text-blue-800 font-bold mb-2">
                 {me.lastAnswerCorrect ? "정답 보너스: 공격 2회 또는 방어 가능!" : "오답 페널티: 공격 1회만 가능 (방어 불가)"}
              </div>

              {/* Shop Section */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                 <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">🛒 아이템 상점</h3>
                 <div className="flex gap-2">
                    <Button 
                      disabled={me.coins < COIN_COSTS.PIERCE_DEFENSE}
                      onClick={() => onShopItemSelect(pendingShopItem === 'PIERCE' ? undefined : 'PIERCE')}
                      className={`text-sm flex-1 ${pendingShopItem === 'PIERCE' ? 'ring-4 ring-offset-1 ring-yellow-400 bg-indigo-700' : ''}`}
                    >
                      {pendingShopItem === 'PIERCE' ? '✅ 방어 관통 선택됨' : `방어 관통 (${COIN_COSTS.PIERCE_DEFENSE}💰)`}
                    </Button>
                    <Button 
                      disabled={me.coins < COIN_COSTS.BUY_LAND}
                      onClick={() => onShopItemSelect(pendingShopItem === 'BUY_LAND' ? undefined : 'BUY_LAND')}
                      className={`text-sm flex-1 ${pendingShopItem === 'BUY_LAND' ? 'ring-4 ring-offset-1 ring-yellow-400 bg-indigo-700' : ''}`}
                    >
                       {pendingShopItem === 'BUY_LAND' ? '✅ 빈 땅 구매 선택됨' : `빈 땅 구매 (${COIN_COSTS.BUY_LAND}💰)`}
                    </Button>
                 </div>
                 {pendingShopItem === 'BUY_LAND' && (
                    <div className="mt-3 bg-white p-3 rounded text-sm text-center border border-indigo-200 text-indigo-700 font-bold">
                       💰 빈 땅 구매가 예약되었습니다! (라운드 종료 시 무작위 획득)<br/>
                       <span className="text-xs font-normal text-gray-500">공격도 함께 할 수 있습니다.</span>
                    </div>
                 )}
              </div>

              <div className="flex justify-center gap-4">
                <div className="text-center w-full">
                  <p className="text-sm font-semibold mb-2 bg-indigo-100 inline-block px-3 py-1 rounded-full text-indigo-800">
                    공격할 땅 선택 ({selectedLandIds.length}/{allowedAttacks})
                  </p>
                  <GameMap 
                    lands={gameState.lands} 
                    players={gameState.players} 
                    myPlayerId={myPlayerId}
                    selectable={true}
                    onLandClick={toggleLandSelection}
                    selectedLandIds={selectedLandIds}
                  />
                  <Button 
                    onClick={handleConfirmAttack} 
                    className="mt-6 w-full py-3 text-lg shadow-md"
                    disabled={selectedLandIds.length === 0 && pendingShopItem !== 'BUY_LAND'}
                  >
                    {selectedLandIds.length > 0 ? '⚔️ 공격 확정' : (pendingShopItem === 'BUY_LAND' ? '💰 구매 확정' : '행동 선택 필요')}
                  </Button>
                </div>
              </div>

              {canDefend && (
                <div className="text-center border-t-2 border-dashed border-gray-300 pt-6 mt-4">
                  <p className="mb-3 text-gray-500 font-bold">- 또는 -</p>
                  <Button onClick={handleDefend} variant="secondary" className="w-full border-2 border-indigo-200 py-3 text-lg font-bold text-indigo-700 hover:bg-indigo-50">
                    🛡️ 방어하기 (공격 막기)
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl shadow-lg border-2 border-indigo-50">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">전략 제출 완료!</h3>
              <p className="text-gray-500">다른 친구들이 선택할 때까지 기다려주세요...</p>
            </div>
          )}
        </div>
    );
};

// -- Main App Component --

const App: React.FC = () => {
  // Mode Selection
  const [mode, setMode] = useState<'MENU' | 'HOST' | 'GUEST'>('MENU');
  
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    roomCode: 'CLASS1',
    phase: 'LOBBY',
    round: 1,
    totalLands: 25,
    quizDuration: 15,
    players: [],
    lands: [],
    quizzes: DEFAULT_QUIZZES,
    currentQuizIndex: 0,
    timer: 0,
    logs: [],
    lastRoundEvents: []
  });

  // Keep a Ref of GameState to access latest state in PeerJS callbacks
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Local Player State
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [joinName, setJoinName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');
  
  // Host Specific Local State
  const [targetQuizCount, setTargetQuizCount] = useState<number>(DEFAULT_QUIZZES.length);

  // Action State (Guest)
  const [selectedLandIds, setSelectedLandIds] = useState<number[]>([]);
  const [actionLocked, setActionLocked] = useState(false);
  const [pendingShopItem, setPendingShopItem] = useState<'PIERCE' | 'BUY_LAND' | undefined>(); // Hoisted state

  // PeerJS Refs
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]); // For Host: list of student connections
  const hostConnRef = useRef<DataConnection | null>(null); // For Guest: connection to host
  
  // Refs for logic that doesn't need re-render
  const lastPingMap = useRef<Record<string, number>>({});
  
  // Timer Refs
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerCallbackRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, []);

  // -- Networking Logic (PeerJS) --

  const getPeerId = (code: string) => `quiz-land-grab-${code}`; 

  const peerConfig = {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };

  // Heartbeat Logic
  const startHeartbeat = (isHost: boolean) => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

    heartbeatIntervalRef.current = setInterval(() => {
        if (isHost) {
            // Host: Send PING to all, Remove dead players
            const now = Date.now();
            
            // 1. Prune disconnected players (timeout increased to 15s to prevent accidental drops)
            setGameState(prev => {
                const activePlayers = prev.players.filter(p => {
                    const lastPing = lastPingMap.current[p.id];
                    if (!lastPing) return true; // New player grace
                    if (now - lastPing > 15000) {
                        console.log(`Removing inactive player: ${p.name} (${p.id})`);
                        const conn = connectionsRef.current.find(c => c.metadata?.playerId === p.id);
                        if (conn) conn.close();
                        return false;
                    }
                    return true;
                });
                
                if (activePlayers.length !== prev.players.length) {
                    return { ...prev, players: activePlayers };
                }
                return prev;
            });

            // 2. Send PING
            connectionsRef.current.forEach(conn => {
                if (conn.open) {
                    conn.send({ type: 'HEARTBEAT', payload: null });
                }
            });

        } else {
            // Guest logic if needed
        }
    }, 2000);
  };

  // HOST: Start Server
  const initializeHost = (code: string) => {
    if (peerRef.current) peerRef.current.destroy();

    setConnectionStatus('방 생성 중... (서버 연결 대기)');
    
    try {
      const peer = new Peer(getPeerId(code), peerConfig);
      
      peer.on('open', (id) => {
        console.log('Host ID Opened:', id);
        setConnectionStatus('방이 생성되었습니다! 학생들이 입장할 수 있습니다.');
        peerRef.current = peer;
        startHeartbeat(true);
      });

      peer.on('connection', (conn) => {
        console.log('New connection received from:', conn.peer);
        connectionsRef.current.push(conn);

        conn.on('data', (data: any) => {
          handleMessage(data, conn);
        });

        conn.on('close', () => {
          console.log('Client disconnected:', conn.peer);
          connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
        });

        conn.on('error', (err) => {
          console.error('Connection error:', err);
        });

        conn.on('open', () => {
          console.log('Connection established, sending state to:', conn.peer);
          setTimeout(() => {
             conn.send({ type: 'STATE_UPDATE', payload: gameStateRef.current });
          }, 100);
        });
      });

      peer.on('error', (err: any) => {
        console.error('Peer Error:', err);
        if (err.type === 'unavailable-id') {
          alert('이미 사용 중인 방 코드입니다. 잠시 후 다시 시도하거나 다른 코드를 사용하세요.');
          setConnectionStatus('방 코드 중복됨');
          setMode('MENU');
        } else if (err.type === 'network') {
           setConnectionStatus('네트워크 오류. 인터넷 연결을 확인하세요.');
        } else {
           setConnectionStatus(`오류 발생: ${err.type}`);
        }
      });
      
      peerRef.current = peer;
    } catch (e) {
      console.error(e);
      setConnectionStatus('초기화 오류');
    }
  };

  // GUEST: Join Server
  const initializeGuest = (code: string, player: Player) => {
    if (peerRef.current) peerRef.current.destroy();

    setConnectionStatus('선생님 컴퓨터 찾는 중...');
    
    const peer = new Peer(peerConfig); 
    peerRef.current = peer;

    peer.on('open', () => {
      setConnectionStatus('서버 접속 성공. 선생님 방에 연결 시도...');
      
      const conn = peer.connect(getPeerId(code), {
        reliable: true,
        metadata: { playerId: player.id }
      });
      
      conn.on('open', () => {
        console.log('Connected to Host!');
        setConnectionStatus('연결 성공!');
        hostConnRef.current = conn;
        
        conn.send({ type: 'PLAYER_JOIN', payload: player });
      });

      conn.on('data', (data: any) => {
        if (data && data.type === 'STATE_UPDATE') {
          setGameState(data.payload);
          
          // CRITICAL FIX: Use gameStateRef to check CURRENT phase before reset
          // If we use 'gameState' from closure, it might be initial state 'LOBBY'
          const currentPhase = gameStateRef.current.phase;
          const newPhase = data.payload.phase;

          // Unlock local state when new action phase starts
          if (newPhase === 'ACTION_SELECT' && currentPhase !== 'ACTION_SELECT') {
            setActionLocked(false);
            setSelectedLandIds([]);
            setPendingShopItem(undefined);
          }
        } else if (data && data.type === 'HEARTBEAT') {
            // Respond to ping
            conn.send({ type: 'HEARTBEAT_ACK', payload: { playerId: player.id } });
        }
      });

      conn.on('close', () => {
        alert('선생님과의 연결이 끊어졌습니다.');
        setMode('MENU');
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        setConnectionStatus('연결 실패. 방 코드가 정확한지 확인하세요.');
      });

      setTimeout(() => {
        if (!conn.open) {
            setConnectionStatus('연결 시간이 초과되었습니다. 방 코드를 다시 확인해주세요.');
        }
      }, 5000);
    });

    peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        setConnectionStatus(`연결 오류: ${err.type}`);
    });
  };

  const broadcastState = useCallback((state: GameState) => {
    if (mode === 'HOST') {
      connectionsRef.current.forEach(conn => {
        if (conn.open) {
          conn.send({ type: 'STATE_UPDATE', payload: state });
        }
      });
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'HOST') {
      broadcastState(gameState);
    }
  }, [gameState, mode, broadcastState]);


  // -- Message Handling (Host Only) --
  const handleMessage = (msg: BroadcastMessage, conn?: DataConnection) => {
    if (msg.type === 'PLAYER_JOIN') {
      handlePlayerJoin(msg.payload, conn);
    } else if (msg.type === 'PLAYER_ACTION') {
      handlePlayerAction(msg.payload);
    } else if (msg.type === 'HEARTBEAT_ACK') {
        const pid = msg.payload.playerId;
        if (pid) {
            lastPingMap.current[pid] = Date.now();
        }
    }
  };

  const handlePlayerJoin = (newPlayer: Player, conn?: DataConnection) => {
    if (conn) {
        // Fix: Explicitly cast to any to allow assignment to readonly metadata
        (conn as any).metadata = { playerId: newPlayer.id };
    }
    lastPingMap.current[newPlayer.id] = Date.now();

    setGameState(prev => {
      const existingPlayerIndex = prev.players.findIndex(p => p.name === newPlayer.name);
      
      if (existingPlayerIndex !== -1) {
        const updatedPlayers = [...prev.players];
        updatedPlayers[existingPlayerIndex] = {
          ...updatedPlayers[existingPlayerIndex],
          id: newPlayer.id,
        };
        return {
          ...prev,
          players: updatedPlayers,
          logs: [...prev.logs, `${newPlayer.name}님이 재접속했습니다.`]
        };
      }

      return {
        ...prev,
        players: [...prev.players, newPlayer],
        logs: [...prev.logs, `${newPlayer.name}님이 입장했습니다.`]
      };
    });
  };

  const handlePlayerAction = (action: { playerId: string, type: string, data: any }) => {
    setGameState(prev => {
      // 1. Update Player State
      const players = prev.players.map(p => {
        if (p.id !== action.playerId) return p;
        
        if (action.type === 'ANSWER') {
          const currentQuiz = prev.quizzes[prev.currentQuizIndex];
          const isCorrect = action.data.answerIndex === currentQuiz.correctIndex;
          return {
            ...p,
            lastAnswerCorrect: isCorrect,
            coins: isCorrect ? p.coins + 1 : p.coins
          };
        }

        if (action.type === 'STRATEGY') {
          return {
            ...p,
            selectedAction: action.data.action,
            pendingAttacks: action.data.targets || [],
            pendingShop: action.data.shopItem || null
          };
        }
        return p;
      });

      const newState = { ...prev, players };

      // 2. Check for "All Answered" Condition if in Quiz Phase
      if (prev.phase === 'QUIZ' && action.type === 'ANSWER') {
        const answeredCount = players.filter(p => p.lastAnswerCorrect !== undefined).length;
        if (answeredCount >= players.length) {
          // If everyone answered, stop timer and end phase immediately
          setTimeout(() => {
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              endQuizPhase(newState);
          }, 500);
        }
      }

      return newState;
    });
  };


  // -- Game Actions --

  const startGame = () => {
    const selectedQuizzes = gameState.quizzes.slice(0, targetQuizCount);
    const lands = generateMap(gameState.totalLands);
    const landsWithOwners = assignInitialLands(lands, gameState.players);
    
    const resetPlayers = gameState.players.map(p => ({
        ...p,
        lastAnswerCorrect: undefined,
        isEliminated: false,
        coins: 0,
        lands: [],
    }));

    const finalLands = assignInitialLands(lands, resetPlayers);

    setGameState(prev => ({
      ...prev,
      phase: 'QUIZ',
      players: resetPlayers,
      lands: finalLands,
      quizzes: selectedQuizzes,
      round: 1,
      currentQuizIndex: 0,
      timer: prev.quizDuration,
      logs: ['게임 시작! 1라운드 시작'],
      lastRoundEvents: []
    }));

    startTimer(gameState.quizDuration, () => endQuizPhase());
  };

  const startTimer = (seconds: number, onComplete: () => void) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerCallbackRef.current = onComplete; // Store callback for extension
    
    let timeLeft = seconds;
    timerIntervalRef.current = setInterval(() => {
      timeLeft -= 1;
      setGameState(prev => ({ ...prev, timer: timeLeft }));
      
      if (timeLeft <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        onComplete();
      }
    }, 1000);
  };

  const addTime = (seconds: number) => {
      // Calculate new time based on current state ref to be safe
      const currentTimer = gameStateRef.current.timer;
      const newTime = currentTimer + seconds;
      
      // Update state immediately
      setGameState(prev => ({ ...prev, timer: newTime }));
      
      // Restart timer with new duration if we have a callback
      if (timerCallbackRef.current) {
         startTimer(newTime, timerCallbackRef.current);
      }
  };

  const endQuizPhase = (currentStateOverride?: GameState) => {
    const transition = (prevState: GameState) => ({
      ...prevState,
      phase: 'ACTION_SELECT' as GamePhase,
      timer: 30
    });

    if (currentStateOverride) {
        setGameState(transition(currentStateOverride));
    } else {
        setGameState(prev => transition(prev));
    }
    
    startTimer(30, () => resolveRound());
  };

  const resolveRound = () => {
    setGameState(prev => {
      const { nextState, messages } = resolveTurn(prev);
      return {
        ...nextState,
        phase: 'ROUND_RESULT',
        logs: [...messages, ...prev.logs],
        timer: 0 // No timer for result phase, manual advance
      };
    });
    // Stop timer for manual progression
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const nextRound = () => {
    setGameState(prev => {
      const nextIdx = prev.currentQuizIndex + 1;
      if (nextIdx >= prev.quizzes.length) {
        return { ...prev, phase: 'GAME_OVER' };
      }
      
      const nextPlayers = prev.players.map(p => ({
          ...p,
          lastAnswerCorrect: undefined,
          selectedAction: undefined,
          pendingAttacks: [],
          pendingShop: null
      }));

      return {
        ...prev,
        players: nextPlayers,
        phase: 'QUIZ',
        currentQuizIndex: nextIdx,
        round: prev.round + 1,
        timer: prev.quizDuration,
        lastRoundEvents: [],
        logs: [`${prev.round + 1}라운드 시작!`, ...prev.logs]
      };
    });
    startTimer(gameState.quizDuration, () => endQuizPhase());
  };

  // CSV Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newQuizzes: Quiz[] = [];
      lines.forEach((line, idx) => {
        const cols = line.split(',');
        if (cols.length >= 6) {
          newQuizzes.push({
            id: `csv-${idx}`,
            question: cols[0].trim(),
            options: [cols[1].trim(), cols[2].trim(), cols[3].trim(), cols[4].trim()],
            correctIndex: parseInt(cols[5].trim()) || 0
          });
        }
      });
      if (newQuizzes.length > 0) {
        setGameState(prev => ({ ...prev, quizzes: newQuizzes }));
        setTargetQuizCount(newQuizzes.length);
        alert(`${newQuizzes.length}개의 퀴즈를 불러왔습니다!`);
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleCSV = () => {
      const csvContent = "문제,보기1,보기2,보기3,보기4,정답번호(0-3)\n예시문제: 하늘은 무슨 색인가요?,빨강,파랑,노랑,검정,1";
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "quiz_sample.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // -- Guest Interactions --

  const joinGame = () => {
    if (!joinName || !joinRoomCode) return;
    const id = `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newPlayer: Player = {
      id,
      name: joinName,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      coins: 0,
      lands: [],
      isEliminated: false,
      pendingAttacks: [],
      isDefending: false
    };

    setMyPlayerId(id);
    setGameState(prev => ({ ...prev, roomCode: joinRoomCode }));
    setMode('GUEST');
    
    initializeGuest(joinRoomCode, newPlayer);
  };

  const submitAnswer = (idx: number) => {
    if (hostConnRef.current) {
        hostConnRef.current.send({
          type: 'PLAYER_ACTION',
          payload: {
            playerId: myPlayerId,
            type: 'ANSWER',
            data: { answerIndex: idx }
          }
        });
    }
  };

  const submitStrategy = (action: 'ATTACK' | 'DEFEND', targets: number[], shopItem?: 'PIERCE' | 'BUY_LAND') => {
    setActionLocked(true);
    hostConnRef.current?.send({
      type: 'PLAYER_ACTION',
      payload: {
        playerId: myPlayerId,
        type: 'STRATEGY',
        data: { action, targets, shopItem }
      }
    });
  };

  // -- Render Helpers --

  const renderHostDashboard = () => (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500">
        <h1 className="text-2xl font-bold text-indigo-900">진행자 (선생님) 대시보드</h1>
        <div className="flex gap-4">
           <div className="text-right">
             <div className="text-xs text-gray-500">방 코드</div>
             <div className="font-bold font-mono text-indigo-600">{gameState.roomCode}</div>
           </div>
           <div className="text-right">
             <div className="text-xs text-gray-500">라운드</div>
             <div className="font-bold">{gameState.round} / {gameState.quizzes.length}</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-2 rounded-xl shadow-sm">
             <div className="mb-2 text-sm font-semibold text-gray-500 px-2 flex justify-between">
                <span>실시간 땅 현황</span>
                <span>총 땅 개수: {gameState.totalLands}</span>
             </div>
             <GameMap 
                lands={gameState.lands} 
                players={gameState.players} 
                combatEvents={gameState.phase === 'ROUND_RESULT' ? gameState.lastRoundEvents : []}
             />
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm h-64 overflow-y-auto">
            <h3 className="font-bold text-gray-700 mb-2 border-b pb-2">게임 로그</h3>
            <ul className="text-sm space-y-2">
              {gameState.logs.slice(0).reverse().map((log, i) => (
                <li key={i} className="text-gray-600 border-b border-gray-100 pb-1 last:border-0">{log}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4 flex flex-col h-full">
            {/* Player Status - Visible during Quiz/Action/Result */}
            {gameState.phase !== 'LOBBY' && gameState.phase !== 'GAME_OVER' && (
                <div className="flex-1 overflow-y-auto max-h-[40vh] lg:max-h-[50vh]">
                    <PlayerStatusTable players={gameState.players} phase={gameState.phase} />
                </div>
            )}

          <div className="bg-white p-4 rounded-xl shadow-sm h-full">
            <h3 className="font-bold mb-4 text-lg text-indigo-800">게임 설정 및 제어</h3>
            {gameState.phase === 'LOBBY' && (
              <div className="space-y-6">
                <div className="space-y-4 bg-indigo-50 p-4 rounded-lg">
                   <div>
                     <label className="text-sm font-bold text-indigo-900 block mb-1">방 코드 설정</label>
                     <div className="flex gap-2">
                        <input 
                          type="text"
                          className="w-full border p-2 rounded uppercase font-mono font-bold text-center tracking-widest"
                          value={gameState.roomCode}
                          onChange={(e) => setGameState({...gameState, roomCode: e.target.value.toUpperCase()})}
                          disabled={!!peerRef.current}
                        />
                     </div>
                     {!peerRef.current && (
                        <Button onClick={() => initializeHost(gameState.roomCode)} className="w-full mt-2" variant="primary">
                            방 생성 및 서버 시작
                        </Button>
                     )}
                     {connectionStatus && <p className="text-xs text-green-600 mt-1 font-bold">{connectionStatus}</p>}
                   </div>

                   {/* Other settings */}
                   <div>
                     <label className="text-sm font-bold text-indigo-900 block mb-1">맵 크기 (칸 수)</label>
                     <div className="flex items-center gap-2">
                       <input 
                         type="range" min="12" max="40" step="1"
                         className="w-full accent-indigo-600"
                         value={gameState.totalLands}
                         onChange={(e) => setGameState({...gameState, totalLands: parseInt(e.target.value)})}
                       />
                       <span className="font-mono font-bold w-8 text-right">{gameState.totalLands}</span>
                     </div>
                   </div>

                   <div>
                     <label className="text-sm font-bold text-indigo-900 block mb-1">문제 제한 시간 (초)</label>
                     <div className="flex items-center gap-2">
                       <input 
                         type="range" min="5" max="60" step="5"
                         className="w-full accent-indigo-600"
                         value={gameState.quizDuration}
                         onChange={(e) => setGameState({...gameState, quizDuration: parseInt(e.target.value)})}
                       />
                       <span className="font-mono font-bold w-8 text-right">{gameState.quizDuration}</span>
                     </div>
                   </div>
                </div>
                
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                     <label className="text-sm font-semibold">퀴즈 업로드 (CSV)</label>
                     <button onClick={downloadSampleCSV} className="text-xs text-blue-600 underline hover:text-blue-800">
                         양식 다운로드
                     </button>
                   </div>
                   <input type="file" accept=".csv" onChange={handleFileUpload} className="w-full text-sm bg-gray-50 p-2 rounded border" />
                </div>
                <hr className="border-gray-100" />
                <LobbyView 
                  isHost={true} 
                  players={gameState.players} 
                  onStart={startGame} 
                  roomCode={gameState.roomCode}
                  connectionStatus={connectionStatus}
                  totalQuizzes={targetQuizCount}
                  setTotalQuizzes={setTargetQuizCount}
                  maxQuizzes={gameState.quizzes.length}
                />
              </div>
            )}
            
            {gameState.phase === 'QUIZ' && (
               <div className="text-center py-8">
                 <div className="text-6xl font-black text-indigo-600 mb-4 animate-pulse">{gameState.timer}</div>
                 <p className="text-lg font-medium text-gray-600">학생들이 문제를 풀고 있습니다...</p>
                 <div className="mt-8 flex gap-2 justify-center">
                    <Button onClick={() => addTime(5)} className="bg-blue-500 hover:bg-blue-600 text-sm">⏱️ +5초</Button>
                    <Button className="bg-gray-400 hover:bg-gray-500 text-sm" onClick={() => endQuizPhase()}>퀴즈 강제 종료</Button>
                 </div>
               </div>
            )}

            {gameState.phase === 'ACTION_SELECT' && (
               <div className="text-center py-8">
                 <div className="text-6xl font-black text-indigo-600 mb-4 animate-pulse">{gameState.timer}</div>
                 <p className="text-lg font-medium text-gray-600">전략을 선택하고 있습니다...</p>
                 <div className="mt-8 flex gap-2 justify-center">
                    <Button onClick={() => addTime(5)} className="bg-blue-500 hover:bg-blue-600 text-sm">⏱️ +5초</Button>
                    <Button className="bg-gray-400 hover:bg-gray-500 text-sm" onClick={() => resolveRound()}>결과 바로 보기</Button>
                 </div>
               </div>
            )}

            {gameState.phase === 'ROUND_RESULT' && (
               <div className="text-center py-8">
                 <p className="mb-4 text-xl font-bold text-green-600">외교 타임 (결과 확인 및 협상)</p>
                 <p className="text-sm text-gray-500 mb-6">학생들이 서로 대화하며 동맹을 맺거나 협상하는 시간입니다.</p>
                 <Button onClick={nextRound} className="w-full py-4 text-lg shadow-lg animate-bounce">다음 라운드 시작 ▶</Button>
               </div>
            )}
            
            {gameState.phase === 'GAME_OVER' && (
              <div className="text-center py-8">
                <h2 className="text-3xl font-bold text-indigo-600 mb-4">게임 종료!</h2>
                <Button onClick={() => window.location.reload()} variant="secondary">로비로 돌아가기</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderGuestDashboard = () => {
    // ... (Guest implementation same as previous, logic handled inside GuestActionView and useEffects above)
    // Only difference is props passed are static, logic update handled in initializeGuest

    const me = gameState.players.find(p => p.id === myPlayerId);
    
    // Connection Loading State
    if (!hostConnRef.current && mode === 'GUEST') {
        return (
            <div className="p-10 text-center space-y-4">
                <div className="text-xl font-bold text-gray-400 animate-pulse">{connectionStatus}</div>
                <div className="text-sm text-gray-500">잠시만 기다려주세요...</div>
                <Button onClick={() => { setMode('MENU'); setConnectionStatus(''); }} variant="secondary">취소하고 돌아가기</Button>
            </div>
        );
    }

    // Lobby fallback
    if (!me) {
        if (gameState.phase === 'LOBBY') {
             return <LobbyView 
                      isHost={false} 
                      players={gameState.players} 
                      onStart={() => {}} 
                      roomCode={gameState.roomCode} 
                      connectionStatus={connectionStatus}
                      totalQuizzes={0}
                      setTotalQuizzes={() => {}}
                      maxQuizzes={0}
                    />;
        }
        return (
            <div className="p-10 text-center space-y-4">
                <div className="text-xl font-bold text-gray-400">참가 정보를 찾을 수 없습니다.</div>
                <Button onClick={() => setMode('MENU')}>메인으로 돌아가기</Button>
            </div>
        );
    }

    if (gameState.phase === 'LOBBY') {
      return <LobbyView 
                isHost={false} 
                players={gameState.players} 
                onStart={() => {}} 
                roomCode={gameState.roomCode} 
                connectionStatus={connectionStatus} 
                totalQuizzes={0}
                setTotalQuizzes={() => {}}
                maxQuizzes={0}
              />;
    }

    if (gameState.phase === 'QUIZ') {
      return (
        <div className="p-4 pt-10">
          <QuizView 
            quiz={gameState.quizzes[gameState.currentQuizIndex]}
            timeRemaining={gameState.timer}
            isHost={false}
            onAnswer={submitAnswer}
          />
        </div>
      );
    }

    if (gameState.phase === 'ACTION_SELECT') {
      const allowedAttacks = me.lastAnswerCorrect ? 2 : 1;
      const canDefend = me.lastAnswerCorrect;
      
      const toggleLandSelection = (id: number) => {
        if (actionLocked) return;
        const land = gameState.lands.find(l => l.id === id);
        if (!land) return;
        
        // Prevent selecting own land
        if (land.ownerId === myPlayerId) {
            alert("우리 땅은 공격할 수 없습니다.");
            return;
        }

        if (selectedLandIds.includes(id)) {
          setSelectedLandIds(prev => prev.filter(lid => lid !== id));
        } else {
          if (selectedLandIds.length < allowedAttacks) {
            setSelectedLandIds(prev => [...prev, id]);
          } else {
             // Smart replace: If max reached, replace logic.
             // If 1 allowed, just replace. If > 1, replace first selected (FIFO-ish).
             if (allowedAttacks === 1) {
                 setSelectedLandIds([id]);
             } else {
                 setSelectedLandIds(prev => [...prev.slice(1), id]);
             }
          }
        }
      };

      const handleConfirmAttack = () => {
        submitStrategy('ATTACK', selectedLandIds, pendingShopItem);
      };

      const handleDefend = () => {
        submitStrategy('DEFEND', [], pendingShopItem);
      };

      return (
          <GuestActionView 
            me={me}
            gameState={gameState}
            myPlayerId={myPlayerId}
            actionLocked={actionLocked}
            selectedLandIds={selectedLandIds}
            toggleLandSelection={toggleLandSelection}
            handleConfirmAttack={handleConfirmAttack}
            handleDefend={handleDefend}
            canDefend={canDefend}
            allowedAttacks={allowedAttacks}
            onShopItemSelect={setPendingShopItem}
            pendingShopItem={pendingShopItem}
          />
      );
    }

    if (gameState.phase === 'ROUND_RESULT' || gameState.phase === 'GAME_OVER') {
       const myAttacks = gameState.lastRoundEvents.filter(e => e.attackerName === me.name);
       const attackedMe = gameState.lastRoundEvents.filter(e => e.defenderName === me.name);

       return (
         <div className="p-4 space-y-4 max-w-4xl mx-auto">
           <h2 className="text-2xl font-bold text-center mb-4 text-indigo-800 bg-white p-2 rounded-lg shadow-sm">
             {gameState.phase === 'ROUND_RESULT' ? '🤝 외교 타임' : '게임 종료'}
           </h2>
           
           <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm">
             <h3 className="font-bold text-yellow-800 mb-3 text-lg border-b border-yellow-200 pb-2">📊 이번 라운드 전투 요약</h3>
             <div className="space-y-3 text-sm">
               <div className="bg-white p-3 rounded border border-yellow-100">
                 <p className="font-bold text-blue-600 mb-1">⚔️ 내가 공격한 곳:</p>
                 <p className="text-gray-700">
                   {myAttacks.length > 0 
                     ? myAttacks.map((e, idx) => <span key={idx} className="inline-block mr-2">Goal: {e.defenderName || '빈 땅'}(#{e.landId+1}){idx < myAttacks.length-1 ? ',' : ''}</span>) 
                     : '없음'}
                 </p>
               </div>
               <div className="bg-white p-3 rounded border border-yellow-100">
                 <p className="font-bold text-red-600 mb-1">🛡️ 나를 공격한 사람:</p>
                 <p className="text-gray-700">
                   {attackedMe.length > 0 
                     ? [...new Set(attackedMe.map(e => e.attackerName))].map((name, idx, arr) => <span key={idx} className="inline-block mr-2 font-bold">{name}{idx < arr.length-1 ? ',' : ''}</span>) 
                     : '없음'}
                 </p>
               </div>
             </div>
           </div>

           <GameMap 
             lands={gameState.lands} 
             players={gameState.players} 
             myPlayerId={myPlayerId} 
             combatEvents={gameState.phase === 'ROUND_RESULT' ? gameState.lastRoundEvents : []}
           />
           <div className="bg-white p-4 rounded-xl shadow border border-gray-100 max-h-40 overflow-y-auto">
             {gameState.logs.slice(-5).map((l, i) => <p key={i} className="text-sm border-b py-2 text-gray-700">{l}</p>)}
           </div>
           <div className="text-center mt-6">
             <span className="inline-block animate-bounce text-indigo-500">⏳</span>
             <p className="text-indigo-600 font-bold inline-block ml-2">선생님이 다음 라운드를 준비 중입니다...</p>
           </div>
         </div>
       );
    }

    return <div>알 수 없는 상태입니다.</div>;
  };

  // Main Render Switch
  if (mode === 'MENU') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex flex-col items-center justify-center p-4">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2 drop-shadow-sm">
          삼국지 땅따먹기
        </h1>
        <p className="text-gray-500 mb-12 text-lg font-medium">지식을 겨루고 영토를 확장하세요!</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
          <button 
            onClick={() => { setMode('HOST'); setMyPlayerId('HOST'); }}
            className="group bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all border-4 border-transparent hover:border-indigo-500 text-left transform hover:-translate-y-1"
          >
            <div className="text-4xl mb-4">👑</div>
            <h2 className="text-2xl font-bold text-gray-800 group-hover:text-indigo-600">선생님 (방 만들기)</h2>
            <p className="text-gray-500 mt-2">퀴즈를 관리하고 게임을 진행합니다.</p>
          </button>
          
          <div className="bg-white p-8 rounded-2xl shadow-xl border-4 border-transparent flex flex-col justify-center transform hover:-translate-y-1 transition-transform">
             <div className="text-4xl mb-4">🎓</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">학생 (참여하기)</h2>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="이름 입력" 
                className="w-full bg-gray-100 p-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none font-bold text-lg"
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
              />
              <input 
                type="text" 
                placeholder="방 코드 (예: CLASS1)" 
                className="w-full bg-gray-100 p-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none font-bold text-lg uppercase"
                value={joinRoomCode}
                onChange={e => setJoinRoomCode(e.target.value.toUpperCase())}
              />
            </div>
            <Button onClick={joinGame} disabled={!joinName || !joinRoomCode} className="w-full py-3 text-lg mt-4">입장하기</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="font-bold text-indigo-700 flex items-center gap-2 text-lg">
          <span>🏰</span> 삼국지 땅따먹기
        </div>
        <div className="flex gap-2 items-center">
           <span className="text-xs text-gray-400 font-mono border px-2 py-1 rounded bg-gray-50">ROOM: {gameState.roomCode}</span>
           <div className="text-xs font-bold font-mono bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-full">
              {mode === 'HOST' ? '👑 선생님 모드' : `👤 ${gameState.players.find(p => p.id === myPlayerId)?.name || '게스트'}`}
           </div>
        </div>
      </div>

      {mode === 'HOST' ? renderHostDashboard() : renderGuestDashboard()}
    </div>
  );
};

export default App;