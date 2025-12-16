import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, BroadcastMessage, GamePhase, Quiz, AVATARS, COLORS } from './types';
import { DEFAULT_QUIZZES, COIN_COSTS } from './constants';
import { generateMap, assignInitialLands, resolveTurn } from './utils/gameLogic';
import { GameMap } from './components/GameMap';
import { Button } from './components/Button';

// CHANGE THIS TO YOUR CLOUDFLARE WORKER URL AFTER DEPLOYMENT
// Local dev default: 'ws://localhost:8787/ws'
const WS_BASE_URL = 'ws://localhost:8787/ws'; 

// -- Sub-Components --

const LobbyView = ({ isHost, players, onStart, roomCode }: { isHost: boolean, players: Player[], onStart: () => void, roomCode: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8">
    <div className="text-center">
      <h2 className="text-4xl font-extrabold text-indigo-900 mb-2 tracking-tight">방 코드: <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border-2 border-indigo-100">{roomCode}</span></h2>
      <p className="text-gray-500 text-lg">학생들이 입장하기를 기다리고 있습니다...</p>
    </div>
    
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
      {players.map(p => (
        <div key={p.id} className="bg-white p-4 rounded-xl shadow-md flex items-center space-x-3 animate-fade-in border-b-4 border-indigo-100">
          <div className={`w-10 h-10 rounded-full ${p.color} flex items-center justify-center text-xl shadow-sm`}>
            {p.avatar}
          </div>
          <span className="font-bold text-gray-700">{p.name}</span>
        </div>
      ))}
      {players.length === 0 && <div className="col-span-full text-center text-gray-400 py-8">아직 참가자가 없습니다.</div>}
    </div>

    {isHost && (
      <Button 
        onClick={onStart} 
        disabled={players.length < 2}
        className="text-xl px-12 py-4 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        variant="success"
      >
        게임 시작 ({players.length}명 대기중)
      </Button>
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
            {isSubmitted ? '제출 완료! (결과 대기 중...)' : '정답 제출하기'}
          </Button>
          {isSubmitted && <p className="mt-4 text-gray-500 animate-pulse">시간이 종료되면 결과를 알 수 있습니다.</p>}
        </div>
      )}

      {isHost && <p className="mt-6 text-center text-gray-400 italic">진행자 화면: 정답을 선택할 수 없습니다.</p>}
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

  // Local Player State
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [joinName, setJoinName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  
  // Action State (Guest)
  const [selectedLandIds, setSelectedLandIds] = useState<number[]>([]);
  const [actionLocked, setActionLocked] = useState(false);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);

  // Helper to send message
  const sendMessage = useCallback((msg: BroadcastMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Initialize WebSocket - Dynamic based on Room Code
  useEffect(() => {
    // Only connect if not in MENU and roomCode is set
    if (mode === 'MENU') return;

    const roomCode = gameState.roomCode;
    const wsUrl = `${WS_BASE_URL}/${roomCode}`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Game Server');
      // If Host, broadcast initial state immediately to sync any late joiners/reconnects
      if (mode === 'HOST') {
        sendMessage({ type: 'HOST_ACTION', payload: { action: 'INIT' } }); // Just to trigger open
        // Actually send state
        ws.send(JSON.stringify({ type: 'STATE_UPDATE', payload: gameState }));
      }
      // If Guest, we already joined via joinGame function, but we might need to resend if connection dropped?
      // For now, joinGame handles the initial join message.
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as BroadcastMessage;
        
        if (msg.type === 'STATE_UPDATE') {
          // Both Host and Guest receive this, but Host is the source of truth.
          // Guest ALWAYS syncs.
          if (mode === 'GUEST') {
             setGameState(msg.payload);
             // If phase changed to ACTION_SELECT, unlock actions
             if (msg.payload.phase === 'ACTION_SELECT') {
               setActionLocked(false);
               setSelectedLandIds([]);
             }
          }
        } else if (msg.type === 'PLAYER_JOIN') {
          if (mode === 'HOST') {
            handlePlayerJoin(msg.payload);
          }
        } else if (msg.type === 'PLAYER_ACTION') {
          if (mode === 'HOST') {
            handlePlayerAction(msg.payload);
          }
        }
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from Game Server');
    };

    return () => {
      ws.close();
    };
  }, [mode, gameState.roomCode, sendMessage]); // Re-connect if roomCode/mode changes

  // Host Logic: Update Clients when state changes
  useEffect(() => {
    if (mode === 'HOST') {
      sendMessage({
        type: 'STATE_UPDATE',
        payload: gameState
      });
    }
  }, [gameState, mode, sendMessage]);

  // -- Host Helpers --

  const handlePlayerJoin = (newPlayer: Player) => {
    setGameState(prev => {
      // Reconnection Logic: Check by NAME
      const existingPlayerIndex = prev.players.findIndex(p => p.name === newPlayer.name);
      
      if (existingPlayerIndex !== -1) {
        // Player exists (reconnecting)
        // We update their ID to the new session ID so we can track them, but keep their game stats
        const updatedPlayers = [...prev.players];
        const existingPlayer = updatedPlayers[existingPlayerIndex];
        
        updatedPlayers[existingPlayerIndex] = {
          ...existingPlayer,
          id: newPlayer.id, // Update ID to new connection ID
          // Keep coins, lands, eliminated status
        };
        
        // Add log
        return {
          ...prev,
          players: updatedPlayers,
          logs: [...prev.logs, `${newPlayer.name}님이 재접속했습니다.`]
        };
      }

      // New Player
      return {
        ...prev,
        players: [...prev.players, newPlayer],
        logs: [...prev.logs, `${newPlayer.name}님이 입장했습니다.`]
      };
    });
  };

  const handlePlayerAction = (action: { playerId: string, type: string, data: any }) => {
    setGameState(prev => {
      const players = prev.players.map(p => {
        if (p.id !== action.playerId) return p;
        
        // Handle Answer
        if (action.type === 'ANSWER') {
          const currentQuiz = prev.quizzes[prev.currentQuizIndex];
          const isCorrect = action.data.answerIndex === currentQuiz.correctIndex;
          
          return {
            ...p,
            lastAnswerCorrect: isCorrect,
            coins: isCorrect ? p.coins + 1 : p.coins
          };
        }

        // Handle Strategy Selection
        if (action.type === 'STRATEGY') {
          return {
            ...p,
            selectedAction: action.data.action, // 'ATTACK' or 'DEFEND'
            pendingAttacks: action.data.targets || [],
            pendingShop: action.data.shopItem || null
          };
        }

        return p;
      });
      return { ...prev, players };
    });
  };

  // CSV Import Logic (unchanged)
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
        alert(`${newQuizzes.length}개의 퀴즈를 불러왔습니다!`);
      }
    };
    reader.readAsText(file);
  };

  // Host Control Flow
  const startGame = () => {
    const lands = generateMap(gameState.totalLands);
    const landsWithOwners = assignInitialLands(lands, gameState.players);
    
    setGameState(prev => ({
      ...prev,
      phase: 'QUIZ',
      lands: landsWithOwners,
      round: 1,
      currentQuizIndex: 0,
      timer: prev.quizDuration,
      logs: ['게임 시작! 1라운드'],
      lastRoundEvents: []
    }));

    startTimer(gameState.quizDuration, () => endQuizPhase());
  };

  const startTimer = (seconds: number, onComplete: () => void) => {
    let timeLeft = seconds;
    const interval = setInterval(() => {
      timeLeft -= 1;
      setGameState(prev => ({ ...prev, timer: timeLeft }));
      
      if (timeLeft <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);
  };

  const endQuizPhase = () => {
    // Transition to ACTION Phase automatically
    setGameState(prev => ({
      ...prev,
      phase: 'ACTION_SELECT',
      timer: 30
    }));
    startTimer(30, () => resolveRound());
  };

  const resolveRound = () => {
    setGameState(prev => {
      const { nextState, messages } = resolveTurn(prev);
      return {
        ...nextState,
        phase: 'ROUND_RESULT',
        logs: [...messages, ...prev.logs],
        timer: 10
      };
    });
  };

  const nextRound = () => {
    setGameState(prev => {
      const nextIdx = prev.currentQuizIndex + 1;
      if (nextIdx >= prev.quizzes.length) {
        return { ...prev, phase: 'GAME_OVER' };
      }
      return {
        ...prev,
        phase: 'QUIZ',
        currentQuizIndex: nextIdx,
        round: prev.round + 1,
        timer: prev.quizDuration,
        lastRoundEvents: [] 
      };
    });
    startTimer(gameState.quizDuration, () => endQuizPhase());
  };

  // -- Guest Actions --

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
    
    // Slight delay to ensure WS connection is open before sending JOIN
    setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
             wsRef.current.send(JSON.stringify({
                type: 'PLAYER_JOIN',
                payload: newPlayer
             }));
        } else {
            // Retry once if not ready
             setTimeout(() => {
                 wsRef.current?.send(JSON.stringify({
                    type: 'PLAYER_JOIN',
                    payload: newPlayer
                 }));
             }, 1000);
        }
    }, 500);
  };

  const submitAnswer = (idx: number) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      payload: {
        playerId: myPlayerId,
        type: 'ANSWER',
        data: { answerIndex: idx }
      }
    });
  };

  const submitStrategy = (action: 'ATTACK' | 'DEFEND', targets: number[], shopItem?: 'PIERCE' | 'BUY_LAND') => {
    setActionLocked(true);
    sendMessage({
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

        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm h-full">
            <h3 className="font-bold mb-4 text-lg text-indigo-800">게임 설정 및 제어</h3>
            {gameState.phase === 'LOBBY' && (
              <div className="space-y-6">
                <div className="space-y-4 bg-indigo-50 p-4 rounded-lg">
                   <div>
                     <label className="text-sm font-bold text-indigo-900 block mb-1">방 코드 설정</label>
                     <input 
                       type="text"
                       className="w-full border p-2 rounded uppercase font-mono font-bold text-center tracking-widest"
                       value={gameState.roomCode}
                       onChange={(e) => setGameState({...gameState, roomCode: e.target.value.toUpperCase()})}
                     />
                   </div>

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
                   <label className="text-sm font-semibold">퀴즈 업로드 (CSV)</label>
                   <input type="file" accept=".csv" onChange={handleFileUpload} className="w-full text-sm bg-gray-50 p-2 rounded border" />
                </div>
                <hr className="border-gray-100" />
                <LobbyView 
                  isHost={true} 
                  players={gameState.players} 
                  onStart={startGame} 
                  roomCode={gameState.roomCode} 
                />
              </div>
            )}
            
            {gameState.phase === 'QUIZ' && (
               <div className="text-center py-8">
                 <div className="text-6xl font-black text-indigo-600 mb-4 animate-pulse">{gameState.timer}</div>
                 <p className="text-lg font-medium text-gray-600">학생들이 문제를 풀고 있습니다...</p>
                 <Button className="mt-8 bg-gray-400 hover:bg-gray-500" onClick={() => endQuizPhase()}>퀴즈 강제 종료</Button>
               </div>
            )}

            {gameState.phase === 'ACTION_SELECT' && (
               <div className="text-center py-8">
                 <div className="text-6xl font-black text-indigo-600 mb-4 animate-pulse">{gameState.timer}</div>
                 <p className="text-lg font-medium text-gray-600">전략을 선택하고 있습니다...</p>
                 <Button className="mt-8 bg-gray-400 hover:bg-gray-500" onClick={() => resolveRound()}>결과 바로 보기</Button>
               </div>
            )}

            {gameState.phase === 'ROUND_RESULT' && (
               <div className="text-center py-8">
                 <p className="mb-4 text-xl font-bold text-green-600">라운드 결과 집계 완료!</p>
                 <Button onClick={nextRound} className="w-full py-4 text-lg">다음 라운드 시작</Button>
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
    // Reconnect fallback: If myPlayerId is in gameState but ID doesn't match exactly (should handle by handlePlayerJoin logic),
    // we find by NAME if we want stronger robustness, but ID update in handlePlayerJoin is safer.
    const me = gameState.players.find(p => p.id === myPlayerId);
    
    // Fallback loading state
    if (!me) {
        if (gameState.phase === 'LOBBY') {
             return <LobbyView isHost={false} players={gameState.players} onStart={() => {}} roomCode={gameState.roomCode} />;
        }
        return (
            <div className="p-10 text-center space-y-4">
                <div className="text-xl font-bold text-gray-400 animate-pulse">서버와 동기화 중이거나 접속이 끊겼습니다.</div>
                <div className="text-sm text-gray-500">방 코드: {gameState.roomCode} / 이름: {joinName}</div>
                <Button onClick={joinGame}>재접속 시도</Button>
            </div>
        );
    }

    if (gameState.phase === 'LOBBY') {
      return <LobbyView isHost={false} players={gameState.players} onStart={() => {}} roomCode={gameState.roomCode} />;
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
        if (selectedLandIds.includes(id)) {
          setSelectedLandIds(prev => prev.filter(lid => lid !== id));
        } else {
          if (selectedLandIds.length < allowedAttacks) {
            setSelectedLandIds(prev => [...prev, id]);
          }
        }
      };

      const handleConfirmAttack = () => {
        submitStrategy('ATTACK', selectedLandIds, pendingShopItem);
      };

      const handleDefend = () => {
        submitStrategy('DEFEND', [], pendingShopItem);
      };

      // Shop State local to this render
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [pendingShopItem, setPendingShopItem] = useState<'PIERCE' | 'BUY_LAND' | undefined>();

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
                 {me.lastAnswerCorrect ? "정답을 맞춰서 공격 기회가 2회입니다!" : "오답이라 공격 기회가 1회입니다."}
              </div>

              {/* Shop Section */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                 <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">🛒 아이템 상점</h3>
                 <div className="flex gap-2">
                    <Button 
                      disabled={me.coins < COIN_COSTS.PIERCE_DEFENSE || pendingShopItem === 'PIERCE'}
                      onClick={() => setPendingShopItem(pendingShopItem === 'PIERCE' ? undefined : 'PIERCE')}
                      className={`text-sm flex-1 ${pendingShopItem === 'PIERCE' ? 'ring-4 ring-offset-1 ring-yellow-400 bg-indigo-700' : ''}`}
                    >
                      방어 관통 (3💰)
                    </Button>
                    <Button 
                      disabled={me.coins < COIN_COSTS.BUY_LAND || pendingShopItem === 'BUY_LAND'}
                      onClick={() => setPendingShopItem('BUY_LAND')}
                      className={`text-sm flex-1 ${pendingShopItem === 'BUY_LAND' ? 'ring-4 ring-offset-1 ring-yellow-400 bg-indigo-700' : ''}`}
                    >
                      빈 땅 구매 (2💰)
                    </Button>
                 </div>
                 {pendingShopItem === 'BUY_LAND' && (
                    <div className="mt-3 bg-white p-3 rounded text-sm text-center">
                       <p className="mb-2">빈 땅을 무작위로 하나 구매합니다.</p>
                       <Button onClick={() => submitStrategy('DEFEND', [], 'BUY_LAND')} className="w-full bg-green-600 hover:bg-green-700">
                          구매 확정
                       </Button>
                    </div>
                 )}
              </div>

              {pendingShopItem !== 'BUY_LAND' && (
                <>
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
                        disabled={selectedLandIds.length === 0}
                      >
                        ⚔️ 공격 확정
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
                </>
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
    }

    if (gameState.phase === 'ROUND_RESULT' || gameState.phase === 'GAME_OVER') {
       return (
         <div className="p-4 space-y-4 max-w-4xl mx-auto">
           <h2 className="text-2xl font-bold text-center mb-4 text-indigo-800 bg-white p-2 rounded-lg shadow-sm">라운드 결과</h2>
           <GameMap 
             lands={gameState.lands} 
             players={gameState.players} 
             myPlayerId={myPlayerId} 
             combatEvents={gameState.phase === 'ROUND_RESULT' ? gameState.lastRoundEvents : []}
           />
           <div className="bg-white p-4 rounded-xl shadow border border-gray-100 max-h-60 overflow-y-auto">
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
          퀴즈 땅따먹기
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
        <div className="mt-12 text-center text-sm text-gray-400 bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm">
          <p>서버 연결 주소: {WS_BASE_URL}</p>
          <p>Cloudflare 배포 후 App.tsx 상단의 WS_BASE_URL을 수정하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="font-bold text-indigo-700 flex items-center gap-2 text-lg">
          <span>🏰</span> 퀴즈 땅따먹기
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