import React, { useState, useEffect, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { User, UserRole } from '../types';

interface MapViewProps {
  hosts: User[];
  currentUser: User | null;
  onUpdateUser?: (updates: Partial<User>) => void;
}

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface LocalMeetupSpot {
  id: string;
  alias: string;
  lat: number;
  lng: number;
  notes: string;
}

const MapView: React.FC<MapViewProps> = ({ hosts, currentUser, onUpdateUser }) => {
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const [proposedLocation, setProposedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 0.3476, lng: 32.5825 }); // Default Kampala
  const [zoom, setZoom] = useState(13);

  // Device permission state tracking
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  // Local device storage location lists and user's pinned location
  const [localPinnedLocation, setLocalPinnedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [localMeetupSpots, setLocalMeetupSpots] = useState<LocalMeetupSpot[]>([]);
  const [newSpotNotes, setNewSpotNotes] = useState('');

  // Read local device location schema and permissions status
  useEffect(() => {
    // 1. Get user pinned location
    const storedUserPin = localStorage.getItem('local_user_pinned_location');
    if (storedUserPin) {
      try {
        const parsed = JSON.parse(storedUserPin);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setLocalPinnedLocation(parsed);
          setMapCenter(parsed);
        }
      } catch (e) {
        console.warn('Error reading local user location pin:', e);
      }
    }

    // 2. Get local meetup draft spots list
    const storedSpots = localStorage.getItem('local_meetup_spots');
    if (storedSpots) {
      try {
        const parsed = JSON.parse(storedSpots);
        if (Array.isArray(parsed)) {
          setLocalMeetupSpots(parsed);
        }
      } catch (e) {
        console.warn('Error reading local meetup spots:', e);
      }
    }

    // 3. Track Geolocation permission
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          setPermissionState(status.state as any);
          status.onchange = () => {
            setPermissionState(status.state as any);
          };
        })
        .catch(() => setPermissionState('prompt'));
    } else {
      setPermissionState('unknown');
    }
  }, []);

  // Update center when local user location changes
  useEffect(() => {
    if (currentUser?.location?.lat && currentUser?.location?.lng) {
      setMapCenter({ lat: currentUser.location.lat, lng: currentUser.location.lng });
    }
  }, [currentUser]);

  // Combine static hosts with local device schema pins
  const allMapPins = useMemo(() => {
    const pins: any[] = [];

    // Add static hosts
    hosts.forEach(host => {
      pins.push({
        id: host.id,
        lat: host.location.lat,
        lng: host.location.lng,
        photo: host.photo,
        alias: host.alias,
        role: host.role,
        bio: host.bio || 'Available for bookings & meetups',
        whatsapp: host.whatsapp,
        phone: host.phone,
        type: 'host'
      });
    });

    // Add user's own local pinned spot from local storage
    if (localPinnedLocation && currentUser) {
      pins.push({
        id: 'me-local',
        lat: localPinnedLocation.lat,
        lng: localPinnedLocation.lng,
        photo: currentUser.photo,
        alias: `${currentUser.alias} (My Pinned Location)`,
        role: currentUser.role,
        bio: 'Pinned securely on this device local schema',
        whatsapp: currentUser.whatsapp,
        phone: currentUser.phone,
        type: 'current-user-local'
      });
    }

    // Add custom local meetup spots
    localMeetupSpots.forEach(spot => {
      pins.push({
        id: spot.id,
        lat: spot.lat,
        lng: spot.lng,
        photo: 'https://picsum.photos/seed/meetup/200/200',
        alias: spot.alias,
        role: UserRole.HOST,
        bio: spot.notes || 'Saved offline on device local storage',
        type: 'local-spot-draft'
      });
    });

    return pins;
  }, [hosts, localPinnedLocation, localMeetupSpots, currentUser]);

  // Use HTML5 Geolocation to query current device GPS with permissions check
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser or device.");
      return;
    }

    setPermissionState('prompt');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setMapCenter(coords);
        setProposedLocation(coords);
        setZoom(15);
        setPermissionState('granted');
      },
      (error) => {
        setPermissionState('denied');
        alert("GPS connection failed: " + error.message + ". Please enable device location settings.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Tap anywhere on map to select spot
  const handleMapClick = (e: any) => {
    if (e.detail?.latLng) {
      setProposedLocation({
        lat: e.detail.latLng.lat,
        lng: e.detail.latLng.lng
      });
    }
  };

  // Save pinned spot directly inside device localStorage (Local Schema)
  const handleSavePinLocally = () => {
    if (!proposedLocation) return;
    setIsSaving(true);

    try {
      localStorage.setItem('local_user_pinned_location', JSON.stringify(proposedLocation));
      setLocalPinnedLocation(proposedLocation);
      
      if (onUpdateUser) {
        onUpdateUser({
          location: { lat: proposedLocation.lat, lng: proposedLocation.lng }
        });
      }

      alert("Location pinned successfully on local device storage!");
      setProposedLocation(null);
    } catch (err) {
      console.error(err);
      alert("Failed to write to local device schema.");
    } finally {
      setIsSaving(false);
    }
  };

  // Clear user's local pinned spot
  const handleRemoveLocalPin = () => {
    if (!confirm("Are you sure you want to delete your local meetup pin from this device?")) return;
    localStorage.removeItem('local_user_pinned_location');
    setLocalPinnedLocation(null);
    if (onUpdateUser) {
      onUpdateUser({
        location: { lat: 0.3476, lng: 32.5825 } // Reset to default
      });
    }
    alert("Local pin removed from device storage.");
  };

  // Add custom meetup spot on device
  const handleAddMeetupSpot = () => {
    if (!proposedLocation) {
      alert("Please tap on the Google Map to choose a location first.");
      return;
    }

    const newSpot: LocalMeetupSpot = {
      id: `spot-${Date.now()}`,
      alias: `Meetup Hub #${localMeetupSpots.length + 1}`,
      lat: proposedLocation.lat,
      lng: proposedLocation.lng,
      notes: newSpotNotes.trim() || 'Custom meetup point drafted on device'
    };

    const updated = [...localMeetupSpots, newSpot];
    setLocalMeetupSpots(updated);
    localStorage.setItem('local_meetup_spots', JSON.stringify(updated));
    setNewSpotNotes('');
    setProposedLocation(null);
    alert("Meetup planning spot pinned and saved on device schema!");
  };

  // Clear all custom meetup spots
  const handleClearAllLocalSpots = () => {
    if (!confirm("Clear all your offline meetup draft pins from this device?")) return;
    localStorage.removeItem('local_meetup_spots');
    setLocalMeetupSpots([]);
  };

  if (!hasValidKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-black text-white text-center">
        <div className="max-w-md bg-zinc-950 border border-zinc-800 p-8 rounded-[40px] space-y-6 shadow-2xl animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-3xl bg-[#39FF14]/10 flex items-center justify-center text-[#39FF14] mx-auto">
            <i className="fas fa-compass text-3xl animate-spin [animation-duration:8s]"></i>
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tight">Meetup Map Activation</h2>
          <p className="text-xs text-zinc-400 leading-relaxed font-bold">
            Real-time GPS mapping and local meetup pin creation requires a Google Maps Platform API key.
          </p>

          <div className="space-y-4 text-left bg-black/50 border border-zinc-900 p-5 rounded-2xl">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-md bg-[#39FF14]/20 text-[#39FF14] text-[10px] font-black flex items-center justify-center mt-0.5">1</span>
              <p className="text-[11px] text-zinc-300">
                <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-[#39FF14] underline font-bold">Get an API Key</a> from the Google Cloud Console.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-md bg-[#39FF14]/20 text-[#39FF14] text-[10px] font-black flex items-center justify-center mt-0.5">2</span>
              <p className="text-[11px] text-zinc-300">
                Open <strong>Settings</strong> (⚙️ gear icon, top-right corner) → <strong>Secrets</strong>.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-md bg-[#39FF14]/20 text-[#39FF14] text-[10px] font-black flex items-center justify-center mt-0.5">3</span>
              <p className="text-[11px] text-zinc-300">
                Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name, and paste your key.
              </p>
            </div>
          </div>

          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest animate-pulse">
            The application will automatically synchronize upon key entry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 space-y-4 relative">
      {/* Local Schema & Permissions Dashboard */}
      <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-[28px] space-y-3 shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#39FF14] animate-ping"></span>
              Local Device Compass
            </h2>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Device storage coordinates & permissions</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black uppercase text-zinc-500">GPS Permission:</span>
            {permissionState === 'granted' && (
              <span className="bg-green-500/10 text-green-400 text-[8px] font-black px-2 py-0.5 rounded border border-green-500/20">
                Granted
              </span>
            )}
            {permissionState === 'denied' && (
              <span className="bg-red-500/10 text-red-400 text-[8px] font-black px-2 py-0.5 rounded border border-red-500/20">
                Denied
              </span>
            )}
            {permissionState === 'prompt' && (
              <span className="bg-amber-500/10 text-amber-400 text-[8px] font-black px-2 py-0.5 rounded border border-amber-500/20">
                Prompt Device
              </span>
            )}
            {permissionState === 'unknown' && (
              <span className="bg-zinc-800 text-zinc-400 text-[8px] font-black px-2 py-0.5 rounded">
                Checking
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-black/50 border border-zinc-900 p-2 rounded-xl space-y-1 text-left">
            <span className="text-[8px] font-bold text-zinc-500 block uppercase">Device Pin Status</span>
            <span className="font-mono font-black text-[#39FF14]">
              {localPinnedLocation ? '📌 Coords Pinned' : '❌ Not Set'}
            </span>
          </div>
          <div className="bg-black/50 border border-zinc-900 p-2 rounded-xl space-y-1 text-left">
            <span className="text-[8px] font-bold text-zinc-500 block uppercase">Client Location Storage</span>
            <span className="font-mono text-zinc-300 font-bold">
              localStorage.schema
            </span>
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight italic">Interactive Meetup Map</h2>
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Tap anywhere to place offline meetup pins</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleGetCurrentLocation}
            className="bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-transform"
          >
            <i className="fas fa-location-arrow"></i> Device GPS
          </button>
          {localPinnedLocation && (
            <button
              onClick={handleRemoveLocalPin}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-transform"
            >
              <i className="fas fa-trash-alt"></i> Clear Pin
            </button>
          )}
        </div>
      </div>

      {/* Real Google Map Container */}
      <div className="flex-1 relative rounded-[32px] overflow-hidden border border-zinc-800 bg-[#050505] shadow-inner" style={{ minHeight: '340px' }}>
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            center={mapCenter}
            onCenterChanged={(e) => setMapCenter(e.detail.center)}
            zoom={zoom}
            onZoomChanged={(e) => setZoom(e.detail.zoom)}
            onClick={handleMapClick}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
          >
            {/* Render Map Pins */}
            {allMapPins.map((pin) => (
              <AdvancedMarker
                key={pin.id}
                position={{ lat: pin.lat, lng: pin.lng }}
                onClick={() => setSelectedPin(pin)}
              >
                <div style={{ width: '40px', height: '40px' }} className="relative flex items-center justify-center">
                  <div className={`absolute w-11 h-11 rounded-full border-2 bg-zinc-950 p-0.5 overflow-hidden shadow-xl hover:scale-110 active:scale-95 transition-transform ${
                    pin.type === 'current-user-local' ? 'border-amber-500 ring-4 ring-amber-500/20' : 
                    pin.type === 'local-spot-draft' ? 'border-cyan-400 ring-4 ring-cyan-400/20' : 'border-[#39FF14]'
                  }`}>
                    {pin.type === 'local-spot-draft' ? (
                      <div className="w-full h-full bg-cyan-950/80 flex items-center justify-center text-cyan-400">
                        <i className="fas fa-map-marker-alt text-xs"></i>
                      </div>
                    ) : (
                      <img src={pin.photo} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  {pin.type === 'current-user-local' && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 border-2 border-black rounded-full flex items-center justify-center">
                      <span className="w-1 h-1 bg-white rounded-full"></span>
                    </div>
                  )}
                </div>
              </AdvancedMarker>
            ))}

            {/* Proposed Pinned Location Marker */}
            {proposedLocation && (
              <AdvancedMarker
                position={proposedLocation}
              >
                <div style={{ width: '40px', height: '40px' }} className="relative flex items-center justify-center animate-bounce">
                  <div className="w-10 h-10 rounded-full border-2 border-amber-500 bg-amber-500/10 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <i className="fas fa-map-pin text-amber-500 text-lg"></i>
                  </div>
                  <div className="absolute -bottom-10 bg-amber-500/90 text-black text-[8px] px-2 py-0.5 rounded font-black uppercase whitespace-nowrap border border-black z-50">
                    Draft Location
                  </div>
                </div>
              </AdvancedMarker>
            )}

            {/* Info Window for Selected Marker */}
            {selectedPin && (
              <InfoWindow
                position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
                onCloseClick={() => setSelectedPin(null)}
              >
                <div className="text-zinc-950 p-2 min-w-[200px] text-left space-y-2">
                  <div className="flex items-center gap-2.5">
                    {selectedPin.type === 'local-spot-draft' ? (
                      <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 font-bold">
                        <i className="fas fa-map-marked-alt text-lg"></i>
                      </div>
                    ) : (
                      <img src={selectedPin.photo} className="w-10 h-10 rounded-xl object-cover border border-zinc-200" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-tight leading-tight">{selectedPin.alias}</h4>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        selectedPin.type === 'current-user-local' ? 'bg-amber-100 text-amber-700' :
                        selectedPin.type === 'local-spot-draft' ? 'bg-cyan-100 text-cyan-700' : 'bg-[#39FF14]/20 text-green-700'
                      }`}>
                        {selectedPin.type === 'current-user-local' ? 'My Local Pin' : 
                         selectedPin.type === 'local-spot-draft' ? 'Offline Spot' : 'Active Node'}
                      </span>
                    </div>
                  </div>
                  {selectedPin.bio && (
                    <p className="text-[10px] text-zinc-600 font-bold leading-normal">{selectedPin.bio}</p>
                  )}
                  <div className="flex gap-1.5 pt-1">
                    {selectedPin.whatsapp && (
                      <a
                        href={`https://wa.me/${selectedPin.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-1.5 rounded-lg text-[9px] uppercase tracking-wider text-center"
                      >
                        WhatsApp
                      </a>
                    )}
                    {selectedPin.phone && (
                      <a
                        href={`tel:${selectedPin.phone}`}
                        className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800 font-black py-1.5 rounded-lg text-[9px] uppercase tracking-wider text-center"
                      >
                        Call
                      </a>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>

        {/* Informative Instructions Overlaid */}
        <div className="absolute top-4 left-4 bg-black/90 backdrop-blur-md border border-zinc-800/80 px-3 py-2 rounded-2xl pointer-events-none max-w-[180px]">
          <span className="text-[8px] font-black text-[#39FF14] uppercase tracking-widest block">SECURE COMPASS</span>
          <p className="text-[8px] text-zinc-400 font-medium leading-relaxed mt-1">
            Tap map to draft coordinate. Pinned points are stored locally on your device storage.
          </p>
        </div>
      </div>

      {/* Pinned / Draft Location Actions */}
      {proposedLocation && (
        <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-[28px] space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300 text-left">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <i className="fas fa-map-pin text-amber-500"></i> Local Coordinate Drafted
              </h4>
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Choose an action below to persist to your device schema</p>
            </div>
            <button
              onClick={() => setProposedLocation(null)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <i className="fas fa-times-circle text-lg"></i>
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSavePinLocally}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-xl text-[9px] uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <i className="fas fa-user-check"></i> Set My Position
              </button>
              <button
                onClick={handleAddMeetupSpot}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl text-[9px] uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <i className="fas fa-plus-circle"></i> Save Meetup Hub
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Meetup Hub Label / Notes</label>
              <input 
                type="text" 
                placeholder="e.g. Garden City Mall Coffee Shop (Optional)"
                value={newSpotNotes}
                onChange={(e) => setNewSpotNotes(e.target.value)}
                className="w-full bg-black border border-zinc-800 p-2.5 rounded-xl text-xs font-medium text-white outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Saved Offline Local Hubs List */}
      {localMeetupSpots.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-[28px] text-left space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <i className="fas fa-list-ul text-cyan-400"></i> My Offline Meetup Hubs ({localMeetupSpots.length})
            </h3>
            <button
              onClick={handleClearAllLocalSpots}
              className="text-[8px] font-black text-red-500 uppercase tracking-wider hover:underline"
            >
              Clear All Hubs
            </button>
          </div>
          <div className="max-h-[110px] overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
            {localMeetupSpots.map((spot) => (
              <div 
                key={spot.id} 
                className="flex items-center justify-between p-2.5 bg-black/50 border border-zinc-900 rounded-xl hover:border-zinc-800 transition-all cursor-pointer"
                onClick={() => {
                  setMapCenter({ lat: spot.lat, lng: spot.lng });
                  setZoom(16);
                }}
              >
                <div>
                  <h4 className="text-[10px] font-black text-white uppercase">{spot.alias}</h4>
                  <p className="text-[8px] text-zinc-500 font-bold max-w-[240px] truncate">{spot.notes}</p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-mono text-[7px] text-zinc-500">
                    {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const filtered = localMeetupSpots.filter(s => s.id !== spot.id);
                      setLocalMeetupSpots(filtered);
                      localStorage.setItem('local_meetup_spots', JSON.stringify(filtered));
                    }}
                    className="text-zinc-500 hover:text-red-500 transition-colors"
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
