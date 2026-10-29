import React from 'react';
import { GeminiAnalytics } from '../../../utilities/geminiAnalysis';
import { Lightbulb, TrendingUp, Target, Users, BedDouble, PenTool, AlertTriangle, Heart, Zap, BookOpen } from 'lucide-react';

const sectionCard = 'bg-gradient-to-br from-[#fff8ee] to-[#f5e8d9] rounded-2xl shadow-lg border border-[#d5b493]/65 p-6 mb-8 transition-transform hover:-translate-y-1 hover:shadow-2xl';
const sectionHeader = 'flex items-center gap-2 mb-4 text-2xl font-bold border-l-4 pl-3';
const tableBase = 'min-w-full rounded-xl overflow-hidden shadow-sm';
const thBase = 'px-4 py-2 text-left bg-[#f7e9db] text-[#5e4028] font-semibold';
const tdBase = 'px-4 py-2';
const zebra = 'even:bg-[#f7e9db]';
const pill = 'inline-block rounded-full px-3 py-1 text-xs font-semibold mr-2 mb-1 bg-[#f1dfcb] text-[#6f4a2e]';
const insightBox = 'flex items-center gap-2 mt-4 p-3 bg-gradient-to-r from-[#f1dfcb] to-[#e8cfb2] rounded-xl text-[#5e4028] text-sm font-medium shadow';

