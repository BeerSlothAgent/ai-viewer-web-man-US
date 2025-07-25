import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Camera, 
  MapPin, 
  Wifi, 
  WifiOff, 
  Users, 
  Zap, 
  Globe, 
  Settings,
  Play,
  Pause,
  RotateCcw,
  Satellite,
  Wallet
} from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import CameraView from './CameraView';
import ThirdWebWalletConnect from './ThirdWebWalletConnect';
import rtkLocationService from '../services/rtkLocation';

const ARViewer = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [initializationStep, setInitializationStep] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [nearbyObjects, setNearbyObjects] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [selectedTab, setSelectedTab] = useState('viewer');
  const [rtkStatus, setRtkStatus] = useState({ isRTKEnhanced: false, source: 'Standard GPS' });
  const [walletConnection, setWalletConnection] = useState({
    isConnected: false,
    address: null,
    user: null
  });
  
  const { 
    isLoading, 
    error: dbError, 
    connectionStatus, 
    getNearbyObjects, 
    refreshConnection 
  } = useDatabase();

  const isMountedRef = useRef(true);

  // Initialize RTK-enhanced location services
  const initializeLocation = async () => {
    try {
      setInitializationStep(1);
      console.log('📍 Requesting RTK-enhanced location...');

      // Use RTK location service for enhanced accuracy
      const location = await rtkLocationService.getEnhancedLocation();
      
      setCurrentLocation(location);
      setLocationError(null);
      setRtkStatus({
        isRTKEnhanced: location.isRTKEnhanced || false,
        source: location.source || 'Standard GPS',
        accuracy: location.accuracy,
        altitude: location.altitude
      });
      
      console.log('✅ RTK Location acquired:', location);
      return location;
    } catch (error) {
      console.error('❌ RTK Location error:', error);
      setLocationError(error.message);
      
      // Use fallback location (San Francisco) as last resort
      const fallbackLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 52.0,
        accuracy: 1000,
        timestamp: Date.now(),
        isFallback: true,
        source: 'Fallback Location'
      };
      
      setCurrentLocation(fallbackLocation);
      setRtkStatus({
        isRTKEnhanced: false,
        source: 'Fallback Location',
        accuracy: 1000,
        altitude: 52.0
      });
      
      console.log('🔄 Using fallback location:', fallbackLocation);
      return fallbackLocation;
    }
  };

  // Initialize camera
  const initializeCamera = async () => {
    try {
      setInitializationStep(2);
      console.log('📷 Initializing camera...');

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });

      // Stop the stream immediately as we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      setCameraActive(true);
      console.log('✅ Camera permission granted');
      return true;
    } catch (error) {
      console.error('❌ Camera error:', error);
      setCameraActive(false);
      return false;
    }
  };

  // Load nearby objects
  const loadNearbyObjects = async (location) => {
    try {
      setInitializationStep(3);
      console.log('🔍 Loading nearby objects...');

      const objects = await getNearbyObjects({
        latitude: location.latitude,
        longitude: location.longitude,
        radius_meters: 100,
        limit: 10
      });

      setNearbyObjects(objects || []);
      console.log(`✅ Loaded ${objects?.length || 0} nearby objects`);
      return objects;
    } catch (error) {
      console.error('❌ Error loading objects:', error);
      setNearbyObjects([]);
      return [];
    }
  };

  // Full initialization sequence
  const initializeApp = async () => {
    try {
      if (!isMountedRef.current) return;

      console.log('🚀 Starting AR Viewer initialization...');
      
      // Step 1: Location
      const location = await initializeLocation();
      if (!isMountedRef.current) return;

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Camera
      if (isMountedRef.current) {
        await initializeCamera();
      }
      if (!isMountedRef.current) return;

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Database and objects
      if (isMountedRef.current) {
        await refreshConnection();
        await loadNearbyObjects(location);
      }
      if (!isMountedRef.current) return;

      await new Promise(resolve => setTimeout(resolve, 800));

      // Step 4: Complete
      if (isMountedRef.current) {
        setInitializationStep(4);
        setIsInitialized(true);
        console.log('🎉 AR Viewer initialization complete!');
      }

    } catch (error) {
      console.error('❌ Initialization error:', error);
      if (isMountedRef.current) {
        setIsInitialized(true); // Allow app to continue with fallbacks
      }
    }
  };

  // Initialize on mount
  useEffect(() => {
    isMountedRef.current = true;
    initializeApp();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Render initialization screen
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/50 border-purple-500/30 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">NeAR Viewer</CardTitle>
            <CardDescription className="text-purple-200">
              Initializing AR Experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                initializationStep >= 1 ? 'bg-green-500/20 text-green-300' : 'bg-slate-700/50 text-slate-400'
              }`}>
                <MapPin className="w-5 h-5" />
                <span>Location Services</span>
                {initializationStep >= 1 && <Badge variant="secondary" className="ml-auto">✓</Badge>}
              </div>
              
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                initializationStep >= 2 ? 'bg-green-500/20 text-green-300' : 'bg-slate-700/50 text-slate-400'
              }`}>
                <Camera className="w-5 h-5" />
                <span>Camera Access</span>
                {initializationStep >= 2 && <Badge variant="secondary" className="ml-auto">✓</Badge>}
              </div>
              
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                initializationStep >= 3 ? 'bg-green-500/20 text-green-300' : 'bg-slate-700/50 text-slate-400'
              }`}>
                <Globe className="w-5 h-5" />
                <span>Database Connection</span>
                {initializationStep >= 3 && <Badge variant="secondary" className="ml-auto">✓</Badge>}
              </div>
              
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                initializationStep >= 4 ? 'bg-green-500/20 text-green-300' : 'bg-slate-700/50 text-slate-400'
              }`}>
                <Zap className="w-5 h-5" />
                <span>AR Ready</span>
                {initializationStep >= 4 && <Badge variant="secondary" className="ml-auto">✓</Badge>}
              </div>
            </div>

            {locationError && (
              <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-200 text-sm">
                  Location: {locationError}
                </p>
                <p className="text-yellow-300 text-xs mt-1">
                  Using fallback location for demo
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main AR Viewer interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm border-b border-purple-500/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">NeAR Viewer</h1>
              <p className="text-sm text-purple-200">AR Agent Network</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'} className="flex items-center space-x-1">
              {connectionStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{connectionStatus === 'connected' ? 'Connected' : 'Offline'}</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-purple-500/20">
        <div className="flex">
          {[
            { id: 'viewer', label: 'NeAR Viewer', icon: Camera },
            { id: 'agents', label: 'NEAR Agents', icon: Users },
            { id: 'map', label: 'NEAR Map', icon: MapPin },
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 p-4 transition-colors ${
                selectedTab === tab.id 
                  ? 'bg-purple-500/30 text-white border-b-2 border-purple-400' 
                  : 'text-purple-200 hover:bg-purple-500/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-4">
        {selectedTab === 'viewer' && (
          <div className="space-y-4">
            {/* Live Camera View */}
            <CameraView
              isActive={cameraActive}
              onToggle={setCameraActive}
              onError={(err) => console.error('Camera error:', err)}
              agents={nearbyObjects}
              userLocation={location}
              onAgentInteraction={(agent, action, data) => {
                console.log('Agent interaction:', agent.name, action, data);
                // Handle agent interactions here
              }}
              showControls={true}
              connectedWallet={walletConnection.address}
            />

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-8 h-8 text-purple-400" />
                      {rtkStatus.isRTKEnhanced && (
                        <Satellite className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-purple-200">Location</p>
                        {rtkStatus.isRTKEnhanced && (
                          <Badge variant="outline" className="text-xs bg-green-500/20 border-green-500 text-green-300">
                            RTK Enhanced
                          </Badge>
                        )}
                      </div>
                      <p className="font-semibold text-white">
                        {currentLocation ? 
                          `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}` :
                          'Unknown'
                        }
                      </p>
                      {currentLocation && (
                        <div className="text-xs text-purple-300 mt-1">
                          <div>Alt: {(currentLocation.altitude || 0).toFixed(1)}m</div>
                          <div>±{(rtkStatus.accuracy || 10).toFixed(2)}m • {rtkStatus.source}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Users className="w-8 h-8 text-purple-400" />
                    <div>
                      <p className="text-sm text-purple-200">Nearby Objects</p>
                      <p className="font-semibold text-white">{nearbyObjects.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Globe className="w-8 h-8 text-purple-400" />
                    <div>
                      <p className="text-sm text-purple-200">Database</p>
                      <p className="font-semibold text-white">
                        {connectionStatus === 'connected' ? 'Connected' : 'Offline'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {selectedTab === 'agents' && (
          <div className="space-y-4">
            <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>NEAR Agents</span>
                </CardTitle>
                <CardDescription className="text-purple-200">
                  Nearby AI agents available for interaction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {nearbyObjects.length > 0 ? (
                  nearbyObjects.map((obj, index) => (
                    <div key={obj.id} className="p-4 bg-slate-800/50 rounded-lg border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-white">{obj.name}</h4>
                          <p className="text-sm text-purple-200">{obj.description}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {obj.distance_meters?.toFixed(1)}m away • {obj.object_type}
                          </p>
                        </div>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">No agents found nearby</p>
                    <Button 
                      onClick={() => loadNearbyObjects(currentLocation)}
                      variant="outline" 
                      className="mt-4"
                      disabled={isLoading}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === 'map' && (
          <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <MapPin className="w-5 h-5" />
                <span>NEAR Map</span>
              </CardTitle>
              <CardDescription className="text-purple-200">
                Interactive map view of nearby agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Interactive Map</h3>
                  <p className="text-purple-200">Map view would be implemented here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedTab === 'wallet' && (
          <div className="space-y-4">
            <ThirdWebWalletConnect 
              onConnectionChange={setWalletConnection}
            />
            
            {/* Wallet Status Summary */}
            {walletConnection.isConnected && (
              <Card className="bg-black/50 border-green-500/30 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-green-400" />
                    <span>Wallet Features</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-green-500/20 rounded-lg">
                      <p className="text-green-300 text-sm font-medium">Agent Payments</p>
                      <p className="text-white text-xs">Pay agents with USDFC tokens</p>
                    </div>
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <p className="text-blue-300 text-sm font-medium">Premium Features</p>
                      <p className="text-white text-xs">Access exclusive AR content</p>
                    </div>
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <p className="text-purple-300 text-sm font-medium">NFT Agents</p>
                      <p className="text-white text-xs">Own and trade agent NFTs</p>
                    </div>
                    <div className="p-3 bg-yellow-500/20 rounded-lg">
                      <p className="text-yellow-300 text-sm font-medium">DAO Voting</p>
                      <p className="text-white text-xs">Participate in governance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {selectedTab === 'settings' && (
          <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </CardTitle>
              <CardDescription className="text-purple-200">
                Configure your AR experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-white">Database Connection</span>
                  <Button 
                    onClick={refreshConnection}
                    variant="outline" 
                    size="sm"
                    disabled={isLoading}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-white">Camera Permission</span>
                  <Badge variant={cameraActive ? 'default' : 'destructive'}>
                    {cameraActive ? 'Granted' : 'Denied'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-white">Location Services</span>
                  <Badge variant={currentLocation ? 'default' : 'destructive'}>
                    {currentLocation ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {dbError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-200 text-sm font-medium">Database Error</p>
                  <p className="text-red-300 text-xs mt-1">{dbError.message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ARViewer;

