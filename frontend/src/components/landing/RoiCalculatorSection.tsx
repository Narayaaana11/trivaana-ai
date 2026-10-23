import React, { useState, useId } from 'react';
import { CountUp, Magnet } from '@/components/reactbits';
import {
  Calculator,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  DollarSign,
  AlertCircle
} from 'lucide-react';

interface RoiCalculatorSectionProps {
  onEnterDashboard: () => void;
}

export const RoiCalculatorSection: React.FC<RoiCalculatorSectionProps> = ({
  onEnterDashboard,
}) => {
  const [monthlyLeads, setMonthlyLeads] = useState<number>(3500);
  const sliderId = useId();

  // Metrics Modeling for Indian SMB & Enterprise Telecalling
  const avgMinsPerCall = 1.8;
  const totalMinutes = Math.round(monthlyLeads * avgMinsPerCall);

  // Human Telecaller Cost: 1 caller = ~1,500 qualified connects/mo @ ₹25,000 salary + infra = ₹28,000
  const humanAgentsNeeded = Math.max(1, Math.ceil(monthlyLeads / 1500));
  const humanMonthlyCost = humanAgentsNeeded * 28000;

  // Trivaana AI Cost: ₹6.50 per minute standard tariff
  const trivaanaRatePerMin = 6.50;
  const trivaanaMonthlyCost = Math.round(totalMinutes * trivaanaRatePerMin);

  // Net Savings
  const monthlySavings = Math.max(0, humanMonthlyCost - trivaanaMonthlyCost);
  const annualSavings = monthlySavings * 12;
  const savingsPercent = Math.round(((humanMonthlyCost - trivaanaMonthlyCost) / humanMonthlyCost) * 100);

  // Speed-to-lead demo conversion boost (from 6% human manual baseline to 22% sub-30s AI)
  const humanDemos = Math.round(monthlyLeads * 0.06);
  const trivaanaDemos = Math.round(monthlyLeads * 0.22);
  const extraDemos = trivaanaDemos - humanDemos;

  return (
    <section id="roi-calculator" className="py-24 bg-white border-b border-slate-200/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-4 border border-emerald-200">
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            <span>Outpero-Benchmarked Unit Economics</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-950 tracking-tight">
            Calculate Your Immediate <br />
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Telecalling Cost Savings
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Human call centers burn cash on salaries, attrition, training, and 45-minute callback delays. See how switching to Trivaana AI cuts telecalling bills by over 70%.
          </p>
        </div>

        {/* Interactive Calculator Grid */}
        <div className="max-w-5xl mx-auto bg-slate-50/80 rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Controls: Sliders */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label htmlFor={sliderId} className="text-sm font-bold text-slate-800">
                    Monthly Inbound / Ad Leads
                  </label>
                  <span className="text-base font-extrabold text-orange-600 px-3 py-1 bg-orange-50 border border-orange-200 rounded-lg">
                    {monthlyLeads.toLocaleString('en-IN')} leads
                  </span>
                </div>
                <input
                  id={sliderId}
                  type="range"
                  min="500"
                  max="25000"
                  step="500"
                  value={monthlyLeads}
                  onChange={(e) => setMonthlyLeads(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>500 (Early Stage)</span>
                  <span>10,000 (Growth)</span>
                  <span>25,000+ (Scale)</span>
                </div>
              </div>

              {/* Breakdown comparison pills */}
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                      {humanAgentsNeeded}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Human BPO Telecallers</h4>
                      <p className="text-xs text-slate-500">Avg 48 min callback delay, 35% attrition</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">
                      ₹{humanMonthlyCost.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[11px] text-slate-400">per month</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200/90 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      AI
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                        <span>Trivaana AI Telecalling</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-200/80 text-orange-900 rounded font-semibold">&lt;30s Speed</span>
                      </h4>
                      <p className="text-xs text-orange-800/80">
                        {totalMinutes.toLocaleString('en-IN')} mins @ ₹{trivaanaRatePerMin.toFixed(2)}/min
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-orange-600">
                      ₹{trivaanaMonthlyCost.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[11px] text-orange-800/80">per month</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-500">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>Zero infrastructure setup cost. Includes TRAI 10 AM-6 PM guardrails and native regional language models.</span>
              </div>
            </div>

            {/* Right Result Card */}
            <div className="lg:col-span-6 bg-slate-950 rounded-2xl p-6 sm:p-8 text-white relative shadow-xl overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Calculated Monthly ROI
                </span>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/70">
                  {savingsPercent}% Cost Reduction
                </span>
              </div>

              {/* Highlight Savings Number */}
              <div className="mb-6">
                <div className="text-xs text-slate-400 mb-1">Estimated Net Monthly Savings</div>
                <div className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-baseline gap-1">
                  <span className="text-orange-500">₹</span>
                  <CountUp to={monthlySavings} duration={1.2} separator="," className="font-mono" />
                </div>
                <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">₹{annualSavings.toLocaleString('en-IN')}</span>
                  <span>saved in annual operating payroll</span>
                </div>
              </div>

              {/* Conversion Boost Metrics */}
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-800 mb-8">
                <div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-orange-400" /> Speed-to-Lead
                  </span>
                  <span className="text-xl font-bold text-white block mt-1">
                    &lt; 28 Seconds
                  </span>
                  <span className="text-[11px] text-slate-500">vs 45 mins human delay</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" /> Extra Demos Booked
                  </span>
                  <span className="text-xl font-bold text-emerald-400 block mt-1">
                    +{extraDemos.toLocaleString('en-IN')} Demos
                  </span>
                  <span className="text-[11px] text-slate-500">from sub-30s callbacks</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={onEnterDashboard}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Launch Trivaana Mission Control</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
