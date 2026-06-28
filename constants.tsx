
import React from 'react';

export const COLORS = {
  NEON_GREEN: '#39FF14',
  DARK_BG: '#000000',
  CARD_BG: '#121212',
  ACCENT: '#1A1A1A',
};

export const PRICING = {
  LIVE_CALL: 4400,
  WHATSAPP_UNLOCK: 2000, 
  GIFT_MIN: 1000,
  GIFT_MAX: 5000000,
  FLASH_BOOST: 1000,
  VAULT_PEEP: 500,
  PLATFORM_TAX: 0.20, // 20% platform fee
};

export const MERCHANT_CODES = {
  MTN: {
    code: "460051",
    label: "NXT DO MERCHANT",
    color: "#EAB308" // Yellow
  },
  AIRTEL: {
    code: "1522704",
    label: "NXT DO AIRTEL",
    phone: "+256706146910",
    color: "#DC2626" // Red
  }
};

const DEFAULT_SERVICE_PHOTOS = [
  'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1529139513477-42f50eeaf01c?q=80&w=400&auto=format&fit=crop'
];

export const MOCK_HOSTS: any[] = [
  {
    id: 'h1',
    alias: 'Exotic Rose',
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=400&auto=format&fit=crop',
    location: { lat: 0.3476, lng: 32.5825 },
    status: 'Available Now',
    verified: true,
    whatsapp: '+256700000001',
    phone: '+256700000001',
    gender: 'Female',
    interests: ['High-End', 'Hookup', 'Outcall'],
    category: 'Callgirl',
    age: 23,
    servicePhotos: [...DEFAULT_SERVICE_PHOTOS],
    lockedPhotos: ['https://images.unsplash.com/photo-1526045612212-70caf35c14df?q=80&w=400&auto=format&fit=crop'],
    isBoosted: true
  },
  {
    id: 'h2',
    alias: 'Troy Alpha',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop',
    location: { lat: 0.3520, lng: 32.5850 },
    status: 'Online',
    verified: true,
    whatsapp: '+256700000008',
    phone: '+256700000008',
    gender: 'Male',
    interests: ['Fitness', 'Discreet Hookup', 'Callboy'],
    category: 'Callboy',
    age: 26,
    servicePhotos: [...DEFAULT_SERVICE_PHOTOS]
  },
  {
    id: 'h3',
    alias: 'Zen Wellness Spa',
    photo: 'https://images.unsplash.com/photo-1544161515-4ae6ce6ea834?q=80&w=400&auto=format&fit=crop',
    location: { lat: 0.3600, lng: 32.6000 },
    status: 'Available Now',
    verified: true,
    whatsapp: '+256700000009',
    phone: '+256700000009',
    gender: 'Female',
    interests: ['Nuru Massage', 'Deep Tissue', 'Full Body Spa'],
    category: 'Massage',
    age: 28,
    servicePhotos: [...DEFAULT_SERVICE_PHOTOS]
  }
];
