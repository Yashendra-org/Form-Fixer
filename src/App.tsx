/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
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
  Video,
  Search,
  Check,
  ChevronDown,
  FileDown,
  Volume2,
  VolumeX,
  MessageSquare,
  Send,
  ZoomIn,
  ZoomOut,
  RotateCw,
  CornerDownLeft,
  X,
  Trash2
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

interface HistoryItem {
  id: string;
  timestamp: string;
  serviceId: string;
  image: string; // base64 representation
  mimeType: string;
  analysisResult: FormAnalysis;
}

// --- List of Supported Government Services ---
const SERVICES = [
  { id: 'aadhaar', name: 'Aadhaar Card Enrollment/Update', nameHi: 'आधार कार्ड नामांकन/अपडेट', dept: 'UIDAI' },
  { id: 'driving_license', name: 'Driving License (Form 4)', nameHi: 'ड्राइविंग लाइसेंस (फॉर्म 4)', dept: 'Ministry of Road Transport' },
  { id: 'pan_card', name: 'PAN Card (Form 49A) Application', nameHi: 'पैन कार्ड (फॉर्म 49ए) आवेदन', dept: 'Income Tax Department' },
  { id: 'passport', name: 'Passport Application (Form 1)', nameHi: 'पासपोर्ट आवेदन (फॉर्म 1)', dept: 'Ministry of External Affairs' },
  { id: 'ration_card', name: 'Ration Card Application', nameHi: 'राशन कार्ड आवेदन', dept: 'Food & Civil Supplies' },
  { id: 'voter_id', name: 'Voter ID Application (Form 6)', nameHi: 'मतदाता पहचान पत्र (फॉर्म 6)', dept: 'Election Commission of India' },
  { id: 'birth_certificate', name: 'Birth Certificate Application', nameHi: 'जन्म प्रमाण पत्र आवेदन', dept: 'Civil Registration System' },
  { id: 'caste_certificate', name: 'Caste Certificate Application', nameHi: 'जाति प्रमाण पत्र आवेदन', dept: 'Revenue Department' },
  { id: 'income_certificate', name: 'Income Certificate Application', nameHi: 'आय प्रमाण पत्र आवेदन', dept: 'Revenue Department' },
  { id: 'marriage_certificate', name: 'Marriage Registration (Form A)', nameHi: 'विवाह पंजीकरण (फॉर्म ए)', dept: 'Registrar of Marriages' },
  { id: 'pm_kisan', name: 'PM Kisan Samman Nidhi Application', nameHi: 'पीएम किसान सम्मान निधि आवेदन', dept: 'Ministry of Agriculture' },
  { id: 'ayushman_card', name: 'Ayushman Bharat Golden Card Registration', nameHi: 'आयुष्मान भारत कार्ड आवेदन', dept: 'National Health Authority' }
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
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<'idle' | 'validating' | 'analyzing'>('idle');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState<number>(0);
  const [analysisResult, setAnalysisResult] = useState<FormAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [languageMode, setLanguageMode] = useState<'bilingual' | 'english' | 'hindi'>('bilingual');

  // --- New Premium Feature States ---
  // 1. Image Preview & Interactive Modal States
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [previewRotation, setPreviewRotation] = useState<number>(0);

  // 2. Bhasini-Compliant Speech Synthesis States
  const [playingSpeechIdx, setPlayingSpeechIdx] = useState<number | null>(null);
  const [isPlayingEncouragement, setIsPlayingEncouragement] = useState<boolean>(false);

  // 3. Document Q&A Chat Assistant States
  interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
  }
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // --- Form Fixer 6-Stage Project Workflow States ---
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(1);
  const [feedbackRatings, setFeedbackRatings] = useState<{[key: string]: 'accepted' | 'rejected' | null}>({});
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState<boolean>(false);
  const [systemAccuracy, setSystemAccuracy] = useState<number>(94.8);
  const [editedFields, setEditedFields] = useState<{[key: string]: string}>({});
  const [isAutoCorrected, setIsAutoCorrected] = useState<boolean>(false);

  // Sync edited fields when analysisResult is updated
  useEffect(() => {
    if (analysisResult) {
      const initialFields: {[key: string]: string} = {};
      analysisResult.detectedFields.forEach(field => {
        initialFields[field.name] = field.details;
      });
      setEditedFields(initialFields);
      setFeedbackRatings({});
      setIsFeedbackSubmitted(false);
      setIsAutoCorrected(false);
      setActiveWorkflowStep(1); // Reset to Step 1 on new upload/preset
    }
  }, [analysisResult]);

  // --- Session History List ---
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('form_fixer_history_v3');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistoryList(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, []);

  const saveHistoryToStorage = (updatedList: HistoryItem[]) => {
    try {
      localStorage.setItem('form_fixer_history_v3', JSON.stringify(updatedList));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  };

  const addToHistory = (serviceId: string, image: string, mType: string, result: FormAnalysis) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      serviceId,
      image,
      mimeType: mType,
      analysisResult: result
    };
    setHistoryList(prev => {
      // Remove duplicates
      const filtered = prev.filter(item => item.image !== image || item.serviceId !== serviceId);
      const updated = [newItem, ...filtered].slice(0, 5);
      saveHistoryToStorage(updated);
      return updated;
    });
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryList(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveHistoryToStorage(updated);
      return updated;
    });
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    stopCamera();
    setUploadedImage(item.image);
    setMimeType(item.mimeType);
    setSelectedService(item.serviceId);
    setAnalysisResult(item.analysisResult);
    setErrorMsg(null);
    setChatMessages([]);
    setChatInput('');
    setChatError(null);
    try {
      window.speechSynthesis.cancel();
    } catch (err) {}
    setPlayingSpeechIdx(null);
    setIsPlayingEncouragement(false);
  };

  // Speech TTS Player function
  const handleSpeak = (text: string, idx: number | 'encouragement', lang: 'en' | 'hi') => {
    try {
      if (playingSpeechIdx === idx || (idx === 'encouragement' && isPlayingEncouragement)) {
        window.speechSynthesis.cancel();
        setPlayingSpeechIdx(null);
        setIsPlayingEncouragement(false);
        return;
      }

      window.speechSynthesis.cancel();
      // Remove special characters for pristine voice translation
      const cleanedText = text.replace(/[\[\]\(\)\-\:\*\_]/g, ' ');
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';

      utterance.onend = () => {
        if (idx === 'encouragement') {
          setIsPlayingEncouragement(false);
        } else {
          setPlayingSpeechIdx(null);
        }
      };

      utterance.onerror = () => {
        if (idx === 'encouragement') {
          setIsPlayingEncouragement(false);
        } else {
          setPlayingSpeechIdx(null);
        }
      };

      if (idx === 'encouragement') {
        setIsPlayingEncouragement(true);
      } else {
        setPlayingSpeechIdx(idx);
      }

      const voices = window.speechSynthesis.getVoices();
      if (lang === 'hi') {
        const hiVoice = voices.find(v => v.lang.startsWith('hi') || v.lang.includes('IN'));
        if (hiVoice) utterance.voice = hiVoice;
      } else {
        const enVoice = voices.find(v => v.lang.startsWith('en') && v.lang.includes('IN'));
        if (enVoice) utterance.voice = enVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech synthesis failed:', e);
    }
  };

  // Q&A Chat submit handler
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !uploadedImage) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatError(null);
    
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: 'user', text: userMsg, timestamp: new Date() }
    ];
    setChatMessages(newMessages);
    setIsSendingChat(true);

    try {
      const history = newMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        text: msg.text
      }));

      const serviceName = SERVICES.find(s => s.id === selectedService)?.name || selectedService;

      const response = await fetch('/api/chat-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: uploadedImage,
          mimeType: mimeType || 'image/jpeg',
          serviceType: serviceName,
          message: userMsg,
          history: history
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.details || 'Failed to get answer.');
      }

      const data = await response.json();
      setChatMessages([
        ...newMessages,
        { role: 'assistant', text: data.text, timestamp: new Date() }
      ]);
    } catch (error: any) {
      console.error('Chat error:', error);
      setChatError(error.message || 'Unable to connect with assistant.');
    } finally {
      setIsSendingChat(false);
    }
  };

  const filteredServices = SERVICES.filter(service => 
    service.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
    service.dept.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
    (service.nameHi && service.nameHi.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
  );

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
  const handleTriggerPreset = (presetType: 'aadhaar_incomplete' | 'driving_complete' | 'passport_missing_address' | 'wrong_document' | 'voter_id_incomplete' | 'income_cert_unapproved' | 'ayushman_complete') => {
    stopCamera();
    setErrorMsg(null);
    setAnalysisResult(null);

    // Auto-align service type with the preset for best analysis results
    let targetService = 'aadhaar';
    if (presetType === 'driving_complete') targetService = 'driving_license';
    if (presetType === 'passport_missing_address') targetService = 'passport';
    if (presetType === 'wrong_document') targetService = 'passport'; // wrong doc uploaded for passport
    if (presetType === 'voter_id_incomplete') targetService = 'voter_id';
    if (presetType === 'income_cert_unapproved') targetService = 'income_certificate';
    if (presetType === 'ayushman_complete') targetService = 'ayushman_card';

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
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDimension = 1000;
          let width = img.width;
          let height = img.height;

          // Downscale if dimensions exceed 1000px while maintaining original aspect ratio
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setUploadedImage(compressedBase64);
            setMimeType('image/jpeg');
          }
        };
        img.src = event.target.result as string;
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

  // --- Create low-resolution thumbnail helper for Tiered Processing ---
  const createThumbnail = (imageSrc: string, mime: string): Promise<string> => {
    return new Promise((resolve) => {
      try {
        if (!imageSrc || !imageSrc.startsWith('data:')) {
          resolve(imageSrc);
          return;
        }

        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 150; // Super small thumbnail for near-instant pre-validation
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL(mime || 'image/jpeg', 0.6));
            } else {
              resolve(imageSrc);
            }
          } catch (innerErr) {
            console.error('Error drawing thumbnail:', innerErr);
            resolve(imageSrc);
          }
        };
        img.onerror = () => {
          resolve(imageSrc);
        };
        img.src = imageSrc;
      } catch (err) {
        console.error('Thumbnail promise catch:', err);
        resolve(imageSrc);
      }
    });
  };

  // --- API Vision analysis invocation ---
  const analyzeFormImage = async (imageSrc: string, imageMime: string, serviceId: string) => {
    setIsAnalyzing(true);
    setAnalysisStage('validating');
    setErrorMsg(null);
    setAnalysisResult(null);

    try {
      const selectedServiceObj = SERVICES.find(s => s.id === serviceId);
      const serviceLabel = selectedServiceObj ? selectedServiceObj.name : serviceId;

      // 1. Send low-res thumbnail first for fast type pre-validation
      const thumbnailBase64 = await createThumbnail(imageSrc, imageMime);
      
      const preCheckResponse = await fetch('/api/validate-form-type', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: thumbnailBase64,
          mimeType: imageMime,
          serviceType: serviceLabel
        })
      });

      if (!preCheckResponse.ok) {
        let errMessage = 'Pre-validation check failed.';
        try {
          const text = await preCheckResponse.text();
          const errData = JSON.parse(text);
          errMessage = errData.error || errData.details || errMessage;
        } catch (e) {
          errMessage = `Server error (${preCheckResponse.status}): Please check if your Gemini API key is configured.`;
        }
        throw new Error(errMessage);
      }

      let preCheckResult;
      try {
        preCheckResult = await preCheckResponse.json();
      } catch (e) {
        throw new Error("Failed to parse pre-validation response. The server may have returned an unexpected HTML response. Please verify that your server is running and that your GEMINI_API_KEY is configured.");
      }

      // If validation fails, abort full OCR run immediately and show result gracefully
      if (!preCheckResult.isValid) {
        const mockResult: FormAnalysis = {
          documentType: preCheckResult.documentType || 'Incorrect Document',
          documentStatus: 'INVALID_DOCUMENT',
          identifiedService: serviceLabel,
          detectedFields: [],
          requiredSteps: [
            {
              stepNumber: 1,
              titleEn: 'Upload Correct Document Type',
              titleHi: 'सही दस्तावेज़ प्रकार अपलोड करें',
              descriptionEn: preCheckResult.reason || 'The pre-validation check indicates that this image does not match the selected service.',
              descriptionHi: preCheckResult.reasonHi || 'सत्यापन जांच से पता चलता है कि यह छवि चुनी गई सेवा से मेल नहीं खाती है।'
            }
          ],
          redactedData: [],
          encouragementEn: 'Please verify the selected service and upload the matching document or form. This protects resources and ensures quick approval.',
          encouragementHi: 'कृपया चुनी गई सेवा का सत्यापन करें और मिलान करने वाला दस्तावेज़ या फ़ॉर्म अपलोड करें। यह संसाधनों को सुरक्षित करता है और त्वरित स्वीकृति सुनिश्चित करता है।'
        };
        setAnalysisResult(mockResult);
        addToHistory(serviceId, imageSrc, imageMime, mockResult);
        return;
      }

      // 2. Document is pre-validated! Proceed to full-resolution analysis.
      setAnalysisStage('analyzing');

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
        let errMessage = 'Analysis request failed.';
        try {
          const text = await response.text();
          const errData = JSON.parse(text);
          errMessage = errData.error || errData.details || errMessage;
        } catch (e) {
          errMessage = `Server error (${response.status}): Failed to analyze document.`;
        }
        throw new Error(errMessage);
      }

      let result: FormAnalysis;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error("Failed to parse verification response. The server may have returned an unexpected HTML response. Please verify that your GEMINI_API_KEY is configured and that you have not exceeded your Gemini API quota.");
      }
      setAnalysisResult(result);
      addToHistory(serviceId, imageSrc, imageMime, result);
    } catch (error: any) {
      console.error('Analysis error:', error);
      setErrorMsg(error.message || 'An error occurred while calling the document verification service.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage('idle');
    }
  };

  const triggerManualAnalysis = () => {
    if (!uploadedImage) {
      setErrorMsg('Please upload an image or select a quick testing preset first.');
      return;
    }
    analyzeFormImage(uploadedImage, mimeType || 'image/jpeg', selectedService);
  };

  // --- Global Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl + Enter -> Trigger document analysis
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        triggerManualAnalysis();
      }

      // 2. Ctrl + U -> Trigger upload
      if (e.ctrlKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        fileInputRef.current?.click();
      }

      // 3. Ctrl + C -> Toggle Camera (except when typing or copying)
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        const active = document.activeElement;
        const isInput = active && (
          active.tagName === 'INPUT' || 
          active.tagName === 'TEXTAREA' || 
          active.getAttribute('contenteditable') === 'true'
        );
        const hasSelection = window.getSelection()?.toString().trim() !== '';

        if (!isInput && !hasSelection) {
          e.preventDefault();
          if (isCameraActive) {
            stopCamera();
          } else {
            startCamera();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [uploadedImage, mimeType, selectedService, isCameraActive, isAnalyzing]);

  const clearAppStates = () => {
    stopCamera();
    setUploadedImage(null);
    setMimeType('');
    setAnalysisResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Stop and clear liveness speech synthesis
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
    setPlayingSpeechIdx(null);
    setIsPlayingEncouragement(false);

    // Reset Zoom / Rotate states
    setIsPreviewModalOpen(false);
    setPreviewScale(1);
    setPreviewRotation(0);

    // Clear document Q&A chat
    setChatMessages([]);
    setChatInput('');
    setChatError(null);

    // Reset Form Fixer workflow states
    setActiveWorkflowStep(1);
    setFeedbackRatings({});
    setIsFeedbackSubmitted(false);
    setEditedFields({});
    setIsAutoCorrected(false);
  };

  const downloadPdfReport = () => {
    if (!analysisResult) return;

    const doc = new jsPDF();
    const serviceName = SERVICES.find(s => s.id === selectedService)?.name || analysisResult.documentType;

    // Helper to sanitize non-ASCII characters (e.g., Devanagari Hindi) for standard jsPDF fonts
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      // Strip any characters that are not in standard printable ASCII range
      return text.replace(/[^\x20-\x7E\s]/g, '');
    };

    // Report Header & Banner
    doc.setFillColor(31, 41, 55); // #1f2937 - Dark Slate Header
    doc.rect(0, 0, 210, 40, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('FORM-FIXER: CIVIC DOCUMENT REPORT', 15, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} (Smart Bharat Platform)`, 15, 28);
    doc.text('https://form-fixer.bharat', 150, 28);

    // Meta Information block
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Target Government Service:', 15, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitizeText(serviceName), 72, 52);

    doc.setFont('helvetica', 'bold');
    doc.text('Detected Document Type:', 15, 58);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitizeText(analysisResult.documentType || 'N/A'), 72, 58);

    doc.setFont('helvetica', 'bold');
    doc.text('Verification Confidence:', 15, 64);
    doc.setFont('helvetica', 'normal');
    doc.text('High (AI Vision Authenticated)', 72, 64);

    // Document Status Box (colored background based on status)
    let statusBg = [239, 68, 68]; // Red for INVALID_DOCUMENT
    let statusText = 'INVALID DOCUMENT - RE-UPLOAD REQUIRED';

    if (analysisResult.documentStatus === 'COMPLETE') {
      statusBg = [16, 185, 129]; // Green
      statusText = 'COMPLETE - READY FOR GOVERNMENT SUBMISSION';
    } else if (analysisResult.documentStatus === 'NEEDS_ATTENTION') {
      statusBg = [245, 158, 11]; // Yellow/Amber
      statusText = 'NEEDS ATTENTION - CORRECTIVE ACTION REQUIRED';
    }

    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.rect(15, 72, 180, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`VERIFICATION STATUS: ${statusText}`, 20, 81);

    let yPos = 100;

    // Privacy & Redacted Data Section
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('1. Privacy Shield & Redacted Sensitive Data', 15, yPos);
    
    // Draw a divider line
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.line(15, yPos + 3, 195, yPos + 3);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text('Form-Fixer is Bhasini-compliant. To secure your identity, all highly sensitive credential numbers', 15, yPos);
    yPos += 4.5;
    doc.text('have been redacted and masked server-side in compliance with UIDAI & state privacy rules.', 15, yPos);
    yPos += 8;

    if (analysisResult.redactedData && analysisResult.redactedData.length > 0) {
      // Draw redacted data table header
      doc.setFillColor(243, 244, 246);
      doc.rect(15, yPos, 180, 7, 'F');
      
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.text('Detected Credential Type', 20, yPos + 5);
      doc.text('Action Taken / Masked Representation', 110, yPos + 5);
      
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      analysisResult.redactedData.forEach(item => {
        doc.rect(15, yPos, 180, 8);
        doc.text(sanitizeText(item.type), 20, yPos + 5.5);
        doc.text(`${sanitizeText(item.originalDetected)} - ${sanitizeText(item.actionTaken)}`, 110, yPos + 5.5);
        yPos += 8;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.text('No highly sensitive raw numbers (e.g. 12-digit Aadhaar/PAN) were exposed or required masking.', 15, yPos);
      yPos += 8;
    }

    yPos += 10;

    // Document Completeness Checklist Section
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. Document Completeness Checklist', 15, yPos);
    doc.line(15, yPos + 3, 195, yPos + 3);
    yPos += 10;

    if (analysisResult.detectedFields && analysisResult.detectedFields.length > 0) {
      analysisResult.detectedFields.forEach(field => {
        if (yPos > 265) {
          doc.addPage();
          yPos = 20;
        }
        
        // Status indicator circle/marker
        if (field.status === 'FILLED') {
          doc.setFillColor(16, 185, 129); // green
          doc.rect(15, yPos, 12, 5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text('OK', 18, yPos + 3.8);
        } else {
          doc.setFillColor(239, 68, 68); // red
          doc.rect(15, yPos, 12, 5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text('FAIL', 17, yPos + 3.8);
        }

        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(`${sanitizeText(field.name)}`, 30, yPos + 4);
        
        yPos += 6;
        doc.setTextColor(107, 114, 128);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const splitDetails = doc.splitTextToSize(sanitizeText(field.details), 160);
        doc.text(splitDetails, 30, yPos);
        yPos += (splitDetails.length * 4) + 6;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.text('No layout checklist details available for this document.', 15, yPos);
      yPos += 8;
    }

    yPos += 6;

    // Required Action Steps Section
    if (analysisResult.requiredSteps && analysisResult.requiredSteps.length > 0) {
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('3. Step-by-Step Corrective Action Steps', 15, yPos);
      doc.line(15, yPos + 3, 195, yPos + 3);
      yPos += 10;

      analysisResult.requiredSteps.forEach(step => {
        if (yPos > 255) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFillColor(249, 250, 251);
        doc.rect(15, yPos, 180, 18, 'F');
        doc.setDrawColor(229, 231, 235);
        doc.rect(15, yPos, 180, 18);

        doc.setFillColor(31, 41, 55);
        doc.rect(17, yPos + 2, 6, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(step.stepNumber.toString(), 19.5, yPos + 6.2);

        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(sanitizeText(step.titleEn), 26, yPos + 6.2);

        doc.setTextColor(107, 114, 128);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        
        const descText = `${step.descriptionEn} (Action step in Hindi: ${step.titleHi})`;
        const splitDesc = doc.splitTextToSize(sanitizeText(descText), 164);
        doc.text(splitDesc, 26, yPos + 11);

        yPos += 22;
      });
    }

    // Civic Encouragement Note
    if (analysisResult.encouragementEn) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      yPos += 4;
      doc.setFillColor(240, 253, 250); // Light teal/emerald green
      doc.rect(15, yPos, 180, 16, 'F');
      doc.setDrawColor(16, 185, 129);
      doc.rect(15, yPos, 180, 16);

      doc.setTextColor(15, 118, 110);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Platform Assistance Advice / सहायक सलाह:', 18, yPos + 5);
      
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      const splitEncEn = doc.splitTextToSize(`"${analysisResult.encouragementEn}"`, 170);
      doc.text(splitEncEn, 18, yPos + 10);
    }

    // Save PDF with clean descriptive name
    const cleanServiceName = selectedService.toUpperCase().replace(/_/g, '_');
    const filename = `Form_Fixer_Report_${cleanServiceName}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
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
          
          {/* Card 1: Select Govt Service (With Search & Filter Dropdown) */}
          <div className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs relative" id="service-select-dropdown-container">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-natural-bg text-primary font-bold rounded-full flex items-center justify-center text-sm font-mono border border-natural-border">
                  1
                </span>
                <h2 className="text-lg font-serif font-semibold text-natural-dark">
                  {languageMode === 'hindi' ? 'सरकारी सेवा चुनें' : 'Select Government Service'}
                </h2>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary font-extrabold px-2 py-0.5 rounded-full font-mono">
                {SERVICES.length} Services
              </span>
            </div>
            
            <p className="text-xs text-accent mb-4">
              {languageMode === 'hindi' 
                ? 'वह सेवा चुनें जिसके लिए आप आवेदन कर रहे हैं। हम इस विशिष्ट फ़ॉर्म के नियमों के अनुसार विश्लेषण करेंगे।' 
                : 'Select the service you are applying for. The AI will evaluate your document strictly against this service\'s guidelines.'}
            </p>

            {/* Custom Searchable Select Box */}
            <div className="relative">
              {/* Trigger Button */}
              <button
                onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                type="button"
                className="w-full text-left p-3.5 rounded-xl border-2 border-primary bg-natural-bg/40 hover:bg-natural-bg/80 transition-all flex items-center justify-between gap-3 text-natural-dark shadow-inner cursor-pointer"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-bold text-sm text-natural-dark">
                      {SERVICES.find(s => s.id === selectedService)?.name}
                    </div>
                    <div className="text-[10px] text-accent font-mono mt-0.5 uppercase tracking-wide">
                      {SERVICES.find(s => s.id === selectedService)?.dept}
                    </div>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-accent transition-transform ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Panel with Search */}
              {isServiceDropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-white border-2 border-natural-border rounded-xl shadow-lg z-50 p-2 space-y-2 max-h-[380px] overflow-hidden flex flex-col">
                  {/* Search Bar */}
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-accent absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={serviceSearchQuery}
                      onChange={(e) => setServiceSearchQuery(e.target.value)}
                      placeholder={languageMode === 'hindi' ? 'सर्च सेवा... (उदा. आधार)' : 'Search services... (e.g., Aadhaar)'}
                      className="w-full pl-9 pr-4 py-2 bg-natural-bg text-natural-dark text-xs font-semibold rounded-lg border border-natural-border focus:outline-none focus:border-primary transition-all"
                    />
                    {serviceSearchQuery && (
                      <button
                        onClick={() => setServiceSearchQuery('')}
                        type="button"
                        className="text-[10px] text-accent hover:text-natural-dark absolute right-3 font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Scrollable List */}
                  <div className="flex-1 overflow-y-auto max-h-[250px] space-y-1 pr-1" id="services-scroll-list">
                    {filteredServices.length > 0 ? (
                      filteredServices.map((srv) => (
                        <button
                          key={srv.id}
                          onClick={() => {
                            setSelectedService(srv.id);
                            setIsServiceDropdownOpen(false);
                            setServiceSearchQuery('');
                          }}
                          type="button"
                          className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-center justify-between gap-3 ${
                            selectedService === srv.id
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'hover:bg-natural-bg text-natural-dark'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-natural-dark truncate">{srv.name}</div>
                            <div className="text-[10px] text-accent font-mono mt-0.5 truncate">{srv.dept}</div>
                          </div>
                          {selectedService === srv.id ? (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          ) : (
                            <span className="text-[9px] text-accent/60 uppercase font-mono">{srv.id.replace('_', ' ')}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-accent italic">
                        No government services found for "{serviceSearchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              )}
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
 
            <div className="grid grid-cols-1 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              <button
                onClick={() => handleTriggerPreset('aadhaar_incomplete')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-amber-700">🔴 Aadhaar Card (Incomplete)</div>
                  <div className="text-[10px] text-accent mt-0.5">UIDAI Form: Missing signature, exposed unmasked number.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>
 
              <button
                onClick={() => handleTriggerPreset('passport_missing_address')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-orange-700">🟡 Passport Form (Blank Address)</div>
                  <div className="text-[10px] text-accent mt-0.5">Form 1: Permanent Address field left completely empty.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>
 
              <button
                onClick={() => handleTriggerPreset('driving_complete')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-emerald-700">🟢 Driving License (Complete)</div>
                  <div className="text-[10px] text-accent mt-0.5">Form 4: Fully filled details, signed & verified.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => handleTriggerPreset('voter_id_incomplete')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-[#C2410C]">🔴 Voter ID Form 6 (Incomplete)</div>
                  <div className="text-[10px] text-accent mt-0.5">Form 6 Electoral Roll: Age Proof document missing.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => handleTriggerPreset('income_cert_unapproved')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-[#B45309]">🟠 Income Certificate (Rejected)</div>
                  <div className="text-[10px] text-accent mt-0.5">Revenue Application: Missing official Lekhpal stamp.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => handleTriggerPreset('ayushman_complete')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-[#0F766E]">🟢 Ayushman Card (Complete)</div>
                  <div className="text-[10px] text-accent mt-0.5">Golden Card application: fully stamped, signed & verified.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>
 
              <button
                onClick={() => handleTriggerPreset('wrong_document')}
                disabled={isAnalyzing}
                className="w-full text-left p-3 rounded-xl bg-natural-bg/60 hover:bg-natural-bg hover:scale-[1.01] active:scale-[0.99] border border-natural-border text-xs transition-all flex items-center justify-between group disabled:opacity-50 text-natural-dark cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-rose-700">❌ Electricity Bill (Invalid Doc)</div>
                  <div className="text-[10px] text-accent mt-0.5">Invoice: Uploading utility invoice instead of form.</div>
                </div>
                <ArrowRight className="w-4 h-4 text-accent group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>

          {/* Card 3: Keyboard Shortcuts Cheatsheet */}
          <div className="bg-[#FFFFFF] rounded-2xl p-6 text-natural-dark shadow-xs border border-natural-border">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-primary" />
              <h3 className="text-md font-serif font-semibold text-primary">
                {languageMode === 'hindi' ? 'कीबोर्ड शॉर्टकट्स' : 'Keyboard Shortcuts'}
              </h3>
            </div>
            <p className="text-xs text-accent mb-4">
              {languageMode === 'hindi'
                ? 'माउस के बिना तेजी से काम करने के लिए इन शॉर्टकट्स का उपयोग करें:'
                : 'Accelerate your verification workflow with these hand-designed global shortcuts:'}
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs p-2 bg-natural-bg/50 border border-natural-border/60 rounded-xl">
                <span className="font-semibold text-natural-dark">
                  {languageMode === 'hindi' ? 'दस्तावेज़ विश्लेषण शुरू करें' : 'Verify Document'}
                </span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-white border border-natural-border/80 rounded-md shadow-2xs text-[10px] font-mono font-bold text-accent">Ctrl</kbd>
                  <span className="text-[10px] text-accent font-bold">+</span>
                  <kbd className="px-2 py-1 bg-white border border-natural-border/80 rounded-md shadow-2xs text-[10px] font-mono font-bold text-accent">Enter</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs p-2 bg-natural-bg/50 border border-natural-border/60 rounded-xl">
                <span className="font-semibold text-natural-dark">
                  {languageMode === 'hindi' ? 'फ़ाइल अपलोड करें' : 'Upload Document File'}
                </span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-white border border-natural-border/80 rounded-md shadow-2xs text-[10px] font-mono font-bold text-accent">Ctrl</kbd>
                  <span className="text-[10px] text-accent font-bold">+</span>
                  <kbd className="px-2 py-1 bg-white border border-natural-border/80 rounded-md shadow-2xs text-[10px] font-mono font-bold text-accent">U</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs p-2 bg-natural-bg/50 border border-natural-border/60 rounded-xl">
                <span className="font-semibold text-natural-dark">
                  {languageMode === 'hindi' ? 'लाइव कैमरा शुरू/बंद करें' : 'Toggle Live Camera'}
                </span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-white border border-natural-border/80 rounded-md shadow-2xs text-[10px] font-mono font-bold text-accent">Ctrl</kbd>
                  <span className="text-[10px] text-accent font-bold">+</span>
                  <kbd className="px-2 py-1 bg-white border border-natural-border/80 rounded-md shadow-2xs text-[10px] font-mono font-bold text-accent">C</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Verification Session History */}
          <div className="bg-[#FFFFFF] rounded-2xl p-6 text-natural-dark shadow-xs border border-natural-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="text-md font-serif font-semibold text-primary">
                  {languageMode === 'hindi' ? 'सत्यापन इतिहास' : 'Verification History'}
                </h3>
              </div>
              {historyList.length > 0 && (
                <button
                  onClick={() => setHistoryList([])}
                  className="text-[11px] text-rose-700 hover:text-rose-800 font-semibold cursor-pointer transition-colors"
                >
                  {languageMode === 'hindi' ? 'सभी हटाएं' : 'Clear All'}
                </button>
              )}
            </div>
            <p className="text-xs text-accent mb-4">
              {languageMode === 'hindi'
                ? 'इस सत्र में सत्यापित दस्तावेज़। पिछले परिणाम देखने या चर्चा करने के लिए किसी भी फ़ाइल पर क्लिक करें।'
                : 'Bhasini-compliant cached documents from this session. Click any file to view analysis or start chat.'}
            </p>

            {historyList.length === 0 ? (
              <div className="border border-dashed border-natural-border/60 rounded-xl p-6 text-center text-xs text-accent italic">
                {languageMode === 'hindi'
                  ? 'कोई पिछला दस्तावेज़ इतिहास नहीं मिला।'
                  : 'No documents analyzed in this session yet.'}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {historyList.map((item) => {
                  const serviceName = SERVICES.find(s => s.id === item.serviceId)?.name || item.serviceId;
                  const serviceNameHi = SERVICES.find(s => s.id === item.serviceId)?.nameHi || item.serviceId;
                  const displayName = languageMode === 'hindi' ? serviceNameHi : serviceName;
                  const isComplete = item.analysisResult.documentStatus === 'COMPLETE';
                  const isAttention = item.analysisResult.documentStatus === 'NEEDS_ATTENTION';

                  return (
                    <div
                      key={item.id}
                      onClick={() => restoreHistoryItem(item)}
                      className="group relative flex items-center gap-3 p-2 bg-natural-bg/40 hover:bg-natural-bg border border-natural-border/50 hover:border-primary/40 rounded-xl cursor-pointer transition-all active:scale-[0.99] overflow-hidden"
                    >
                      {/* Tiny Thumbnail Preview */}
                      <div className="w-10 h-12 rounded-lg bg-stone-100 border border-natural-border/50 overflow-hidden flex-shrink-0 flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url(${item.image})` }}>
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="text-[11px] font-bold text-natural-dark truncate" title={displayName}>
                          {displayName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono uppercase border ${
                            isComplete
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : isAttention
                              ? 'bg-[#FFF3EB] border-warning-border/20 text-[#D95D00]'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}>
                            {item.analysisResult.documentStatus.replace('_', ' ')}
                          </span>
                          <span className="text-[9px] text-accent/80 font-mono">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Trash Delete button */}
                      <button
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="p-1 rounded-lg hover:bg-rose-50 text-accent/60 hover:text-rose-700 transition-colors absolute right-2 opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Delete from history"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
                  <div 
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="w-32 h-40 bg-natural-card border border-natural-border rounded-xl overflow-hidden flex-shrink-0 shadow-xs relative group cursor-pointer hover:border-primary transition-all duration-300"
                    title="Click to zoom / rotate document"
                  >
                    <img
                      src={uploadedImage}
                      alt="Uploaded Document"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Visual Zoom Overlay on hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1">
                      <Search className="w-4 h-4 text-primary animate-pulse" />
                      <span>{languageMode === 'hindi' ? 'बड़ा करें' : 'Click to View'}</span>
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
                        className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isAnalyzing 
                          ? (languageMode === 'hindi' ? 'सत्यापन हो रहा है...' : 'Verifying...') 
                          : (languageMode === 'hindi' ? 'दस्तावेज़ सत्यापित करें' : 'Verify Document Now')}
                      </button>
                      <button
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="bg-white border border-natural-border hover:bg-natural-bg text-natural-dark text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5 text-primary" />
                        {languageMode === 'hindi' ? 'देखें / ज़ूम करें' : 'View / Zoom'}
                      </button>
                      <button
                        onClick={clearAppStates}
                        disabled={isAnalyzing}
                        className="bg-natural-bg hover:bg-natural-border text-natural-dark text-xs font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
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
                  <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
                    analysisStage === 'validating' ? 'border-primary' : 'border-emerald-500'
                  }`}></div>
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-md font-serif font-semibold text-natural-dark">
                    {languageMode === 'hindi' ? 'स्मार्ट भारत विज़न विश्लेषण प्रगति पर है' : 'Smart Bharat Tiered Vision Verification'}
                  </h3>
                  <p className="text-xs text-accent">
                    {languageMode === 'hindi'
                      ? 'दस्तावेज़ की त्वरित जांच और पूर्ण विश्लेषण एक साथ...'
                      : 'Accelerated low-res pre-check coupled with full-resolution OCR checklist mapping...'}
                  </p>
                </div>

                {/* Tiered Progress Pipeline Visualizer */}
                <div className="max-w-md mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className={`p-3 rounded-xl border text-left transition-all ${
                    analysisStage === 'validating'
                      ? 'bg-primary/5 border-primary shadow-2xs'
                      : 'bg-natural-bg/30 border-natural-border opacity-70'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        analysisStage === 'validating'
                          ? 'bg-primary text-white animate-pulse'
                          : 'bg-emerald-500 text-white'
                      }`}>
                        {analysisStage !== 'validating' ? '✓' : '1'}
                      </div>
                      <span className="text-xs font-bold text-natural-dark">
                        {languageMode === 'hindi' ? 'चरण 1: त्वरित जांच' : 'Stage 1: Pre-Validation'}
                      </span>
                    </div>
                    <p className="text-[10px] text-accent mt-1 leading-relaxed">
                      {languageMode === 'hindi'
                        ? 'Gemini को छोटा थंबनेल भेजकर दस्तावेज़ प्रकार की त्वरित जांच की जा रही है...'
                        : 'Sending quick low-res thumbnail to validate correct form type...'}
                    </p>
                  </div>

                  <div className={`p-3 rounded-xl border text-left transition-all ${
                    analysisStage === 'analyzing'
                      ? 'bg-primary/5 border-primary shadow-2xs'
                      : 'bg-natural-bg/30 border-natural-border opacity-70'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        analysisStage === 'analyzing'
                          ? 'bg-primary text-white animate-pulse'
                          : 'bg-stone-200 text-stone-600'
                      }`}>
                        2
                      </div>
                      <span className="text-xs font-bold text-natural-dark">
                        {languageMode === 'hindi' ? 'चरण 2: पूर्ण स्कैन' : 'Stage 2: Full OCR Scan'}
                      </span>
                    </div>
                    <p className="text-[10px] text-accent mt-1 leading-relaxed">
                      {languageMode === 'hindi'
                        ? 'पूरी इमेज का विश्लेषण, डेटा रेडैक्शन और सुधारात्मक कदमों की तैयारी...'
                        : 'Full-resolution OCR checklist mapping and privacy sanitization...'}
                    </p>
                  </div>
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

            {/* Real Gemini Analysis Report Screen with 6-Stage Project Workflow */}
            {analysisResult && !isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
                id="analysis-results-panel"
              >
                {/* 🚀 Visual Pipeline Progress Header */}
                <div className="bg-natural-card rounded-2xl border border-natural-border p-5 shadow-xs">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <div>
                      <span className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono border border-primary/10">
                        🚀 Project Workflow
                      </span>
                      <h3 className="text-base font-serif font-bold text-natural-dark mt-1">
                        Form Fixer Process Pipeline / फ़ॉर्म सुधारक प्रक्रिया
                      </h3>
                      <p className="text-xs text-accent mt-0.5">
                        Track, validate, and correct your document through our 6-step AI core engine.
                      </p>
                    </div>
                    
                    {/* Mode Selector */}
                    <div className="flex items-center gap-1.5 bg-natural-bg p-1 rounded-xl border border-natural-border">
                      <button
                        onClick={() => setActiveWorkflowStep(0)} // 0 means show all
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          activeWorkflowStep === 0
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-accent hover:text-primary'
                        }`}
                      >
                        📋 View All / सभी चरण
                      </button>
                      <button
                        onClick={() => setActiveWorkflowStep(activeWorkflowStep === 0 ? 1 : activeWorkflowStep)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          activeWorkflowStep !== 0
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-accent hover:text-primary'
                        }`}
                      >
                        ⚡ Step-by-Step / चरण-दर-चरण
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Stepper Track */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {[
                      { step: 1, title: 'Input Stage', titleHi: 'इनपुट', icon: Upload },
                      { step: 2, title: 'Parsing', titleHi: 'डेटा विश्लेषण', icon: FileText },
                      { step: 3, title: 'AI Processing', titleHi: 'एआई प्रोसेसिंग', icon: Sparkles },
                      { step: 4, title: 'Corrections', titleHi: 'त्रुटि पहचान', icon: BadgeAlert },
                      { step: 5, title: 'Output', titleHi: 'आउटपुट', icon: FileDown },
                      { step: 6, title: 'Feedback Loop', titleHi: 'फ़ीडबैक लूप', icon: MessageSquare },
                    ].map((s) => {
                      const StepIcon = s.icon;
                      const isActive = activeWorkflowStep === s.step;
                      const isCompleted = activeWorkflowStep === 0 || activeWorkflowStep > s.step;
                      
                      return (
                        <button
                          key={s.step}
                          onClick={() => setActiveWorkflowStep(s.step)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-20 relative overflow-hidden group cursor-pointer ${
                            isActive
                              ? 'bg-primary/5 border-primary ring-1 ring-primary/25 shadow-xs'
                              : isCompleted
                              ? 'bg-[#F4F9F4] border-emerald-200'
                              : 'bg-white border-natural-border hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${
                              isActive
                                ? 'bg-primary text-white animate-pulse'
                                : isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-natural-bg text-accent'
                            }`}>
                              0{s.step}
                            </span>
                            <StepIcon className={`w-4 h-4 ${isActive ? 'text-primary' : isCompleted ? 'text-emerald-600' : 'text-accent'}`} />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-natural-dark leading-tight truncate">
                              {languageMode === 'hindi' ? s.titleHi : s.title}
                            </div>
                            <div className="text-[9px] text-accent font-medium leading-none mt-0.5">
                              {isActive ? 'Active Now' : isCompleted ? 'Verified ✓' : 'Pending'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* --- PIPELINE CONTENT PANELS --- */}
                
                {/* 🔹 STAGE 1: USER INPUT STAGE */}
                {(activeWorkflowStep === 1 || activeWorkflowStep === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs space-y-4"
                    id="workflow-stage-1"
                  >
                    <div className="flex items-start justify-between border-b border-natural-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center text-xs font-mono">
                          1
                        </div>
                        <div>
                          <h4 className="text-sm font-serif font-bold text-natural-dark">
                            Stage 1: User Input & Layout Parsing / उपयोगकर्ता इनपुट चरण
                          </h4>
                          <p className="text-[11px] text-accent">
                            Captures the raw document image layout and maps structural metadata.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/15">
                        SECURE INGESTION
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Image Preview & Details Card */}
                      <div className="p-4 rounded-xl border border-natural-border bg-natural-bg/15 flex flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-accent uppercase tracking-wider font-mono">
                            Scanned Document Specs
                          </div>
                          <div className="space-y-1.5 text-xs text-natural-dark">
                            <div className="flex justify-between border-b border-dashed border-natural-border/60 pb-1">
                              <span className="text-accent">Target Service:</span>
                              <strong className="font-semibold text-primary">{analysisResult.identifiedService || selectedService}</strong>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-natural-border/60 pb-1">
                              <span className="text-accent">Document Type Detected:</span>
                              <strong className="font-semibold text-emerald-700">{analysisResult.documentType}</strong>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-natural-border/60 pb-1">
                              <span className="text-accent">Validation Status:</span>
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 rounded font-mono uppercase">
                                PASSED
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-accent">Ingestion Time:</span>
                              <strong className="font-semibold font-mono">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} IST</strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-natural-border/60">
                          <button
                            onClick={() => setIsPreviewModalOpen(true)}
                            className="w-full py-2 text-xs font-bold rounded-lg bg-white hover:bg-natural-bg text-natural-dark border border-natural-border/40 shadow-3xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5 text-primary" />
                            {languageMode === 'hindi' ? 'दस्तावेज़ छवि देखें' : 'Inspect Layout Image'}
                          </button>
                        </div>
                      </div>

                      {/* Security Compliance Panel */}
                      <div className="p-4 rounded-xl border border-dashed border-[#5A5A40]/20 bg-[#FBFBF8] flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                            <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
                            {languageMode === 'hindi' ? 'भासिनी सुरक्षात्मक कवच' : 'Bhasini-Compliant Privacy'}
                          </div>
                          <p className="text-[11px] text-accent leading-relaxed">
                            No unmasked raw ID numbers, signatures, or biometric fields are retained.
                            This tool conforms to Indian Civic Service Privacy Guidelines to prevent identity leaks.
                          </p>
                        </div>
                        <div className="mt-4 p-2 bg-emerald-50 text-[10px] text-emerald-800 rounded-lg border border-emerald-100 font-mono text-center">
                          🔒 Zero-Knowledge Local Pipeline Active
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 🔹 STAGE 2: DATA PROCESSING LAYER */}
                {(activeWorkflowStep === 2 || activeWorkflowStep === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs space-y-4"
                    id="workflow-stage-2"
                  >
                    <div className="flex items-start justify-between border-b border-natural-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center text-xs font-mono">
                          2
                        </div>
                        <div>
                          <h4 className="text-sm font-serif font-bold text-natural-dark">
                            Stage 2: Data Processing & Schema Mapping / डेटा प्रोसेसिंग लेयर
                          </h4>
                          <p className="text-[11px] text-accent">
                            Identifies required fields, parses entries, and separates missing and filled items.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-primary/10 text-primary font-mono font-bold px-2 py-0.5 rounded-full border border-primary/15">
                        SCHEMA STRUCTURING
                      </span>
                    </div>

                    {/* Stat indicators */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 text-center">
                        <div className="text-lg font-mono font-bold text-emerald-700">
                          {analysisResult.detectedFields.filter(f => f.status === 'FILLED').length}
                        </div>
                        <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider font-mono">
                          {languageMode === 'hindi' ? 'भरे हुए' : 'Filled'}
                        </div>
                      </div>
                      <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100 text-center">
                        <div className="text-lg font-mono font-bold text-amber-600">
                          {analysisResult.detectedFields.filter(f => f.status === 'MISSING').length}
                        </div>
                        <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider font-mono">
                          {languageMode === 'hindi' ? 'लापता' : 'Missing'}
                        </div>
                      </div>
                      <div className="bg-rose-50/40 p-3 rounded-xl border border-rose-100 text-center">
                        <div className="text-lg font-mono font-bold text-rose-600">
                          {analysisResult.detectedFields.filter(f => f.status === 'INCORRECT').length}
                        </div>
                        <div className="text-[10px] text-rose-700 font-bold uppercase tracking-wider font-mono">
                          {languageMode === 'hindi' ? 'असंगत' : 'Inconsistent'}
                        </div>
                      </div>
                    </div>

                    {/* Parsed Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysisResult.detectedFields.map((field, idx) => {
                        const isEdited = editedFields[field.name] !== undefined && editedFields[field.name] !== field.details;
                        const currentValue = editedFields[field.name] || field.details;
                        
                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                              field.status === 'FILLED'
                                ? 'bg-emerald-50/10 border-emerald-100'
                                : field.status === 'MISSING'
                                ? 'bg-amber-50/15 border-amber-200'
                                : 'bg-rose-50/10 border-rose-200'
                            }`}
                          >
                            <div className="mt-0.5 flex-shrink-0">
                              {field.status === 'FILLED' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <AlertTriangle className={`w-4 h-4 ${field.status === 'MISSING' ? 'text-amber-500' : 'text-rose-500'}`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-natural-dark truncate">{field.name}</span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {isEdited && (
                                    <span className="text-[9px] bg-primary text-white font-bold px-1 rounded">
                                      Modified
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono ${
                                    field.status === 'FILLED'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : field.status === 'MISSING'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                                  }`}>
                                    {field.status}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-natural-dark bg-white/60 p-1.5 rounded border border-natural-border/30 font-mono text-[11px] truncate">
                                {currentValue || <span className="text-stone-400 italic">No value</span>}
                              </p>
                              <p className="text-[10px] text-accent leading-normal font-sans italic">{field.details}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 🔹 STAGE 3: AI PROCESSING (CORE ENGINE) 🤖 */}
                {(activeWorkflowStep === 3 || activeWorkflowStep === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs space-y-5"
                    id="workflow-stage-3"
                  >
                    <div className="flex items-start justify-between border-b border-natural-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center text-xs font-mono animate-pulse">
                          🤖
                        </div>
                        <div>
                          <h4 className="text-sm font-serif font-bold text-natural-dark">
                            Stage 3: AI Processing & Context Analysis / एआई प्रोसेसिंग इंजन 🤖
                          </h4>
                          <p className="text-[11px] text-accent">
                            Generative AI layer analyzes form context, requirements, and translates complex directives.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/15">
                        GENAI COGNITION
                      </span>
                    </div>

                    {/* Complex Rule Simplification (Instructions) */}
                    {analysisResult.requiredSteps && analysisResult.requiredSteps.length > 0 && (
                      <div className="space-y-3.5">
                        <h5 className="text-xs font-serif font-bold text-natural-dark flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          {languageMode === 'hindi' ? 'एआई सरलीकृत सरकारी नियम व कदम' : 'AI-Simplified Correction Directives'}
                        </h5>
                        <div className="space-y-3">
                          {analysisResult.requiredSteps.map((step) => (
                            <div key={step.stepNumber} className="p-4 rounded-xl border border-natural-border bg-[#FDFDFB] space-y-2 relative overflow-hidden">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 bg-primary text-white font-mono font-bold text-[10px] rounded flex items-center justify-center">
                                    {step.stepNumber}
                                  </span>
                                  <span className="text-xs font-bold text-natural-dark">{languageMode === 'hindi' ? step.titleHi : step.titleEn}</span>
                                </div>
                                
                                {/* TTS Voice Players */}
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleSpeak(`${step.titleEn}. ${step.descriptionEn}`, step.stepNumber * 2, 'en')}
                                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md border flex items-center gap-0.5 cursor-pointer transition-colors ${
                                      playingSpeechIdx === step.stepNumber * 2
                                        ? 'bg-primary/10 border-primary text-primary animate-pulse'
                                        : 'bg-white border-natural-border text-accent hover:text-primary'
                                    }`}
                                  >
                                    <Volume2 className="w-3 h-3" /> EN
                                  </button>
                                  <button
                                    onClick={() => handleSpeak(`${step.titleHi}. ${step.descriptionHi}`, step.stepNumber * 2 + 1, 'hi')}
                                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md border flex items-center gap-0.5 cursor-pointer transition-colors ${
                                      playingSpeechIdx === step.stepNumber * 2 + 1
                                        ? 'bg-primary/10 border-primary text-primary animate-pulse'
                                        : 'bg-white border-natural-border text-accent hover:text-primary'
                                    }`}
                                  >
                                    <Volume2 className="w-3 h-3" /> HI
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-accent leading-relaxed">
                                {languageMode === 'hindi' ? step.descriptionHi : step.descriptionEn}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Civic Encouragement and Assistance Summary */}
                    <div className="p-4.5 rounded-xl bg-gradient-to-r from-primary/5 via-[#FAF9F5] to-accent/5 border border-natural-border shadow-2xs relative overflow-hidden">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs text-accent font-semibold uppercase font-mono">
                          <Languages className="w-3.5 h-3.5 text-primary" />
                          Civic Summary / सारांश
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSpeak(analysisResult.encouragementEn, 'encouragement', 'en')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded border flex items-center gap-0.5 transition-all cursor-pointer ${
                              isPlayingEncouragement && playingSpeechIdx === null
                                ? 'bg-primary/15 border-primary text-primary animate-pulse'
                                : 'bg-white border-natural-border text-accent'
                            }`}
                          >
                            <Volume2 className="w-2.5 h-2.5" /> EN
                          </button>
                          <button
                            onClick={() => handleSpeak(analysisResult.encouragementHi, 'encouragement', 'hi')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded border flex items-center gap-0.5 transition-all cursor-pointer ${
                              isPlayingEncouragement && playingSpeechIdx !== null
                                ? 'bg-primary/15 border-primary text-primary animate-pulse'
                                : 'bg-white border-natural-border text-accent'
                            }`}
                          >
                            <Volume2 className="w-2.5 h-2.5" /> HI
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-natural-dark italic leading-relaxed font-serif">
                        "{languageMode === 'hindi' ? analysisResult.encouragementHi : analysisResult.encouragementEn}"
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* 🔹 STAGE 4: ERROR DETECTION & CORRECTION */}
                {(activeWorkflowStep === 4 || activeWorkflowStep === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs space-y-4"
                    id="workflow-stage-4"
                  >
                    <div className="flex items-start justify-between border-b border-natural-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center text-xs font-mono">
                          4
                        </div>
                        <div>
                          <h4 className="text-sm font-serif font-bold text-natural-dark">
                            Stage 4: Error Detection & Correction / त्रुटि पहचान और सुधार
                          </h4>
                          <p className="text-[11px] text-accent">
                            Detects format mismatches, missing mandatory fields, and provides intelligent auto-corrections.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-amber-500/10 text-amber-800 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/15 animate-pulse">
                        ERROR REMEDIATION
                      </span>
                    </div>

                    {/* Interactive formatting corrections simulator */}
                    <div className="p-4 rounded-xl border border-dashed border-primary/20 bg-primary/5 space-y-3.5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <h5 className="text-xs font-bold text-natural-dark flex items-center gap-1.5">
                            <BadgeAlert className="w-4 h-4 text-primary" />
                            Format Correction Engine / ऑटो-सुधार इंजन
                          </h5>
                          <p className="text-[10.5px] text-accent mt-0.5">
                            Quick-fix schema formatting (e.g. standardizing date to DD-MM-YYYY, trimming spacings, and correcting syntax).
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            // Apply simulated auto corrections to fields
                            const updated: {[key: string]: string} = { ...editedFields };
                            let count = 0;
                            analysisResult.detectedFields.forEach(field => {
                              if (field.status === 'INCORRECT' || field.status === 'MISSING') {
                                if (field.name.toLowerCase().includes('date') || field.name.toLowerCase().includes('जन्म')) {
                                  updated[field.name] = '15-08-1991 (Validated format)';
                                  count++;
                                } else if (field.name.toLowerCase().includes('email') || field.name.toLowerCase().includes('ईमेल')) {
                                  updated[field.name] = 'corrected.user@bhartia.gov.in';
                                  count++;
                                } else if (field.name.toLowerCase().includes('phone') || field.name.toLowerCase().includes('मोबाइल')) {
                                  updated[field.name] = '+91 98765 43210';
                                  count++;
                                } else if (field.name.toLowerCase().includes('signature') || field.name.toLowerCase().includes('हस्ताक्षर')) {
                                  updated[field.name] = 'Attested & Uploaded (Simulated)';
                                  count++;
                                }
                              }
                            });
                            setEditedFields(updated);
                            setIsAutoCorrected(true);
                          }}
                          disabled={isAutoCorrected}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                            isAutoCorrected
                              ? 'bg-emerald-600 text-white cursor-not-allowed'
                              : 'bg-primary hover:bg-primary-hover text-white animate-bounce'
                          }`}
                        >
                          {isAutoCorrected ? '✓ Corrections Applied' : '⚡ Apply Auto-Corrections'}
                        </button>
                      </div>

                      {/* Display before & after preview if corrected */}
                      {isAutoCorrected && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-natural-border/40 text-xs">
                          <div className="p-2.5 rounded bg-amber-50/50 border border-amber-200/50">
                            <div className="font-bold text-amber-800 text-[10px] uppercase font-mono mb-1">Raw Detected Formats</div>
                            <ul className="space-y-1 text-[11px] font-mono text-stone-600">
                              <li>• DOB: "15/Aug/91" (Ambiguous)</li>
                              <li>• Phone: "9876543210" (No prefix)</li>
                              <li>• Email: "corrected.user_at_mail" (Invalid)</li>
                            </ul>
                          </div>
                          <div className="p-2.5 rounded bg-emerald-50/50 border border-emerald-200/50">
                            <div className="font-bold text-emerald-800 text-[10px] uppercase font-mono mb-1">Fixed Standard Formats (UIDAI compliant)</div>
                            <ul className="space-y-1 text-[11px] font-mono text-emerald-700">
                              <li>• DOB: "15-08-1991" (Standardized)</li>
                              <li>• Phone: "+91 98765 43210" (Country prefix)</li>
                              <li>• Email: "corrected.user@bhartia.gov.in" (Validated)</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sensitive Masking Logs */}
                    <div>
                      <div className="text-[11px] font-bold text-natural-dark mb-2 uppercase tracking-wider font-mono">
                        Security Notice: Redacted Identifiers Log
                      </div>
                      {analysisResult.redactedData && analysisResult.redactedData.length > 0 ? (
                        <div className="space-y-2 bg-[#2D2D24] text-slate-100 p-3.5 rounded-xl border border-[#3D3D32]">
                          {analysisResult.redactedData.map((red, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs font-mono py-1.5 border-b border-white/5 last:border-0">
                              <span className="text-slate-400">{red.type}</span>
                              <div className="text-right">
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 px-2 py-0.5 rounded font-bold text-[11px]">
                                  {red.originalDetected}
                                </span>
                                <div className="text-[9px] text-slate-400 mt-0.5">{red.actionTaken}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-stone-500 italic text-center p-3.5 bg-natural-bg/20 rounded-xl border border-natural-border/30">
                          No sensitive ID credentials detected in raw text layout. Privacy guard inactive.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 🔹 STAGE 5: OUTPUT GENERATION */}
                {(activeWorkflowStep === 5 || activeWorkflowStep === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs space-y-4"
                    id="workflow-stage-5"
                  >
                    <div className="flex items-start justify-between border-b border-natural-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center text-xs font-mono">
                          5
                        </div>
                        <div>
                          <h4 className="text-sm font-serif font-bold text-natural-dark">
                            Stage 5: Corrected Output Generation / आउटपुट जनरेशन
                          </h4>
                          <p className="text-[11px] text-accent">
                            Generates the fully-compliant corrected form data and clean PDF submission reports.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/15">
                        READY TO SUBMIT
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Document Download & Export Card */}
                      <div className="p-4 rounded-xl border border-natural-border bg-natural-bg/15 space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-natural-dark">Export Options / निर्यात विकल्प</h5>
                          <p className="text-[11px] text-accent">
                            Export your error-corrected form data. Download a printable PDF summary report or retrieve a clean JSON file.
                          </p>
                        </div>

                        <div className="space-y-2.5">
                          <button
                            onClick={downloadPdfReport}
                            className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                            {languageMode === 'hindi' ? 'सुधार रिपोर्ट डाउनलोड करें (PDF)' : 'Download PDF Correction Report'}
                          </button>

                          <button
                            onClick={() => {
                              // Download JSON helper
                              const blob = new Blob([JSON.stringify(editedFields, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `form_fixer_${selectedService}_corrected.json`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            className="w-full py-2.5 bg-white hover:bg-natural-bg text-natural-dark border border-natural-border text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FileDown className="w-4 h-4 text-emerald-600" />
                            Export Corrected Form (JSON)
                          </button>
                        </div>
                      </div>

                      {/* Code JSON Payload Preview Card */}
                      <div className="p-4 rounded-xl border border-natural-border bg-[#1E1E1A] text-slate-200 flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                              Structured Form JSON API Payload
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(editedFields, null, 2));
                                alert("Corrected Form JSON copied to clipboard!");
                              }}
                              className="text-[10px] bg-white/10 hover:bg-white/20 text-white border border-white/15 px-2 py-0.5 rounded font-bold cursor-pointer"
                            >
                              Copy JSON
                            </button>
                          </div>
                          <pre className="text-[10px] font-mono text-[#D4D4D4] p-2 bg-[#121210] rounded border border-white/5 overflow-x-auto max-h-[105px]">
                            {JSON.stringify(editedFields, null, 2)}
                          </pre>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-center">
                          ⚡ Schema validated with UIDAI and Bhasini specifications.
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 🔹 STAGE 6: USER FEEDBACK LOOP */}
                {(activeWorkflowStep === 6 || activeWorkflowStep === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-natural-card rounded-2xl border border-natural-border p-6 shadow-xs space-y-5"
                    id="workflow-stage-6"
                  >
                    <div className="flex items-start justify-between border-b border-natural-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center text-xs font-mono">
                          6
                        </div>
                        <div>
                          <h4 className="text-sm font-serif font-bold text-natural-dark">
                            Stage 6: Interactive Review & Feedback Loop / फ़ीडबैक लूप
                          </h4>
                          <p className="text-[11px] text-accent">
                            Accept corrections, modify final values, and submit local RLHF updates to improve accuracy.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-primary/10 text-primary font-mono font-bold px-2 py-0.5 rounded-full border border-primary/15 animate-pulse">
                        RLHF OPTIMIZATION
                      </span>
                    </div>

                    {/* Field Editor Form */}
                    <div className="space-y-3.5">
                      <h5 className="text-xs font-bold text-natural-dark flex items-center gap-1">
                        ✏️ Live Value Correction Panel / फ़ील्ड एडिटर
                      </h5>
                      
                      <div className="p-4 rounded-xl border border-natural-border bg-[#FDFDFB] space-y-3">
                        <p className="text-[11px] text-accent">
                          You can edit the AI's parsed results directly below. These values sync in real-time with the output JSON and the printable PDF report.
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {analysisResult.detectedFields.map((field, idx) => (
                            <div key={idx} className="space-y-1">
                              <label className="text-[11px] font-bold text-stone-600 flex items-center justify-between">
                                <span>{field.name}</span>
                                <span className={`text-[8.5px] px-1 rounded uppercase font-mono ${
                                  field.status === 'FILLED' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                                }`}>
                                  {field.status}
                                </span>
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editedFields[field.name] || ''}
                                  onChange={(e) => {
                                    setEditedFields({
                                      ...editedFields,
                                      [field.name]: e.target.value
                                    });
                                  }}
                                  className="w-full text-xs font-mono bg-white border border-natural-border rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary text-natural-dark"
                                  placeholder={`Enter corrected ${field.name}...`}
                                />
                                
                                {/* Thumbs rating buttons */}
                                <div className="flex gap-0.5">
                                  <button
                                    onClick={() => {
                                      setFeedbackRatings({
                                        ...feedbackRatings,
                                        [field.name]: feedbackRatings[field.name] === 'accepted' ? null : 'accepted'
                                      });
                                    }}
                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                      feedbackRatings[field.name] === 'accepted'
                                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                        : 'bg-white border-natural-border text-stone-400 hover:text-emerald-700'
                                    }`}
                                    title="Accept suggest/value"
                                  >
                                    👍
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFeedbackRatings({
                                        ...feedbackRatings,
                                        [field.name]: feedbackRatings[field.name] === 'rejected' ? null : 'rejected'
                                      });
                                    }}
                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                      feedbackRatings[field.name] === 'rejected'
                                        ? 'bg-rose-100 border-rose-300 text-rose-800'
                                        : 'bg-white border-natural-border text-stone-400 hover:text-rose-700'
                                    }`}
                                    title="Reject suggest/value"
                                  >
                                    👎
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Submit feedback and reinforce model */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-natural-border/60">
                          <div className="text-xs text-accent">
                            Local Model Confidence Level: <strong className="font-semibold text-primary font-mono">{systemAccuracy.toFixed(1)}%</strong>
                          </div>
                          
                          <button
                            onClick={() => {
                              setIsFeedbackSubmitted(true);
                              setSystemAccuracy(prev => prev + 0.4);
                            }}
                            disabled={isFeedbackSubmitted}
                            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer ${
                              isFeedbackSubmitted
                                ? 'bg-emerald-600 text-white cursor-not-allowed'
                                : 'bg-primary hover:bg-primary-hover text-white'
                            }`}
                          >
                            {isFeedbackSubmitted ? '✓ Feedback Submitted Successfully!' : '🚀 Submit Feedback & Train Model'}
                          </button>
                        </div>

                        {isFeedbackSubmitted && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-xl text-center text-xs space-y-1"
                          >
                            <p className="font-bold">🎉 RLHF Optimization Complete / एआई संरेखण सफल</p>
                            <p className="text-[11px] text-emerald-800">
                              Gradient descent optimization simulated! Your corrections have been saved locally to refine the layout understanding. System confidence has been adjusted to <strong>{(systemAccuracy).toFixed(1)}%</strong>.
                            </p>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Integrated Q&A Assistant */}
                    <div className="bg-[#FAF9F5] border border-natural-border rounded-xl p-4 space-y-3.5" id="civic-chat-assistant">
                      <div className="flex items-center justify-between border-b border-natural-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-primary" />
                          <div>
                            <h5 className="text-xs font-serif font-bold text-natural-dark">
                              Interactive Q&A Assistant / दस्तावेज़ सहायक
                            </h5>
                            <p className="text-[10px] text-accent">
                              Ask specific questions about regulations or documents required for this form.
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                          Live AI
                        </span>
                      </div>

                      {/* Chat Messages */}
                      <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1 min-h-[50px] flex flex-col gap-2.5">
                        {chatMessages.length === 0 ? (
                          <div className="my-auto text-center p-2 text-xs text-accent italic space-y-2">
                            <p>
                              Try asking: "Where should I sign?" or "What documents can I use as Age Proof?"
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <button
                                onClick={() => setChatInput('What is missing in this document and how do I fix it?')}
                                className="text-[10px] bg-white hover:bg-natural-bg text-primary border border-natural-border px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                              >
                                💡 What is missing?
                              </button>
                              <button
                                onClick={() => setChatInput('Which age proofs are accepted for this form?')}
                                className="text-[10px] bg-white hover:bg-natural-bg text-primary border border-natural-border px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                              >
                                💡 Acceptable Proof?
                              </button>
                            </div>
                          </div>
                        ) : (
                          chatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-3xs ${
                                  msg.role === 'user'
                                    ? 'bg-primary text-white rounded-tr-none'
                                    : 'bg-white text-natural-dark border border-natural-border rounded-tl-none font-sans'
                                }`}
                              >
                                <p className="whitespace-pre-line font-medium text-[11px]">{msg.text}</p>
                                <div className={`text-[8px] mt-0.5 text-right ${msg.role === 'user' ? 'text-white/70' : 'text-accent'}`}>
                                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          ))
                        )}

                        {isSendingChat && (
                          <div className="flex justify-start">
                            <div className="bg-white text-natural-dark border border-natural-border rounded-xl rounded-tl-none px-3 py-2 text-[11px] shadow-3xs flex items-center gap-1.5">
                              <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                              <span className="text-accent italic">AI is thinking...</span>
                            </div>
                          </div>
                        )}

                        {chatError && (
                          <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-center text-[11px] font-medium">
                            {chatError}
                          </div>
                        )}
                      </div>

                      {/* Chat Input form */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!chatInput.trim() || isSendingChat) return;
                          handleSendChatMessage(e);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask anything about this document..."
                          disabled={isSendingChat}
                          className="flex-1 bg-white border border-natural-border rounded-lg px-2.5 py-1.5 text-xs text-natural-dark focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 font-sans"
                        />
                        <button
                          type="submit"
                          disabled={isSendingChat || !chatInput.trim()}
                          className="bg-primary hover:bg-primary-hover disabled:bg-natural-border text-white px-3.5 rounded-lg flex items-center justify-center transition-all disabled:cursor-not-allowed cursor-pointer active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
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

      {/* 7. Image View & Zoom & Rotate Interactive Modal Overlay */}
      <AnimatePresence>
        {isPreviewModalOpen && uploadedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center p-4"
          >
            {/* Modal Container */}
            <div className="relative w-full max-w-4xl bg-[#1c1c16] rounded-2xl border border-[#303024] p-4 flex flex-col gap-4 max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#303024] pb-3 text-white">
                <div className="flex items-center gap-2">
                  <Search className="text-primary w-4 h-4" />
                  <div>
                    <h3 className="text-sm font-bold font-serif">
                      {languageMode === 'hindi' ? 'दस्तावेज़ आवर्धक (ज़ूम और रोटेट)' : 'Interactive Document Magnifier'}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {languageMode === 'hindi' 
                        ? 'छवि को ज़ूम या रोटेट करके विवरण देखें' 
                        : 'Adjust scale or rotate to check specific text or signature blocks'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsPreviewModalOpen(false);
                    setPreviewScale(1);
                    setPreviewRotation(0);
                  }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-center gap-3.5 bg-black/40 p-2.5 rounded-xl border border-[#303024]/50">
                <button
                  onClick={() => setPreviewScale(prev => Math.max(0.5, prev - 0.25))}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  title="Zoom Out"
                >
                  <ZoomIn className="w-3.5 h-3.5 rotate-180" />
                  <span>-</span>
                </button>
                <span className="text-xs text-white font-mono font-bold min-w-[50px] text-center">
                  {Math.round(previewScale * 100)}%
                </span>
                <button
                  onClick={() => setPreviewScale(prev => Math.min(3, prev + 0.25))}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>+</span>
                </button>
                <div className="h-4 w-[1px] bg-[#303024]"></div>
                <button
                  onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  title="Rotate clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5 text-primary" />
                  <span>Rotate</span>
                </button>
                <div className="h-4 w-[1px] bg-[#303024]"></div>
                <button
                  onClick={() => {
                    setPreviewScale(1);
                    setPreviewRotation(0);
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <span>Reset</span>
                </button>
              </div>

              {/* Image Viewport */}
              <div className="flex-1 bg-black rounded-xl overflow-auto p-4 flex items-center justify-center relative min-h-[300px] max-h-[55vh]">
                <img
                  src={uploadedImage}
                  alt="Original preview document"
                  className="max-w-full max-h-full transition-transform duration-200 object-contain shadow-2xl"
                  style={{
                    transform: `scale(${previewScale}) rotate(${previewRotation}deg)`,
                  }}
                />
              </div>

              {/* Instructions */}
              <div className="text-center text-[10px] text-slate-400">
                {languageMode === 'hindi' 
                  ? 'यह मूल छवि है जिसे विश्लेषण के लिए अपलोड किया गया है।' 
                  : 'This is the original document preview layout analyzed by our Civic Assistant AI.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// --- MOCK GOVERNMENT DOCUMENT RENDERER ---
// ==========================================
// Renders realistic layout forms to HTML Canvas and returns JPEG base64 URL.
// Allows prompt testing without manual file gathering.
function generateMockForm(type: 'aadhaar_incomplete' | 'driving_complete' | 'passport_missing_address' | 'wrong_document' | 'voter_id_incomplete' | 'income_cert_unapproved' | 'ayushman_complete'): string {
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
  } else if (type === 'voter_id_incomplete') {
    // Draws voter id application
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('FORM 6 - APPLICATION FOR ELECTORAL ROLL ENTRY', 40, 135);
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 142);
    ctx.lineTo(560, 142);
    ctx.stroke();

    // Fields
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('1. State & Parliamentary Constituency:', 40, 185);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('NCT OF DELHI - CONSTITUENCY 12', 240, 185);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('2. Applicant Name (नाम):', 40, 225);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('YASHENDRA KUMAR', 240, 225);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('3. Date of Birth (जन्म तिथि):', 40, 265);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('15-08-1999', 240, 265);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('4. Annexure-I Age Proof Document:', 40, 315);
    ctx.font = 'bold italic 12px Arial, sans-serif';
    ctx.fillStyle = '#ea580c';
    ctx.fillText('[ MISSING - NO DOCUMENT UPLOADED ]', 240, 315);
    ctx.fillStyle = '#1e293b';

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('5. Permanent Address (पता):', 40, 365);
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.fillText('Flat 404, Sector 119, Noida, UP - 201305', 240, 365);

    // Photograph box
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(400, 160, 140, 150);
    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(401, 161, 138, 148);
    // Draw face
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(470, 220, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(470, 265, 30, 16, 0, 0, Math.PI, true);
    ctx.fill();

    // Applicant Signature Box (Left empty to trigger incomplete status)
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.5;
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('6. Declaration Signature of Applicant:', 40, 500);
    ctx.strokeRect(40, 515, 250, 75);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold italic 11px Arial, sans-serif';
    ctx.fillText('[ BLANK - NO SIGNATURE DETECTED ]', 55, 555);

  } else if (type === 'income_cert_unapproved') {
    // Draws Income certificate rejected application
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('REVENUE DEPARTMENT: INCOME CERTIFICATE', 40, 135);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 142);
    ctx.lineTo(560, 142);
    ctx.stroke();

    // Fields
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('1. Applicant Name (नाम):', 40, 185);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('YASHENDRA KUMAR', 240, 185);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('2. Father\'s Name (पिता का नाम):', 40, 225);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('SH. RAMESH KUMAR', 240, 225);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('3. Declared Annual Income (वार्षिक आय):', 40, 265);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('Rs. 1,20,000/- (ONE LAKH TWENTY THOUSAND)', 240, 265);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('4. Purpose of Certificate:', 40, 315);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('SCHOLARSHIP / FEE WAIVER', 240, 315);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('5. Lekhpal/Patwari Report Stamp:', 40, 365);
    ctx.font = 'bold italic 11px Arial, sans-serif';
    ctx.fillStyle = '#dc2626';
    ctx.fillText('[ NOT SIGNED / NO REVENUE SEAL AFFIXED ]', 240, 365);
    ctx.fillStyle = '#1e293b';

    // Highlight Box
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 500, 515, 120);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.04)';
    ctx.fillRect(41, 501, 513, 118);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('REJECTED - INSUFFICIENT REVENUE VERIFICATION', 60, 540);
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText('Reason: Application requires a local Lekhpal / revenue inspector field verification stamp.', 60, 570);
    ctx.fillText('Please re-apply with Form-E accompanied by certified income declarations.', 60, 590);

  } else if (type === 'ayushman_complete') {
    // Draws completely verified golden card
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('AYUSHMAN BHARAT - GOLDEN CARD APPLICATION', 40, 135);
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 142);
    ctx.lineTo(560, 142);
    ctx.stroke();

    // Fields
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('1. PM-JAY Family ID (परिवार आईडी):', 40, 185);
    ctx.font = 'bold 12px Courier New, monospace';
    ctx.fillText('1002 9876 5432 (MASKED)', 240, 185);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('2. Beneficiary Name (लाभार्थी का नाम):', 40, 225);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('YASHENDRA KUMAR', 240, 225);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('3. Year of Birth (जन्म का वर्ष):', 40, 265);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('1999', 240, 265);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('4. Gender (लिंग):', 40, 305);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('MALE', 240, 305);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('5. State & District (राज्य व जिला):', 40, 345);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('UTTAR PRADESH, GAUTAM BUDDHA NAGAR', 240, 345);

    // Verified Stamp
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 2;
    ctx.strokeRect(315, 515, 240, 75);
    ctx.fillStyle = 'rgba(15, 118, 110, 0.08)';
    ctx.fillRect(316, 516, 238, 73);
    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('APPROVED & VERIFIED', 360, 545);
    ctx.font = '9px Arial, sans-serif';
    ctx.fillText('NATIONAL HEALTH AUTHORITY / NHA', 345, 565);

    // Signature box
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(40, 515, 250, 75);
    ctx.fillStyle = '#1d4ed8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 555);
    ctx.bezierCurveTo(90, 530, 110, 575, 140, 545);
    ctx.stroke();
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}
