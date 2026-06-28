
import React, { useState, useEffect } from 'react';
import { User, UserRole, UserStatus, AppState, TransactionType, AppSettings, GridPost, HostCategory } from './types';
import { MOCK_HOSTS, PRICING } from './constants';
import NearbyList from './components/NearbyList';
import MapView from './components/MapView';
import WalletView from './components/WalletView';
import ProfileView from './components/ProfileView';
import AuthScreen from './components/AuthScreen';
import AIConcierge from './components/AIConcierge';
import PaymentProcessor from './components/PaymentProcessor';
import { saveProfile, saveTransaction } from './utils/supabase';

const SERVICE_CATEGORIES: { id: HostCategory | null; label: string; icon: string }[] = [
  { id: null, label: 'All', icon: 'fa-globe' },
  { id: 'Callgirl', label: 'Girls', icon: 'fa-venus' },
  { id: 'Callboy', label: 'Boys', icon: 'fa-mars' },
  { id: 'Massage', label: 'Massage', icon: 'fa-hands-bubbles' },
  { id: 'Spa', label: 'Spa', icon: 'fa-hot-tub-person' },
  { id: 'Entertainment', label: 'Shows', icon: 'fa-masks-theater' },
  { id: 'Hookup', label: 'Meet Up', icon: 'fa-bolt' },
];

