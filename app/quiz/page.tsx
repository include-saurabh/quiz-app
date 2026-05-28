'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuizStore, Question } from '@/store/useQuizStore';
import { 
  ArrowRight, Timer, AlertCircle, Eye, 
  HelpCircle, ChevronRight, ChevronLeft, Home, RefreshCw 
} from 'lucide-react';

export default function QuizPage() {
  const router = useRouter();
  
  // Zustand Store hooks
  const isPlaying = useQuizStore((state) => state.isPlaying);
  const questions = useQuizStore((state) => state.questions);
  const currentIndex = useQuizStore((state) => state.currentIndex);
  const answers = useQuizStore((state) => state.answers);
  const timeLeft = useQuizStore((state) => state.timeLeft);
  const timePerQuestion = useQuizStore((state) => state.timePerQuestion);
  const timerActive = useQuizStore((state) => state.timerActive);
  
  const tickTimer = useQuizStore((state) => state.tickTimer);
  const selectOption = useQuizStore((state) => state.selectOption);
  const nextQuestion = useQuizStore((state) => state.nextQuestion);
  const prevQuestion = useQuizStore((state) => state.prevQuestion);
  const finishQuiz = useQuizStore((state) => state.finishQuiz);
  const setTimerActive = useQuizStore((state) => state.setTimerActive);
  const loadQuizBackupState = useQuizStore((state) => state.loadQuizBackupState);
  const resetQuiz = useQuizStore((state) => state.resetQuiz);

  // Local component states
  const [toastMessage, setToastMessage] = useState<string>('');
  const [hasRestored, setHasRestored] = useState<boolean>(false);
  const [isClient, setIsClient] = useState<boolean>(false);

  const currentQuestion = questions[currentIndex] as Question | undefined;
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  // 1. Safe Client hydration checking
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 2. Load Backup State if not currently playing (e.g. refreshed page)
  useEffect(() => {
    if (isClient && !isPlaying && !hasRestored) {
      const restored = loadQuizBackupState();
      setHasRestored(true);
      if (!restored) {
        router.push('/');
      }
    }
  }, [isPlaying, isClient, hasRestored, loadQuizBackupState, router]);

  // 3. Tab Visibility API Listener (Pauses timer and backups state)
  useEffect(() => {
    if (!isPlaying) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTimerActive(false);
      } else {
        setTimerActive(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, setTimerActive]);

  // 4. Timer interval tick
  useEffect(() => {
    if (!isPlaying || !timerActive) return;

    const timer = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, timerActive, tickTimer]);

  // 5. Timer Expiry toast handler
  useEffect(() => {
    const handleTimerExpired = (e: Event) => {
      setToastMessage('वेळ संपली!');
      setTimeout(() => {
        setToastMessage('');
        router.push('/results');
      }, 2000);
    };

    window.addEventListener('quiz-timer-expired', handleTimerExpired);
    return () => {
      window.removeEventListener('quiz-timer-expired', handleTimerExpired);
    };
  }, [router]);

  // Handle Option Click
  const handleOptionClick = (optionIdx: number) => {
    if (!currentQuestion) return;
    selectOption(currentQuestion.id, optionIdx);
  };

  // Handle Navigation clicks
  const handleNextClick = () => {
    nextQuestion();
  };

  const handlePrevClick = () => {
    prevQuestion();
  };

  const handleFinishClick = () => {
    router.push('/results');
  };

  const handleQuitQuiz = () => {
    if (confirm('तुम्हाला खरोखर चाचणी थांबवायची आहे का? आपली प्रगती गमावली जाईल.')) {
      resetQuiz();
      router.push('/');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isClient || !currentQuestion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-mukta">
        <div className="animate-spin text-indigo-650 mb-4">
          <RefreshCw className="w-10 h-10" />
        </div>
        <p className="text-slate-500 text-sm">चाचणी लोड होत आहे...</p>
      </div>
    );
  }

  // Calculate timer circle path dash offset for animations
  const progressPercent = timePerQuestion > 0 ? (timeLeft / timePerQuestion) * 100 : 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="min-h-screen flex flex-col font-mukta text-slate-900 bg-slate-50 pb-16 px-4">
      
      {/* Quiz Header */}
      <header className="w-full max-w-2xl mx-auto py-4 flex items-center justify-between border-b border-slate-200 sticky top-0 bg-slate-50/90 backdrop-blur-sm z-30">
        <button
          onClick={handleQuitQuiz}
          className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-semibold flex items-center space-x-1"
        >
          <Home className="w-4 h-4" />
          <span>थांबवा</span>
        </button>

        <div className="text-center">
          <span className="text-slate-550 text-xs uppercase tracking-wider font-semibold">प्रगती / Progress</span>
          <div className="text-base font-extrabold text-slate-800 font-sans mt-0.5">
            {currentIndex + 1} / {questions.length}
          </div>
        </div>

        {/* Dynamic Circular Timer */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="24"
              cy="24"
              r={radius}
              className="stroke-slate-200"
              strokeWidth="3.5"
              fill="transparent"
            />
            <circle
              cx="24"
              cy="24"
              r={radius}
              className={`transition-all duration-1000 ${
                timeLeft <= 30 
                  ? 'stroke-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.3)]' 
                  : 'stroke-indigo-600'
              }`}
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <span className={`absolute text-[10px] sm:text-xs font-bold font-sans ${timeLeft <= 30 ? 'text-red-500 font-extrabold' : 'text-slate-800'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </header>

      {/* Main Quiz Section */}
      <main className="w-full max-w-2xl mx-auto mt-6 flex-1 flex flex-col space-y-6">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 px-5 py-3 bg-red-655 border border-red-500 text-white rounded-xl shadow-lg flex items-center space-x-2 z-50 animate-bounce">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
          </div>
        )}

        {/* Card: Question & Attached Image */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <span className="inline-block text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
            {currentQuestion.subject} • {currentQuestion.topic}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 leading-relaxed">
            <span className="font-sans">{currentIndex + 1}.</span> {currentQuestion.question_text}
          </h2>

          {/* Attached Math Figure / Image */}
          {currentQuestion.image_url && (
            <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-3 relative group">
              <img
                src={currentQuestion.image_url}
                alt="Math figure for the question"
                className="max-h-60 object-contain rounded-lg transition-transform group-hover:scale-[1.01]"
              />
              <div className="absolute top-2 right-2 p-1 bg-white rounded-md border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <Eye className="w-4 h-4 text-indigo-650" />
              </div>
            </div>
          )}
        </div>

        {/* List: 4 Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedAnswer !== undefined && selectedAnswer !== null && idx === selectedAnswer;
            
            // Visual styles - highlight selected options
            let optionStyles = 'border-slate-200 bg-white text-slate-705 hover:border-slate-350 hover:bg-slate-50';
            let indicatorBg = 'border-slate-250 text-slate-500 bg-slate-50';

            if (isSelected) {
              optionStyles = 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-550/15';
              indicatorBg = 'bg-indigo-600 border-indigo-600 text-white';
            }

            return (
              <button
                key={idx}
                onClick={() => handleOptionClick(idx)}
                className={`w-full p-4 border rounded-xl flex items-center justify-between text-left text-sm sm:text-base font-semibold transition-all relative ${optionStyles} cursor-pointer hover:scale-[1.002] shadow-sm`}
              >
                <div className="flex items-center space-x-3.5 pr-4">
                  <span className={`w-6 h-6 rounded-lg border text-xs font-bold font-sans flex items-center justify-center shrink-0 ${indicatorBg}`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{option}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 pt-2">
          {currentIndex > 0 && (
            <button
              onClick={handlePrevClick}
              className="flex-1 py-3.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 shadow-sm transition-all flex items-center justify-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>मागे</span>
            </button>
          )}
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={handleNextClick}
              className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1"
            >
              <span>पुढे</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          ) : (
            <button
              onClick={handleFinishClick}
              className="flex-1 py-3.5 bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1"
            >
              <span>चाचणी पूर्ण करा</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>

      </main>
    </div>
  );
}
