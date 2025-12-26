
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import { GameState, Player, BroadcastMessage, GamePhase, Quiz, AVATARS, COLORS, CombatEvent } from './types';
import { DEFAULT_QUIZZES, COIN_COSTS } from './constants';
import { generateMap, assignInitialLands, resolveTurn } from './utils/gameLogic';
import { GameMap } from './components/GameMap';
import { Button } from './components/Button';

// -- Assets --
const IMAGES = {
  QUIZ: "https://lh3.googleusercontent.com/d/1MRKcqtXnqmsFeGN4w-ULPq6x4-ZoC2C4", // 지략의 시간 (퀴즈)
  ACTION: "https://lh3.googleusercontent.com/d/1Okvxliz4Nfe7mKeCHIPDDt1989zoLVKk", // 전쟁의 서막 (전략)
  DIPLOMACY: "https://lh3.googleusercontent.com/d/1pv6Owdj9mGBy0CGagJaa2qBoQ320w5Yi" // 천하 정세 (외교)
};

// -- Sub-Components --

const PhaseVisual = ({ phase }: { phase: GamePhase }) => {
    let imgUrl = "";
    let title = "";
    let desc = "";
    let color = "";

    switch(phase) {
        case 'QUIZ':
            imgUrl = IMAGES.QUIZ;
            title = "지략의 시간 (퀴즈)";
            desc = "제갈량의 지혜로 문제를 해결하고 군자금을 확보하라!";
            color = "border-indigo-500 bg-indigo-50";
            break;
        case 'ACTION_SELECT':
            imgUrl = IMAGES.ACTION;
            title = "전쟁의 서막 (전략)";
            desc = "관우의 무용으로 적진을 돌파하거나 굳건히 방어하라!";
            color = "border-red-500 bg-red-50";
            break;
        case 'ROUND_RESULT':
        case 'GAME_OVER': 
            imgUrl = IMAGES.DIPLOMACY;
            title = phase === 'GAME_OVER' ? "천하 통일 (종료)" : "천하 정세 (외교)";
            desc = phase === 'GAME_OVER' ? "긴 전쟁이 끝났습니다." : "유비의 덕으로 동맹을 맺고 적을 파악하라!";
            color = "border-green-500 bg-green-50";
            break;
        default:
            return null;
    }

    if (!imgUrl) return null;

    return (
        <div className={`flex items-center gap-4 p-4 rounded-xl border-l-4 shadow-sm mb-4 ${color} transition-all duration-500 bg-white`}>
            <div className="flex-shrink-0">
                <img 
                src={imgUrl} 
                alt={title} 
                className="w-20 h-20 object-cover rounded-full border-4 border-white shadow-md bg-gray-200"
                referrerPolicy="no-referrer" 
                />
            </div>
            <div>
                <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                <p className="text-sm text-gray-600">{desc}</p>
            </div>
        </div>
    );
};