const NavButton: React.FC<{ active: boolean; icon: string; label: string; onClick: () => void; hasNotification?: boolean }> = ({ active, icon, label, onClick, hasNotification }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all w-20 relative ${active ? 'text-[#39FF14]' : 'text-zinc-600 hover:text-zinc-400'}`}>
    {active && <div className="absolute -top-4 w-8 h-1 bg-[#39FF14] rounded-full shadow-[0_0_10px_#39FF14]"></div>}
    <div className="relative">
      <i className={`fas ${icon} ${active ? 'text-xl animate-pulse' : 'text-lg'}`}></i>
      {hasNotification && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-black animate-pulse"></div>}
    </div>
    <span className={`text-[9px] font-bold uppercase tracking-wide ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
  </button>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('nxt_do_state_v7');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, nearbyHosts: MOCK_HOSTS.map(h => ({ ...h, safetyScore: Math.floor(Math.random() * 20) + 80 })) };
      } catch (e) { console.error(e); }
    }
    return {
      currentUser: null,
      wallet: { totalBalance: 0, availableBalance: 0, pendingWithdrawal: 0, totalGiftsReceived: 0 },
      activeView: 'nearby',
      nearbyHosts: MOCK_HOSTS.map(h => ({ ...h, safetyScore: Math.floor(Math.random() * 20) + 80 })),
      gridPosts: [],
      isLoggedIn: false,
      favorites: [],
      blockedIds: [],
      settings: { discreetMode: false, preciseDistance: true, autoClearHistory: false, isGhostMode: false },
    };
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ amount: number; host: User | null; type: TransactionType | 'deposit' } | null>(null);
  const [activeCategory, setActiveCategory] = useState<HostCategory | null>(null);

  useEffect(() => {
    localStorage.setItem('nxt_do_state_v7', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (userData: Partial<User>) => {
    const newUser: User = {
      id: userData.id || 'u' + Date.now(),
      phone: userData.phone || '',
      whatsapp: userData.whatsapp || userData.phone || '',
      alias: userData.alias || 'User_Anon',
      photo: userData.photo || 'https://picsum.photos/seed/me/200/200',
      role: userData.role || UserRole.VIEWER,
      category: userData.category,
      verified: true,
      status: UserStatus.ONLINE,
      distance: 0,
      location: { lat: 0.3476, lng: 32.5825 },
      freeTrialsRemaining: 2,
      services: [],
      interests: userData.interests || []
    };
    setState(prev => ({ ...prev, currentUser: newUser, isLoggedIn: true }));
  };

  const handleUpdateUser = async (updates: Partial<User>) => {
    setState(prev => {
      const updatedUser = prev.currentUser ? { ...prev.currentUser, ...updates } : null;
      if (updatedUser) {
        saveProfile(updatedUser).catch(err => console.warn('Could not update profile on Supabase:', err));
      }
      return {
        ...prev,
        currentUser: updatedUser
      };
    });
  };

  const handleUseTrial = (host: User) => {
    setState(prev => {
      if (!prev.currentUser || prev.currentUser.freeTrialsRemaining <= 0) return prev;
      return {
        ...prev,
        currentUser: { ...prev.currentUser, freeTrialsRemaining: prev.currentUser.freeTrialsRemaining - 1 }
      };
    });
    handleFinalRedirect(host);
  };

  const handlePaymentRequest = (host: User | null, amount: number, type: TransactionType | 'deposit') => {
    setPendingPayment({ host, amount, type });
  };

  const handlePaymentSuccess = () => {
    if (!pendingPayment) return;
    const { host, amount, type } = pendingPayment;

    if (state.currentUser) {
      saveTransaction({
        id: `TXN-${Date.now()}`,
        user_id: state.currentUser.id,
        amount,
        service_name: type,
        status: 'Completed',
        provider: 'PESAPAL'
      }).catch(err => console.warn('Failed to log transaction to Supabase:', err));
    }

    if (type === 'deposit') {
      setState(prev => ({
        ...prev,
        wallet: {
          ...prev.wallet,
          availableBalance: prev.wallet.availableBalance + amount,
          totalBalance: prev.wallet.totalBalance + amount
        }
      }));
    } else if (host) {
      handleFinalRedirect(host);
    }
    
    setPendingPayment(null);
  };

  const handleFinalRedirect = (host: User) => {
    const contact = (host.whatsapp || host.phone || '').replace(/\D/g, '');
    const isWhatsApp = !!host.whatsapp;
    if (isWhatsApp) {
      window.open(`https://wa.me/${contact}?text=Hi%20${host.alias},%20I%20unlocked%20your%20Node%20on%20NXT%20DO!`, '_blank');
    } else {
      window.location.href = `tel:${contact}`;
    }
  };

  const setView = (view: AppState['activeView']) => setState(prev => ({ ...prev, activeView: view }));

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center">
        <div className="text-6xl font-black text-[#39FF14] animate-pulse italic tracking-tighter">NXT DO</div>
      </div>
    );
  }

  if (!state.isLoggedIn) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden max-w-md mx-auto relative border-x border-zinc-900 shadow-2xl">
      <header className="p-5 flex flex-col border-b border-zinc-900 bg-black/95 backdrop-blur-2xl z-[60]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform" onClick={() => setView('nearby')}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-black font-black italic ${state.currentUser?.role === UserRole.HOST ? 'bg-[#39FF14]' : 'bg-blue-500'}`}>
              {state.currentUser?.role === UserRole.HOST ? 'P' : 'C'}
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg text-white uppercase italic tracking-tighter leading-none">NXT DO</span>
              <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${state.currentUser?.role === UserRole.HOST ? 'text-[#39FF14]' : 'text-blue-500'}`}>
                {state.currentUser?.role === UserRole.HOST ? 'Provider Mode' : 'Connect Mode'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
               onClick={() => setIsAIModalOpen(true)}
               className="w-10 h-10 rounded-2xl flex items-center justify-center border transition-all bg-zinc-900/50 border-zinc-800 text-[#39FF14] hover:border-[#39FF14]/50 active:scale-95"
             >
               <i className="fas fa-comment-dots text-xs"></i>
             </button>

             <div className="bg-zinc-900/50 px-4 py-2 h-10 rounded-2xl border border-zinc-800 flex items-center gap-2 cursor-pointer active:scale-95 transition-all" onClick={() => setView('wallet')}>
               <i className="fas fa-wallet text-[#39FF14] text-[10px]"></i>
               <span className="text-[10px] font-black text-white">{state.wallet.availableBalance.toLocaleString()}</span>
             </div>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
          {SERVICE_CATEGORIES.map(cat => (
            <button 
              key={cat.label}
              onClick={() => {
                setActiveCategory(cat.id);
                if (state.activeView !== 'nearby' && state.activeView !== 'map') setView('nearby');
              }}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase border transition-all ${activeCategory === cat.id ? 'bg-[#39FF14] text-black border-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.2)]' : 'bg-zinc-900/40 text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
            >
              <i className={`fas ${cat.icon} ${activeCategory === cat.id ? 'text-black' : 'text-[#39FF14]'}`}></i>
              {cat.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 relative no-scrollbar">
        {state.activeView === 'nearby' && (
          <NearbyList 
            hosts={state.nearbyHosts} 
            gridPosts={state.gridPosts}
            currentUser={state.currentUser}
            favorites={state.favorites}
            onToggleFavorite={(id) => setState(prev => ({ ...prev, favorites: prev.favorites.includes(id) ? prev.favorites.filter(f => f !== id) : [...prev.favorites, id] }))}
            onBlock={(id) => setState(prev => ({ ...prev, blockedIds: [...prev.blockedIds, id] }))}
            settings={state.settings}
            onPaymentRequest={handlePaymentRequest}
            onUseTrial={handleUseTrial}
            activeCategory={activeCategory}
          />
        )}
        {state.activeView === 'map' && (
          <MapView 
            hosts={state.nearbyHosts} 
            currentUser={state.currentUser} 
            onUpdateUser={handleUpdateUser} 
          />
        )}

        {state.activeView === 'wallet' && (
          <WalletView 
            wallet={state.wallet} 
            onWithdraw={() => alert("Withdrawal to MoMo requested")} 
            onTopUp={(amount) => handlePaymentRequest(null, amount, 'deposit')}
            userRole={state.currentUser?.role} 
          />
        )}
        {state.activeView === 'profile' && (
          <ProfileView 
            user={state.currentUser!} 
            hosts={state.nearbyHosts} 
            onUpdateUser={handleUpdateUser} 
            favorites={state.favorites} 
            onToggleFavorite={() => {}} 
            settings={state.settings} 
            onUpdateSettings={() => {}} 
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-black/95 backdrop-blur-2xl border-t border-zinc-900 flex justify-around py-5 z-[80]">
        <NavButton active={state.activeView === 'nearby'} icon="fa-th-large" label="Home" onClick={() => setView('nearby')} />
        <NavButton active={state.activeView === 'map'} icon="fa-compass" label="Near Me" onClick={() => setView('map')} />
        <NavButton active={state.activeView === 'profile'} icon="fa-user" label="Me" onClick={() => setView('profile')} />
      </nav>

      {pendingPayment && (
        <PaymentProcessor 
          amount={pendingPayment.amount} 
          serviceName={pendingPayment.type === TransactionType.WHATSAPP ? "Get Number" : "Pay Now"}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setPendingPayment(null)}
          currentUser={state.currentUser}
        />
      )}

      <AIConcierge isOpen={state.isLoggedIn && isAIModalOpen} onClose={() => setIsAIModalOpen(false)} nearbyHosts={state.nearbyHosts} currentUser={state.currentUser} />
    </div>
  );
};

export default App;
