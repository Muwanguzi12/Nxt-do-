
import React, { useState, useMemo } from 'react';
import { User, TransactionType, HostCategory, GridPost } from '../types';
import { PRICING } from '../constants';
import { calculateDistance } from '../utils/geo';

interface NearbyListProps {
  hosts: User[];
  gridPosts: GridPost[];
  currentUser: User | null;
  favorites: string[];
  onToggleFavorite: (hostId: string) => void;
  onBlock: (hostId: string) => void;
  settings: any;
  onPaymentRequest: (host: User, amount: number, type: TransactionType) => void;
  onUseTrial: (host: User) => void;
  activeCategory: HostCategory | null;
}

const NearbyList: React.FC<NearbyListProps> = ({ 
  hosts, 
  currentUser, 
  onPaymentRequest,
  onBlock,
  onUseTrial,
  activeCategory
}) => {
  const [selectedHost, setSelectedHost] = useState<User | null>(null);

  const processedHosts = useMemo(() => {
    let list = hosts.filter(h => !activeCategory || h.category === activeCategory);
    return list.map(host => ({
      ...host,
      distance: currentUser?.location ? calculateDistance(currentUser.location.lat, currentUser.location.lng, host.location.lat, host.location.lng) : 0
    })).sort((a, b) => (a.isBoosted === b.isBoosted ? a.distance - b.distance : a.isBoosted ? -1 : 1));
  }, [hosts, currentUser?.location, activeCategory]);

  const handleInitiateConnect = () => {
    if (!selectedHost) return;
    
    if (currentUser?.freeTrialsRemaining && currentUser.freeTrialsRemaining > 0) {
      onUseTrial(selectedHost);
      setSelectedHost(null);
    } else {
      onPaymentRequest(selectedHost, PRICING.WHATSAPP_UNLOCK, TransactionType.WHATSAPP);
      setSelectedHost(null);
    }
  };

  return (
    <div className="p-5 space-y-8 animate-in fade-in duration-700">
      {currentUser?.freeTrialsRemaining !== undefined && currentUser.freeTrialsRemaining > 0 && (
        <div className="bg-gradient-to-r from-[#39FF14] to-zinc-900 p-4 rounded-[28px] flex items-center justify-between border border-white/10 shadow-lg animate-pulse">
           <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-[#39FF14]"><i className="fas fa-gift"></i></div>
             <div>
               <p className="text-[10px] font-black uppercase text-black">Free Gift</p>
               <p className="text-[11px] font-bold text-white uppercase tracking-tight">{currentUser.freeTrialsRemaining} FREE CHANCES LEFT</p>
             </div>
           </div>
           <i className="fas fa-chevron-right text-black/50"></i>
        </div>
      )}

      <section className="space-y-8 pb-40">
        <div className="flex justify-between items-center px-2">
          <h2 className="text-2xl font-black uppercase text-white tracking-tighter italic">People Near You</h2>
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
            {activeCategory ? activeCategory : 'Looking Everywhere'} • {processedHosts.length} People
          </span>
        </div>

        {processedHosts.length > 0 ? processedHosts.map(host => (
          <div key={host.id} className={`relative bg-zinc-900 rounded-[56px] overflow-hidden border shadow-xl transition-all group ${host.isBoosted ? 'border-[#39FF14] neon-shadow' : 'border-zinc-800'}`} onClick={() => setSelectedHost(host)}>
            <div className="aspect-[4/5] relative">
              <img src={host.photo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
              
              <div className="absolute top-8 left-8">
                 <div className={`bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase border border-white/5 ${host.role === 'HOST' ? 'text-[#39FF14]' : 'text-blue-500'}`}>
                   {host.category || 'User'}
                 </div>
              </div>

              <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between">
                <div>
                  <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-1">{host.alias}</h3>
                  <p className="text-[11px] font-bold text-[#39FF14] uppercase tracking-widest">{host.distance} km away</p>
                </div>
                <div className={`w-16 h-16 rounded-[28px] text-black flex items-center justify-center shadow-lg ${host.role === 'HOST' ? 'bg-[#39FF14]' : 'bg-blue-500'}`}>
                  <i className={`fab ${host.whatsapp ? 'fa-whatsapp' : 'fa-phone'} text-2xl`}></i>
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-700 space-y-4">
             <i className="fas fa-radar text-4xl animate-pulse"></i>
             <p className="text-xs font-black uppercase tracking-widest">
               {currentUser?.role === 'HOST' ? 'You are visible to others' : 'No one found here'}
             </p>
          </div>
        )}
      </section>

      {selectedHost && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-6 backdrop-blur-3xl" onClick={() => setSelectedHost(null)}>
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[64px] overflow-hidden shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <img src={selectedHost.photo} className="w-full aspect-square object-cover" />
            <div className="p-10 space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">{selectedHost.alias}</h3>
                <p className="text-[#39FF14] text-[10px] font-black uppercase tracking-[0.3em] mt-2">Checked {selectedHost.category} Profile</p>
              </div>
              <button 
                onClick={handleInitiateConnect}
                className="w-full bg-[#39FF14] text-black font-black py-6 rounded-[28px] uppercase text-sm tracking-widest shadow-xl flex items-center justify-center gap-4 active:scale-95 transition-all"
              >
                <i className="fab fa-whatsapp text-lg"></i>
                {currentUser?.freeTrialsRemaining ? 'Use Free Chance' : 'Pay to Connect'}
              </button>
              <p className="text-center text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Paying keeps everyone safe</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyList;
