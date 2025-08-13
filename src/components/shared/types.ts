
export type BloomCategory = 'Remembering' | 'Understanding' | 'Applying' | 'Analyzing' | 'Evaluating' | 'Creating';

export type BloomWeights = Record<BloomCategory, number>;

export interface DetailedScoreItem {
    question: string;
    score: BloomWeights;
}

export interface ScoreData {
    totalScore: BloomWeights;
    detailedScores: DetailedScoreItem[];
    totalQuestions: number;
}

export type QuestionStatus = 'pending' | 'accepted' | 'discarded';

export type QuestionType = 'text' | 'TrueFalse' | 'MCQ';

export interface GeneratedQuestion {
    id: number;
    text: string;
    status: QuestionStatus;
    question_type: QuestionType;
    options?: string[];
    answer?: string | boolean;
}

// Type for the question scorer API, remains unchanged
export interface ApiQuestionScore {
    question: string;
    question_type: QuestionType;
    option?: string[];
    remembering: number;
    understanding: number;
    applying: number;
    analyzing: number;
    evaluating: number;
    creating: number;
}

// New type for the question generator API response
interface ApiTFInfo {
    question: string;
    answer: boolean;
}
interface ApiMCQInfo {
    question: string;
    options: string[];
    answer: string;
}

export type ApiGeneratedQuestionItem =
  | { question_type: 'text', questioninfo: string }
  | { question_type: 'TrueFalse', questioninfo: ApiTFInfo }
  | { question_type: 'MCQ', questioninfo: ApiMCQInfo };