const TextualAnalysisTab: React.FC<{ analytics: GeminiAnalytics }> = ({ analytics }) => {
  return (
    <div className="space-y-10">

      {/* Life Balance Overview */}
      {analytics.healthWellnessInsight && (
        <section className={sectionCard} style={{animation: 'fadeIn 0.5s'}}>
          <div className={sectionHeader} style={{borderColor: '#60a5fa'}}>
            <Heart className="w-6 h-6 text-[#8b5d36]" /> Life Balance Overview
          </div>
          <p className="text-[#5e4028] leading-relaxed">{analytics.healthWellnessInsight}</p>
        </section>
      )}

      {/* Emotional Triggers — kept as core pattern data */}
      {analytics.emotionalTriggers && analytics.emotionalTriggers.length > 0 && (
        <section className={sectionCard} style={{animation: 'fadeIn 0.6s'}}>
          <div className={sectionHeader} style={{borderColor: '#f472b6'}}>
            <TrendingUp className="w-6 h-6 text-pink-400" /> Emotional Triggers
          </div>
          <table className={tableBase}>
            <thead>
              <tr>
                <th className={thBase}>Event</th>
                <th className={thBase}>Mood</th>
                <th className={thBase}>Timeframe</th>
                <th className={thBase}>Note</th>
              </tr>
            </thead>
            <tbody>
              {analytics.emotionalTriggers.map((trigger, idx) => (
                <tr key={idx} className={zebra+" border-t border-pink-100 hover:bg-pink-50 transition"}>
                  <td className={tdBase+" font-medium"}>{trigger.event}</td>
                  <td className={tdBase}>{trigger.mood}</td>
                  <td className={tdBase}>{trigger.timeframe}</td>
                  <td className={tdBase}>{trigger.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Energy-Level Tracking — kept as core pattern data */}
      {analytics.energyLevelTracking && analytics.energyLevelTracking.length > 0 && (
        <section className={sectionCard} style={{animation: 'fadeIn 0.7s'}}>
          <div className={sectionHeader} style={{borderColor: '#fbbf24'}}>
            <Zap className="w-6 h-6 text-yellow-400" /> Energy-Level Tracking
          </div>
          <table className={tableBase}>
            <thead>
              <tr>
                <th className={thBase}>Time Block</th>
                <th className={thBase}>Energy (1-5)</th>
                <th className={thBase}>Mood</th>
                <th className={thBase}>Correlation</th>
              </tr>
            </thead>
            <tbody>
              {analytics.energyLevelTracking.map((row, idx) => (
                <tr key={idx} className={zebra+" border-t border-yellow-100 hover:bg-yellow-50 transition"}>
                  <td className={tdBase+" font-medium"}>{row.timeBlock}</td>
                  <td className={tdBase}>{row.energy}</td>
                  <td className={tdBase}>{row.mood}</td>
                  <td className={tdBase}>{row.correlation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Vocabulary Shifts — retained for language pattern value */}
      {analytics.vocabularyShifts && analytics.vocabularyShifts.phases && analytics.vocabularyShifts.phases.length > 0 && (
        <section className={sectionCard} style={{animation: 'fadeIn 0.8s'}}>
          <div className={sectionHeader} style={{borderColor: '#60a5fa'}}>
            <BookOpen className="w-6 h-6 text-[#8b5d36]" /> Vocabulary Shifts
          </div>
          <table className={tableBase}>
            <thead>
              <tr>
                <th className={thBase}>Timeframe</th>
                <th className={thBase}>Distinctive Words</th>
                <th className={thBase}>Mood</th>
              </tr>
            </thead>
            <tbody>
              {analytics.vocabularyShifts.phases.map((phase, idx) => (
                <tr key={idx} className={zebra+" border-t border-blue-100 hover:bg-blue-100 transition"}>
                  <td className={tdBase+" font-medium"}>{phase.phase}</td>
                  <td className={tdBase}>
                    {phase.words.map((word, i) => (
                      <span key={i} className={pill}>{word}</span>
                    ))}
                  </td>
                  <td className={tdBase}>{phase.mood}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {analytics.vocabularyShifts.insight && (
            <div className={insightBox}><Lightbulb className="w-4 h-4 text-yellow-500" /> <span className="italic">{analytics.vocabularyShifts.insight}</span></div>
          )}
        </section>
      )}

      {/* Major Milestones — retained for concrete achievements */}
      {analytics.majorMilestones && analytics.majorMilestones.milestones && analytics.majorMilestones.milestones.length > 0 && (
        <section className={sectionCard} style={{animation: 'fadeIn 0.9s'}}>
          <div className={sectionHeader} style={{borderColor: '#818cf8'}}>
            <Target className="w-6 h-6 text-indigo-400" /> Major Milestones
          </div>
          <div className="space-y-4">
            {analytics.majorMilestones.milestones.map((m, idx) => (
              <div key={idx} className="bg-indigo-50 rounded-xl p-4 shadow-sm border-l-4 border-indigo-300">
                <div className="font-semibold text-indigo-700 mb-1">{m.date} - {m.title}</div>
                <div className="text-gray-800 mb-1">{m.description}</div>
                <div className="text-xs text-indigo-900 italic">{m.insight}</div>
              </div>
            ))}
          </div>
          {analytics.majorMilestones.insight && (
            <div className={insightBox.replace('blue', 'indigo')}><Lightbulb className="w-4 h-4 text-yellow-500" /> <span className="italic">{analytics.majorMilestones.insight}</span></div>
          )}
        </section>
      )}

      {/* Daily Rhythm Patterns — retained for schedule insight */}
      {analytics.dailyRhythmPatterns && analytics.dailyRhythmPatterns.blocks && analytics.dailyRhythmPatterns.blocks.length > 0 && (
        <section className={sectionCard} style={{animation: 'fadeIn 1.0s'}}>
          <div className={sectionHeader} style={{borderColor: '#34d399'}}>
            <Zap className="w-6 h-6 text-emerald-400" /> Daily Rhythm
          </div>
          <table className={tableBase}>
            <thead>
              <tr>
                <th className={thBase}>Time Block</th>
                <th className={thBase}>Activities</th>
                <th className={thBase}>Note</th>
              </tr>
            </thead>
            <tbody>
              {analytics.dailyRhythmPatterns.blocks.map((block, idx) => (
                <tr key={idx} className={zebra+" border-t border-emerald-100 hover:bg-emerald-50 transition"}>
                  <td className={tdBase+" font-medium"}>{block.block}</td>
                  <td className={tdBase}>
                    {block.activities.map((act, i) => (
                      <span key={i} className={pill.replace('blue', 'emerald')}>{act}</span>
                    ))}
                  </td>
                  <td className={tdBase}>{block.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {analytics.dailyRhythmPatterns.insight && (
            <div className={insightBox.replace('blue', 'emerald')}><Lightbulb className="w-4 h-4 text-yellow-500" /> <span className="italic">{analytics.dailyRhythmPatterns.insight}</span></div>
          )}
        </section>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
};

export default TextualAnalysisTab; 