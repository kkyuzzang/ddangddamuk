import { Quiz } from './types';

export const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: 'q1',
    question: "대한민국의 수도는 어디인가요?",
    options: ["부산", "서울", "광주", "대전"],
    correctIndex: 1
  },
  {
    id: 'q2',
    question: "임진왜란 때 거북선을 만든 장군은?",
    options: ["강감찬", "을지문덕", "이순신", "권율"],
    correctIndex: 2
  },
  {
    id: 'q3',
    question: "물(H2O)을 구성하는 원소가 아닌 것은?",
    options: ["수소", "산소", "탄소", "없음"],
    correctIndex: 2
  },
  {
    id: 'q4',
    question: "다음 중 태양계 행성이 아닌 것은?",
    options: ["수성", "금성", "지구", "달"],
    correctIndex: 3
  },
  {
    id: 'q5',
    question: "훈민정음을 창제한 왕은?",
    options: ["태조", "태종", "세종대왕", "정조"],
    correctIndex: 2
  }
];

export const COIN_COSTS = {
  PIERCE_DEFENSE: 3,
  BUY_LAND: 2
};