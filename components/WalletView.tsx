
import React, { useMemo, useState } from 'react';
import { Wallet } from '../types';
import { PRICING } from '../constants';

interface WalletViewProps {
  wallet: Wallet;
  onWithdraw?: () => void;
  onTopUp?: (amount: number) => void;
  userRole?: string;
}

const WalletView: React.FC<WalletViewProps> = ({ wallet, onWithdraw, onTopUp, userRole }) => {
  const [topUpAmount, setTopUpAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('');

  const calculations = useMemo(() => {
    const platformCut = wallet.availableBalance * PRICING.PLATFORM_TAX;
    const netPayout = wallet.availableBalance - platformCut;
    return { platformCut, netPayout };
  }, [wallet.availableBalance]);

  const isHost = userRole === 'HOST';

  const handleTopUpClick = () => {
    if (onTopUp) {
      const amount = customAmount ? parseInt(customAmount) : topUpAmount;
      if (isNaN(amount) || amount <= 0) {
        alert('Please specify a valid amount.');
        return;
      }
      onTopUp(amount);
    }
  };

  return (
    <div className="p-6 space-y-10 animate-in fade-in duration-700">
      <div className="flex items-center justify-between px-1">
         <h2 className="text-3xl font-black tracking-tighter uppercase italic text-white">{isHost ? 'My Money' : 'My Wallet'}</h2>
         <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-3 rounded-2xl relative">
           <i className={`fas ${isHost ? 'fa-chart-line' : 'fa-wallet'} ${isHost ? 'text-[#39FF14]' : 'text-blue-500'} text-sm`}></i>
           {isHost && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>}
         </div>
      </div>

      <div className={`p-10 rounded-[56px] text-black space-y-8 shadow-xl relative overflow-hidden group ${isHost ? 'bg-gradient-to-br from-[#39FF14] via-[#2fd111] to-[#25d611]' : 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700'}`}>
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/20 rounded-full blur-3xl"></div>
        <div className="flex justify-between items-start relative z-10">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-black/50">{isHost ? 'Total Earned' : 'Balance'}</p>
            <h1 className="text-6xl font-black tracking-tighter leading-none">
              <span className="text-2xl mr-1 font-bold">UGX</span>
              {wallet.availableBalance.toLocaleString()}
            </h1>
          </div>
          <div className="w-16 h-16 bg-black rounded-[24px] flex items-center justify-center shadow-lg">
            <i className={`fas ${isHost ? 'fa-coins' : 'fa-wallet'} text-3xl ${isHost ? 'text-[#39FF14]' : 'text-blue-500'}`}></i>
          </div>
        </div>
        
        {isHost && (
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-black/10 relative z-10">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/50">Can Withdraw</p>
              <p className="text-2xl font-black tracking-tight">UGX {wallet.availableBalance.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/50">You Get</p>
              <p className="text-2xl font-black tracking-tight text-white">UGX {calculations.netPayout.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {isHost ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">How you earned</h3>
            <span className="text-[9px] font-bold text-[#39FF14] uppercase">Live Update</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] space-y-2 relative overflow-hidden">
              <i className="fas fa-unlock text-[#39FF14] text-sm mb-2"></i>
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Number Unlocks</p>
              <p className="text-xl font-black text-white">UGX {(wallet.totalGiftsReceived * PRICING.WHATSAPP_UNLOCK).toLocaleString()}</p>
              <div className="absolute top-0 right-0 p-3">
                <div className="w-1 h-1 bg-[#39FF14] rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] space-y-2">
              <i className="fas fa-video text-purple-500 text-sm mb-2"></i>
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Live Shows</p>
              <p className="text-xl font-black text-white">UGX 0</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-950 p-8 rounded-[48px] border border-zinc-900 text-center space-y-6">
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-400">
              <i className="fas fa-credit-card text-lg"></i>
            </div>
            <div>
              <span className="font-bold text-sm uppercase block text-white">Load My Wallet</span>
              <span className="text-[9px] text-zinc-500 uppercase font-bold">Safe deposits via Pesapal</span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 text-left">
            Add money to your account to instantly connect and unlock communication lines with girls, guys, and hosts near you.
          </p>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-2">
              {[5000, 10000, 20000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setTopUpAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`py-3.5 px-3 rounded-2xl text-[10px] font-black uppercase border transition-all ${
                    topUpAmount === amt && !customAmount
                      ? 'bg-teal-500 text-black border-teal-500 shadow-lg shadow-teal-500/20'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  UGX {amt.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider block">Or Custom Amount (UGX)</label>
              <input
                type="number"
                placeholder="Enter amount, e.g. 50000"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full bg-black border border-zinc-900 p-3 rounded-2xl text-xs font-mono text-white outline-none focus:border-teal-500"
              />
            </div>

            <button
              onClick={handleTopUpClick}
              className="w-full bg-[#009688] hover:bg-teal-500 text-white font-black py-4 rounded-[24px] uppercase text-xs tracking-wider shadow-lg shadow-teal-500/20 active:scale-95 transition-transform"
            >
              Top Up via Pesapal
            </button>
          </div>
        </div>
      )}

      {isHost && (
        <div className="space-y-5">
          <button 
            onClick={onWithdraw}
            className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-8 rounded-[44px] flex items-center justify-between active:scale-[0.98] transition-all shadow-lg group hover:border-[#39FF14]/30"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-[#39FF14] rounded-2xl flex items-center justify-center text-black shadow-lg group-hover:scale-110 transition-transform">
                <i className="fas fa-paper-plane text-2xl"></i>
              </div>
              <div className="text-left">
                <h4 className="font-bold text-lg uppercase text-white">Get My Money</h4>
                <p className="text-[11px] text-zinc-500 font-bold uppercase mt-1">
                  {PRICING.PLATFORM_TAX * 100}% Fee Applied
                </p>
              </div>
            </div>
            <i className="fas fa-chevron-right text-zinc-700"></i>
          </button>
        </div>
      )}

      <div className="bg-zinc-900/20 p-6 rounded-[32px] border border-zinc-900/50 space-y-2">
        <div className="flex items-center gap-2 justify-center text-zinc-600">
          <i className="fas fa-shield-halved text-[10px]"></i>
          <p className="text-[9px] font-bold uppercase tracking-widest">How fees work</p>
        </div>
        <p className="text-[9px] font-bold text-zinc-700 uppercase leading-relaxed text-center">
          You keep 80%. We take 20% to keep the app safe and running.
        </p>
      </div>
    </div>
  );
};

export default WalletView;