const RoundReport = ({ events }: { events: CombatEvent[] }) => {
    if (events.length === 0) return (
        <div className="bg-white p-6 rounded-xl shadow-md text-center border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-bold">이번 라운드에는 조용한 정세가 유지되었습니다.</p>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-indigo-100">
            <div className="bg-indigo-600 text-white px-4 py-3 font-bold text-center flex items-center justify-center gap-2">
                <span>📜 이번 라운드 전쟁 보고서</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {events.map((ev, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 transition-colors">
                        <div className="text-2xl">
                            {ev.type === 'CONQUERED' ? '⚔️' : ev.type === 'DEFENDED' ? '🛡️' : ev.type === 'PIERCED' ? '💥' : '💰'}
                        </div>
                        <div className="text-sm">
                            {ev.type === 'CONQUERED' && (
                                <p><span className="font-bold text-indigo-700">{ev.attackerName}</span> 군주가 <span className="font-bold text-gray-600">{ev.defenderName}</span>의 <span className="text-red-500 font-bold">{ev.landId + 1}번 성</span>을 점령했습니다!</p>
                            )}
                            {ev.type === 'DEFENDED' && (
                                <p><span className="font-bold text-indigo-700">{ev.defenderName}</span> 군주가 <span className="font-bold text-gray-500">{ev.allAttackers?.join(', ')}</span>의 파상공세를 <span className="text-blue-600 font-bold">성공적으로 방어</span>했습니다.</p>
                            )}
                            {ev.type === 'PIERCED' && (
                                <p><span className="text-red-600 font-bold">방어 관통!</span> <span className="font-bold text-gray-700">{ev.defenderName}</span>의 철벽 수비가 무너졌습니다.</p>
                            )}
                            {ev.type === 'BOUGHT' && (
                                <p><span className="font-bold text-indigo-700">{ev.attackerName}</span> 군주가 풍부한 군자금으로 <span className="text-green-600 font-bold">빈 땅({ev.landId + 1}번)</span>을 매입했습니다.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SubmissionStatusBoard = ({ players, phase }: { players: Player[], phase: GamePhase }) => {
    const checkSubmitted = (p: Player) => {
        if (phase === 'QUIZ') return p.lastAnswerCorrect !== undefined;
        if (phase === 'ACTION_SELECT') return !!p.selectedAction;
        return false;
    };

    const submittedCount = players.filter(checkSubmitted).length;
    const totalPlayers = players.length;
    const isAllSubmitted = submittedCount === totalPlayers && totalPlayers > 0;

    const title = phase === 'QUIZ' ? '📝 정답 제출 현황' : '🚩 전략 제출 현황';

    return (
        <div className="bg-white p-5 rounded-xl shadow-md border-2 border-red-100 mb-6 animate-fade-in">
            <h3 className="font-bold text-red-800 mb-4 flex justify-between items-center text-lg border-b border-red-100 pb-2">
                <span className="flex items-center gap-2">{title}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-mono ${isAllSubmitted ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-red-100 text-red-700'}`}>
                    {submittedCount} / {totalPlayers} 완료
                </span>
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {players.map(p => {
                    const isSubmitted = checkSubmitted(p);
                    return (
                        <div key={p.id} className={`
                            relative p-3 rounded-xl border flex flex-col items-center gap-2 transition-all duration-300
                            ${isSubmitted 
                                ? 'bg-green-50 border-green-300 shadow-sm scale-105' 
                                : 'bg-gray-50 border-gray-200 opacity-80'}
                        `}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg text-white font-bold shadow-sm ${p.color} overflow-hidden`}>
                                <img src={p.avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <span className={`text-sm font-bold truncate w-full text-center ${isSubmitted ? 'text-green-800' : 'text-gray-500'}`}>
                                {p.name}
                            </span>
                            {isSubmitted && (
                                <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                             {!isSubmitted && (
                                <div className="absolute -top-2 -right-2 bg-gray-300 text-white rounded-full p-1">
                                    <span className="text-[10px] font-bold px-1">...</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {isAllSubmitted && (
                <div className="mt-4 text-center text-green-600 font-bold bg-green-50 py-2 rounded-lg animate-bounce">
                    ✨ 모든 군주가 {phase === 'QUIZ' ? '정답' : '전략'}을 제출했습니다!
                </div>
            )}
        </div>
    );
};

const PlayerStatusTable = ({ players, phase }: { players: Player[], phase: GamePhase }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">📜 장수 현황판</h3>
                <span className="text-xs text-gray-500 font-mono">총 {players.length}명</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-4 py-2">군주</th>
                            <th className="px-4 py-2 text-center">영토 / 군자금</th>
                            <th className="px-4 py-2 text-center">퀴즈 결과</th>
                            <th className="px-4 py-2 text-center">전략</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {players.map(p => {
                            let actionText = '-';
                            if (phase === 'ACTION_SELECT') {
                                actionText = p.selectedAction ? '✅ 제출 완료' : '⏳ 대기 중';
                            } else if (phase === 'ROUND_RESULT') {
                                if (p.selectedAction === 'DEFEND') actionText = '🛡️ 철벽 방어';
                                else if (p.pendingAttacks.length > 0) actionText = `⚔️ 침공 (${p.pendingAttacks.length}곳)`;
                                else if (p.pendingShop === 'BUY_LAND') actionText = '💰 영토 매입';
                                else actionText = '대기중';
                            }
                            
                            return (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center shadow-sm text-xs text-white font-bold overflow-hidden`}>
                                             <img src={p.avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                        <span className={`font-bold ${p.isEliminated ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                            {p.name}
                                        </span>
                                        {p.isEliminated && <span className="text-xs bg-red-100 text-red-600 px-1 rounded">패배</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="font-mono">
                                            <span className="text-indigo-600 font-bold">{p.lands.length}성</span>
                                            <span className="mx-2 text-gray-300">|</span>
                                            <span className="text-yellow-600 font-bold">{p.coins}금</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {p.lastAnswerCorrect === true && <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">⭕ 정답 (+1금)</span>}
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

const Leaderboard = ({ players, myPlayerId }: { players: Player[], myPlayerId?: string }) => {
    const sortedPlayers = [...players].sort((a, b) => {
        if (b.lands.length !== a.lands.length) return b.lands.length - a.lands.length;
        if (b.coins !== a.coins) return b.coins - a.coins;
        return a.name.localeCompare(b.name);
    });

    const winner = sortedPlayers[0];
    const myRank = myPlayerId ? sortedPlayers.findIndex(p => p.id === myPlayerId) + 1 : 0;

    return (
        <div className="space-y-6 animate-fade-in">
             {winner && (
                <div className="text-center bg-yellow-100 border-4 border-yellow-300 p-6 rounded-2xl shadow-lg mb-8">
                    <div className="text-5xl mb-2">👑</div>
                    <h2 className="text-3xl font-extrabold text-yellow-800 mb-2">천하 통일 달성!</h2>
                    <p className="text-2xl font-bold text-indigo-900">
                        <span className="text-3xl mr-2">"{winner.name}"</span> 
                        님이 천하를 평정하였습니다!
                    </p>
                </div>
            )}
            
            {myRank > 0 && (
                <div className="text-center mb-4">
                    <span className="bg-indigo-600 text-white px-4 py-2 rounded-full text-xl font-bold shadow-md">
                        나의 순위: {myRank}위
                    </span>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                <div className="bg-gray-800 text-white px-4 py-3 font-bold text-center">🏆 영웅 순위표</div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 w-16 text-center">순위</th>
                            <th className="px-4 py-3">군주</th>
                            <th className="px-4 py-3 text-center">영토</th>
                            <th className="px-4 py-3 text-center">군자금</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sortedPlayers.map((p, idx) => (
                            <tr key={p.id} className={`${p.id === myPlayerId ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                                <td className="px-4 py-3 text-center font-bold text-gray-600">
                                    {idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : idx + 1 === 3 ? '🥉' : idx + 1}
                                </td>
                                <td className="px-4 py-3 font-bold flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center shadow-sm overflow-hidden`}>
                                        <img src={p.avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    </div>
                                    {p.name}
                                    {p.isEliminated && <span className="text-xs text-red-500 ml-2">(패배)</span>}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-indigo-600 font-bold">{p.lands.length}</td>
                                <td className="px-4 py-3 text-center font-mono text-yellow-600 font-bold">{p.coins}</td>
                            </tr>
                        ))}
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
      <p className="text-gray-500 text-lg">전국의 영웅들이 모이기를 기다리고 있습니다...</p>
      {connectionStatus && <p className="text-sm text-orange-600 mt-2 font-mono font-bold bg-orange-50 inline-block px-2 py-1 rounded">{connectionStatus}</p>}
    </div>
    
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
      {players.map(p => (
        <div key={p.id} className="bg-white p-4 rounded-xl shadow-md flex items-center space-x-3 animate-fade-in border-b-4 border-indigo-100">
          <div className={`w-10 h-10 rounded-full ${p.color} flex items-center justify-center text-xl shadow-sm text-white font-bold overflow-hidden`}>
             <img src={p.avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
            천하 통일 전쟁 시작 ({players.length}명 대기중)
          </Button>
      </div>
    )}
    {!isHost && <div className="text-indigo-600 animate-pulse font-bold text-lg">군주님이 곧 전쟁을 선포합니다...</div>}
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
        <span className="text-sm font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-3 py-1 rounded-full">지략 대결</span>
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
            {isSubmitted ? '제출 완료! (다른 군주 기다리는 중...)' : '정답 제출하기'}
          </Button>
          {isSubmitted && <p className="mt-4 text-gray-500 animate-pulse">모든 군주가 답을 적으면 전쟁 준비 단계로 넘어갑니다.</p>}
        </div>
      )}

      {isHost && (
          <div className="mt-6 text-center">
             <p className="text-gray-400 italic mb-2">진행자 화면: 정답을 선택할 수 없습니다.</p>
             <p className="text-indigo-600 font-bold">군주들이 모두 답을 적으면 자동으로 넘어갑니다.</p>
          </div>
      )}
    </div>
  );
};

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
    pendingShopItem,
    prevQuiz
}: any) => {

    const prevAnswerText = prevQuiz ? `${prevQuiz.correctIndex + 1}. ${prevQuiz.options[prevQuiz.correctIndex]}` : '알 수 없음';

    return (
        <div className="p-4 max-w-4xl mx-auto pb-24">
          <PhaseVisual phase={gameState.phase} />

          <div className="bg-white p-4 rounded-xl shadow-md mb-4 flex justify-between items-center sticky top-0 z-20 border-b-4 border-indigo-100">
             <div>
               <div className="text-xs text-gray-500 font-bold">국고 (군자금)</div>
               <div className="text-2xl font-bold text-yellow-500 flex items-center drop-shadow-sm">
                 💰 {me.coins}금
               </div>
             </div>
             <div className="text-right">
               <div className="text-xs text-gray-500 font-bold">퀴즈 결과</div>
               <div className={`font-bold text-lg ${me.lastAnswerCorrect ? 'text-green-600' : 'text-red-500'}`}>
                 {me.lastAnswerCorrect ? '승리! (+1금)' : '패배'}
               </div>
             </div>
          </div>

          {!actionLocked ? (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded text-center text-sm text-blue-800 mb-2">
                 <div className="font-bold text-lg mb-1">{me.lastAnswerCorrect ? "🎉 승전보!" : "😭 패전..."}</div>
                 <div className="text-blue-900 bg-blue-100 py-1 px-3 rounded inline-block">
                     직전 정답: <b>{prevAnswerText}</b>
                 </div>
                 <div className="mt-2 text-xs opacity-80">
                    {me.lastAnswerCorrect ? "공격 2회 또는 방어 태세 가능" : "공격 1회만 가능 (방어 불가)"}
                 </div>
              </div>

              {/* Shop Section */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                 <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">🛒 병법서 및 영토 매입</h3>
                 <div className="flex gap-2">
                    <Button 
                      disabled={me.coins < COIN_COSTS.PIERCE_DEFENSE}
                      onClick={() => onShopItemSelect(pendingShopItem === 'PIERCE' ? undefined : 'PIERCE')}
                      className={`text-sm flex-1 ${pendingShopItem === 'PIERCE' ? 'ring-4 ring-offset-1 ring-yellow-400 bg-indigo-700 shadow-inner' : ''}`}
                    >
                      {pendingShopItem === 'PIERCE' ? '✅ 방어 관통 선택됨' : `방어 관통 (${COIN_COSTS.PIERCE_DEFENSE}금)`}
                    </Button>
                    <Button 
                      disabled={me.coins < COIN_COSTS.BUY_LAND}
                      onClick={() => onShopItemSelect(pendingShopItem === 'BUY_LAND' ? undefined : 'BUY_LAND')}
                      className={`text-sm flex-1 ${pendingShopItem === 'BUY_LAND' ? 'ring-4 ring-offset-1 ring-yellow-400 bg-indigo-700 shadow-inner' : ''}`}
                    >
                       {pendingShopItem === 'BUY_LAND' ? '✅ 빈 땅 구매 선택됨' : `빈 땅 구매 (${COIN_COSTS.BUY_LAND}금)`}
                    </Button>
                 </div>
                 {pendingShopItem === 'BUY_LAND' && (
                    <div className="mt-3 bg-white p-3 rounded text-sm text-center border border-indigo-200 text-indigo-700 font-bold">
                       💰 빈 땅 구매가 예약되었습니다! (라운드 종료 시 무작위 획득)<br/>
                       <span className="text-xs font-normal text-gray-500">주의: 구매를 선택해도 다른 땅을 공격할 수 있습니다.</span>
                    </div>
                 )}
              </div>

              <div className="flex justify-center gap-4">
                <div className="text-center w-full">
                  <p className="text-sm font-semibold mb-2 bg-indigo-100 inline-block px-3 py-1 rounded-full text-indigo-800">
                    공격할 적의 영토 선택 ({selectedLandIds.length}/{allowedAttacks})
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
                    {selectedLandIds.length > 0 ? '⚔️ 공격 개시' : (pendingShopItem === 'BUY_LAND' ? '💰 구매 확정 및 대기' : '행동을 선택하세요')}
                  </Button>
                </div>
              </div>

              {canDefend && (
                <div className="text-center border-t-2 border-dashed border-gray-300 pt-6 mt-4">
                  <p className="mb-3 text-gray-500 font-bold">- 또는 -</p>
                  <Button onClick={handleDefend} variant="secondary" className="w-full border-2 border-indigo-200 py-3 text-lg font-bold text-indigo-700 hover:bg-indigo-50">
                    🛡️ 철벽 방어 (공격 대신 수비)
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl shadow-lg border-2 border-indigo-50">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">작전 명령 전달 완료!</h3>
              <p className="text-gray-500">다른 군주들이 작전을 짤 때까지 대기하십시오...</p>
            </div>
          )}
        </div>
    );
};

const App: React.FC = () => {
  const [mode, setMode] = useState<'MENU' | 'HOST' | 'GUEST'>('MENU');
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

  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [joinName, setJoinName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [targetQuizCount, setTargetQuizCount] = useState<number>(DEFAULT_QUIZZES.length);

  const [selectedLandIds, setSelectedLandIds] = useState<number[]>([]);
  const [actionLocked, setActionLocked] = useState(false);
  const [pendingShopItem, setPendingShopItem] = useState<'PIERCE' | 'BUY_LAND' | undefined>();

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const hostConnRef = useRef<DataConnection | null>(null);
  const lastPingMap = useRef<Record<string, number>>({});
  
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerCallbackRef = useRef<(() => void) | null>(null);

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

  const getPeerId = (code: string) => `quiz-land-grab-${code}`; 
  const peerConfig = {
    debug: 1,
    config: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }]
    }
  };

  const startHeartbeat = (isHost: boolean) => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(() => {
        if (isHost) {
            const now = Date.now();
            setGameState(prev => {
                const disconnectedIds: string[] = [];
                prev.players.forEach(p => {
                    const lastPing = lastPingMap.current[p.id];
                    if (!lastPing) return; 
                    if (now - lastPing > 15000) disconnectedIds.push(p.id);
                });
                if (disconnectedIds.length > 0) {
                     disconnectedIds.forEach(id => {
                        const conn = connectionsRef.current.find(c => (c as any).metadata?.playerId === id);
                        if (conn && conn.open) conn.close();
                     });
                }
                return prev;
            });
            connectionsRef.current.forEach(conn => {
                if (conn.open) conn.send({ type: 'HEARTBEAT', payload: null });
            });
        }
    }, 2000);
  };

  const initializeHost = (code: string) => {
    if (peerRef.current) peerRef.current.destroy();
    setConnectionStatus('방 생성 중...');
    try {
      const peer = new Peer(getPeerId(code), peerConfig);
      peer.on('open', () => {
        setConnectionStatus('방 생성 완료! 학생들이 입장할 수 있습니다.');
        peerRef.current = peer;
        startHeartbeat(true);
      });
      peer.on('connection', (conn) => {
        connectionsRef.current.push(conn);
        conn.on('data', (data: any) => handleMessage(data, conn));
        conn.on('close', () => {
          connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
        });
        conn.on('open', () => {
          setTimeout(() => conn.send({ type: 'STATE_UPDATE', payload: gameStateRef.current }), 100);
        });
      });
      peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') alert('이미 사용 중인 방 코드입니다.');
        setMode('MENU');
      });
      peerRef.current = peer;
    } catch (e) { setConnectionStatus('초기화 오류'); }
  };

  const initializeGuest = (code: string, player: Player) => {
    if (peerRef.current) peerRef.current.destroy();
    setConnectionStatus('연결 시도 중...');
    const peer = new Peer(peerConfig); 
    peerRef.current = peer;
    peer.on('open', () => {
      const conn = peer.connect(getPeerId(code), { reliable: true, metadata: { playerId: player.id } });
      conn.on('open', () => {
        setConnectionStatus('연결 성공!');
        hostConnRef.current = conn;
        conn.send({ type: 'PLAYER_JOIN', payload: player });
      });
      conn.on('data', (data: any) => {
        if (data && data.type === 'STATE_UPDATE') {
          setGameState(data.payload);
          if (data.payload.phase === 'ACTION_SELECT' && gameStateRef.current.phase !== 'ACTION_SELECT') {
            setActionLocked(false); setSelectedLandIds([]); setPendingShopItem(undefined);
          }
        } else if (data && data.type === 'HEARTBEAT') {
            conn.send({ type: 'HEARTBEAT_ACK', payload: { playerId: player.id } });
        }
      });
    });
  };

  const broadcastState = useCallback((state: GameState) => {
    if (mode === 'HOST') {
      connectionsRef.current.forEach(conn => { if (conn.open) conn.send({ type: 'STATE_UPDATE', payload: state }); });
    }
  }, [mode]);

  useEffect(() => { if (mode === 'HOST') broadcastState(gameState); }, [gameState, mode, broadcastState]);

  const handleMessage = (msg: BroadcastMessage, conn?: DataConnection) => {
    if (msg.type === 'PLAYER_JOIN') handlePlayerJoin(msg.payload, conn);
    else if (msg.type === 'PLAYER_ACTION') handlePlayerAction(msg.payload);
    else if (msg.type === 'HEARTBEAT_ACK') {
        const pid = msg.payload.playerId;
        if (pid) lastPingMap.current[pid] = Date.now();
    }
  };

  const handlePlayerJoin = (newPlayer: Player, conn?: DataConnection) => {
    if (conn) (conn as any).metadata = { playerId: newPlayer.id };
    lastPingMap.current[newPlayer.id] = Date.now();

    setGameState(prev => {
      const existingIdx = prev.players.findIndex(p => p.name === newPlayer.name);
      if (existingIdx !== -1) {
        const oldId = prev.players[existingIdx].id;
        const newId = newPlayer.id;
        const updatedPlayers = [...prev.players];
        updatedPlayers[existingIdx] = { ...updatedPlayers[existingIdx], id: newId };
        const updatedLands = prev.lands.map(land => land.ownerId === oldId ? { ...land, ownerId: newId } : land);
        updatedPlayers[existingIdx].lands = updatedLands.filter(l => l.ownerId === newId).map(l => l.id);
        return { ...prev, players: updatedPlayers, lands: updatedLands, logs: [`${newPlayer.name}님이 재접속했습니다.`, ...prev.logs] };
      }

      // Unique Avatar Assignment Logic
      let assignedAvatar = "";
      const usedAvatars = prev.players.map(p => p.avatar);
      if (prev.players.length < AVATARS.length) {
          const availableAvatars = AVATARS.filter(a => !usedAvatars.includes(a));
          assignedAvatar = availableAvatars[0];
      } else {
          assignedAvatar = AVATARS[prev.players.length % AVATARS.length];
      }

      let assignedColor = newPlayer.color;
      if (prev.players.length < COLORS.length) {
          const usedColors = new Set(prev.players.map(p => p.color));
          if (usedColors.has(assignedColor)) {
              const available = COLORS.filter(c => !usedColors.has(c));
              if (available.length > 0) assignedColor = available[Math.floor(Math.random() * available.length)];
          }
      }
      
      const playerToAdd = { ...newPlayer, avatar: assignedAvatar, color: assignedColor };
      return { ...prev, players: [...prev.players, playerToAdd], logs: [`${playerToAdd.name}님이 입장했습니다.`, ...prev.logs] };
    });
  };

  const handlePlayerAction = (action: { playerId: string, type: string, data: any }) => {
    setGameState(prev => {
      const players = prev.players.map(p => {
        if (p.id !== action.playerId) return p;
        if (action.type === 'ANSWER') {
          const isCorrect = action.data.answerIndex === prev.quizzes[prev.currentQuizIndex].correctIndex;
          return { ...p, lastAnswerCorrect: isCorrect, coins: isCorrect ? p.coins + 1 : p.coins };
        }
        if (action.type === 'STRATEGY') {
          return { ...p, selectedAction: action.data.action, pendingAttacks: action.data.targets || [], pendingShop: action.data.shopItem || null };
        }
        return p;
      });
      if (prev.phase === 'QUIZ' && action.type === 'ANSWER') {
        if (players.filter(p => p.lastAnswerCorrect !== undefined).length >= players.length) {
          setTimeout(() => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); endQuizPhase({ ...prev, players }); }, 500);
        }
      }
      return { ...prev, players };
    });
  };

  const startGame = () => {
    const selectedQuizzes = gameState.quizzes.slice(0, targetQuizCount);
    const lands = generateMap(gameState.totalLands);
    const resetPlayers = gameState.players.map(p => ({ ...p, lastAnswerCorrect: undefined, isEliminated: false, coins: 0, lands: [] }));
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
      lastRoundEvents: [],
      logs: ['📢 천하 통일 전쟁 시작!']
    }));
    startTimer(gameState.quizDuration, () => endQuizPhase());
  };

  const startTimer = (seconds: number, onComplete: () => void) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerCallbackRef.current = onComplete;
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
      const currentT = gameStateRef.current.timer;
      const newTime = currentT + seconds;
      setGameState(prev => ({ ...prev, timer: newTime }));
      if (timerCallbackRef.current) startTimer(newTime, timerCallbackRef.current);
  };

  const endQuizPhase = (override?: GameState) => {
    const transition = (s: GameState) => ({ ...s, phase: 'ACTION_SELECT' as GamePhase, timer: 30 });
    setGameState(prev => transition(override || prev));
    startTimer(30, () => resolveRound());
  };

  const resolveRound = () => {
    setGameState(prev => {
      const { nextState, messages } = resolveTurn(prev);
      return { ...nextState, phase: 'ROUND_RESULT', logs: [...messages, ...prev.logs], timer: 0 };
    });
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const nextRound = () => {
    setGameState(prev => {
      const nextIdx = prev.currentQuizIndex + 1;
      if (nextIdx >= prev.quizzes.length) return { ...prev, phase: 'GAME_OVER' };
      return { 
        ...prev, 
        players: prev.players.map(p => ({ ...p, lastAnswerCorrect: undefined, selectedAction: undefined, pendingAttacks: [], pendingShop: null })), 
        phase: 'QUIZ', 
        currentQuizIndex: nextIdx, 
        round: prev.round + 1, 
        timer: prev.quizDuration, 
        lastRoundEvents: [],
        logs: [`📢 제 ${prev.round + 1} 라운드 시작!`, ...prev.logs]
      };
    });
    startTimer(gameState.quizDuration, () => endQuizPhase());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      let text = '';
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder('euc-kr').decode(buffer);
      }
      const lines = text.split('\n');
      const newQuizzes: Quiz[] = [];
      lines.slice(1).forEach((line, idx) => {
        const cols = line.split(',');
        if (cols.length >= 6) {
          newQuizzes.push({
            id: `csv-${idx}`,
            question: cols[0].trim(),
            options: [cols[1].trim(), cols[2].trim(), cols[3].trim(), cols[4].trim()],
            correctIndex: (parseInt(cols[5].trim()) || 1) - 1
          });
        }
      });
      if (newQuizzes.length > 0) {
        setGameState(prev => ({ ...prev, quizzes: newQuizzes }));
        setTargetQuizCount(newQuizzes.length);
        alert(`${newQuizzes.length}개의 퀴즈를 불러왔습니다!`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadSampleCSV = () => {
      const csvContent = "문제,보기1,보기2,보기3,보기4,정답번호(1-4)\n대한민국의 수도는?,서울,부산,광주,대전,1";
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "quiz_sample.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const joinGame = () => {
    if (!joinName || !joinRoomCode) return;
    const id = `p-${Date.now()}`;
    const newPlayer: Player = { 
      id, 
      name: joinName, 
      avatar: AVATARS[0], // Will be reassigned in handlePlayerJoin
      color: COLORS[0], 
      coins: 0, 
      lands: [], 
      isEliminated: false, 
      pendingAttacks: [], 
      isDefending: false 
    };
    setMyPlayerId(id); setGameState(prev => ({ ...prev, roomCode: joinRoomCode })); setMode('GUEST');
    initializeGuest(joinRoomCode, newPlayer);
  };

  const submitAnswer = (idx: number) => hostConnRef.current?.send({ type: 'PLAYER_ACTION', payload: { playerId: myPlayerId, type: 'ANSWER', data: { answerIndex: idx } } });

  const renderHostDashboard = () => (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500">
        <h1 className="text-2xl font-bold text-indigo-900">🏰 진행자 대시보드</h1>
        <div className="text-right">
          <div className="text-xs text-gray-500">방 코드: <span className="font-mono font-bold text-indigo-600">{gameState.roomCode}</span></div>
          <div className="font-bold">라운드: {gameState.round} / {gameState.quizzes.length}</div>
        </div>
      </div>
      <PhaseVisual phase={gameState.phase} />
      {(gameState.phase === 'ACTION_SELECT' || gameState.phase === 'QUIZ') && <SubmissionStatusBoard players={gameState.players} phase={gameState.phase} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm relative">
             <div className="flex justify-between items-center mb-2 px-2 text-sm font-semibold text-gray-500">
                <span>실시간 천하 지도</span>
                <button onClick={() => setIsMapFullscreen(!isMapFullscreen)} className="text-indigo-600 underline">전체화면</button>
             </div>
             <div className={isMapFullscreen ? 'fixed inset-0 z-50 bg-gray-100 p-10 flex items-center justify-center' : ''}>
                {isMapFullscreen && <button onClick={() => setIsMapFullscreen(false)} className="absolute top-5 right-5 bg-white p-2 rounded-full shadow-lg font-bold">닫기</button>}
                <GameMap lands={gameState.lands} players={gameState.players} combatEvents={gameState.phase === 'ROUND_RESULT' ? gameState.lastRoundEvents : []} />
             </div>
          </div>
          {gameState.phase === 'ROUND_RESULT' ? (
              <RoundReport events={gameState.lastRoundEvents} />
          ) : (
              <div className="bg-white p-4 rounded-xl shadow-sm h-48 overflow-y-auto text-sm">
                <h3 className="font-bold mb-2 border-b pb-1 text-gray-700">실록 (게임 로그)</h3>
                {gameState.logs.map((log, i) => <div key={i} className="border-b border-gray-50 py-1 text-gray-600">{log}</div>)}
              </div>
          )}
        </div>
        <div className="space-y-4">
            {gameState.phase !== 'ROUND_RESULT' && (
                <PlayerStatusTable players={gameState.players} phase={gameState.phase} />
            )}
            <div className="bg-white p-4 rounded-xl shadow-sm">
                <h3 className="font-bold mb-4 text-indigo-800">게임 설정 및 제어</h3>
                {gameState.phase === 'LOBBY' && (
                    <div className="space-y-6">
                        <div className="bg-indigo-50 p-4 rounded-lg space-y-4">
                            <div>
                                <label className="text-sm font-bold text-indigo-900 block mb-1">방 코드 설정</label>
                                <input type="text" className="w-full border p-2 rounded uppercase font-mono font-bold text-center" value={gameState.roomCode} onChange={e => setGameState({...gameState, roomCode: e.target.value.toUpperCase()})} disabled={!!peerRef.current} />
                                {!peerRef.current && <Button onClick={() => initializeHost(gameState.roomCode)} className="w-full mt-2">방 생성 및 서버 시작</Button>}
                            </div>
                            <div>
                                <label className="text-sm font-bold text-indigo-900 block mb-1">맵 크기 (땅 개수): {gameState.totalLands}</label>
                                <input type="range" min="12" max="60" className="w-full" value={gameState.totalLands} onChange={e => setGameState({...gameState, totalLands: parseInt(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-indigo-900 block mb-1">퀴즈 시간 (초): {gameState.quizDuration}</label>
                                <input type="range" min="5" max="60" step="5" className="w-full" value={gameState.quizDuration} onChange={e => setGameState({...gameState, quizDuration: parseInt(e.target.value)})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center"><label className="text-sm font-semibold">퀴즈 파일 (CSV)</label><button onClick={downloadSampleCSV} className="text-xs text-blue-600 underline">샘플 다운로드</button></div>
                            <input type="file" accept=".csv" onChange={handleFileUpload} className="w-full text-xs p-2 border rounded bg-gray-50" />
                        </div>
                        <LobbyView isHost={true} players={gameState.players} onStart={startGame} roomCode={gameState.roomCode} connectionStatus={connectionStatus} totalQuizzes={targetQuizCount} setTotalQuizzes={setTargetQuizCount} maxQuizzes={gameState.quizzes.length} />
                    </div>
                )}
                {gameState.phase === 'QUIZ' && (
                    <div className="text-center py-8 space-y-4">
                        <div className="text-6xl font-black text-indigo-600">{gameState.timer}</div>
                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={() => addTime(5)}>⏱️ +5초</Button>
                            <Button className="flex-1" variant="danger" onClick={() => endQuizPhase()}>⏭️ 즉시 종료</Button>
                        </div>
                    </div>
                )}
                {gameState.phase === 'ACTION_SELECT' && (
                    <div className="text-center py-8 space-y-4">
                        <div className="text-6xl font-black text-red-600">{gameState.timer}</div>
                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={() => addTime(5)}>⏱️ +5초</Button>
                            <Button className="flex-1" variant="danger" onClick={() => resolveRound()}>⏭️ 즉시 완료</Button>
                        </div>
                    </div>
                )}
                {gameState.phase === 'ROUND_RESULT' && <div className="text-center py-8"><Button onClick={nextRound} className="w-full py-4 text-lg animate-bounce">다음 라운드 시작 ▶</Button></div>}
                {gameState.phase === 'GAME_OVER' && <div className="text-center py-8"><Leaderboard players={gameState.players} /><Button onClick={() => window.location.reload()} className="mt-4">처음으로</Button></div>}
            </div>
        </div>
      </div>
    </div>
  );

  const renderGuestDashboard = () => {
    const me = gameState.players.find(p => p.id === myPlayerId);
    if (!me) return null;
    if (gameState.phase === 'ROUND_RESULT') {
        return (
            <div className="p-4 space-y-6">
                <PhaseVisual phase="ROUND_RESULT" />
                <RoundReport events={gameState.lastRoundEvents} />
                <GameMap lands={gameState.lands} players={gameState.players} myPlayerId={myPlayerId} combatEvents={gameState.lastRoundEvents} />
            </div>
        );
    }
    if (gameState.phase === 'GAME_OVER') {
        return (
            <div className="p-4 space-y-6">
                <PhaseVisual phase="GAME_OVER" />
                <Leaderboard players={gameState.players} myPlayerId={myPlayerId} />
                <GameMap lands={gameState.lands} players={gameState.players} myPlayerId={myPlayerId} combatEvents={gameState.lastRoundEvents} />
            </div>
        );
    }
    return <GuestActionView me={me} gameState={gameState} myPlayerId={myPlayerId} actionLocked={actionLocked} selectedLandIds={selectedLandIds} toggleLandSelection={(id: number) => { if (actionLocked) return; const land = gameState.lands.find(l => l.id === id); if (!land || land.ownerId === myPlayerId || !land.ownerId) return; setSelectedLandIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id].slice(-(me.lastAnswerCorrect ? 2 : 1))); }} handleConfirmAttack={() => { setActionLocked(true); hostConnRef.current?.send({ type: 'PLAYER_ACTION', payload: { playerId: myPlayerId, type: 'STRATEGY', data: { action: 'ATTACK', targets: selectedLandIds, shopItem: pendingShopItem } } }); }} handleDefend={() => { setActionLocked(true); hostConnRef.current?.send({ type: 'PLAYER_ACTION', payload: { playerId: myPlayerId, type: 'STRATEGY', data: { action: 'DEFEND', targets: [], shopItem: pendingShopItem } } }); }} canDefend={me.lastAnswerCorrect} allowedAttacks={me.lastAnswerCorrect ? 2 : 1} onShopItemSelect={setPendingShopItem} pendingShopItem={pendingShopItem} prevQuiz={gameState.quizzes[gameState.currentQuizIndex]} />;
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <div className="container mx-auto px-4 py-8">
        {mode === 'MENU' && (
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden mt-12 border-t-8 border-indigo-600">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 text-center text-white">
                    <h1 className="text-4xl font-extrabold mb-2">삼국지 땅따먹기</h1>
                    <p className="opacity-80 font-medium">지략과 전략의 천하통일 퀴즈 게임</p>
                </div>
                <div className="p-8 space-y-6">
                    <Button onClick={() => setMode('HOST')} className="w-full py-4 text-lg" variant="secondary">👑 선생님(진행자)로 시작</Button>
                    <div className="relative flex items-center"><div className="flex-grow border-t border-gray-200"></div><span className="px-3 text-gray-400 text-sm">학생 입장</span><div className="flex-grow border-t border-gray-200"></div></div>
                    <div className="space-y-3">
                        <input type="text" placeholder="이름 (닉네임)" className="w-full p-4 border rounded-xl font-bold" value={joinName} onChange={e => setJoinName(e.target.value)} />
                        <input type="text" placeholder="방 코드 (예: CLASS1)" className="w-full p-4 border rounded-xl font-mono text-center text-xl uppercase tracking-widest" value={joinRoomCode} onChange={e => setJoinRoomCode(e.target.value.toUpperCase())} />
                        <Button onClick={joinGame} className="w-full py-4 text-lg shadow-lg">전쟁터 입장하기</Button>
                    </div>
                </div>
            </div>
        )}
        {mode === 'HOST' && renderHostDashboard()}
        {mode === 'GUEST' && (
          <div className="max-w-4xl mx-auto">
             {gameState.phase !== 'GAME_OVER' && (
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500">
                    <div className="flex items-center gap-3">
                        <div className="font-bold text-gray-800">{gameState.players.find(p => p.id === myPlayerId)?.name || joinName}</div>
                    </div>
                    <div className="text-right">
                         <div className="text-xs text-gray-500 font-bold">현재 라운드</div>
                         <div className="font-mono font-bold text-indigo-600">{gameState.round} / {gameState.quizzes.length}</div>
                    </div>
                </div>
             )}
            {gameState.phase === 'LOBBY' && <LobbyView isHost={false} players={gameState.players} onStart={() => {}} roomCode={gameState.roomCode} connectionStatus={connectionStatus} totalQuizzes={targetQuizCount} setTotalQuizzes={() => {}} maxQuizzes={gameState.quizzes.length} />}
            {gameState.phase === 'QUIZ' && <QuizView quiz={gameState.quizzes[gameState.currentQuizIndex]} timeRemaining={gameState.timer} isHost={false} onAnswer={submitAnswer} />}
            {(gameState.phase === 'ACTION_SELECT' || gameState.phase === 'ROUND_RESULT' || gameState.phase === 'GAME_OVER') && renderGuestDashboard()}
          </div>
        )}
        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500 pb-8">
            <p className="font-bold mb-2 text-gray-700">만든 사람: 경기도 지구과학 교사 뀨짱</p>
            <div className="flex justify-center items-center gap-3 flex-wrap">
                <span>문의: <a href="https://open.kakao.com/o/s7hVU65h" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 transition">카카오톡 오픈채팅</a></span>
                <span className="text-gray-300">|</span>
                <span>블로그: <a href="https://eduarchive.tistory.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 transition">뀨짱쌤의 교육자료 아카이브</a></span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
