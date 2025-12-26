
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import { GameState, Player, BroadcastMessage, GamePhase, Quiz, AVATARS, COLORS, CombatEvent } from './types';
import { DEFAULT_QUIZZES, COIN_COSTS } from './constants';
import { generateMap, assignInitialLands, resolveTurn } from './utils/gameLogic';
import { GameMap } from './components/GameMap';
import { Button } from './components/Button';

// -- Assets --
// Updated to Google Drive direct links based on user request.
const IMAGES = {
  QUIZ: "https://drive.google.com/uc?id=1MRKcqtXnqmsFeGN4w-ULPq6x4-ZoC2C4", // 지략의 시간 (퀴즈)
  ACTION: "https://drive.google.com/uc?id=1Okvxliz4Nfe7mKeCHIPDDt1989zoLVKk", // 전쟁의 서막 (전략)
  DIPLOMACY: "https://drive.google.com/uc?id=1pv6Owdj9mGBy0CGagJaa2qBoQ320w5Yi" // 천하 정세 (외교)
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
        case 'GAME_OVER': // Show Diplomacy/End image for game over too
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

const SubmissionStatusBoard = ({ players, phase }: { players: Player[], phase: GamePhase }) => {
    // For Quiz: check if lastAnswerCorrect is set (boolean)
    // For Action: check if selectedAction is set
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
                            if (phase === 'ACTION_SELECT' || phase === 'ROUND_RESULT') {
                                if (p.selectedAction === 'DEFEND') actionText = '🛡️ 철벽 방어';
                                else if (p.pendingAttacks.length > 0) actionText = `⚔️ 침공 (${p.pendingAttacks.length}곳)`;
                                else if (p.pendingShop === 'BUY_LAND') actionText = '💰 영토 매입';
                                else if (phase === 'ACTION_SELECT' && p.selectedAction) actionText = '✅ 제출 완료';
                                else if (phase === 'ACTION_SELECT') actionText = '⏳ 고민 중...';
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
    // Sort by Lands (desc), then Coins (desc), then Name
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

  // Local state for Host Map Fullscreen
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

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
            // Host: Send PING to all, REMOVE DEAD CONNECTIONS BUT KEEP PLAYERS IN STATE
            // This allows reconnection with persistence
            const now = Date.now();
            
            // 1. Identify disconnected players
            setGameState(prev => {
                const disconnectedIds: string[] = [];
                prev.players.forEach(p => {
                    const lastPing = lastPingMap.current[p.id];
                    if (!lastPing) return; 
                    if (now - lastPing > 15000) {
                        disconnectedIds.push(p.id);
                    }
                });

                if (disconnectedIds.length > 0) {
                     // We just close connections, we do NOT remove from state.
                     disconnectedIds.forEach(id => {
                        const conn = connectionsRef.current.find(c => c.metadata?.playerId === id);
                        if (conn && conn.open) {
                             console.log(`Closing connection for inactive player: ${id}`);
                             conn.close();
                        }
                     });
                     // DO NOT filter players out from state to allow reconnection persistence
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
        // RECONNECTION LOGIC:
        // Update the player ID to the new one, BUT keep the lands and coins.
        // Also need to update LANDS ownership to the new ID.
        const oldId = prev.players[existingPlayerIndex].id;
        const newId = newPlayer.id;

        const updatedPlayers = [...prev.players];
        updatedPlayers[existingPlayerIndex] = {
          ...updatedPlayers[existingPlayerIndex],
          id: newId, // Update ID
          // Keep other stats (coins, etc.)
        };

        // Update Lands ownership
        const updatedLands = prev.lands.map(land => {
           if (land.ownerId === oldId) {
             return { ...land, ownerId: newId };
           }
           return land;
        });

        // Also update the player's internal land reference if it existed (though usually redundant as lands is derived from map in some logic, but kept in player for easy access)
        updatedPlayers[existingPlayerIndex].lands = updatedLands.filter(l => l.ownerId === newId).map(l => l.id);

        return {
          ...prev,
          players: updatedPlayers,
          lands: updatedLands,
          logs: [...prev.logs, `${newPlayer.name}님이 재접속했습니다. (영토 복구됨)`]
        };
      }

      // New Player Logic with Avatar Uniqueness check
      let assignedAvatar = newPlayer.avatar;
      
      // If we have fewer players than unique avatars, enforce uniqueness
      if (prev.players.length < AVATARS.length) {
          const usedAvatars = new Set(prev.players.map(p => p.avatar));
          
          if (usedAvatars.has(assignedAvatar)) {
              const availableAvatars = AVATARS.filter(a => !usedAvatars.has(a));
              if (availableAvatars.length > 0) {
                  // Pick a random available avatar
                  assignedAvatar = availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
              }
          }
      }

      // New Player Logic with Color Uniqueness check
      let assignedColor = newPlayer.color;
      if (prev.players.length < COLORS.length) {
          const usedColors = new Set(prev.players.map(p => p.color));
          
          if (usedColors.has(assignedColor)) {
              const availableColors = COLORS.filter(c => !usedColors.has(c));
              if (availableColors.length > 0) {
                  assignedColor = availableColors[Math.floor(Math.random() * availableColors.length)];
              }
          }
      }
      
      const playerToAdd = { ...newPlayer, avatar: assignedAvatar, color: assignedColor };

      return {
        ...prev,
        players: [...prev.players, playerToAdd],
        logs: [...prev.logs, `${playerToAdd.name}님이 입장했습니다.`]
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
      logs: ['📢 제 1 라운드 시작!', '게임이 시작되었습니다.'],
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
        logs: [`📢 제 ${prev.round + 1} 라운드 시작!`, ...prev.logs]
      };
    });
    startTimer(gameState.quizDuration, () => endQuizPhase());
  };

  // CSV Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use FileReader as ArrayBuffer to handle encoding manually
    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      let text = '';
      
      // Try to decode as UTF-8 first
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        text = decoder.decode(buffer);
      } catch (e) {
        // If UTF-8 fails, try EUC-KR (common for Korean Excel CSVs)
        try {
            const decoder = new TextDecoder('euc-kr');
            text = decoder.decode(buffer);
        } catch (e2) {
            alert('파일 인코딩을 읽을 수 없습니다. UTF-8 또는 EUC-KR 형식이어야 합니다.');
            return;
        }
      }

      const lines = text.split('\n');
      const newQuizzes: Quiz[] = [];
      // Skip the first line (header) using slice(1)
      lines.slice(1).forEach((line, idx) => {
        const cols = line.split(',');
        if (cols.length >= 6) {
          const qText = cols[0].trim();
          if (!qText) return; // Skip empty lines
          // User inputs 1, 2, 3, 4. We need 0, 1, 2, 3. So subtract 1.
          const ansIdx = (parseInt(cols[5].trim()) || 1) - 1;
          
          newQuizzes.push({
            id: `csv-${idx}`,
            question: qText,
            options: [cols[1].trim(), cols[2].trim(), cols[3].trim(), cols[4].trim()],
            correctIndex: ansIdx
          });
        }
      });
      if (newQuizzes.length > 0) {
        setGameState(prev => ({ ...prev, quizzes: newQuizzes }));
        setTargetQuizCount(newQuizzes.length);
        alert(`${newQuizzes.length}개의 퀴즈를 불러왔습니다! (한글 디코딩 완료, 1행 스킵됨)`);
      } else {
          alert('유효한 퀴즈를 찾지 못했습니다. CSV 형식을 확인해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadSampleCSV = () => {
      const csvContent = "문제,보기1,보기2,보기3,보기4,정답번호(1-4)\n예시문제: 하늘은 무슨 색인가요?,빨강,파랑,노랑,검정,2";
      // Add BOM for Excel to recognize UTF-8 automatically
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
    <div className={`p-6 max-w-6xl mx-auto space-y-6 transition-colors duration-500 rounded-2xl ${gameState.phase === 'ACTION_SELECT' ? 'bg-red-100/50' : ''} ${gameState.phase === 'ROUND_RESULT' ? 'bg-yellow-100/50' : ''}`}>
      <div className={`flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border-l-4 ${gameState.phase === 'ACTION_SELECT' ? 'border-red-500' : gameState.phase === 'ROUND_RESULT' ? 'border-yellow-500' : 'border-indigo-500'}`}>
        <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
            {gameState.phase === 'ACTION_SELECT' ? '⚔️' : gameState.phase === 'ROUND_RESULT' ? '🤝' : '🏰'} 진행자 (선생님) 대시보드
        </h1>
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

      <PhaseVisual phase={gameState.phase} />

      {(gameState.phase === 'ACTION_SELECT' || gameState.phase === 'QUIZ') && (
         <SubmissionStatusBoard players={gameState.players} phase={gameState.phase} />
      )}

      {/* Game Over Leaderboard */}
      {gameState.phase === 'GAME_OVER' && (
          <Leaderboard players={gameState.players} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className={`bg-white p-2 rounded-xl shadow-sm ${isMapFullscreen ? 'fixed inset-0 z-50 flex flex-col items-center justify-center p-8' : 'relative'}`}>
             <div className="mb-2 text-sm font-semibold text-gray-500 px-2 flex justify-between w-full">
                <span>실시간 천하 지도</span>
                <div className="flex gap-4">
                    <span>총 영토: {gameState.totalLands}</span>
                    <button 
                        onClick={() => setIsMapFullscreen(!isMapFullscreen)} 
                        className="text-indigo-600 hover:text-indigo-800 underline font-bold"
                    >
                        {isMapFullscreen ? '전체화면 닫기' : '전체화면 보기'}
                    </button>
                </div>
             </div>
             <div className={isMapFullscreen ? 'w-full h-full flex items-center justify-center overflow-auto' : ''}>
                <GameMap 
                    lands={gameState.lands} 
                    players={gameState.players} 
                    combatEvents={gameState.phase === 'ROUND_RESULT' ? gameState.lastRoundEvents : []}
                />
             </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm h-64 overflow-y-auto">
            <h3 className="font-bold text-gray-700 mb-2 border-b pb-2">실록 (게임 로그)</h3>
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
                         type="range" min="12" max="60" step="1"
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
                   <p className="text-xs text-gray-500">UTF-8 또는 EUC-KR(한글 엑셀) 형식을 지원합니다. 첫 줄은 헤더로 간주하여 건너뜜니다.</p>
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
                 <p className="text-lg font-medium text-gray-600">군주들이 지략을 겨루고 있습니다...</p>
                 <div className="mt-8 flex gap-2 justify-center">
                    <Button onClick={() => addTime(5)} className="bg-blue-500 hover:bg-blue-600 text-sm">⏱️ +5초</Button>
                    <Button className="bg-gray-400 hover:bg-gray-500 text-sm" onClick={() => endQuizPhase()}>퀴즈 강제 종료</Button>
                 </div>
               </div>
            )}

            {gameState.phase === 'ACTION_SELECT' && (
               <div className="text-center py-8">
                 <div className="text-6xl font-black text-red-600 mb-4 animate-pulse">{gameState.timer}</div>
                 <p className="text-lg font-medium text-red-800 font-bold">⚠️ 전쟁 준비 단계 (전략 수립 중)</p>
                 <div className="mt-8 flex gap-2 justify-center">
                    <Button onClick={() => addTime(5)} className="bg-blue-500 hover:bg-blue-600 text-sm">⏱️ +5초</Button>
                    <Button className="bg-gray-400 hover:bg-gray-500 text-sm" onClick={() => resolveRound()}>결과 바로 보기</Button>
                 </div>
               </div>
            )}

            {gameState.phase === 'ROUND_RESULT' && (
               <div className="text-center py-8">
                 <p className="mb-4 text-xl font-bold text-green-600">외교 타임 (결과 확인 및 협상)</p>
                 <p className="text-sm text-gray-500 mb-6">서로 대화하며 동맹을 맺거나 협상하는 시간입니다.</p>
                 <Button onClick={nextRound} className="w-full py-4 text-lg shadow-lg animate-bounce mb-6">다음 라운드 시작 ▶</Button>
                 
                 {/* Summary Section for Teacher */}
                 <div className="bg-yellow-50 rounded-xl p-4 text-left border border-yellow-200 max-h-48 overflow-y-auto">
                    <h4 className="font-bold text-yellow-800 mb-2 sticky top-0 bg-yellow-50 pb-2 border-b border-yellow-200">📊 이번 라운드 요약</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                        {gameState.lastRoundEvents.length === 0 && <li>- 특별한 전투 기록이 없습니다.</li>}
                        {gameState.lastRoundEvents.map((evt, i) => {
                            if (evt.type === 'BOUGHT') {
                                return <li key={i} className="text-blue-700">💰 {evt.attackerName}님이 {evt.landId+1}번 빈 땅을 구매함</li>;
                            } else if (evt.type === 'CONQUERED') {
                                // Conflict check
                                const allAttackers = evt.allAttackers || [];
                                if (allAttackers.length > 1) {
                                     return <li key={i} className="text-red-700 font-bold">⚔️ [{allAttackers.join(', ')}] 격돌 ➜ 승자: {evt.attackerName} ({evt.landId+1}번 땅)</li>;
                                }
                                return <li key={i} className="text-red-700">⚔️ {evt.attackerName}님이 {evt.defenderName}의 {evt.landId+1}번 땅을 점령함</li>;
                            } else if (evt.type === 'DEFENDED') {
                                return <li key={i} className="text-green-700">🛡️ {evt.defenderName}님이 {evt.landId+1}번 땅 방어 성공</li>;
                            } else if (evt.type === 'PIERCED') {
                                return <li key={i} className="text-purple-700">🗡️ {evt.defenderName}님이 {evt.landId+1}번 땅에서 방어 관통 당함</li>;
                            }
                            return null;
                        })}
                    </ul>
                 </div>
               </div>
            )}
            
            {gameState.phase === 'GAME_OVER' && (
              <div className="text-center py-8">
                <Button onClick={() => window.location.reload()} variant="secondary">로비로 돌아가기</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderGuestDashboard = () => {
    const me = gameState.players.find(p => p.id === myPlayerId);
    if (!me) return <div className="p-8 text-center font-bold text-gray-500">플레이어 정보를 불러오는 중...</div>;

    const toggleLandSelection = (landId: number) => {
        if (actionLocked) return;
        
        const land = gameState.lands.find(l => l.id === landId);
        if (!land) return;

        // Rule: Cannot select own land
        if (land.ownerId === myPlayerId) {
            alert("우리 땅은 공격할 수 없습니다.");
            return;
        }

        // Rule: Cannot select empty land
        if (!land.ownerId) {
            alert("빈 땅은 공격할 수 없습니다. '빈 땅 구매' 아이템을 이용하세요.");
            return;
        }

        if (selectedLandIds.includes(landId)) {
            setSelectedLandIds(selectedLandIds.filter(id => id !== landId));
        } else {
             const maxAttacks = me.lastAnswerCorrect ? 2 : 1;
             // If buying land, selection logic is different or not needed here (since buying is random)
             // But assuming this is purely for ATTACK selection:
             if (selectedLandIds.length < maxAttacks) {
                setSelectedLandIds([...selectedLandIds, landId]);
             } else {
                 // FIFO replacement if full
                 if (maxAttacks === 1) {
                     setSelectedLandIds([landId]);
                 } else {
                     setSelectedLandIds([...selectedLandIds.slice(1), landId]);
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
    
    const onShopItemSelect = (item: 'PIERCE' | 'BUY_LAND' | undefined) => {
        if (actionLocked) return;
        setPendingShopItem(item);
    };

    if (gameState.phase === 'ROUND_RESULT' || gameState.phase === 'GAME_OVER') {
       // Filter attacks where I was the WINNER
       const myWins = gameState.lastRoundEvents.filter(e => e.attackerName === me.name && e.type !== 'BOUGHT');
       // Filter attacks where I participated (was in allAttackers) but LOST (winner != me)
       const myLosses = gameState.lastRoundEvents.filter(e => e.allAttackers && e.allAttackers.includes(me.name) && e.attackerName !== me.name);
       // Filter attacks where I was blocked by defense
       const myBlocked = gameState.lastRoundEvents.filter(e => e.type === 'DEFENDED' && e.allAttackers && e.allAttackers.includes(me.name));

       const myPurchases = gameState.lastRoundEvents.filter(e => e.attackerName === me.name && e.type === 'BOUGHT');
       
       // Filter attacks against me (Conquered, Pierced, or Defended)
       // For DEFENDED events, I am the defenderName.
       const attackedMe = gameState.lastRoundEvents.filter(e => e.defenderName === me.name);

       return (
         <div className="p-4 space-y-4 max-w-4xl mx-auto">
           <PhaseVisual phase={gameState.phase === 'GAME_OVER' ? 'ROUND_RESULT' : gameState.phase} />
            
           {gameState.phase === 'GAME_OVER' ? (
                <Leaderboard players={gameState.players} myPlayerId={myPlayerId} />
           ) : (
             <h2 className="text-2xl font-bold text-center mb-4 text-indigo-800 bg-white p-2 rounded-lg shadow-sm">
               🤝 외교 타임
             </h2>
           )}
           
           <div className="bg-white p-4 rounded-xl shadow-md mb-4 flex justify-between items-center border-b-4 border-indigo-100">
             <div>
               <div className="text-xs text-gray-500 font-bold">국고 (군자금)</div>
               <div className="text-2xl font-bold text-yellow-500 flex items-center drop-shadow-sm">
                 💰 {me.coins}금
               </div>
             </div>
             <div className="text-right">
               <div className="text-xs text-gray-500 font-bold">직전 퀴즈 결과</div>
               <div className={`font-bold text-lg ${me.lastAnswerCorrect ? 'text-green-600' : 'text-red-500'}`}>
                 {me.lastAnswerCorrect ? '승리! (+1금)' : '패배'}
               </div>
             </div>
          </div>
           
           <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm">
             <h3 className="font-bold text-yellow-800 mb-3 text-lg border-b border-yellow-200 pb-2">📊 이번 라운드 전투 요약</h3>
             <div className="space-y-3 text-sm">
               <div className="bg-white p-3 rounded border border-yellow-100">
                 <p className="font-bold text-blue-600 mb-1">⚔️ 내가 공격한 곳:</p>
                 <div className="text-gray-700 space-y-1">
                   {myWins.length === 0 && myLosses.length === 0 && myBlocked.length === 0 && <span>없음</span>}
                   
                   {/* Successful Attacks */}
                   {myWins.map((e, idx) => {
                       const isConflict = (e.allAttackers?.length || 0) > 1;
                       return (
                           <div key={`win-${idx}`} className="flex items-center gap-2">
                               <span className="text-green-600 font-bold">✅ 승리:</span>
                               <span>{e.defenderName || '빈 땅'}(#{e.landId+1})</span>
                               {isConflict ? 
                                   <span className="text-xs bg-orange-100 text-orange-700 px-2 rounded-full font-bold">치열한 전쟁 끝에 땅을 획득!</span> 
                                   : <span className="text-xs text-gray-500">(점령 성공)</span>
                               }
                           </div>
                       );
                   })}
                   
                   {/* Failed Attacks (Lost conflict) */}
                   {myLosses.map((e, idx) => (
                       <div key={`loss-${idx}`} className="flex items-center gap-2">
                           <span className="text-red-500 font-bold">❌ 패배:</span>
                           <span>{e.defenderName || '빈 땅'}(#{e.landId+1})</span>
                           <span className="text-xs bg-gray-200 text-gray-600 px-2 rounded-full font-bold">다른 나라의 국력에 밀림...</span>
                       </div>
                   ))}

                   {/* Blocked Attacks */}
                   {myBlocked.map((e, idx) => (
                       <div key={`blocked-${idx}`} className="flex items-center gap-2">
                           <span className="text-gray-500 font-bold">🛡️ 막힘:</span>
                           <span>{e.defenderName || '빈 땅'}(#{e.landId+1})</span>
                           <span className="text-xs bg-gray-100 text-gray-500 px-2 rounded-full font-bold">상대의 방어에 막혔습니다.</span>
                       </div>
                   ))}
                 </div>
               </div>
               <div className="bg-white p-3 rounded border border-yellow-100">
                 <p className="font-bold text-purple-600 mb-1">💰 내가 구매한 곳:</p>
                 <p className="text-gray-700">
                   {myPurchases.length > 0 
                     ? myPurchases.map((e, idx) => <span key={idx} className="inline-block mr-2">No.{e.landId+1}{idx < myPurchases.length-1 ? ',' : ''}</span>) 
                     : '없음'}
                 </p>
               </div>
               <div className="bg-white p-3 rounded border border-yellow-100">
                 <p className="font-bold text-red-600 mb-1">🛡️ 나를 공격한 사람:</p>
                 <p className="text-gray-700">
                   {attackedMe.length > 0 
                     ? [...new Set(
                         attackedMe.flatMap(e => e.allAttackers || [e.attackerName || ''])
                       )].filter(Boolean).map((name, idx, arr) => <span key={idx} className="inline-block mr-2 font-bold">{name}{idx < arr.length-1 ? ',' : ''}</span>) 
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
             {gameState.logs.slice(-5).reverse().map((l, i) => <p key={i} className="text-sm border-b py-2 text-gray-700">{l}</p>)}
           </div>
           
           {gameState.phase !== 'GAME_OVER' && (
               <div className="text-center mt-6">
                 <span className="inline-block animate-bounce text-indigo-500">⏳</span>
                 <p className="text-indigo-600 font-bold inline-block ml-2">선생님이 다음 라운드를 준비 중입니다...</p>
               </div>
           )}
         </div>
       );
    }

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
            canDefend={me.lastAnswerCorrect && !me.isDefending}
            allowedAttacks={me.lastAnswerCorrect ? 2 : 1}
            onShopItemSelect={onShopItemSelect}
            pendingShopItem={pendingShopItem}
            prevQuiz={gameState.currentQuizIndex >= 0 ? gameState.quizzes[gameState.currentQuizIndex] : undefined}
        />
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <div className="container mx-auto px-4 py-8">
        {mode === 'MENU' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden mt-12 border-t-8 border-indigo-600">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 text-center text-white">
              <h1 className="text-4xl font-extrabold mb-2 tracking-tight drop-shadow-md">삼국지 땅따먹기</h1>
              <p className="text-indigo-100 font-medium">지략과 전략의 천하통일 게임</p>
            </div>
            <div className="p-8 space-y-6">
              <button 
                onClick={() => setMode('HOST')}
                className="w-full bg-indigo-50 text-indigo-700 py-4 rounded-xl font-bold text-lg hover:bg-indigo-100 transition shadow-sm border-2 border-indigo-100 flex items-center justify-center gap-2 group"
              >
                <span className="group-hover:scale-110 transition-transform">👑</span> 선생님(진행자)로 시작
              </button>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-400 font-medium">학생 참여</span>
                </div>
              </div>

              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="이름 (닉네임)" 
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition font-bold text-gray-800 placeholder-gray-400"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="방 코드 (예: CLASS1)" 
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition font-mono font-bold text-lg uppercase placeholder-gray-400 tracking-wider"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                />
                <button 
                  onClick={joinGame}
                  disabled={!joinName || !joinRoomCode}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                >
                  전쟁터로 입장하기
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === 'HOST' && renderHostDashboard()}

        {mode === 'GUEST' && (
          <div>
             {/* Guest Header */}
             {gameState.phase !== 'GAME_OVER' && (
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm overflow-hidden border-2 border-gray-100`}>
                            {gameState.players.find(p => p.id === myPlayerId)?.avatar && (
                                <img 
                                src={gameState.players.find(p => p.id === myPlayerId)?.avatar} 
                                alt="avatar" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                />
                            )}
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 font-bold">나의 이름</div>
                            <div className="font-bold text-gray-800">{gameState.players.find(p => p.id === myPlayerId)?.name || joinName}</div>
                        </div>
                    </div>
                    <div className="text-right">
                         <div className="text-xs text-gray-500 font-bold">현재 라운드</div>
                         <div className="font-mono font-bold text-indigo-600">{gameState.round} / {gameState.quizzes.length}</div>
                    </div>
                </div>
             )}

            {gameState.phase === 'LOBBY' && (
              <LobbyView 
                isHost={false} 
                players={gameState.players} 
                onStart={() => {}} 
                roomCode={gameState.roomCode}
                connectionStatus={connectionStatus}
                totalQuizzes={targetQuizCount}
                setTotalQuizzes={() => {}}
                maxQuizzes={gameState.quizzes.length}
              />
            )}

            {gameState.phase === 'QUIZ' && (
               <QuizView 
                 quiz={gameState.quizzes[gameState.currentQuizIndex]}
                 timeRemaining={gameState.timer}
                 isHost={false}
                 onAnswer={submitAnswer}
               />
            )}

            {(gameState.phase === 'ACTION_SELECT' || gameState.phase === 'ROUND_RESULT' || gameState.phase === 'GAME_OVER') && renderGuestDashboard()}
          </div>
        )}

        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500 pb-8">
            <p className="font-bold mb-2 text-gray-700">만든 사람: 경기도 지구과학 교사 뀨짱</p>
            <div className="flex justify-center items-center gap-3 flex-wrap">
                <span>
                    문의: <a href="https://open.kakao.com/o/s7hVU65h" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 transition">
                        카카오톡 오픈채팅
                    </a>
                </span>
                <span className="text-gray-300">|</span>
                <span>
                    블로그: <a href="https://eduarchive.tistory.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 transition">
                        뀨짱쌤의 교육자료 아카이브
                    </a>
                </span>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;
