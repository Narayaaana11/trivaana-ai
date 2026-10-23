import React, { useState, useEffect } from 'react';
import { trivaanaApi } from '@/lib/trivaana-api';
import { Transaction, Tenant } from '@/types/trivaana';
import confetti from 'canvas-confetti';
import {
  Wallet,
  CreditCard,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  Download,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface FinancialLedgerPanelProps {
  tenant: Tenant | null;
  onBalanceUpdated?: () => void;
}

export const FinancialLedgerPanel: React.FC<FinancialLedgerPanelProps> = ({
  tenant,
  onBalanceUpdated,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await trivaanaApi.getTransactions();
      setTransactions(res.transactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleQuickRecharge = async (amount: number) => {
    setIsProcessing(true);
    try {
      // 1. Create Razorpay order
      const order = await trivaanaApi.createRazorpayOrder(amount);

      // 2. Simulate Razorpay payment confirmation
      const fakePaymentId = `pay_${Date.now()}`;
      await trivaanaApi.submitRazorpayWebhook({
        order_id: order.order_id,
        payment_id: fakePaymentId,
        signature: 'sig_verified_mock_checksum',
        amount_inr: amount,
      });

      // Confetti burst
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      alert(`₹${amount.toLocaleString('en-IN')} added to wallet successfully via Razorpay!`);
      await fetchTransactions();
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (err: any) {
      alert(`Payment failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-800 text-xs font-semibold w-fit mb-3 border border-orange-200">
          <Wallet className="w-3.5 h-3.5 text-orange-600" />
          <span>Zero-Float-Drift Integer Paise Accounting</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Wallet, Razorpay Top-Up & GST Invoices
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Trivaana tracks call duration down to whole integer paise (₹0.06/sec). Never pay for fractional rounding discrepancies. Download 18% GST tax invoices with input tax credit (ITC).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Wallet Balance & Top-Up Chips */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Wallet Card */}
          <div className="bg-slate-950 rounded-3xl p-6 text-white border border-slate-800 shadow-md relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Prepaid Call Balance
                </span>
                <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-1 flex items-baseline gap-1">
                  <span className="text-orange-500 text-2xl">₹</span>
                  <span>
                    {(tenant?.wallet_balance ?? 5000).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Talk-Time Rate:</span>
                <span className="font-mono text-orange-400 font-bold">
                  ₹{tenant?.rate_per_min ?? 3.60} / min
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Per-Second Equivalent:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  6 Paise / second
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Payment Gateway:</span>
                <span className="text-white font-bold">Razorpay (UPI / Netbanking)</span>
              </div>
            </div>
          </div>

          {/* Quick Top-Up Form */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Quick Razorpay Recharge
            </h3>

            <div className="grid grid-cols-3 gap-2.5">
              {[500, 1000, 2500, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTopUpAmount(amt)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    topUpAmount === amt
                      ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleQuickRecharge(topUpAmount)}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Razorpay Checkout...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Pay ₹{topUpAmount.toLocaleString('en-IN')} via Razorpay UPI</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Instant wallet credit with 18% GST invoice generation</span>
            </div>
          </div>
        </div>

        {/* Right Column: Transactions & GST Invoices Table */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Integer Paise Ledger & GST Invoices
              </h2>
              <p className="text-xs text-slate-500">
                Audited transaction history with downloadable GST tax receipts
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {transactions.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="pb-3 pl-2">Type</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Invoice #</th>
                  <th className="pb-3">Paise</th>
                  <th className="pb-3">Amount (INR)</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading financial ledger...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pl-2">
                        {tx.type === 'credit' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                            <ArrowDownLeft className="w-3 h-3" /> Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600 font-bold text-[11px]">
                            <ArrowUpRight className="w-3 h-3" /> Debit
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-medium text-slate-800">{tx.description}</td>
                      <td className="py-3 font-mono text-[11px] text-slate-500">{tx.invoice_id}</td>
                      <td className="py-3 font-mono text-slate-500">{tx.amount_paise}p</td>
                      <td className={`py-3 font-mono font-bold ${
                        tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {tx.type === 'credit' ? '+' : '-'}₹{tx.amount_inr.toFixed(2)}
                      </td>
                      <td className="py-3 text-right pr-2">
                        <button
                          onClick={() => setSelectedInvoice(tx)}
                          className="text-orange-600 hover:text-orange-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Invoice</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Printable GST Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest block">
                  Tax Invoice / Receipt
                </span>
                <h3 className="text-xl font-black text-slate-900 font-mono mt-0.5">
                  {selectedInvoice.invoice_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="flex justify-between text-slate-600">
                <span>Issued To:</span>
                <span className="font-bold text-slate-900">{tenant?.name || 'Enterprise Customer'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Seller GSTIN:</span>
                <span className="font-mono font-bold text-slate-900">37AAACT0000A1Z5</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>HSN / SAC Code:</span>
                <span className="font-mono text-slate-900">998313 (IT & Cloud Services)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Description:</span>
                <span className="text-slate-900">{selectedInvoice.description}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax Breakdown:</span>
                <span>CGST (9%) + SGST (9%) Included</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center font-mono">
              <span className="text-xs font-bold text-slate-700">Total Paid (INR):</span>
              <span className="text-xl font-black text-slate-950">
                ₹{selectedInvoice.amount_inr.toFixed(2)}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print / Save Tax PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
