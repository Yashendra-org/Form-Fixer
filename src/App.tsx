/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Upload,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Languages,
  Download,
  Info,
  BadgeAlert,
  Camera,
  Video
} from 'lucide-react';

// --- TS Interfaces ---
interface DetectedField {
  name: string;
  status: 'FILLED' | 'MISSING' | 'INCORRECT';
  details: string;
}

interface RequiredStep {
  stepNumber: number;
  titleEn: string;
  titleHi: string;
  descriptionEn: string;
  descriptionHi: string;
}

interface RedactedData {
  type: string;
  originalDetected: string;
  actionTaken: string;
}

interface FormAnalysis {
  documentType: string;
  documentStatus: 'COMPLETE' | 'NEEDS_ATTENTION' | 'INVALID_DOCUMENT';
  identifiedService: string;
  detectedFields: DetectedField[];
  requiredSteps: RequiredStep[];
  redactedData: RedactedData[];
  encouragementEn: string;
  encouragementHi: string;
}

// --- List of Supported Government Services ---
const SERVICES = [
  { id: 'aadhaar', name: 'Aadhaar Card Enrollment/Update', nameHi: 'आधार कार्ड नामांकन/अपडेट', dept: 'UIDAI' },
  { id: 'driving_license', name: 'Driving License (Form 4)', nameHi: 'ड्राइविंग लाइसेंस (फॉर्म 4)', dept: 'Ministry of Road Transport' },
  { id: 'pan_card', name: 'PAN Card (Form 49A) Application', nameHi: 'पैन कार्ड (फॉर्म 49ए) आवेदन', dept: 'Income Tax Department' },
  { id: 'passport', name: 'Passport Application (Form 1)', nameHi: 'पासपोर्ट आवेदन (फॉर्म 1)', dept: 'Ministry of External Affairs' },
  { id: 'ration_card', name: 'Ration Card Application', nameHi: 'राशन कार्ड आवेदन', dept: 'Food & Civil Supplies' }
];

// --- Encouragement loading messages shown during vision analysis ---
const LOADING_MESSAGES = [
  'Verifying document structure & layout...',
  'दस्तावेज़ की संरचना और लेआउट का सत्यापन किया जा रहा है...',
  'Inspecting required signatures and thumbprints...',
  'आवश्यक हस्ताक्षर और अंगूठे के निशान की जांच की जा रही है...',
  'Checking for missing form inputs and checkboxes...',
  'खाली छोड़े गए फ़ॉर्म इनपुट और चेकबॉक्स की जांच की जा रही है...',
  'Detecting and redacting sensitive personal ID credentials for safety...',
  'सुरक्षा के लिए संवेदनशील व्यक्तिगत पहचान क्रेडेंशियल्स को छुपाया जा रहा है...',
  'Formulating bilingual corrective steps in Hindi & English...',
  'हिंदी और अंग्रेजी में सुधारात्मक कदम तैयार किए जा रहे हैं...'
];

