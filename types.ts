export enum UserRole {
  HOST = "HOST",
  VIEWER = "VIEWER",
}

export enum UserStatus {
  ONLINE = "Online",
  LIVE = "Live",
  AVAILABLE = "Available Now",
  OFFLINE = "Offline",
}

export type HostCategory =
  "Hookup" | "Callboy" | "Callgirl" | "Massage" | "Spa" | "Entertainment";

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: HostCategory;
  whatsapp?: string;
  phone?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export interface User {
  id: string;
  phone?: string;
  email?: string;
  secondaryPhone?: string;
  alias: string;
  photo: string;
  role: UserRole;
  verified: boolean;
  status: UserStatus;
  distance: number;
  location: {
    lat: number;
    lng: number;
  };
  whatsapp?: string;
  gender?: string;
  interests?: string[];
  category?: HostCategory;
  bio?: string;
  age?: number;
  servicePhotos?: string[];
  lockedPhotos?: string[]; // Media behind a paywall
  services?: ServiceItem[];
  safetyScore?: number;
  isBoosted?: boolean; // Featured listing
  boostExpiry?: number;
  freeTrialsRemaining: number; // For "First 2 on us" promotion
}

export interface GridPost {
  id: string;
  hostId: string;
  hostAlias: string;
  hostPhoto: string;
  contentImage: string;
  caption: string;
  timestamp: number;
  likes: number;
  price?: number;
  serviceType?: string;
  whatsapp?: string;
  phone?: string;
  coordinationLocation?: {
    lat: number;
    lng: number;
  };
}

export interface Wallet {
  totalBalance: number;
  availableBalance: number;
  pendingWithdrawal: number;
  totalGiftsReceived: number;
}

export enum TransactionType {
  LIVE_CALL = "live_call",
  WHATSAPP = "whatsapp",
  GIFT = "gift",
  SERVICE_CHARGE = "service_charge",
  BOOST = "boost",
  VAULT_UNLOCK = "vault_unlock",
}

export interface AppSettings {
  discreetMode: boolean;
  preciseDistance: boolean;
  autoClearHistory: boolean;
  isGhostMode: boolean;
}

// Added ChatMessage interface to resolve error in components/ChatView.tsx:3
export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

// Added ChatThread interface to resolve error in components/ChatView.tsx:3
export interface ChatThread {
  id: string;
  participantId: string;
  messages: ChatMessage[];
  lastMessageAt: number;
}

export interface AppState {
  currentUser: User | null;
  wallet: Wallet;
  activeView: "nearby" | "map" | "wallet" | "profile";
  nearbyHosts: User[];
  gridPosts: GridPost[];
  isLoggedIn: boolean;
  favorites: string[];
  blockedIds: string[];
  settings: AppSettings;
}
