import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  CameraOff, 
  Play, 
  Pause, 
  RotateCcw,
  Maximize,
  Minimize,
  AlertCircle
} from 'lucide-react';
import ARAgentOverlay from './ARAgentOverlay';
import AgentInteractionModal from './AgentInteractionModal';
import PaymentQRModal from './PaymentQRModal';

const CameraView = ({ 
  isActive, 
  onToggle, 
  onError,
  className = "",
  showControls = true,
  agents = [],
  userLocation = null,
  onAgentInteraction = null
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'user' or 'environment'
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Agent interaction states
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Camera constraint levels - from simplest to most complex
  const getConstraints = (level = 0) => {
    const constraintLevels = [
      // Level 0: Most basic - just video
      { video: true, audio: false },
      
      // Level 1: Basic with facing mode
      { 
        video: { facingMode: cameraFacing }, 
        audio: false 
      },
      
      // Level 2: Add basic resolution
      { 
        video: { 
          facingMode: cameraFacing,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }, 
        audio: false 
      },
      
      // Level 3: Higher resolution
      { 
        video: { 
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      },
      
      // Level 4: Full constraints (original)
      { 
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false 
      }
    ];
    
    return constraintLevels[Math.min(level, constraintLevels.length - 1)];
  };

  // Start camera stream with retry logic
  const startCamera = async (constraintLevel = 0, attempt = 1) => {
    const maxAttempts = 3;
    const maxConstraintLevels = 5;
    
    try {
      setError(null);
      setIsRetrying(attempt > 1);
      
      console.log(`🎥 Starting camera (attempt ${attempt}/${maxAttempts}, constraint level ${constraintLevel})...`);

      // Stop existing stream if any
      if (streamRef.current) {
        console.log('🛑 Stopping existing stream...');
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🔌 Stopped existing track:', track.kind);
        });
        streamRef.current = null;
      }

      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Wait longer between attempts
      const delay = attempt > 1 ? 500 + (attempt * 200) : 100;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Get constraints for this level
      const constraints = getConstraints(constraintLevel);
      console.log('📱 Using constraints:', JSON.stringify(constraints, null, 2));

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!stream || stream.getTracks().length === 0) {
        throw new Error('No camera stream received');
      }

      console.log('✅ Camera stream acquired:', stream.getTracks().map(t => `${t.kind}: ${t.label || 'unnamed'}`));
      streamRef.current = stream;

      // Attach stream to video element
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      const video = videoRef.current;
      video.srcObject = stream;
      
      // Wait for video to load and start playing
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 5000);

        const onLoadedMetadata = () => {
          console.log('📹 Video metadata loaded');
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onVideoError);
          resolve();
        };

        const onVideoError = (err) => {
          console.error('❌ Video element error:', err);
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onVideoError);
          reject(new Error('Video element failed to load stream'));
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onVideoError);

        // Start playing
        video.play().catch(playErr => {
          console.error('❌ Video play error:', playErr);
          clearTimeout(timeout);
          // Don't reject on play error, video might still work
          resolve();
        });
      });

      setIsStreaming(true);
      setRetryCount(0);
      setIsRetrying(false);
      console.log('✅ Camera stream started successfully');

    } catch (err) {
      console.error(`❌ Camera error (attempt ${attempt}):`, err.name, err.message);
      
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Retry logic
      if (attempt < maxAttempts) {
        console.log(`🔄 Retrying camera access (${attempt + 1}/${maxAttempts})...`);
        setRetryCount(attempt);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return startCamera(constraintLevel, attempt + 1);
      } else if (constraintLevel < maxConstraintLevels - 1) {
        console.log(`🔄 Trying simpler constraints (level ${constraintLevel + 1})...`);
        setRetryCount(0);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return startCamera(constraintLevel + 1, 1);
      } else {
        // All attempts failed
        const errorMessage = getCameraErrorMessage(err);
        setError(errorMessage);
        setIsStreaming(false);
        setRetryCount(0);
        setIsRetrying(false);
        if (onError) onError(err);
      }
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    console.log('🛑 Stopping camera stream...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🔌 Stopped track:', track.kind);
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    console.log('✅ Camera stream stopped');
  };

  // Toggle camera on/off
  const toggleCamera = async () => {
    if (isStreaming) {
      stopCamera();
      if (onToggle) onToggle(false);
    } else {
      await startCamera();
      if (onToggle) onToggle(true);
    }
  };

  // Switch camera (front/back)
  const switchCamera = async () => {
    console.log('🔄 Switching camera from', cameraFacing, 'to', cameraFacing === 'environment' ? 'user' : 'environment');
    
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    
    if (isStreaming) {
      // Stop current stream
      stopCamera();
      
      // Wait a bit longer for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Start with new camera
      await startCamera();
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Auto-start camera if isActive prop is true
  useEffect(() => {
    if (isActive && !isStreaming) {
      startCamera();
    } else if (!isActive && isStreaming) {
      stopCamera();
    }
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Get user-friendly error message
  const getCameraErrorMessage = (err) => {
    console.log('🔍 Camera error details:', err.name, err.message);
    
    if (err.name === 'NotAllowedError') {
      return 'Camera access denied. Please allow camera permissions and refresh the page.';
    } else if (err.name === 'NotFoundError') {
      return 'No camera found. Please connect a camera and try again.';
    } else if (err.name === 'NotSupportedError') {
      return 'Camera not supported by this browser. Try using Chrome or Firefox.';
    } else if (err.name === 'NotReadableError' || err.message?.includes('already in use')) {
      return 'Camera is busy. Please close other apps using the camera and try again.';
    } else if (err.name === 'OverconstrainedError') {
      return 'Camera settings not supported. Trying with basic settings...';
    } else if (err.message?.includes('Video element failed')) {
      return 'Video display error. Please refresh the page and try again.';
    } else {
      return `Camera error: ${err.message || 'Please refresh the page and try again.'}`;
    }
  };

  // Handle agent click
  const handleAgentClick = (agent) => {
    console.log('🤖 Agent clicked:', agent.name);
    setSelectedAgent(agent);
    setShowAgentModal(true);
    
    if (onAgentInteraction) {
      onAgentInteraction(agent, 'click');
    }
  };

  // Handle payment request
  const handlePaymentRequest = (agent) => {
    console.log('💳 Payment requested for agent:', agent.name);
    setSelectedAgent(agent);
    setShowAgentModal(false);
    setShowPaymentModal(true);
  };

  // Handle payment completion
  const handlePaymentComplete = (agent, paymentData) => {
    console.log('✅ Payment completed for agent:', agent.name, paymentData);
    setShowPaymentModal(false);
    setShowAgentModal(true); // Return to agent modal
    
    if (onAgentInteraction) {
      onAgentInteraction(agent, 'payment_complete', paymentData);
    }
  };

  // Close modals
  const closeModals = () => {
    setShowAgentModal(false);
    setShowPaymentModal(false);
    setSelectedAgent(null);
  };

  return (
    <div className={`relative ${className}`}>
      <Card className="bg-black/50 border-purple-500/30 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-video bg-slate-900 overflow-hidden">
            {/* Video Element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`}
              autoPlay
              playsInline
              muted
            />

            {/* Placeholder when camera is off */}
            {!isStreaming && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                <div className="text-center">
                  <Camera className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Camera View</h3>
                  <p className="text-purple-200 mb-4">
                    {error ? 'Camera unavailable' : 'Press start to begin camera feed'}
                  </p>
                </div>
              </div>
            )}

            {/* Error Display with Retry */}
            {error && (
              <div className="absolute top-4 left-4 right-4">
                <div className="bg-red-500/90 backdrop-blur-sm rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">Camera Access Issue</p>
                      <p className="text-red-100 text-xs mt-1">{error}</p>
                      {retryCount > 0 && (
                        <p className="text-red-200 text-xs mt-1">Retry {retryCount}/3</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2 mt-3">
                    <Button
                      onClick={() => startCamera(0, 1)}
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                      disabled={isRetrying}
                    >
                      {isRetrying ? 'Retrying...' : 'Try Again'}
                    </Button>
                    <Button
                      onClick={() => setError(null)}
                      size="sm"
                      variant="outline"
                      className="bg-transparent border-white/30 text-white hover:bg-white/10"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Retry Status */}
            {isRetrying && !error && (
              <div className="absolute top-4 left-4 right-4">
                <div className="bg-yellow-500/90 backdrop-blur-sm rounded-lg p-3 flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <p className="text-white font-medium text-sm">Retrying Camera Access</p>
                    <p className="text-yellow-100 text-xs">Attempt {retryCount + 1}/3</p>
                  </div>
                </div>
              </div>
            )}

            {/* Camera Status Badge */}
            {isStreaming && (
              <div className="absolute top-4 left-4">
                <Badge className="bg-red-500 text-white flex items-center space-x-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span>LIVE</span>
                </Badge>
              </div>
            )}

            {/* Camera Info */}
            {isStreaming && (
              <div className="absolute top-4 right-4">
                <Badge variant="secondary" className="bg-black/50 text-white">
                  {cameraFacing === 'environment' ? 'Back Camera' : 'Front Camera'}
                </Badge>
              </div>
            )}

            {/* Controls Overlay */}
            {showControls && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center justify-center space-x-3">
                  {/* Main Toggle Button */}
                  <Button
                    onClick={toggleCamera}
                    size="lg"
                    className={`${
                      isStreaming 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white shadow-lg`}
                  >
                    {isStreaming ? (
                      <>
                        <Pause className="w-5 h-5 mr-2" />
                        Stop Camera
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        Start Camera
                      </>
                    )}
                  </Button>

                  {/* Switch Camera Button */}
                  {isStreaming && (
                    <Button
                      onClick={switchCamera}
                      variant="outline"
                      size="lg"
                      className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </Button>
                  )}

                  {/* Fullscreen Button */}
                  {isStreaming && (
                    <Button
                      onClick={toggleFullscreen}
                      variant="outline"
                      size="lg"
                      className="bg-black/50 border-white/20 text-white hover:bg-black/70"
                    >
                      {isFullscreen ? (
                        <Minimize className="w-5 h-5" />
                      ) : (
                        <Maximize className="w-5 h-5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* AR Agent Overlays */}
            {isStreaming && (
              <>
                {/* AR crosshair in center */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="w-8 h-8 border-2 border-purple-400 rounded-full bg-purple-400/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  </div>
                </div>

                {/* AR Grid Lines */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-purple-400/20"></div>
                    ))}
                  </div>
                </div>

                {/* AR Agent Overlay */}
                <ARAgentOverlay
                  agents={agents}
                  onAgentClick={handleAgentClick}
                  userLocation={userLocation}
                  cameraViewSize={{ width: 1280, height: 720 }}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Interaction Modal */}
      <AgentInteractionModal
        agent={selectedAgent}
        isOpen={showAgentModal}
        onClose={closeModals}
        onPayment={handlePaymentRequest}
      />

      {/* Payment QR Modal */}
      <PaymentQRModal
        agent={selectedAgent}
        isOpen={showPaymentModal}
        onClose={closeModals}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
};

export default CameraView;

