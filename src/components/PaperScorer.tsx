
import React, { useState } from 'react';
import type { ScoreData, DetailedScoreItem, BloomCategory, BloomWeights, ApiQuestionScore } from '../types';
import FileUploader from './shared/FileUploader';

const CATEGORIES: BloomCategory[] = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'];
const CATEGORY_COLORS: Record<BloomCategory, string> = {
    Remembering: 'bg-sky-500',
    Understanding: 'bg-teal-500',
    Applying: 'bg-indigo-500',
    Analyzing: 'bg-purple-500',
    Evaluating: 'bg-pink-500',
    Creating: 'bg-amber-500',
};

const BORDER_COLORS: Record<BloomCategory, string> = {
    Remembering: 'border-sky-500',
    Understanding: 'border-teal-500',
    Applying: 'border-indigo-500',
    Analyzing: 'border-purple-500',
    Evaluating: 'border-pink-500',
    Creating: 'border-amber-500',
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the Data URL prefix to send only the Base64 string
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });

const StackedBar: React.FC<{ scores: BloomWeights, maxScore: number, showLegend?: boolean }> = ({ scores, maxScore, showLegend = false }) => {
    const totalScore = Object.values(scores).reduce((a: number, b: number) => a + b, 0);
    if (maxScore === 0) maxScore = totalScore || 1;

    return (
        <div>
            <div className="w-full flex h-8 rounded-full overflow-hidden bg-gray-200 shadow-inner">
                {CATEGORIES.map(category => {
                    const value = scores[category];
                    const percentage = maxScore > 0 ? (value / maxScore) * 100 : 0;
                    if (percentage < 0.1) return null;
                    return (
                        <div
                            key={category}
                            className={`flex items-center justify-center transition-all duration-500 ${CATEGORY_COLORS[category]}`}
                            style={{ width: `${percentage}%` }}
                            title={`${category}: ${percentage.toFixed(1)}%`}
                        >
                          {percentage > 8 && <span className="text-white text-xs font-bold truncate">{`${percentage.toFixed(0)}%`}</span>}
                        </div>
                    );
                })}
            </div>
            {showLegend && (
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
                    {CATEGORIES.map(category => (
                        <div key={category} className="flex items-center text-xs">
                            <span className={`w-3 h-3 rounded-sm mr-1.5 ${CATEGORY_COLORS[category]}`}></span>
                            <span>{category}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DetailedScore: React.FC<{ item: DetailedScoreItem, index: number }> = ({ item, index }) => {
    const dominantCategory = (Object.keys(item.score) as BloomCategory[]).reduce((a, b) => item.score[a] > item.score[b] ? a : b);
    
    return (
    <div className={`p-4 border-l-4 rounded-r-lg bg-slate-50/50 ${BORDER_COLORS[dominantCategory]}`}>
        <h4 className="font-semibold text-slate-800 mb-3">Question {index + 1}: <span className="font-normal italic">"{item.question}"</span></h4>
        <StackedBar scores={item.score} maxScore={Object.values(item.score).reduce((a: number, b: number)=>a+b, 0) || 1} />
    </div>
)};

const PaperScorer: React.FC = () => {
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [questionText, setQuestionText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scoreData, setScoreData] = useState<ScoreData | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadedFile && !questionText) {
            setError("Please upload a file or paste questions.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setScoreData(null);

        try {
            let fileContentBase64: string | null = null;
            if (uploadedFile) {
                fileContentBase64 = await fileToBase64(uploadedFile);
            }
            
            const payload = {
                file: uploadedFile && fileContentBase64 ? {
                    filename: uploadedFile.name,
                    content: fileContentBase64,
                    mimeType: uploadedFile.type,
                } : null,
                questions: questionText || null,
            };

            const response = await fetch('https://bloomflask-production.up.railway.app/analysequestion', {
                method: 'POST',
                 headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Request failed: ${response.statusText}`);
            }

            const apiData: ApiQuestionScore[] = await response.json();

            const detailedScores: DetailedScoreItem[] = apiData.map(item => ({
                question: item.question,
                score: {
                    Remembering: item.remembering,
                    Understanding: item.understanding,
                    Applying: item.applying,
                    Analyzing: item.analyzing,
                    Evaluating: item.evaluating,
                    Creating: item.creating,
                },
            }));

            const totalScore: BloomWeights = detailedScores.reduce((total, item) => {
                CATEGORIES.forEach(cat => {
                    total[cat] = (total[cat] || 0) + item.score[cat];
                });
                return total;
            }, { Remembering: 0, Understanding: 0, Applying: 0, Analyzing: 0, Evaluating: 0, Creating: 0 });

            const newScoreData: ScoreData = {
                totalScore: totalScore,
                detailedScores: detailedScores,
                totalQuestions: apiData.length,
            };

            setScoreData(newScoreData);
        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during scoring.";
            setError(`Failed to score paper: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-10">
            <div>
                <h2 className="text-2xl font-bold text-center text-slate-800">Evaluate Your Academic Paper</h2>
                <p className="mt-1 text-slate-600 text-center">Get a detailed breakdown of cognitive levels based on Bloom's Taxonomy.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-2 sm:p-6 bg-slate-100/50 border-2 border-dashed border-slate-300 rounded-lg text-center">
                    <FileUploader 
                        onFileSelect={setUploadedFile} 
                        fullWidth={true}
                        acceptedMimeTypes={['application/pdf', 'image/png', 'image/jpeg']}
                        fileTypeDescription="PDF, PNG, or JPG"
                    />
                </div>
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-slate-400 font-semibold text-sm">OR</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                </div>
                <textarea
                    placeholder="Paste your questions here, separated by new lines..."
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition h-28"
                    aria-label="Paste questions here"
                />
                <button type="submit" disabled={isLoading || (!uploadedFile && !questionText)} className="w-full bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-primary-600 transition duration-300 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-lg hover:scale-105">
                    {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    {isLoading ? 'Scoring...' : 'Score Paper'}
                </button>
            </form>

            {error && <div className="p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-center">{error}</div>}
      
            {scoreData && (
                <div className="mt-12 animate-fade-in">
                    <h3 className="text-2xl font-bold text-slate-800 mb-4 text-center">Scoring Results</h3>
                    <div className="p-4 sm:p-6 bg-slate-50/50 border border-slate-200 rounded-lg space-y-8">
                        <div>
                            <h4 className="text-lg font-semibold text-slate-700 mb-4 text-center">Overall Score Distribution (%)</h4>
                            <StackedBar scores={scoreData.totalScore} maxScore={Object.values(scoreData.totalScore).reduce((sum, val) => sum + val, 0) || 1} showLegend={true} />
                        </div>

                        <details className="pt-6 border-t border-slate-200" open>
                            <summary className="text-lg font-semibold text-slate-700 cursor-pointer hover:text-primary list-none flex justify-between items-center">
                                <span>Detailed Score Distribution (%)</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform transform details-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </summary>
                            <div className="mt-4 space-y-4">
                                {scoreData.detailedScores.map((item, index) => (
                                    <DetailedScore key={index} item={item} index={index} />
                                ))}
                            </div>
                        </details>
                    </div>
                </div>
            )}
             <style>{`
                details[open] .details-arrow { transform: rotate(180deg); }
                .animate-fade-in { animation: fadeIn 0.5s ease-in-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default PaperScorer;
