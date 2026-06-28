import React, { useState, useEffect } from "react";
import { User, UserRole, HostCategory } from "../types";
import { supabase, getProfileById, saveProfile } from "../utils/supabase";

interface AuthScreenProps {
  onLogin: (userData: Partial<User>) => void;
}

const INTEREST_OPTIONS = [
  "Massage",
  "Body Scrub",
  "Fitness",
  "Escort",
  "Striptease",
  "Shows",
  "Travel",
  "Cocktails",
  "Movies",
  "Gaming",
];

const CATEGORY_OPTIONS: HostCategory[] = [
  "Hookup",
  "Callboy",
  "Callgirl",
  "Massage",
  "Spa",
  "Entertainment",
];

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState("");
  const [gender, setGender] = useState("");
  const [alias, setAlias] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.VIEWER);
  const [category, setCategory] = useState<HostCategory>("Hookup");
  const [age, setAge] = useState<string>("");
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string>(
    "https://picsum.photos/seed/me/200/200",
  );
  const [isCheckingSupabase, setIsCheckingSupabase] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => {
    // Check if there is an active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleAuthSession(session);
      }
    });

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        handleAuthSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthSession = async (session: any) => {
    setIsCheckingSupabase(true);
    try {
      const user = session.user;
      setUserId(user.id);
      setEmail(user.email || "");

      const existingProfile = await getProfileById(user.id);
      if (existingProfile) {
        onLogin({
          id: existingProfile.id,
          phone: existingProfile.phone || "",
          email: existingProfile.email || user.email || "",
          whatsapp: existingProfile.whatsapp || existingProfile.phone || "",
          alias: existingProfile.alias,
          photo: existingProfile.photo,
          role: existingProfile.role as UserRole,
          category: existingProfile.category as HostCategory,
          gender: existingProfile.gender,
          interests: existingProfile.interests,
          bio: existingProfile.bio,
          age: existingProfile.age,
        });
        return;
      } else {
        // No profile exists, transition to profile creation step
        setStep(3);
      }
    } catch (err) {
      console.warn("Error checking profile after magic link login:", err);
      setStep(3);
    } finally {
      setIsCheckingSupabase(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!email.trim() || !email.includes("@")) {
      alert("Please enter a valid email address");
      return;
    }

    setIsSendingLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        alert("Error sending magic link: " + error.message);
      } else {
        setStep(2);
      }
    } catch (err: any) {
      alert("Failed to send magic link: " + err.message);
    } finally {
      setIsSendingLink(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      alert("Please enter the 6-digit confirmation code from your email.");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: "email",
      });

      if (error) {
        alert("Verification failed: " + error.message);
      } else if (data?.session) {
        handleAuthSession(data.session);
      }
    } catch (err: any) {
      alert("Verification error: " + err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompleteSetup = async () => {
    const ageNum = parseInt(age);
    if (!alias.trim() || !gender || isNaN(ageNum)) {
      alert("Please fill in your name, gender, and age.");
      return;
    }
    if (ageNum < 18) {
      alert("You must be 18 years or older to use this app.");
      return;
    }

    setIsCheckingSupabase(true);
    const profileData = {
      id: userId || "u" + Date.now(),
      phone: phone || undefined,
      email,
      whatsapp: whatsapp || phone || undefined,
      alias,
      gender,
      role: role as string,
      category: role === UserRole.HOST ? category : undefined,
      interests,
      bio,
      age: ageNum,
      photo: profilePhoto,
    };

    try {
      await saveProfile(profileData);
    } catch (err) {
      console.warn("Failed to save profile to Supabase:", err);
    } finally {
      setIsCheckingSupabase(false);
    }

    onLogin(profileData);
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-start p-6 text-white max-w-md mx-auto border-x border-zinc-800 overflow-y-auto custom-scrollbar">
      <div className="text-center mt-8 mb-12">
        <h1 className="text-6xl font-black text-[#39FF14] tracking-tighter italic">
          NXT DO
        </h1>
        <p className="text-zinc-600 font-bold tracking-widest text-[10px] mt-2 uppercase">
          Meet People Near You
        </p>
      </div>

      <div className="w-full space-y-6 pb-12 relative">
        {isCheckingSupabase && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 space-y-4 py-12 rounded-3xl">
            <div className="w-12 h-12 border-4 border-zinc-800 border-t-[#39FF14] rounded-full animate-spin"></div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              Checking secure session...
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="space-y-4">
              <label className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#39FF14] p-5 text-xl outline-none rounded-[24px]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-[9px] text-zinc-500 font-bold px-1 uppercase tracking-wider">
                We'll email you a secure, passwordless magic login link.
              </p>
            </div>
            <button
              onClick={handleSendMagicLink}
              disabled={isSendingLink}
              className="w-full bg-[#39FF14] text-black font-black py-5 rounded-[24px] text-sm shadow-lg uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSendingLink ? (
                <>
                  <i className="fas fa-spinner animate-spin"></i>
                  Sending...
                </>
              ) : (
                "Send Magic Link"
              )}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in slide-in-from-right duration-300 space-y-6 text-center py-6">
            <div className="w-20 h-20 bg-[#39FF14]/10 rounded-full flex items-center justify-center mx-auto text-[#39FF14] text-3xl">
              <i className="fas fa-envelope-open-text animate-bounce"></i>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-black uppercase tracking-tight">
                Check Your Inbox
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                We sent a secure link and code to{" "}
                <span className="text-white font-bold">{email}</span>.
              </p>
            </div>

            {/* OTP Code Input */}
            <div className="p-5 bg-zinc-900 rounded-[24px] border border-zinc-800 space-y-4 max-w-xs mx-auto text-left">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">
                  Or enter 6-digit verification code:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full bg-black border border-zinc-800 text-center tracking-[0.5em] text-xl font-mono py-3 rounded-xl text-[#39FF14] outline-none focus:border-[#39FF14]"
                />
              </div>
              <button
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp}
                className="w-full bg-[#39FF14] hover:bg-[#32dd10] disabled:opacity-50 text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-wider transition-colors"
              >
                {isVerifyingOtp ? "Verifying..." : "Verify Code"}
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                <i className="fas fa-spinner animate-spin text-[#39FF14]"></i>
                Waiting for activation...
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-[10px] text-zinc-400 hover:text-white uppercase font-black tracking-wider underline mt-2"
              >
                Change Email Address
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in zoom-in duration-500">
            <div className="text-center">
              <h2 className="text-3xl font-black uppercase italic">
                Create Profile
              </h2>
              <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest mt-2">
                Tell us about you
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="relative w-24 h-24 group">
                <img
                  src={profilePhoto}
                  className="w-full h-full rounded-[32px] object-cover border-2 border-[#39FF14]/30"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[32px] opacity-0 group-hover:opacity-100">
                  <i className="fas fa-camera text-white"></i>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleProfilePhotoChange}
                />
              </div>
              <p className="text-[10px] font-bold uppercase text-zinc-500">
                Add Photo
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-zinc-600 tracking-widest px-2">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Display Name"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-[20px] p-4 text-white font-bold text-sm"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-zinc-600 tracking-widest px-2">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="21"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-[20px] p-4 text-white font-bold text-sm"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-zinc-600 tracking-widest px-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  placeholder="+256..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-[20px] p-4 text-white font-bold text-sm"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-zinc-600 tracking-widest px-2">
                  Phone Call Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+256..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-[20px] p-4 text-white font-bold text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-bold uppercase text-zinc-600 tracking-widest px-2 italic">
                  Choose Your Mode
                </label>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => setRole(UserRole.VIEWER)}
                    className={`p-6 rounded-[32px] border text-left transition-all relative overflow-hidden group ${role === UserRole.VIEWER ? "bg-blue-500/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]" : "bg-zinc-900 text-zinc-500 border-zinc-800"}`}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${role === UserRole.VIEWER ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-600"}`}
                      >
                        <i className="fas fa-search text-lg"></i>
                      </div>
                      <div>
                        <p
                          className={`font-black uppercase text-xs ${role === UserRole.VIEWER ? "text-blue-500" : "text-white"}`}
                        >
                          Connect Account
                        </p>
                        <p className="text-[10px] font-bold opacity-60 mt-0.5">
                          I want to find and connect with people nearby.
                        </p>
                      </div>
                    </div>
                    {role === UserRole.VIEWER && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                  </button>

                  <button
                    onClick={() => setRole(UserRole.HOST)}
                    className={`p-6 rounded-[32px] border text-left transition-all relative overflow-hidden group ${role === UserRole.HOST ? "bg-[#39FF14]/10 border-[#39FF14] shadow-[0_0_20px_rgba(57,255,20,0.2)]" : "bg-zinc-900 text-zinc-500 border-zinc-800"}`}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${role === UserRole.HOST ? "bg-[#39FF14] text-black" : "bg-zinc-800 text-zinc-600"}`}
                      >
                        <i className="fas fa-briefcase text-lg"></i>
                      </div>
                      <div>
                        <p
                          className={`font-black uppercase text-xs ${role === UserRole.HOST ? "text-[#39FF14]" : "text-white"}`}
                        >
                          Service Provider
                        </p>
                        <p className="text-[10px] font-bold opacity-60 mt-0.5">
                          I want to offer services and earn money.
                        </p>
                      </div>
                    </div>
                    {role === UserRole.HOST && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-[#39FF14] rounded-full animate-pulse"></div>
                    )}
                  </button>
                </div>
              </div>

              {role === UserRole.HOST && (
                <div className="space-y-2 animate-in slide-in-from-top-4">
                  <label className="text-[11px] font-bold uppercase text-[#39FF14] tracking-widest px-2 italic">
                    What do you do?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setCategory(opt)}
                        className={`py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${category === opt ? "bg-[#39FF14] text-black border-[#39FF14]" : "bg-zinc-900 text-zinc-700 border-zinc-800"}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-zinc-600 tracking-widest px-2">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["Female", "Male", "Other"].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`py-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${gender === g ? "bg-[#39FF14] text-black border-[#39FF14]" : "bg-zinc-900 text-zinc-500 border-zinc-800"}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-zinc-600 tracking-widest px-2">
                  What you like
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-zinc-900/50 rounded-[24px] border border-zinc-800">
                  {INTEREST_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => toggleInterest(opt)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${interests.includes(opt) ? "bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14]/40" : "bg-zinc-900 text-zinc-600 border-zinc-800"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleCompleteSetup}
              className="w-full bg-[#39FF14] text-black font-black py-5 rounded-[24px] uppercase shadow-xl shadow-[#39FF14]/20 active:scale-95 text-xs tracking-[0.2em]"
            >
              Finish
            </button>
          </div>
        )}
      </div>

      <p className="mt-8 text-zinc-700 text-[9px] text-center uppercase font-black tracking-widest opacity-40">
        Safe and Private
      </p>
    </div>
  );
};

export default AuthScreen;
