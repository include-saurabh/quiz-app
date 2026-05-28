import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Question {
  id: string;
  subject: string;
  topic: string;
  question_text: string;
  options: string[];
  correct_option: number;
  explanation: string;
  image_url?: string | null;
}

export interface QuizState {
  user_id: string;
  isPlaying: boolean;
  testType: 'topic-wise' | 'mixed' | null;
  selectedTopics: string[];
  questions: Question[];
  currentIndex: number;
  answers: Record<string, number | null>; // Maps question.id to selected option index (0-3) or null (timed out / skipped)
  timeLeft: number;
  timePerQuestion: number;
  timerActive: boolean;
  
  // Actions
  initUserId: () => string;
  startQuiz: (
    type: 'topic-wise' | 'mixed', 
    topics: string[], 
    questions: Question[], 
    timePerQuestion?: number
  ) => void;
  selectOption: (questionId: string, optionIdx: number | null) => void;
  nextQuestion: () => boolean; // Returns true if advanced, false if quiz ended
  prevQuestion: () => boolean; // Returns true if moved back, false if already at index 0
  finishQuiz: () => void;
  tickTimer: () => void;
  setTimerActive: (active: boolean) => void;
  resetQuiz: () => void;
  saveQuizBackupState: () => void;
  loadQuizBackupState: () => boolean;
  clearQuizBackupState: () => void;
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      user_id: '',
      isPlaying: false,
      testType: null,
      selectedTopics: [],
      questions: [],
      currentIndex: 0,
      answers: {},
      timeLeft: 60,
      timePerQuestion: 60,
      timerActive: false,

      initUserId: () => {
        let id = get().user_id;
        if (!id) {
          id = uuidv4();
          set({ user_id: id });
        }
        return id;
      },

      startQuiz: (type, topics, questions, timePerQuestion = 60) => {
        // Global timer: total questions * 60 seconds
        const globalTimeLimit = questions.length * 60;
        set({
          isPlaying: true,
          testType: type,
          selectedTopics: topics,
          questions,
          currentIndex: 0,
          answers: {},
          timeLeft: globalTimeLimit,
          timePerQuestion: globalTimeLimit,
          timerActive: true,
        });
        get().saveQuizBackupState();
      },

      selectOption: (questionId, optionIdx) => {
        set((state) => {
          const newAnswers = { ...state.answers, [questionId]: optionIdx };
          return { answers: newAnswers };
        });
        get().saveQuizBackupState();
      },

      nextQuestion: () => {
        const { currentIndex, questions } = get();
        if (currentIndex < questions.length - 1) {
          set({
            currentIndex: currentIndex + 1,
          });
          get().saveQuizBackupState();
          return true;
        }
        return false;
      },

      prevQuestion: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
          set({
            currentIndex: currentIndex - 1,
          });
          get().saveQuizBackupState();
          return true;
        }
        return false;
      },

      finishQuiz: () => {
        set({
          isPlaying: false,
          timerActive: false,
        });
        get().clearQuizBackupState();
      },

      tickTimer: () => {
        const { timeLeft, timerActive, isPlaying } = get();
        if (!isPlaying || !timerActive) return;

        if (timeLeft <= 1) {
          // Global timer expired! Stop the timer, but keep isPlaying active
          set({
            timeLeft: 0,
            timerActive: false,
          });
          
          // Trigger a custom event for UI toast notification
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('quiz-timer-expired', {
              detail: { isLast: true }
            }));
          }
        } else {
          set({ timeLeft: timeLeft - 1 });
        }
      },

      setTimerActive: (active) => {
        set({ timerActive: active });
      },

      resetQuiz: () => {
        set({
          isPlaying: false,
          testType: null,
          selectedTopics: [],
          questions: [],
          currentIndex: 0,
          answers: {},
          timerActive: false,
        });
        get().clearQuizBackupState();
      },

      // PRD Required: Backup to localStorage key: quiz_state_{user_id}
      saveQuizBackupState: () => {
        const { user_id, isPlaying, testType, selectedTopics, questions, currentIndex, answers, timeLeft, timePerQuestion } = get();
        if (!user_id || !isPlaying) return;

        const backupState = {
          isPlaying,
          testType,
          selectedTopics,
          questions,
          currentIndex,
          answers,
          timeLeft,
          timePerQuestion,
        };
        localStorage.setItem(`quiz_state_${user_id}`, JSON.stringify(backupState));
      },

      loadQuizBackupState: () => {
        const { user_id } = get();
        if (!user_id) return false;

        const saved = localStorage.getItem(`quiz_state_${user_id}`);
        if (!saved) return false;

        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.isPlaying) {
            set({
              isPlaying: parsed.isPlaying,
              testType: parsed.testType,
              selectedTopics: parsed.selectedTopics,
              questions: parsed.questions,
              currentIndex: parsed.currentIndex,
              answers: parsed.answers,
              timeLeft: parsed.timeLeft,
              timePerQuestion: parsed.timePerQuestion,
              timerActive: true,
            });
            return true;
          }
        } catch (e) {
          console.error('Error loading quiz backup state:', e);
        }
        return false;
      },

      clearQuizBackupState: () => {
        const { user_id } = get();
        if (user_id) {
          localStorage.removeItem(`quiz_state_${user_id}`);
        }
      }
    }),
    {
      name: 'marathi-quiz-store', // name of the item in the storage (defaults to localStorage)
      partialize: (state) => ({ user_id: state.user_id }), // only persist user_id through standard Zustand store to avoid stale states
    }
  )
);