export default function App() {
  const [selectedService, setSelectedService] = useState<string>('aadhaar');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState<number>(0);
  const [analysisResult, setAnalysisResult] = useState<FormAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [languageMode, setLanguageMode] = useState<'bilingual' | 'english' | 'hindi'>('bilingual');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera Capture States & Functionality
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto play camera stream when stream or video ref becomes active
  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => {
        console.error("Error starting video playback:", err);
      });
    }
  }, [isCameraActive, cameraStream]);

  // Clean up camera stream tracks when unmounting or if active status changes
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async (mode: 'user' | 'environment' = cameraFacingMode) => {
    setCameraError(null);
    setIsCameraActive(true);
    setAnalysisResult(null);
    setErrorMsg(null);

    // Stop any existing stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
      setCameraStream(stream);
    } catch (err: any) {
      console.error("Camera permissions/hardware error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(
          languageMode === 'hindi'
            ? 'कैमरा एक्सेस की अनुमति नहीं है। कृपया अपने ब्राउज़र में कैमरा अनुमति सक्षम करें।'
            : 'Camera permission denied. Please allow camera access in your browser settings to capture document photos.'
        );
      } else {
        setCameraError(
          languageMode === 'hindi'
            ? 'कैमरा शुरू करने में असमर्थ। कृपया सुनिश्चित करें कि कोई कैमरा कनेक्टेड और सक्रिय है।'
            : `Could not start camera: ${err.message || 'Device occupied or unavailable.'}`
        );
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  const toggleCameraFacingMode = () => {
    const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextMode);
    startCamera(nextMode);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setUploadedImage(dataUrl);
        setMimeType('image/jpeg');
        stopCamera();
      }
    }
  };

  // Rotate loading messages when analysis is ongoing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // --- Dynamic Canvas Mock Form Generator ---
  // Generates high-quality base64 forms dynamically to let users test instantly
  const handleTriggerPreset = (presetType: 'aadhaar_incomplete' | 'driving_complete' | 'passport_missing_address' | 'wrong_document') => {
    stopCamera();
    setErrorMsg(null);
    setAnalysisResult(null);

    // Auto-align service type with the preset for best analysis results
    let targetService = 'aadhaar';
    if (presetType === 'driving_complete') targetService = 'driving_license';
    if (presetType === 'passport_missing_address') targetService = 'passport';
    if (presetType === 'wrong_document') targetService = 'passport'; // wrong doc uploaded for passport

    setSelectedService(targetService);

    // Render preset on canvas
    const base64Jpg = generateMockForm(presetType);
    setUploadedImage(base64Jpg);
    setMimeType('image/jpeg');

    // Trigger analysis automatically
    analyzeFormImage(base64Jpg, 'image/jpeg', targetService);
  };

  // --- Handle Real File Uploads ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, or WEBP).');
      return;
    }
    setErrorMsg(null);
    setAnalysisResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedImage(event.target.result as string);
        setMimeType(file.type);
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // --- API Vision analysis invocation ---
  const analyzeFormImage = async (imageSrc: string, imageMime: string, serviceId: string) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisResult(null);

    try {
      const selectedServiceObj = SERVICES.find(s => s.id === serviceId);
      const serviceLabel = selectedServiceObj ? selectedServiceObj.name : serviceId;

      const response = await fetch('/api/analyze-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: imageSrc,
          mimeType: imageMime,
          serviceType: serviceLabel
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Analysis request failed.');
      }

      const result: FormAnalysis = await response.json();
      setAnalysisResult(result);
    } catch (error: any) {
      console.error('Analysis error:', error);
      setErrorMsg(error.message || 'An error occurred while calling the document verification service.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const triggerManualAnalysis = () => {
    if (!uploadedImage) {
      setErrorMsg('Please upload an image or select a quick testing preset first.');
      return;
    }
    analyzeFormImage(uploadedImage, mimeType || 'image/jpeg', selectedService);
  };

  const clearAppStates = () => {
    stopCamera();
    setUploadedImage(null);
    setMimeType('');
    setAnalysisResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-natural-bg text-natural-dark flex flex-col font-sans" id="form-fixer-app-root">
      {/* Tricolor Aesthetic Top Accent Band */}
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-white to-green-600 flex">
        <div className="w-1/3 bg-[#FF9933]"></div>
        <div className="w-1/3 bg-[#FFFFFF]"></div>
        <div className="w-1/3 bg-[#138808]"></div>
      </div>

      {/* Main Header */}
      <header className="bg-natural-card border-b border-natural-border py-6 px-4 md:px-8" id="app-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-natural-bg text-primary rounded-xl border border-natural-border flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-serif font-bold tracking-tight text-primary">Form-Fixer</h1>
                <span className="text-[10px] bg-[#FEF9F6] text-[#F27D26] border border-[#F27D26]/20 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                  Smart Bharat Prototype
                </span>
              </div>
              <p className="text-xs text-accent font-medium">AI-Powered Civic Assistant & Bilingual Form Completeness Validator</p>
            </div>
          </div>

          {/* Bilingual / English / Hindi view modes */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-natural-bg p-1.5 rounded-lg border border-natural-border">
            <Languages className="w-4 h-4 text-accent ml-2" />
            <button
              onClick={() => setLanguageMode('bilingual')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${languageMode === 'bilingual' ? 'bg-natural-card text-natural-dark shadow-xs' : 'text-accent hover:text-natural-dark'}`}
            >
              Bilingual (Eng+हिन्दी)
            </button>
            <button
              onClick={() => setLanguageMode('english')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${languageMode === 'english' ? 'bg-natural-card text-natural-dark shadow-xs' : 'text-accent hover:text-natural-dark'}`}
            >
              English
            </button>
            <button
              onClick={() => setLanguageMode('hindi')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${languageMode === 'hindi' ? 'bg-natural-card text-natural-dark shadow-xs' : 'text-accent hover:text-natural-dark'}`}
            >
              हिन्दी
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 px-4 md:px-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8" id="main-content">
        
        {/* Left Column: Form Selection & Presets (Grid span 5) */}
        <section className="lg:col-span-5 flex flex-col gap-6" id="setup-section">
          
          {/* Card 1: Select Govt Service */}
          <div className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 bg-natural-bg text-primary font-bold rounded-full flex items-center justify-center text-sm font-mono border border-natural-border">
                1
              </span>
              <h2 className="text-lg font-serif font-semibold text-natural-dark">
                {languageMode === 'hindi' ? 'सरकारी सेवा चुनें' : 'Select Government Service'}
              </h2>
            </div>
            
            <p className="text-xs text-accent mb-4">
              {languageMode === 'hindi' 
                ? 'वह सेवा चुनें जिसके लिए आप आवेदन कर रहे हैं। हम इस विशिष्ट फ़ॉर्म के नियमों के अनुसार विश्लेषण करेंगे।' 
                : 'Select the service you are applying for. The AI will evaluate your document strictly against this service\'s guidelines.'}
            </p>

            <div className="space-y-2.5">
              {SERVICES.map((srv) => (
                <button
                  key={srv.id}
                  onClick={() => setSelectedService(srv.id)}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start justify-between gap-3 ${
                    selectedService === srv.id
                      ? 'border-primary bg-natural-bg text-primary shadow-xs'
                      : 'border-natural-border bg-natural-card hover:border-accent text-natural-dark'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <FileText className={`w-5 h-5 mt-0.5 ${selectedService === srv.id ? 'text-primary' : 'text-accent'}`} />
                    <div>
                      <div className="font-medium text-sm text-natural-dark">{srv.name}</div>
                      <div className="text-[11px] text-accent font-mono mt-0.5">{srv.dept}</div>
                    </div>
                  </div>
                  {selectedService === srv.id && (
                    <span className="h-2.5 w-2.5 bg-primary rounded-full mt-1.5 ring-4 ring-primary/20"></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Card 2: Demo Presets / Quick Testing Simulator */}
          <div className="bg-[#FFFFFF] rounded-2xl p-6 text-natural-dark shadow-xs border border-natural-border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-md font-serif font-semibold text-primary">Preset Simulator / त्वरित सिम्युलेटर</h3>
            </div>
            
            <p className="text-xs text-accent mb-4">
              No government form on hand? Click a scenario below to render a realistic mock document on an HTML canvas instantly and send it to the vision engine.
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => handleTriggerPreset('aadhaar_incomplete')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark"
              >
                <div>
                  <div className="font-semibold text-amber-700">🔴 Incomplete Aadhaar Form</div>
                  <div className="text-[10px] text-accent mt-0.5">Missing signature, exposed raw ID numbers.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => handleTriggerPreset('passport_missing_address')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark"
              >
                <div>
                  <div className="font-semibold text-orange-700">🟡 Passport Form (Blank Address)</div>
                  <div className="text-[10px] text-accent mt-0.5">Permanent Address left completely empty.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => handleTriggerPreset('driving_complete')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark"
              >
                <div>
                  <div className="font-semibold text-emerald-700">🟢 Complete Driving License Form</div>
                  <div className="text-[10px] text-accent mt-0.5">Fully filled details, signed & verifier stamped.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => handleTriggerPreset('wrong_document')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark"
              >
                <div>
                  <div className="font-semibold text-rose-700">❌ Electricity Utility Bill</div>
                  <div className="text-[10px] text-accent mt-0.5">Uploading an invoice instead of passport form.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Upload Box & Analysis Report (Grid span 7) */}
        <section className="lg:col-span-7 flex flex-col gap-6" id="upload-analysis-section">
          
          {/* Main Document Upload Card */}
          <div className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-natural-bg text-primary font-bold rounded-full flex items-center justify-center text-sm font-mono border border-natural-border">
                  2
                </span>
                <h2 className="text-lg font-serif font-semibold text-natural-dark">
                  {languageMode === 'hindi' ? 'फ़ॉर्म की फोटो अपलोड करें' : 'Upload Form or Document'}
                </h2>
              </div>
              {uploadedImage && (
                <button
                  onClick={clearAppStates}
                  className="text-xs text-rose-700 hover:text-rose-800 font-semibold flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  {languageMode === 'hindi' ? 'साफ़ करें' : 'Clear All'}
                </button>
              )}
            </div>

            {/* Live Camera Capture or Drag & Drop Upload Container */}
            {isCameraActive ? (
              <div className="relative rounded-2xl border-2 border-natural-border bg-[#121210] overflow-hidden flex flex-col items-center justify-center min-h-[380px] p-4 shadow-inner" id="camera-viewport-container">
                {/* Close camera button */}
                <button
                  onClick={stopCamera}
                  type="button"
                  className="absolute top-3 right-3 z-30 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors border border-white/10 cursor-pointer"
                  title="Close Camera"
                >
                  <XCircle className="w-5 h-5" />
                </button>

                {cameraError ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-md z-10 text-white">
                    <AlertTriangle className="w-12 h-12 text-[#FF9933]" />
                    <p className="text-sm font-semibold text-stone-300">{cameraError}</p>
                    <button
                      onClick={() => startCamera(cameraFacingMode)}
                      type="button"
                      className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      {languageMode === 'hindi' ? 'पुनः प्रयास करें' : 'Retry Camera'}
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full relative flex flex-col items-center">
                    {/* Live Video element */}
                    <video
                      ref={videoRef}
                      className="w-full max-h-[360px] object-cover rounded-xl bg-black"
                      playsInline
                      muted
                      autoPlay
                    />

                    {/* Dotted document frame overlay */}
                    <div className="absolute inset-4 border-2 border-dashed border-white/30 rounded-xl pointer-events-none flex flex-col items-center justify-between p-4 z-10">
                      <div className="bg-black/60 text-white/90 px-3 py-1 rounded-full text-[10px] font-mono tracking-wide uppercase">
                        {languageMode === 'hindi' ? 'दस्तावेज़ को सीमा के भीतर संरेखित करें' : 'Align Document within Borders'}
                      </div>
                      
                      <div className="w-12 h-12 border-b-2 border-r-2 border-primary absolute bottom-4 right-4 rounded-br-lg pointer-events-none"></div>
                      <div className="w-12 h-12 border-b-2 border-l-2 border-primary absolute bottom-4 left-4 rounded-bl-lg pointer-events-none"></div>
                      <div className="w-12 h-12 border-t-2 border-r-2 border-primary absolute top-4 right-4 rounded-tr-lg pointer-events-none"></div>
                      <div className="w-12 h-12 border-t-2 border-l-2 border-primary absolute top-4 left-4 rounded-tl-lg pointer-events-none"></div>
                    </div>

                    {/* Camera Control Panel Overlay */}
                    <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6 px-4 z-20">
                      {/* Facing Mode toggle */}
                      <button
                        onClick={toggleCameraFacingMode}
                        type="button"
                        className="p-3 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 transition-all active:scale-95 cursor-pointer"
                        title="Toggle Camera (Front/Back)"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>

                      {/* Snap Photo Shutter */}
                      <button
                        onClick={capturePhoto}
                        type="button"
                        className="w-16 h-16 bg-white rounded-full p-1 border-4 border-white/30 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Capture Photo"
                      >
                        <div className="w-full h-full bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                      </button>

                      {/* Cancel / Stop Camera */}
                      <button
                        onClick={stopCamera}
                        type="button"
                        className="p-3 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 transition-all active:scale-95 text-xs font-semibold px-4 py-2 cursor-pointer"
                      >
                        {languageMode === 'hindi' ? 'रद्द करें' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : !uploadedImage ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-3 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-primary bg-natural-bg/50 scale-[0.99]'
                    : 'border-natural-border hover:border-accent hover:bg-natural-bg/30'
                }`}
              >
                <div className="p-4 bg-natural-bg text-primary rounded-2xl mb-4 transition-transform">
                  <Upload className="w-10 h-10 text-accent" />
                </div>
                <h3 className="font-semibold text-natural-dark text-sm md:text-base font-serif">
                  {languageMode === 'hindi' ? 'फ़ाइल यहाँ खींचें या विकल्प चुनें' : 'Drag & drop your form image here'}
                </h3>
                <p className="text-xs text-accent mt-1 max-w-sm mx-auto">
                  Supports JPG, PNG, WEBP files. For best results, ensure the image is bright, straight, and text is readable.
                </p>
                
                {/* Action Buttons with Propagation stopped to allow independent clicking */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {languageMode === 'hindi' ? 'फ़ाइल चुनें' : 'Choose File'}
                  </button>
                  <button
                    onClick={() => startCamera()}
                    type="button"
                    className="bg-white border border-natural-border text-natural-dark hover:bg-natural-bg text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5 text-primary animate-pulse" />
                    {languageMode === 'hindi' ? 'कैमरा से फोटो लें' : 'Capture from Camera'}
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Selected Area */}
                <div className="relative rounded-2xl border border-natural-border bg-natural-bg/40 p-4 overflow-hidden flex flex-col md:flex-row gap-4 items-center">
                  <div className="w-32 h-40 bg-natural-card border border-natural-border rounded-xl overflow-hidden flex-shrink-0 shadow-xs relative group">
                    <img
                      src={uploadedImage}
                      alt="Uploaded Document"
                      className="w-full h-full object-cover"
                    />
                    {/* Visual Zoom Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold">
                      Uploaded Image
                    </div>
                  </div>

                  <div className="flex-1 w-full text-center md:text-left space-y-2">
                    <div>
                      <span className="text-[10px] bg-natural-bg text-primary font-semibold px-2 py-0.5 rounded-md uppercase font-mono border border-natural-border">
                        {mimeType ? mimeType.replace('image/', '') : 'JPEG'} Image
                      </span>
                      <h4 className="text-sm font-serif font-semibold text-natural-dark mt-1.5">
                        Selected Document Target
                      </h4>
                      <p className="text-xs text-accent">
                        Analyzing for: <strong className="text-primary font-semibold">{SERVICES.find(s => s.id === selectedService)?.name}</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1">
                      <button
                        onClick={triggerManualAnalysis}
                        disabled={isAnalyzing}
                        className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isAnalyzing 
                          ? (languageMode === 'hindi' ? 'सत्यापन हो रहा है...' : 'Verifying...') 
                          : (languageMode === 'hindi' ? 'दस्तावेज़ सत्यापित करें' : 'Verify Document Now')}
                      </button>
                      <button
                        onClick={clearAppStates}
                        disabled={isAnalyzing}
                        className="bg-natural-bg hover:bg-natural-border text-natural-dark text-xs font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                      >
                        {languageMode === 'hindi' ? 'हटाएं' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Analysis Processing Screen */}
          <AnimatePresence mode="wait">
            {isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-natural-card rounded-2xl border border-natural-border p-8 shadow-xs text-center space-y-5"
                id="analysis-loader"
              >
                <div className="relative w-16 h-16 mx-auto">
                  {/* Glowing spinner animations */}
                  <div className="absolute inset-0 rounded-full border-4 border-natural-bg"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-md font-serif font-semibold text-natural-dark">
                    Smart Bharat Vision Analysis in Progress
                  </h3>
                  <p className="text-xs text-accent">
                    We are performing OCR, checklist mapping, and privacy scrubbing...
                  </p>
                </div>

                {/* Rotating message box */}
                <div className="bg-natural-bg/50 border border-natural-border rounded-xl p-3 max-w-sm mx-auto h-14 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={loadingMsgIdx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.3 }}
                      className="text-xs text-primary font-medium text-center"
                    >
                      {LOADING_MESSAGES[loadingMsgIdx]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Error Message Display */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-warning-bg border border-warning-border/30 text-warning-border rounded-2xl p-5 flex items-start gap-3 shadow-xs"
                id="error-banner"
              >
                <AlertTriangle className="w-5 h-5 text-warning-border mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-serif font-bold text-sm">Verification Failed / सत्यापन त्रुटि</h4>
                  <p className="text-xs text-[#D95D00] mt-1 font-medium">{errorMsg}</p>
                  <p className="text-[11px] text-accent mt-2">
                    Suggestion: If you uploaded a heavy custom image, try rotating or compressing it. You can also test instantly using our Preset Simulator on the left.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Real Gemini Analysis Report Screen */}
            {analysisResult && !isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
                id="analysis-results-panel"
              >
                {/* Tab 1: Verdict Banner */}
                <div className={`rounded-2xl p-5 border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  analysisResult.documentStatus === 'COMPLETE'
                    ? 'bg-success-bg border-emerald-200 text-emerald-900'
                    : analysisResult.documentStatus === 'NEEDS_ATTENTION'
                    ? 'bg-warning-bg border-warning-border/30 text-[#D95D00]'
                    : 'bg-rose-50/50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                      {analysisResult.documentStatus === 'COMPLETE' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      ) : analysisResult.documentStatus === 'NEEDS_ATTENTION' ? (
                        <AlertTriangle className="w-6 h-6 text-warning-border" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider font-mono opacity-80">
                        {languageMode === 'hindi' ? 'सत्यापन स्थिति' : 'Verification Status'}
                      </div>
                      <h3 className="text-base font-serif font-bold mt-0.5">
                        {analysisResult.documentStatus === 'COMPLETE' && (languageMode === 'hindi' ? 'पूर्ण: फ़ॉर्म तैयार है!' : 'COMPLETE: Document ready to submit!')}
                        {analysisResult.documentStatus === 'NEEDS_ATTENTION' && (languageMode === 'hindi' ? 'ध्यान दें: सुधार की आवश्यकता है' : 'NEEDS ATTENTION: Action required')}
                        {analysisResult.documentStatus === 'INVALID_DOCUMENT' && (languageMode === 'hindi' ? 'अमान्य: गलत दस्तावेज़' : 'INVALID DOCUMENT: Wrong file uploaded')}
                      </h3>
                      <p className="text-xs opacity-90 mt-1">
                        Detected Document: <strong className="font-semibold">{analysisResult.documentType}</strong>
                      </p>
                    </div>
                  </div>

                  <span className={`px-3 py-1 text-xs font-bold rounded-full border shadow-2xs font-mono uppercase ${
                    analysisResult.documentStatus === 'COMPLETE'
                      ? 'bg-emerald-100/50 border-emerald-200 text-emerald-800'
                      : analysisResult.documentStatus === 'NEEDS_ATTENTION'
                      ? 'bg-[#FFF3EB] border-warning-border/20 text-[#D95D00]'
                      : 'bg-rose-100/50 border-rose-200 text-rose-800'
                  }`}>
                    {analysisResult.documentStatus.replace('_', ' ')}
                  </span>
                </div>

                {/* Tab 2: Personal Data Privacy Shield */}
                <div className="bg-[#2D2D24] text-slate-100 rounded-2xl border border-[#3D3D32] p-5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#3D3D32] text-emerald-400 rounded-xl border border-[#4D4D42]">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-serif font-bold text-white flex items-center gap-1.5">
                        {languageMode === 'hindi' ? 'व्यक्तिगत डेटा सुरक्षा कवच' : 'Bhasini-Compliant Privacy Shield'}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        Security Notice: All sensitive identifiers (Aadhaar/PAN Card numbers, mobile, and banking numbers) found in the vision pipeline have been masked. No raw credentials are saved or transmitted unmasked.
                      </p>

                      {/* Redaction Logs list */}
                      {analysisResult.redactedData && analysisResult.redactedData.length > 0 ? (
                        <div className="mt-3.5 space-y-2 bg-[#1E1E1A] p-3 rounded-xl border border-[#2D2D24]">
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                            Masked Data Log / संवेदनशील डेटा लॉग
                          </div>
                          <div className="divide-y divide-slate-800/40">
                            {analysisResult.redactedData.map((red, idx) => (
                              <div key={idx} className="py-2 flex items-center justify-between gap-4 text-xs font-mono">
                                <span className="text-slate-400">{red.type}</span>
                                <div className="text-right">
                                  <span className="bg-[#2D2D24] border border-[#3D3D32] px-2 py-0.5 rounded-md text-emerald-450 font-semibold text-[11px]">
                                    {red.originalDetected}
                                  </span>
                                  <div className="text-[9px] text-slate-500 mt-0.5">{red.actionTaken}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3.5 text-xs text-slate-500 italic bg-[#1E1E1A] p-2.5 rounded-lg text-center font-mono border border-[#2D2D24]">
                          No sensitive raw ID numbers detected in image layout.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tab 3: Detailed Completeness Checklist */}
                <div className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs">
                  <h4 className="text-sm font-serif font-bold text-natural-dark mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" />
                    {languageMode === 'hindi' ? 'दस्तावेज़ पूर्णता चेकलिस्ट' : 'Document Completeness Checklist'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {analysisResult.detectedFields.map((field, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-natural-border bg-natural-bg/20 flex items-start gap-2.5"
                      >
                        <div className="mt-0.5">
                          {field.status === 'FILLED' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <AlertTriangle className={`w-4 h-4 ${field.status === 'MISSING' ? 'text-warning-border' : 'text-rose-500'}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-natural-dark truncate">{field.name}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md font-mono ${
                              field.status === 'FILLED'
                                ? 'bg-emerald-50/50 text-emerald-700 border border-emerald-100'
                                : 'bg-amber-50/50 text-amber-700 border border-amber-100'
                            }`}>
                              {field.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-accent mt-1 leading-normal">{field.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tab 4: Step-by-Step Bilingual Actionable Fixes */}
                {analysisResult.requiredSteps && analysisResult.requiredSteps.length > 0 && (
                  <div className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-serif font-bold text-natural-dark flex items-center gap-2">
                        <BadgeAlert className="w-4.5 h-4.5 text-primary" />
                        {languageMode === 'hindi' ? 'आवश्यक सुधार कदम' : 'Required Correction Steps'}
                      </h4>
                      <span className="text-xs bg-[#FEF9F6] text-[#F27D26] font-bold px-2.5 py-1 rounded-full border border-[#F27D26]/20 font-mono">
                        {analysisResult.requiredSteps.length} Action Needed
                      </span>
                    </div>

                    <div className="space-y-4">
                      {analysisResult.requiredSteps.map((step) => (
                        <div key={step.stepNumber} className="flex gap-4 p-4 rounded-xl border border-natural-border bg-natural-bg/10">
                          <div className="w-8 h-8 bg-primary text-white font-bold rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-mono shadow-xs">
                            {step.stepNumber}
                          </div>
                          
                          <div className="flex-1 space-y-3">
                            {/* English version of the instruction */}
                            {(languageMode === 'bilingual' || languageMode === 'english') && (
                              <div>
                                <div className="text-xs font-serif font-bold text-natural-dark flex items-center gap-1.5">
                                  <span className="text-[9px] bg-natural-bg text-accent font-mono px-1 rounded-sm uppercase border border-natural-border">EN</span>
                                  {step.titleEn}
                                </div>
                                <p className="text-xs text-accent mt-1 leading-relaxed">
                                  {step.descriptionEn}
                                </p>
                              </div>
                            )}

                            {/* Hindi version of the instruction */}
                            {(languageMode === 'bilingual' || languageMode === 'hindi') && (
                              <div className="pt-2 border-t border-dashed border-natural-border">
                                <div className="text-xs font-serif font-bold text-natural-dark flex items-center gap-1.5">
                                  <span className="text-[9px] bg-natural-bg text-accent font-mono px-1 rounded-sm uppercase border border-natural-border">HI</span>
                                  {step.titleHi}
                                </div>
                                <p className="text-xs text-accent mt-1 leading-relaxed">
                                  {step.descriptionHi}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 5: Civic Encouragement Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/5 via-natural-card to-accent/5 border border-natural-border shadow-xs relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 text-primary/10 opacity-30 select-none">
                    <Sparkles className="w-40 h-40" />
                  </div>
                  
                  <div className="space-y-3 relative z-10">
                    <div className="flex items-center gap-1.5 text-xs text-accent font-semibold font-mono uppercase">
                      <Languages className="w-3.5 h-3.5 text-primary" />
                      Assistance Summary / सारांश
                    </div>

                    {(languageMode === 'bilingual' || languageMode === 'english') && (
                      <p className="text-xs text-natural-dark italic font-serif leading-relaxed">
                        "{analysisResult.encouragementEn}"
                      </p>
                    )}

                    {(languageMode === 'bilingual' || languageMode === 'hindi') && (
                      <p className="text-xs text-natural-dark italic font-serif leading-relaxed pt-2 border-t border-dashed border-natural-border">
                        "{analysisResult.encouragementHi}"
                      </p>
                    )}
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-natural-card border-t border-natural-border py-6 text-center text-xs text-accent mt-12" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p>© 2026 Form-Fixer Project. Built for Smart Bharat Civic Service Improvement.</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-[10px] bg-[#F5F8F5] text-[#5A5A40] border border-[#5A5A40]/10 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
              Bhasini & UIDAI Standards
            </span>
            <span className="text-[10px] bg-natural-bg text-primary border border-natural-border font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
              Privacy First Mode
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ==========================================
// --- MOCK GOVERNMENT DOCUMENT RENDERER ---
// ==========================================
// Renders realistic layout forms to HTML Canvas and returns JPEG base64 URL.
// Allows prompt testing without manual file gathering.
function generateMockForm(type: 'aadhaar_incomplete' | 'driving_complete' | 'passport_missing_address' | 'wrong_document'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 600, 800);

  // Outer border
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.strokeRect(15, 15, 570, 770);

  // Inner aesthetic grid line
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, 556, 756);

  // Subtle Ashoka Wheel background watermark
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.03)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(300, 420, 110, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    ctx.beginPath();
    ctx.moveTo(300, 420);
    ctx.lineTo(300 + Math.cos(angle) * 110, 420 + Math.sin(angle) * 110);
    ctx.stroke();
  }

  // Heading Block
  ctx.fillStyle = '#0f172a'; // Deep slate dark block
  ctx.fillRect(25, 25, 550, 75);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GOVERNMENT OF BHARAT / भारत सरकार', 300, 52);
  ctx.font = 'normal 11px Courier New, monospace';
  ctx.fillText('CIVIC DOCUMENT VERIFICATION PROTOCOL / नागरिक सत्यापन', 300, 78);

  // Re-orient text rendering to left
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';

  if (type === 'aadhaar_incomplete') {
    // Form Title
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('AADHAAR CARD ENROLLMENT & UPDATE FORM', 40, 135);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 142);
    ctx.lineTo(560, 142);
    ctx.stroke();

    // Fields
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('1. Resident Status / निवासी स्थिति:', 40, 185);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('RESIDENT (निवासी)', 240, 185);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('2. Existing Aadhaar Number / आधार संख्या:', 40, 225);
    ctx.font = 'bold 12px Courier New, monospace';
    ctx.fillStyle = '#b91c1c'; // Raw exposed Aadhaar to trigger redaction
    ctx.fillText('4219 8765 1024', 240, 225);
    ctx.fillStyle = '#1e293b';

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('3. Applicant Full Name (नाम):', 40, 265);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('YASHENDRA KUMAR', 240, 265);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('4. Date of Birth (जन्म तिथि):', 40, 305);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('15-08-1999', 240, 305);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('5. Gender (लिंग):', 40, 345);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('MALE', 240, 345);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('6. Permanent Address (स्थायी पता):', 40, 385);
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.fillText('Flat 404, Amrapali Platinum, Sector 119, Noida, UP - 201305', 240, 385);

    // Photograph box
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(400, 160, 140, 150);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(401, 161, 138, 148);
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText('PASTE PHOTO', 435, 230);
    ctx.fillText('HERE / यहाँ फोटो लगाएं', 415, 248);

    // Signature Box - left empty to trigger incomplete check
    ctx.strokeStyle = '#b91c1c'; // Red border highlighting emptiness
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('7. Applicant Signature or Thumbprint / हस्ताक्षर बॉक्स:', 40, 500);
    ctx.strokeRect(40, 515, 250, 75);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold italic 11px Arial, sans-serif';
    ctx.fillText('[ BLANK - SIGNATURE IS MISSING ]', 60, 555);

    // Verifier seal box
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('8. UIDAI Verifier Stamp & Sign:', 315, 500);
    ctx.strokeRect(315, 515, 240, 75);

    // Footer info
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 10px Arial, sans-serif';
    ctx.fillText('Notice: Exposing Aadhaar details is subject to UIDAI UID regulations under Section 32 of Aadhaar Act.', 40, 730);

  } else if (type === 'driving_complete') {
    // Form Title
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('FORM 4 - APPLICATION FOR LICENSE TO DRIVE', 40, 135);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 142);
    ctx.lineTo(560, 142);
    ctx.stroke();

    // Fields
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('1. Class of Vehicle:', 40, 185);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('LMV (LIGHT MOTOR VEHICLE)', 240, 185);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('2. Applicant Full Name (नाम):', 40, 225);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('YASHENDRA KUMAR', 240, 225);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText("3. Father's Name (पिता का नाम):", 40, 265);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('SH. RAMESH KUMAR', 240, 265);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('4. Permanent Address (पता):', 40, 305);
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.fillText('H-12, Sector 62, Noida, UP - 201301', 240, 305);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('5. Date of Birth (जन्म तिथि):', 40, 345);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('15-08-1999', 240, 345);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('6. Blood Group (रक्त समूह):', 40, 385);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('O POSITIVE (O+)', 240, 385);

    // Completed photo box
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(400, 160, 140, 150);
    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(401, 161, 138, 148);
    // Draw face
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(470, 220, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(470, 265, 30, 16, 0, 0, Math.PI, true);
    ctx.fill();

    // Applicant Signature Box
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('7. Signature of Applicant (हस्ताक्षर):', 40, 500);
    ctx.strokeRect(40, 515, 250, 75);
    // Render cursive signature scribble
    ctx.strokeStyle = '#1d4ed8'; // Blue ink pen
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(60, 555);
    ctx.bezierCurveTo(90, 530, 110, 575, 140, 545);
    ctx.bezierCurveTo(170, 520, 190, 565, 230, 540);
    ctx.stroke();

    // Verifier stamp
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#059669';
    ctx.strokeRect(315, 515, 240, 75);
    ctx.fillStyle = 'rgba(5, 150, 105, 0.08)';
    ctx.fillRect(316, 516, 238, 73);
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText('FITNESS CERTIFIED BY RTO', 345, 545);
    ctx.fillText('DR. VERMA REG NO: 54321', 345, 560);

  } else if (type === 'passport_missing_address') {
    // Form Title
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('PASSPORT APPLICATION FORM (FORM 1 / FRESH)', 40, 135);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 142);
    ctx.lineTo(560, 142);
    ctx.stroke();

    // Fields
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('1. Service Required:', 40, 185);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('FRESH PASSPORT (नया पासपोर्ट)', 240, 185);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('2. Given Name (प्रथम नाम):', 40, 225);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('YASHENDRA', 240, 225);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('3. Surname (कुल नाम):', 40, 265);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('KUMAR', 240, 265);

    // Missing address field
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('4. Permanent Address (स्थायी पता):', 40, 305);
    ctx.font = 'italic bold 12px Arial, sans-serif';
    ctx.fillStyle = '#d97706'; // Highlight amber emptiness
    ctx.fillText('[ NOT FILLED - LEFT BLANK ]', 240, 305);
    ctx.fillStyle = '#1e293b';

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('5. Mobile Phone Number (मोबाइल):', 40, 345);
    ctx.font = 'bold 12px Courier New, monospace';
    ctx.fillText('+91 98765 43210', 240, 345); // Raw phone number

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('6. Place of Birth (जन्म स्थान):', 40, 385);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('NEW DELHI, INDIA', 240, 385);

    // Photo Box
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(400, 160, 140, 150);
    ctx.fillStyle = '#fee2e2';
    ctx.fillRect(401, 161, 138, 148);
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText('ATTACH PORTRAIT', 425, 230);
    ctx.fillText('PHOTO HERE', 438, 248);

    // Applicant signature box (Complete)
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('7. Signature of Applicant (हस्ताक्षर):', 40, 500);
    ctx.strokeRect(40, 515, 250, 75);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(60, 555);
    ctx.bezierCurveTo(90, 530, 110, 575, 140, 545);
    ctx.stroke();

    // Office seal
    ctx.strokeRect(315, 515, 240, 75);

  } else if (type === 'wrong_document') {
    // Draws completely incorrect document type - utility bill
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('BHARAT ELECTRICITY BOARD (विद्युत वितरण बोर्ड)', 40, 135);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 142);
    ctx.lineTo(560, 142);
    ctx.stroke();

    // Fields
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('CONSUMER ID / उपभोक्ता संख्या:', 40, 195);
    ctx.font = 'bold 12px Courier New, monospace';
    ctx.fillText('9876543210-A', 240, 195);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('CONSUMER NAME (नाम):', 40, 235);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('YASHENDRA KUMAR', 240, 235);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('BILL MONTH / DUE DATE:', 40, 275);
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.fillText('JUNE 2026 / 05-07-2026', 240, 275);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('NET CURRENT BILL / देय राशि:', 40, 325);
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillStyle = '#b91c1c';
    ctx.fillText('Rs. 1,450.00 (देय)', 240, 325);
    ctx.fillStyle = '#1e293b';

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('PAYMENT STATUS (स्थिति):', 40, 375);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText('PAID - ON TIME (भुगतान सफल)', 240, 375);
    ctx.fillStyle = '#1e293b';

    // Massive warning stamp on the bill
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 480, 400, 150);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.05)';
    ctx.fillRect(101, 481, 398, 148);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText('NOT A GOVERNMENT APPLICATION FORM', 115, 545);
    ctx.font = 'italic bold 13px Arial, sans-serif';
    ctx.fillText('(MONTHLY UTILITY SERVICE INVOICE ONLY)', 140, 580);
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}
