import React, { useState, useEffect, useCallback } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Transaction, Tenant, PricingCatalog } from '@/types/trivaana';
import { AuroraBackground, GlareHover, ClickSpark, WarmTooltip } from '@/components/reactbits';
import confetti from 'canvas-confetti';
import {
  Wallet,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Download,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface FinancialLedgerPanelProps {
  tenant: Tenant | null;
  onBalanceUpdated?: () => void;
  initialSubTab?: 'ledger' | 'invoices' | 'billing_details';
}

export const FinancialLedgerPanel: React.FC<FinancialLedgerPanelProps> = ({
  tenant,
  onBalanceUpdated,
  initialSubTab = 'ledger',
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [workspaceBilling, setWorkspaceBilling] = useState<{ name: string; gstin: string; billing_email: string }>({
    name: tenant?.name || '',
    gstin: '',
    billing_email: '',
  });
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'ledger' | 'invoices' | 'billing_details'>(initialSubTab);
  const [prevInitialSubTab, setPrevInitialSubTab] = useState(initialSubTab);
  if (initialSubTab !== prevInitialSubTab) {
    setPrevInitialSubTab(initialSubTab);
    setActiveSubTab(initialSubTab);
  }
  const [pricing, setPricing] = useState<PricingCatalog | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ plan: string; concurrency_limit: number } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const tenantName = tenant?.name || '';
  const fetchBillingData = useCallback(async () => {
    try {
      setLoading(true);
      const [txRes, invRes, wsRes, pRes, subRes] = await Promise.all([
        trivaanaApi.getTransactions(),
        trivaanaApi.getInvoices().catch(() => ({ invoices: [] })),
        trivaanaApi.getWorkspace().catch(() => null),
        trivaanaApi.getPricing().catch(() => null),
        trivaanaApi.getSubscription().catch(() => null),
      ]);
      setTransactions(txRes.transactions || []);
      setInvoices(invRes.invoices || []);
      if (pRes) setPricing(pRes);
      if (subRes) setSubscriptionInfo({ plan: subRes.plan, concurrency_limit: subRes.concurrency_limit });
      if (wsRes) {
        setWorkspaceBilling({
          name: wsRes.name || tenantName,
          gstin: wsRes.gstin || '',
          billing_email: wsRes.billing_email || '',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load billing records' });
    } finally {
      setLoading(false);
    }
  }, [tenantName]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchBillingData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchBillingData]);

  const handleQuickRecharge = async (amount: number) => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const order = await trivaanaApi.createRazorpayOrder(amount);

      if (order.is_sandbox || !window.Razorpay) {
        await trivaanaApi.sandboxTopup(amount);
        confetti({ particleCount: 70, spread: 55, origin: { y: 0.6 } });
        setFeedback({
          type: 'success',
          message: `₹${amount.toLocaleString('en-IN')} credited via Developer Sandbox Ledger (Razorpay live keys not configured).`,
        });
      } else {
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: 'Trivaana AI SaaS',
          description: `Prepaid Telephony Credit (₹${amount})`,
          order_id: order.id,
          handler: async (response: any) => {
            await trivaanaApi.submitRazorpayWebhook({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              amount_inr: amount,
            });
            confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
            setFeedback({
              type: 'success',
              message: `Payment of ₹${amount.toLocaleString('en-IN')} verified and credited!`,
            });
            await fetchBillingData();
            if (onBalanceUpdated) onBalanceUpdated();
          },
          theme: { color: '#ea580c' },
        });
        rzp.open();
        return;
      }

      await fetchBillingData();
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Payment failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-3 border border-orange-200">
          <Wallet className="w-3.5 h-3.5 text-orange-600" />
          <span>Zero-Float-Drift Integer Paise Accounting</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Wallet, Razorpay Top-Up & GST Invoices
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Append-only integer paise ledger with configurable voice tariffs, 30-second rounding rules, and 18% GST SAC 998313 tax invoices.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-5">
          <GlareHover className="rounded-[24px] shadow-xl">
            <AuroraBackground className="p-6 rounded-[24px] bg-outpero-dark-card text-white border border-white/10">
            <div className="text-[11px] font-bold text-[#ff8547] uppercase tracking-wider mb-1">
              Available Prepaid Balance
            </div>
            <div className="font-display text-4xl font-extrabold tabular-nums flex items-baseline gap-1 my-2">
              <span className="text-[#ff5500] text-2xl">₹</span>
              <span>{(tenant?.wallet_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="text-[11px] text-slate-400 mb-6 flex items-center justify-between tabular-nums">
              <span>Standard Rate: ₹{(tenant?.rate_per_min ?? 6.5).toFixed(2)}/min</span>
              <WarmTooltip tip="HSN/SAC Telecom IT Services · 18% GST">
                <span className="text-emerald-400 font-semibold">SAC: 998313</span>
              </WarmTooltip>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="text-xs font-bold text-slate-300">Add Credits</div>
              <div className="grid grid-cols-3 gap-2">
                {[500, 1000, 2500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopUpAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      topUpAmount === amt
                        ? 'bg-orange-600 text-white border-orange-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1 text-slate-300">
                {(() => {
                  const gstPct = pricing?.billing_rules?.gst_percentage ?? 18;
                  const taxableBase = topUpAmount / (1 + gstPct / 100);
                  const gstIncluded = topUpAmount - taxableBase;
                  return (
                    <>
                      <div className="flex justify-between"><span>Taxable Value (Excl. GST):</span><span className="font-mono">₹{taxableBase.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>GST ({gstPct}% Incl. SAC 998313):</span><span className="font-mono">₹{gstIncluded.toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-slate-800 pt-1 font-bold text-white"><span>Total Payable &amp; Credited:</span><span className="font-mono">₹{topUpAmount.toFixed(2)}</span></div>
                    </>
                  );
                })()}
              </div>

              <ClickSpark className="w-full">
                <button
                  onClick={() => handleQuickRecharge(topUpAmount)}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isProcessing ? 'Processing...' : `Add ₹${topUpAmount.toLocaleString('en-IN')} Credits`}</span>
                </button>
              </ClickSpark>
            </div>
            </AuroraBackground>
          </GlareHover>

          <div className="p-5 rounded-2xl bg-white border border-[#e4e4e9] shadow-2xs space-y-2.5 text-xs">
            <div className="font-display font-bold text-[#0f0f14] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Billing, Voice Tiers &amp; GST Policy</span>
            </div>
            <div className="flex justify-between text-[#525260]">
              <span>Current Plan:</span>
              <span className="font-bold text-[#0f0f14] uppercase">
                {subscriptionInfo?.plan || tenant?.plan || 'Growth'} ({subscriptionInfo?.concurrency_limit || tenant?.concurrency_limit || 10} ch)
              </span>
            </div>
            <div className="flex justify-between text-[#525260] tabular-nums">
              <span>Standard Voice Tier:</span>
              <span className="font-semibold text-[#0f0f14]">₹{(pricing?.tariffs?.standard_ai_call_inr_per_min ?? 6.5).toFixed(2)}/min</span>
            </div>
            <div className="flex justify-between text-[#525260] tabular-nums">
              <span>Premium Neural Tier:</span>
              <span className="font-semibold text-[#ff5500]">₹{(pricing?.tariffs?.premium_ai_call_inr_per_min ?? 8.5).toFixed(2)}/min</span>
            </div>
            <div className="flex justify-between text-[#525260]">
              <span>Unconnected Calls:</span>
              <span className="font-semibold text-emerald-700">₹0.00 (Not Billed)</span>
            </div>
            <div className="flex justify-between text-[#525260]">
              <span>GST Rate:</span>
              <span className="font-semibold text-[#0f0f14]">{pricing?.billing_rules?.gst_percentage ?? 18}% (ITC Eligible)</span>
            </div>
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="font-bold text-[#0f0f14]">Switch Concurrency Plan</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'payg', label: 'PAYG (2 ch)' },
                  { id: 'starter', label: 'Starter (₹2,999)' },
                  { id: 'growth', label: 'Growth (₹7,999)' },
                  { id: 'enterprise', label: 'Enterprise (₹24,999)' },
                ].map((pl) => {
                  const activePlan = (subscriptionInfo?.plan || tenant?.plan || '').toLowerCase() === pl.id;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      disabled={isProcessing || activePlan}
                      onClick={async () => {
                        setIsProcessing(true);
                        setFeedback(null);
                        try {
                          const res = await trivaanaApi.updateSubscription(pl.id);
                          setSubscriptionInfo({ plan: res.plan, concurrency_limit: res.concurrency_limit });
                          setFeedback({ type: 'success', message: `Subscribed to ${pl.id.toUpperCase()} (${res.concurrency_limit} channels).` });
                          await fetchBillingData();
                          if (onBalanceUpdated) onBalanceUpdated();
                        } catch (err: any) {
                          setFeedback({ type: 'error', message: err.message });
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer disabled:opacity-50 ${
                        activePlan ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-orange-50 text-slate-800 border-slate-200'
                      }`}
                    >
                      Activate {pl.id.charAt(0).toUpperCase() + pl.id.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveSubTab('ledger')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  activeSubTab === 'ledger' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Transaction Ledger ({transactions.length})
              </button>
              <button
                onClick={() => setActiveSubTab('invoices')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  activeSubTab === 'invoices' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                GST Invoices ({invoices.length})
              </button>
              <button
                onClick={() => setActiveSubTab('billing_details')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  activeSubTab === 'billing_details' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Billing Details
              </button>
            </div>
            <button
              onClick={fetchBillingData}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {activeSubTab === 'ledger' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2">Description</th>
                    <th className="py-3 px-2">Invoice</th>
                    <th className="py-3 px-2 text-right">Amount</th>
                    <th className="py-3 px-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr><td colSpan={5} className="py-10 text-center text-slate-400">Loading ledger...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-slate-400">No transactions yet.</td></tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            tx.type === 'credit'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {tx.type === 'credit' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {tx.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-medium text-slate-900">{tx.description}</td>
                        <td className="py-3 px-2 font-mono text-[11px] text-slate-500">{tx.invoice_id || '—'}</td>
                        <td className={`py-3 px-2 text-right font-mono font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {tx.type === 'credit' ? '+' : '-'}₹{tx.amount_inr.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-700">₹{tx.running_balance.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : activeSubTab === 'invoices' ? (
            <div className="space-y-3">
              {invoices.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">No GST invoices generated yet. Top up credits to generate a tax invoice.</div>
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-orange-600" />
                        <span>{inv.invoice_number}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">SAC {inv.sac_code}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Subtotal: ₹{inv.subtotal_inr.toFixed(2)} • GST (18%): ₹{inv.gst_inr.toFixed(2)} • Total: ₹{inv.total_inr.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> View Tax Invoice
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await trivaanaApi.updateWorkspace({
                  name: workspaceBilling.name,
                  gstin: workspaceBilling.gstin,
                  billing_email: workspaceBilling.billing_email,
                });
                setFeedback({ type: 'success', message: 'Billing & GST details saved to workspace.' });
              }}
              className="space-y-4 text-xs max-w-lg"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Legal / Workspace Entity Name</label>
                <input
                  value={workspaceBilling.name}
                  onChange={(e) => setWorkspaceBilling({ ...workspaceBilling, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTIN (15-character tax ID for ITC invoices)</label>
                <input
                  value={workspaceBilling.gstin}
                  onChange={(e) => setWorkspaceBilling({ ...workspaceBilling, gstin: e.target.value.toUpperCase() })}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Billing & Invoice Email</label>
                <input
                  type="email"
                  value={workspaceBilling.billing_email}
                  onChange={(e) => setWorkspaceBilling({ ...workspaceBilling, billing_email: e.target.value })}
                  placeholder="accounts@company.in"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold cursor-pointer">
                Save Billing Details
              </button>
            </form>
          )}
        </div>
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="font-black text-slate-900">Tax Invoice {selectedInvoice.invoice_number}</div>
              <button onClick={() => setSelectedInvoice(null)} className="text-xs font-bold text-slate-500 cursor-pointer">Close</button>
            </div>
            <div className="text-xs space-y-2 text-slate-600">
              <div className="flex justify-between"><span>Workspace:</span><span className="font-bold text-slate-900">{tenant?.name}</span></div>
              <div className="flex justify-between"><span>SAC Code:</span><span className="font-mono">{selectedInvoice.sac_code}</span></div>
              <div className="flex justify-between"><span>Taxable Value:</span><span className="font-mono">₹{selectedInvoice.subtotal_inr.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>IGST / CGST+SGST (18%):</span><span className="font-mono">₹{selectedInvoice.gst_inr.toFixed(2)}</span></div>
              <div className="flex justify-between border-t pt-2 font-bold text-slate-900 text-sm"><span>Total Paid:</span><span className="font-mono">₹{selectedInvoice.total_inr.toFixed(2)}</span></div>
            </div>
            <button onClick={() => window.print()} className="w-full py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer">
              Print / Save PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
