import React, { useState, useEffect } from "react";
import {
  User,
  UserRole,
  HostCategory,
  AppSettings,
  ServiceItem,
} from "../types";
import { PRICING } from "../constants";
import {
  checkSupabaseConnection,
} from "../utils/supabase";

interface ProfileViewProps {
  user: User;
  hosts: User[];
  onUpdateUser?: (updates: Partial<User>) => void;
  favorites: string[];
  onToggleFavorite: (hostId: string) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
}

const CATEGORY_OPTIONS: HostCategory[] = [
  "Hookup",
  "Callboy",
  "Callgirl",
  "Massage",
  "Spa",
  "Entertainment",
];

const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdateUser }) => {
  const [sessionYield, setSessionYield] = useState(0);
  const [isBoosting, setIsBoosting] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");

  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "checking" | "connected" | "failed"
  >("idle");

  useEffect(() => {
    setConnectionStatus("checking");
    checkSupabaseConnection()
      .then((connected) => {
        setConnectionStatus(connected ? "connected" : "failed");
      })
      .catch(() => {
        setConnectionStatus("failed");
      });
  }, []);

  const isHost = user.role === UserRole.HOST;

  const handleUpdateField = (field: keyof User, value: any) => {
    if (onUpdateUser) onUpdateUser({ [field]: value });
  };

  const handleAddService = () => {
    if (!newServiceName || !newServicePrice) return;
    const price = parseInt(newServicePrice);
    if (isNaN(price)) return;

    const newService: ServiceItem = {
      id: "s" + Date.now(),
      name: newServiceName,
      price: price,
      description: "Custom Service",
      category: user.category || "Hookup",
    };

    const currentServices = user.services || [];
    handleUpdateField("services", [...currentServices, newService]);
    setNewServiceName("");
    setNewServicePrice("");
  };

  const handleRemoveService = (id: string) => {
    const currentServices = user.services || [];
    handleUpdateField(
      "services",
      currentServices.filter((s) => s.id !== id),
    );
  };

  const handleTriggerBoost = () => {
    setIsBoosting(true);
    setTimeout(() => {
      if (onUpdateUser) onUpdateUser({ isBoosted: true });
      setIsBoosting(false);
      alert(`Profile Boosted! UGX ${PRICING.FLASH_BOOST} deducted.`);
    }, 1000);
  };

  return (
    <div className="p-4 space-y-8 pb-32 animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
      <div className="text-center pt-8">
        <div className="relative inline-block">
          <div className="relative">
            <img
              src={user.photo}
              className={`w-32 h-32 rounded-[40px] object-cover mx-auto border-4 shadow-2xl relative z-10 ${isHost ? "border-[#39FF14]" : "border-blue-500"}`}
            />
            <div
              className={`absolute inset-0 rounded-[40px] blur-2xl opacity-20 ${isHost ? "bg-[#39FF14] animate-pulse" : "bg-blue-500"}`}
            ></div>
          </div>
          <label
            className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl flex items-center justify-center text-black border-4 border-black z-20 cursor-pointer ${isHost ? "bg-[#39FF14]" : "bg-blue-500"}`}
          >
            <i className="fas fa-camera text-[12px]"></i>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () =>
                    handleUpdateField("photo", reader.result);
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-3xl font-black tracking-tight uppercase italic text-white">
              {user.alias}
            </h2>
            {user.verified && (
              <i
                className={`fas fa-check-circle text-sm ${isHost ? "text-[#39FF14]" : "text-blue-500"}`}
              ></i>
            )}
          </div>
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${isHost ? "bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]" : "bg-blue-500/10 border-blue-500/30 text-blue-500"}`}
          >
            <i
              className={`fas ${isHost ? "fa-briefcase" : "fa-user-check"}`}
            ></i>
            {isHost ? "Service Provider Account" : "Connect Account"}
          </div>
        </div>
      </div>

      {/* Profile Details Editing */}
      <section className="bg-zinc-900/50 p-6 rounded-[40px] border border-zinc-800 space-y-6">
        <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest px-2">
          My Info
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
              Email Address
            </label>
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="w-full bg-zinc-950 border border-zinc-900 p-3 rounded-xl text-xs font-bold text-zinc-500 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                Phone Number
              </label>
              <input
                type="text"
                value={user.phone || ""}
                onChange={(e) => handleUpdateField("phone", e.target.value)}
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-xs font-bold text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                WhatsApp
              </label>
              <input
                type="text"
                value={user.whatsapp || ""}
                onChange={(e) => handleUpdateField("whatsapp", e.target.value)}
                className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-xs font-bold text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
              My Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleUpdateField("category", opt)}
                  className={`py-2 rounded-lg text-[8px] font-black uppercase border transition-all ${user.category === opt ? "bg-[#39FF14] text-black border-[#39FF14]" : "bg-black text-zinc-600 border-zinc-800"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isHost && (
        <>
          {/* Revenue & Boost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 border border-[#39FF14]/10 p-6 rounded-[32px] flex flex-col justify-center">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                Today's Earnings
              </p>
              <h4 className="text-xl font-black text-[#39FF14]">
                UGX {sessionYield.toLocaleString()}
              </h4>
            </div>
            <button
              onClick={handleTriggerBoost}
              disabled={isBoosting || user.isBoosted}
              className={`p-6 rounded-[32px] border transition-all flex flex-col justify-center gap-1 ${user.isBoosted ? "bg-[#39FF14] border-[#39FF14] text-black shadow-[0_0_15px_rgba(57,255,20,0.3)]" : "bg-zinc-900 border-zinc-800 text-white"}`}
            >
              <p className="text-[9px] font-black uppercase tracking-widest">
                {user.isBoosted ? "Top of List" : "Boost Profile"}
              </p>
              <h4 className="text-sm font-black uppercase">
                {user.isBoosted ? "Top of Grid" : `UGX ${PRICING.FLASH_BOOST}`}
              </h4>
            </button>
          </div>

          {/* Service Providers Listing */}
          <section className="bg-zinc-900/50 p-6 rounded-[40px] border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                What I Offer
              </h3>
              <i className="fas fa-list-check text-[#39FF14] text-xs"></i>
            </div>

            <div className="space-y-3">
              {(user.services || []).map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-4 bg-black rounded-2xl border border-zinc-800 group"
                >
                  <div>
                    <p className="text-xs font-black text-white uppercase italic tracking-tight">
                      {service.name}
                    </p>
                    <p className="text-[9px] font-bold text-[#39FF14] uppercase">
                      UGX {service.price.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveService(service.id)}
                    className="text-zinc-800 hover:text-red-500 transition-colors"
                  >
                    <i className="fas fa-trash-alt text-[10px]"></i>
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-zinc-800 space-y-4">
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] text-center">
                Add Something New
              </p>
              <div className="flex gap-2">
                <input
                  placeholder="Service Name"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 text-[10px] font-bold text-white outline-none focus:border-[#39FF14]"
                />
                <input
                  placeholder="Price"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="w-24 bg-black border border-zinc-800 rounded-xl p-3 text-[10px] font-bold text-white outline-none focus:border-[#39FF14]"
                />
              </div>
              <button
                onClick={handleAddService}
                className="w-full bg-zinc-800 text-[#39FF14] font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
              >
                Add Now
              </button>
            </div>
          </section>
        </>
      )}

      {/* Safety & Tools */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase text-zinc-600 tracking-widest px-4">
          Settings
        </h3>
        <div className="grid grid-cols-1 gap-3 px-2">
          {/* Supabase Connection Status Card (Read-Only & Polished) */}
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-[32px] space-y-4 text-left animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <i className="fas fa-database text-lg"></i>
              </div>
              <div className="text-left flex-1">
                <span className="font-bold text-sm uppercase block text-white">
                  Database Synchronization
                </span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">
                  Active Supabase Cloud Storage
                </span>
              </div>
            </div>

            <div className="text-[11px] bg-black/40 border border-zinc-800/80 p-4 rounded-2xl text-zinc-400 font-medium space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                  Database Connection:
                </span>
                {connectionStatus === "checking" && (
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Syncing...
                  </span>
                )}
                {connectionStatus === "connected" && (
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]"></span>
                    Live & Connected
                  </span>
                )}
                {connectionStatus === "failed" && (
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    Disconnected
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase pt-1 border-t border-zinc-800/60">
                <span>Data Protection:</span>
                <span className="font-bold text-emerald-500">AES-256 Enabled</span>
              </div>

              <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase">
                <span>Sync Server:</span>
                <span className="font-bold font-mono">Supabase Global</span>
              </div>
            </div>
          </div>



          <button className="flex items-center justify-between p-6 bg-zinc-900 border border-zinc-800 rounded-[32px] group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-purple-500">
                <i className="fas fa-vault"></i>
              </div>
              <div className="text-left">
                <span className="font-bold text-sm uppercase block text-white">
                  Hidden Photos
                </span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">
                  Safe Photos
                </span>
              </div>
            </div>
            <i className="fas fa-chevron-right text-zinc-700"></i>
          </button>

          <button className="flex items-center justify-between p-6 bg-zinc-900 border border-zinc-800 rounded-[32px] group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-blue-500">
                <i className="fas fa-user-shield"></i>
              </div>
              <div className="text-left">
                <span className="font-bold text-sm uppercase block text-white">
                  Check My ID
                </span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">
                  Verified
                </span>
              </div>
            </div>
            <i className="fas fa-chevron-right text-zinc-700"></i>
          </button>
        </div>
      </section>

      <button
        onClick={() => {
          localStorage.clear();
          window.location.reload();
        }}
        className="w-full p-8 text-zinc-800 font-black uppercase text-[10px] tracking-[0.4em] hover:text-red-500 transition-colors"
      >
        Log Out
      </button>
    </div>
  );
};

export default ProfileView;
