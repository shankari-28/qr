import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import QRCodeStyling, { DotType, CornerSquareType, ErrorCorrectionLevel } from "qr-code-styling";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Globe, Type, Image as ImageIcon, Share2, Smartphone, Video,
  Palette, Square, Pipette, Upload, ShieldCheck, Download, Save, Lock, ArrowRight,
  FileText, MapPin, CreditCard, Menu, Star, FileUser, Presentation, Mail, Wifi, X, Users
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQrCodes } from "@/hooks/useQrCodes";
import { usePlan } from "@/hooks/usePlan";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import { toPng, toSvg } from "html-to-image";

const ease = [0.16, 1, 0.3, 1] as const;

const qrTypes = [
  { id: "url", label: "Website URL", icon: Globe },
  { id: "text", label: "Text", icon: Type },
  { id: "pdf", label: "PDF to QR", icon: FileText },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "maps", label: "Google Maps", icon: MapPin },
  { id: "wifi", label: "WiFi", icon: Wifi },
  { id: "email", label: "Email", icon: Mail },
  { id: "social", label: "Social Media", icon: Share2 },
  { id: "app", label: "App Download", icon: Smartphone },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "menu", label: "Menu Card", icon: Menu },
  { id: "review", label: "Google Review", icon: Star },
  { id: "resume", label: "Resume", icon: FileUser },
  { id: "meet", label: "Google Meet", icon: Video },
  { id: "presentation", label: "Presentation", icon: Presentation },
];

const frames = ["None", "Scan Me", "Point Here", "Follow Us"];

type ShapeDef = { 
  id: string; 
  label: string; 
  src?: string; 
  innerScale: number; 
  isPng?: boolean; 
  previewCircle?: boolean; 
  previewPoints?: string; 
  previewPath?: string; 
  clip?: string; 
  radius?: string; 
  safeZone?: { cx: number; cy: number; size: number }; // Maximum Inscribed Square (0.0 - 1.0)
};

// Clean array containing ONLY the newly uploaded PNG shapes for the frame selector
const allShapes: ShapeDef[] = [
  { id: "Square",     label: "Square",                                    innerScale: 1.0,  isPng: false, safeZone: { cx: 0.5, cy: 0.5, size: 0.85 } },
  { id: "Brain",      label: "Brain",      src: "/shapes/brain.png",      innerScale: 0.55, isPng: true,  safeZone: { cx: 0.5, cy: 0.5, size: 0.55 } },
  { id: "Circle",     label: "Circle",     src: "/shapes/circle.png",     innerScale: 0.65, isPng: true,  safeZone: { cx: 0.5, cy: 0.5, size: 0.65 } },
  { id: "Dress",      label: "Dress",      src: "/shapes/dress.png",      innerScale: 0.40, isPng: true,  safeZone: { cx: 0.5, cy: 0.5, size: 0.40 } },
  { id: "Face",       label: "Face",       src: "/shapes/face.png",       innerScale: 0.55, isPng: true,  safeZone: { cx: 0.5, cy: 0.5, size: 0.50 } },
  { id: "Heart",      label: "Heart",      src: "/shapes/heart.png",      innerScale: 0.50, isPng: true,  safeZone: { cx: 0.5, cy: 0.45, size: 0.50 } },
  { id: "Hexagon",    label: "Hexagon",    src: "/shapes/hexagon (2).png",innerScale: 0.60, isPng: true,  safeZone: { cx: 0.5, cy: 0.5, size: 0.60 } },
  { id: "House",      label: "House",      src: "/shapes/house.png",      innerScale: 0.55, isPng: true,  safeZone: { cx: 0.5, cy: 0.6, size: 0.50 } },
  { id: "Ice Cream",  label: "Ice Cream",  src: "/shapes/ice_cream.png",  innerScale: 0.40, isPng: true,  safeZone: { cx: 0.5, cy: 0.4, size: 0.40 } },
  { id: "Message",    label: "Message",    src: "/shapes/message.png",    innerScale: 0.55, isPng: true,  safeZone: { cx: 0.5, cy: 0.45, size: 0.50 } },
  { id: "Shirt",      label: "Shirt",      src: "/shapes/shirt.png",      innerScale: 0.50, isPng: true,  safeZone: { cx: 0.5, cy: 0.5, size: 0.50 } },
  { id: "Star",       label: "Star",       src: "/shapes/star.png",       innerScale: 0.40, isPng: true,  safeZone: { cx: 0.5, cy: 0.5, size: 0.40 } }
];

const corrections = ["L (7%)", "M (15%)", "Q (25%)", "H (30%)"];

// ─── Body Type (dot style) ────────────────────────────────────────────────
const bodyTypes: Array<{ id: string; label: string; dotType: string; preview: (c: string) => React.ReactNode }> = [
  { id: "square",   label: "Square",        dotType: "square",  preview: (c) => <rect x="20" y="20" width="60" height="60" fill={c} /> },
  { id: "dots",     label: "Small Dots",    dotType: "dots",    preview: (c) => <>{[22,50,78].map(x => [22,50,78].map(y => <circle key={`${x}${y}`} cx={x} cy={y} r="9" fill={c} />))}</> },
  { id: "rounded",  label: "Rounded",       dotType: "rounded", preview: (c) => <rect x="18" y="18" width="64" height="64" rx="20" fill={c} /> },
  { id: "star5",    label: "5-Point Star",  dotType: "dots",    preview: (c) => <polygon points="50,12 61,38 90,38 68,56 76,82 50,66 24,82 32,56 10,38 39,38" fill={c} /> },
  { id: "heart",    label: "Heart",         dotType: "dots",    preview: (c) => <path d="M50,78 C15,60 5,40 5,28 C5,15 14,7 26,7 C36,7 45,15 50,21 C55,15 64,7 74,7 C86,7 95,15 95,28 C95,40 85,60 50,78Z" fill={c} /> },
  { id: "four-star",label: "4-Point Star",  dotType: "classy",  preview: (c) => <polygon points="50,8 60,40 92,50 60,60 50,92 40,60 8,50 40,40" fill={c} /> },
  { id: "pentagon", label: "Pentagon",      dotType: "rounded", preview: (c) => <polygon points="50,5 93,36 77,93 23,93 7,36" fill={c} /> },
  { id: "hexagon",  label: "Hexagon",       dotType: "extra-rounded", preview: (c) => <polygon points="50,5 91,27 91,73 50,95 9,73 9,27" fill={c} /> },
];

// ─── Eye Frame Type (cornersSquare style) ────────────────────────────────
const eyeFrameTypes: Array<{ id: string; label: string; type: string; preview: (c: string) => React.ReactNode }> = [
  { id: "square",        label: "Square",   type: "square",        preview: (c) => <rect x="15" y="15" width="70" height="70" strokeWidth="10" stroke={c} fill="none" /> },
  { id: "extra-rounded", label: "Rounded",  type: "extra-rounded", preview: (c) => <rect x="15" y="15" width="70" height="70" rx="24" strokeWidth="10" stroke={c} fill="none" /> },
  { id: "dot",           label: "Circle",   type: "dot",           preview: (c) => <circle cx="50" cy="50" r="35" strokeWidth="10" stroke={c} fill="none" /> },
  { id: "hexagon-frame", label: "Hexagon",  type: "extra-rounded", preview: (c) => <polygon points="50,8 88,29 88,71 50,92 12,71 12,29" strokeWidth="10" stroke={c} fill="none" /> },
  { id: "pentagon-frame",label: "Pentagon", type: "square",        preview: (c) => <polygon points="50,8 92,38 76,90 24,90 8,38" strokeWidth="10" stroke={c} fill="none" /> },
];

// ─── Eye Ball Type (cornersDot style) ───────────────────────────────────
const eyeBallTypes: Array<{ id: string; label: string; type: string; preview: (c: string) => React.ReactNode }> = [
  { id: "square",  label: "Square",  type: "square", preview: (c) => <rect x="25" y="25" width="50" height="50" fill={c} /> },
  { id: "dot",     label: "Circle",  type: "dot",    preview: (c) => <circle cx="50" cy="50" r="28" fill={c} /> },
  { id: "diamond", label: "Diamond", type: "square", preview: (c) => <polygon points="50,22 78,50 50,78 22,50" fill={c} /> },
  { id: "star",    label: "Star",    type: "dot",    preview: (c) => <polygon points="50,15 58,38 83,38 63,53 70,78 50,63 30,78 37,53 17,38 42,38" fill={c} /> },
];

// Each template's whitebox defines where the white QR area is inside the PNG (all as 0-1 fractions).
// The QR is square; its side = min(right-left, bottom-top) * scale to guarantee fit inside white area.
const preDesignTemplates = [
  {
    id: 'scan_me', src: '/pre_design/scan_me.png', label: 'Classic Scan',
    // PNG ~440x535. White area measured: L=9% R=91% T=28% B=88%
    whitebox: { left: 0.09, right: 0.91, top: 0.28, bottom: 0.88 },
    safeZone: { cx: 0.5, cy: 0.59, size: 0.76 },
    config: { fgColor: '#0f172a', bodyType: 'square', eyeFrameType: 'square', eyeBallType: 'square', selectedShape: 'Square', colorMode: 'single', selectedFrame: 'Scan Me' }
  },
  {
    id: 'follow_us', src: '/pre_design/follow_us.png', label: 'Social Core',
    // PNG ~440x535. White area: L=9% R=91% T=22% B=87%
    whitebox: { left: 0.09, right: 0.91, top: 0.22, bottom: 0.87 },
    safeZone: { cx: 0.5, cy: 0.55, size: 0.76 },
    config: { fgColor: '#3b82f6', bodyType: 'rounded', eyeFrameType: 'extra-rounded', eyeBallType: 'dot', selectedShape: 'Circle', colorMode: 'single', selectedFrame: 'Follow Us' }
  },
  {
    id: 'order_here', src: '/pre_design/order_here.png', label: 'Cafe Menu',
    // PNG ~440x535. White area: L=8% R=92% T=25% B=88%
    whitebox: { left: 0.08, right: 0.92, top: 0.25, bottom: 0.88 },
    safeZone: { cx: 0.5, cy: 0.58, size: 0.78 },
    config: { fgColor: '#f97316', bodyType: 'rounded', eyeFrameType: 'hexagon-frame', eyeBallType: 'square', selectedShape: 'Square', colorMode: 'single', selectedFrame: 'None' }
  },
  {
    id: 'review', src: '/pre_design/review.png', label: 'Rate Us',
    // PNG ~445x540. White area: L=7% R=86% T=27% B=80% (3D figure bottom-right stays outside QR)
    whitebox: { left: 0.07, right: 0.86, top: 0.27, bottom: 0.80 },
    safeZone: { cx: 0.47, cy: 0.54, size: 0.70 },
    config: { fgColor: '#eab308', bodyType: 'dots', eyeFrameType: 'dot', eyeBallType: 'star', selectedShape: 'Star', colorMode: 'single', selectedFrame: 'None' }
  },
  {
    id: 'watch_live', src: '/pre_design/watch_live.png', label: 'Stream Hub',
    // PNG ~440x535. White area: L=8% R=92% T=24% B=88%
    whitebox: { left: 0.08, right: 0.92, top: 0.24, bottom: 0.88 },
    safeZone: { cx: 0.5, cy: 0.57, size: 0.78 },
    config: { fgColor: '#ef4444', bodyType: 'extra-rounded', eyeFrameType: 'pentagon-frame', eyeBallType: 'dot', selectedShape: 'House', colorMode: 'single', selectedFrame: 'None' }
  }
];

const generateUUID = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

function LockedOverlay({ title, onUpgrade }: { title: string; onUpgrade: () => void }) {
  return (
    <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center p-4 text-center border border-border">
      <Lock className="w-6 h-6 text-muted-foreground mb-2" />
      <p className="font-semibold text-sm mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-3">Upgrade to Premium to unlock</p>
      <button onClick={onUpgrade} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
        Upgrade Plan
      </button>
    </div>
  );
}

export default function Generator() {
  const [activeType, setActiveType] = useState("url");
  const [qrName, setQrName] = useState("");
  const [inputValue, setInputValue] = useState("https://scanovax.com");

  const [fgColor, setFgColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [selectedFrame, setSelectedFrame] = useState("None");
  const [selectedShape, setSelectedShape] = useState("Square");
  const [errorLevel, setErrorLevel] = useState("H (30%)");
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false);

  // Dot style controls (independent)
  const [bodyType,     setBodyType]     = useState("square");         // body dot style
  const [eyeFrameType, setEyeFrameType] = useState("square");         // corner frame style
  const [eyeBallType,  setEyeBallType]  = useState("square");         // corner ball style

  // Color mode: 'single' or 'gradient'
  const [colorMode, setColorMode] = useState<"single" | "gradient">("single");
  const [gradientColor1, setGradientColor1] = useState("#6366f1");

  // QR Visual Transformations
  const [qrScale, setQrScale] = useState(1);
  const [shapeScale, setShapeScale] = useState(1);
  const [qrOffsetX, setQrOffsetX] = useState(0);
  const [qrOffsetY, setQrOffsetY] = useState(0);
  const [shapeOffsetX, setShapeOffsetX] = useState(0);
  const [shapeOffsetY, setShapeOffsetY] = useState(0);
  const [gradientColor2, setGradientColor2] = useState("#ec4899");
  const [gradientAngle, setGradientAngle] = useState(45);

  const gradientPresets = [
    { label: "Violet → Pink",  c1: "#6366f1", c2: "#ec4899" },
    { label: "Blue → Cyan",   c1: "#3b82f6", c2: "#06b6d4" },
    { label: "Orange → Red",  c1: "#f97316", c2: "#ef4444" },
    { label: "Green → Teal",  c1: "#22c55e", c2: "#14b8a6" },
    { label: "Gold → Amber",  c1: "#eab308", c2: "#f97316" },
    { label: "Purple → Blue", c1: "#a855f7", c2: "#3b82f6" },
  ];

  // WiFi State
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiEncryption, setWifiEncryption] = useState("WPA");

  // Email State
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const [isCustomizing, setIsCustomizing] = useState(false);

  const { codes, createQrCode, isCreating, updateQrCode } = useQrCodes();
  const { limits, effectivePlan } = usePlan();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const [solidProcessedMasks, setSolidProcessedMasks] = useState<Record<string, string>>({});
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  // Carousel State & Logic
  const typeScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleTypeScroll = () => {
    if (!typeScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = typeScrollRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(Math.ceil(scrollLeft) < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    handleTypeScroll();
    window.addEventListener("resize", handleTypeScroll);
    return () => window.removeEventListener("resize", handleTypeScroll);
  }, []);

  const scrollTypesBy = (direction: 'left' | 'right') => {
    if (!typeScrollRef.current) return;
    const amount = 300;
    typeScrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: "smooth" });
  };

  // Automatically map hollow outline PNGs into cohesive solid CSS masks universally  
  useEffect(() => {
    const processShapes = async () => {
      const processed: Record<string, string> = {};
      for (const shape of allShapes) {
        if (!shape.isPng || !shape.src || shape.id === "Square") continue;
        processed[shape.id] = await new Promise<string>((resolve) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(shape.src!); return; }
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            const startX = Math.floor(canvas.width / 2);
            const startY = Math.floor(canvas.height / 2);
            const startIndex = (startY * canvas.width + startX) * 4;
            
            if (data[startIndex + 3] > 128) {
              resolve(shape.src!); // Already solid
              return;
            }

            const stack = [[startX, startY]];
            const visited = new Uint8Array(canvas.width * canvas.height);
            visited[startY * canvas.width + startX] = 1;

            while (stack.length > 0) {
              const [x, y] = stack.pop()!;
              const index = (y * canvas.width + x) * 4;
              
              data[index] = 0; data[index + 1] = 0; data[index + 2] = 0; data[index + 3] = 255;

              const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
              for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
                  const nIndex = (ny * canvas.width + nx) * 4;
                  const vIndex = ny * canvas.width + nx;
                  if (data[nIndex + 3] < 128 && !visited[vIndex]) {
                    visited[vIndex] = 1;
                    stack.push([nx, ny]);
                  }
                }
              }
            }
            
            // Solidify perimeter bound
            for (let i = 0; i < data.length; i += 4) {
              if (data[i+3] >= 128) {
                data[i] = 0; data[i+1] = 0; data[i+2] = 0; data[i+3] = 255;
              }
            }
            
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => resolve(shape.src!);
          img.src = shape.src;
        });
      }
      setSolidProcessedMasks(processed);
    };
    processShapes();
  }, []);

  // Check if editing is allowed
  const canEdit = limits.editable;
  if (editId && !canEdit) {
    toast.error("Your plan does not allow editing QR codes. Upgrade to unlock this feature.");
    navigate("/dashboard/qr-generator");
    return null;
  }

  const trackingIdRef = useRef(generateUUID());

  const qrRef = useRef<HTMLDivElement>(null);
  const previewCaptureRef = useRef<HTMLDivElement>(null);
  // Ref wrapping only the QR visual — used by Download & Share for pixel-perfect output
  const qrExportRef = useRef<HTMLDivElement>(null);
  const qrCodeInstance = useRef<QRCodeStyling>(new QRCodeStyling({
    width: 1000,
    height: 1000,
    type: "svg",
    data: "https://scanovax.com",
    margin: 10,
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 0,
      imageSize: 0.45
    }
  }));

  const [logoFile, setLogoFile] = useState<string | undefined>(undefined);
  const [base64Logo, setBase64Logo] = useState<string | undefined>(undefined);

  // Helper to convert URL to Base64 for reliable embedding in QR
  useEffect(() => {
    if (!logoFile) {
      setBase64Logo(undefined);
      return;
    }

    if (logoFile.startsWith("data:") || logoFile.startsWith("blob:")) {
      setBase64Logo(logoFile);
      return;
    }

    const convertToBase64 = async () => {
      try {
        const response = await fetch(logoFile);
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Logo Base64 conversion failed", e);
        return logoFile; // Fallback to original URL
      }
    };

    convertToBase64().then(setBase64Logo);
  }, [logoFile]);

  // Ensure proper formatting for direct scanning without redirect dependency
  let qrValue = inputValue || " ";
  
  // Enforce valid protocols to guarantee correct native scanner behaviour
  const urlBasedTypes = ["url", "social", "app", "video", "maps", "review", "meet", "presentation"];
  if (urlBasedTypes.includes(activeType) && qrValue !== " " && !/^https?:\/\//i.test(qrValue) && !/^[A-Za-z0-9]+:/i.test(qrValue)) {
    qrValue = `https://${qrValue}`;
  }

  // Content for the QR code if it were static (optional, but we use redirect now)
  const qrContent = inputValue;
  
  const getPlaceholder = () => {
    switch (activeType) {
      case "url": return "https://example.com";
      case "text": return "Enter your text message...";
      case "social": return "@username or profile URL";
      case "app": return "App Store or Play Store URL";
      case "video": return "YouTube or video URL";
      case "image": return "Upload an image below";
      case "pdf": return "Upload your PDF file";
      case "resume": return "Upload your Resume (PDF)";
      case "menu": return "Upload your Menu (PDF/Image)";
      case "maps": return "Enter location address or coordinates";
      case "payments": return "Enter UPI ID or payment link";
      case "review": return "Enter Google Review page URL";
      case "meet": return "Enter Google Meet link";
      case "presentation": return "Enter Google Slides or Canva link";
      default: return "Enter content...";
    }
  };

  // Sync complex inputs to inputValue
  useEffect(() => {
    if (activeType === "wifi") {
      setInputValue(`WIFI:S:${wifiSsid};T:${wifiEncryption};P:${wifiPassword};;`);
    } else if (activeType === "email") {
      const mailto = `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      setInputValue(mailto);
    }
  }, [wifiSsid, wifiPassword, wifiEncryption, emailTo, emailSubject, emailBody, activeType]);

  const ecLevel = errorLevel.charAt(0) as ErrorCorrectionLevel;
  const isLimitReached = codes.length >= limits.qrLimit;

  // Load existing data for editing
  useEffect(() => {
    if (editId && codes.length > 0) {
      const existing = codes.find(c => c.id === editId);
      if (existing) {
        setQrName(existing.name);
        setActiveType(existing.type as any);
        setInputValue(existing.content);
        setFgColor(existing.fg_color || "#0f172a");
        setBgColor(existing.bg_color || "#ffffff");
        setSelectedFrame(existing.frame || "None");
        setSelectedShape(existing.shape || "Square");
        if (existing.logo_url) {
          setLogoFile(existing.logo_url);
        }
        if (existing.ec_level) {
          const matched = corrections.find(c => c.startsWith(existing.ec_level!));
          if (matched) setErrorLevel(matched);
        }
        setLeadCaptureEnabled(!!existing.lead_capture_enabled);
        trackingIdRef.current = existing.id as any;
      }
    }
  }, [editId, codes]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (["image", "pdf", "resume", "menu"].includes(activeType)) {
      const toastId = toast.loading(`Uploading ${activeType.toUpperCase()} securely...`);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${trackingIdRef.current}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('user_uploads')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('user_uploads').getPublicUrl(filePath);
        setInputValue(data.publicUrl);
        toast.success(`${activeType.toUpperCase()} uploaded globally! Ready to scan.`, { id: toastId });
      } catch (error: any) {
        toast.error("Upload failed: " + error.message, { id: toastId });
      }
    }
  };

  // Real-time synchronization of the QR Code Styling library
  useEffect(() => {
    if (!qrRef.current) return;

    // Append once on first mount
    if (qrRef.current.childNodes.length === 0) {
      qrCodeInstance.current.append(qrRef.current);
    }

    const safeFgColor = limits.customization !== "none" ? fgColor : "#0f172a";
    const safeBgColor = limits.customization !== "none" ? bgColor : "#ffffff";
    const safeShapeId = limits.customization !== "none" ? selectedShape : "Square";
    const safeFrame = limits.customization === "full" ? selectedFrame : "None";
    const isShaped = selectedShape !== "Square";
    // Always force High (H) Error Correction to protect heavily customized aesthetics from breaking scannability
    const safeEcLevel = "H (30%)";
    const safeLogo = limits.logoUpload ? (base64Logo || logoFile) : undefined;

    const safeBodyType = limits.customization !== "none" ? bodyType : "square";
    const useGradient = limits.customization !== "none" && colorMode === "gradient";
    const isCustomBody = ["heart", "star5", "four-star", "pentagon", "hexagon"].includes(safeBodyType);
    const dotsOptions: any = isCustomBody 
      ? { color: "transparent", type: "square" }
      : (useGradient
        ? {
            type: safeBodyType as DotType,
            gradient: {
              type: "linear",
              rotation: (gradientAngle * Math.PI) / 180,
              colorStops: [
                { offset: 0, color: gradientColor1 },
                { offset: 1, color: gradientColor2 },
              ],
            },
          }
        : { type: safeBodyType as DotType, color: safeFgColor });

    const eyeColor = useGradient ? gradientColor1 : safeFgColor;
    const safeEyeFrameType = limits.customization !== "none" ? eyeFrameType : "square";
    const safeEyeBallType  = limits.customization !== "none" ? eyeBallType  : "square";

    const eyeBallDef = eyeBallTypes.find(e => e.id === safeEyeBallType);
    const eyeBallLibType = (eyeBallDef?.type ?? "square") as any;

    const eyeFrameDef = eyeFrameTypes.find(e => e.id === safeEyeFrameType);
    const eyeFrameLibType = (eyeFrameDef?.type ?? "square") as any;

    // Force SVG to fill its container after every update.
    const forceSvgFill = () => {
      const svg = qrRef.current?.querySelector("svg");
      if (svg) {
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.display = "block";
        svg.style.maxWidth = "100%";
        svg.style.maxHeight = "100%";
      }
    };
    
    // We override ALL eye frames and balls for perfect alignment and centering
    // supported or not by library
    const hideEyeFrame = true; // safeEyeFrameType === "hexagon-frame" || safeEyeFrameType === "pentagon-frame";
    const hideEyeBall = true;   // safeEyeBallType === "diamond" || safeEyeBallType === "star";

    qrCodeInstance.current.update({
      data: qrValue || " ",
      dotsOptions,
      cornersSquareOptions: { color: "transparent", type: eyeFrameLibType },
      cornersDotOptions: { color: "transparent", type: eyeBallLibType },
      backgroundOptions: { color: "transparent" },
      margin: 10, // Maintain mandatory Quiet Zone so scanners do not fail
      qrOptions: { errorCorrectionLevel: safeEcLevel.charAt(0) as ErrorCorrectionLevel },
      image: safeLogo,
      imageOptions: { margin: 0, imageSize: 0.45 }
    });

    forceSvgFill();
    
    // Standardized Finder Pattern & Custom Body Injection
    const injectCustomShapes = () => {
      forceSvgFill();
      const svg = qrRef.current?.querySelector("svg");
      if (!svg) return;
      
      const size = 1000;
      const qrInternal = (qrCodeInstance.current as any)._qr;
      if (!qrInternal) return;
      
      const count = qrInternal.getModuleCount();
      const mod = size / count; // module size
      const eyeSize = mod * 7;
      
      let overlayGroup = svg.querySelector("#custom-overlay-layer");
      if (!overlayGroup) {
        overlayGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        overlayGroup.setAttribute("id", "custom-overlay-layer");
        svg.appendChild(overlayGroup);
      }
      overlayGroup.innerHTML = "";
      
      // Support for Gradients in Custom Shapes
      if (useGradient) {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const lg = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        lg.setAttribute("id", "custom-overlay-gradient");
        lg.setAttribute("gradientTransform", `rotate(${gradientAngle}, 500, 500)`);
        
        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", gradientColor1);
        
        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", gradientColor2);
        
        lg.appendChild(stop1);
        lg.appendChild(stop2);
        defs.appendChild(lg);
        overlayGroup.appendChild(defs);
      }

      const shapeFill = useGradient ? "url(#custom-overlay-gradient)" : safeFgColor;

      const corners = [
        { x: 0, y: 0 },
        { x: size - eyeSize, y: 0 },
        { x: 0, y: size - eyeSize }
      ];

      // Draw Standardized Eye Frames (7x7 module grid)
      corners.forEach(corner => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const cx = corner.x + eyeSize / 2;
        const cy = corner.y + eyeSize / 2;
        const r_out = eyeSize / 2;
        const r_in = (eyeSize - (mod * 2)) / 2; 
        let d = "";
        
        switch (safeEyeFrameType) {
          case "extra-rounded":
            const rad = eyeSize * 0.3;
            d = `M${corner.x+rad},${corner.y} L${corner.x+eyeSize-rad},${corner.y} Q${corner.x+eyeSize},${corner.y} ${corner.x+eyeSize},${corner.y+rad} L${corner.x+eyeSize},${corner.y+eyeSize-rad} Q${corner.x+eyeSize},${corner.y+eyeSize} ${corner.x+eyeSize-rad},${corner.y+eyeSize} L${corner.x+rad},${corner.y+eyeSize} Q${corner.x},${corner.y+eyeSize} ${corner.x},${corner.y+eyeSize-rad} L${corner.x},${corner.y+rad} Q${corner.x},${corner.y} ${corner.x+rad},${corner.y} Z 
                 M${corner.x+rad},${corner.y+mod} Q${corner.x+mod},${corner.y+mod} ${corner.x+mod},${corner.y+rad} L${corner.x+mod},${corner.y+eyeSize-rad} Q${corner.x+mod},${corner.y+eyeSize-mod} ${corner.x+rad},${corner.y+eyeSize-mod} L${corner.x+eyeSize-rad},${corner.y+eyeSize-mod} Q${corner.x+eyeSize-mod},${corner.y+eyeSize-mod} ${corner.x+eyeSize-mod},${corner.y+eyeSize-rad} L${corner.x+eyeSize-mod},${corner.y+rad} Q${corner.x+eyeSize-mod},${corner.y+mod} ${corner.x+eyeSize-rad},${corner.y+mod} Z`;
            break;
          case "dot":
            d = `M${cx},${corner.y} A${r_out},${r_out} 0 1,1 ${cx},${corner.y+eyeSize} A${r_out},${r_out} 0 1,1 ${cx},${corner.y} Z
                 M${cx},${corner.y+mod} A${r_in},${r_in} 0 1,0 ${cx},${corner.y+eyeSize-mod} A${r_in},${r_in} 0 1,0 ${cx},${corner.y+mod} Z`;
            break;
          case "hexagon-frame":
            const getHex = (r: number) => Array.from({length:6}, (_,i)=>({x:cx+r*Math.cos(i*Math.PI/3-Math.PI/2), y:cy+r*Math.sin(i*Math.PI/3-Math.PI/2)}));
            const pOut=getHex(r_out), pIn=getHex(r_in).reverse();
            d = `M${pOut[0].x},${pOut[0].y} ${pOut.slice(1).map(p=>`L${p.x},${p.y}`).join(' ')} Z M${pIn[0].x},${pIn[0].y} ${pIn.slice(1).map(p=>`L${p.x},${p.y}`).join(' ')} Z`;
            break;
          case "pentagon-frame":
            const getPent = (r: number) => Array.from({length:5}, (_,i)=>({x:cx+r*Math.cos(i*2*Math.PI/5-Math.PI/2), y:cy+r*Math.sin(i*2*Math.PI/5-Math.PI/2)}));
            const pentO=getPent(r_out), pentI=getPent(r_in).reverse();
            d = `M${pentO[0].x},${pentO[0].y} ${pentO.slice(1).map(p=>`L${p.x},${p.y}`).join(' ')} Z M${pentI[0].x},${pentI[0].y} ${pentI.slice(1).map(p=>`L${p.x},${p.y}`).join(' ')} Z`;
            break;
          case "square":
          default:
            d = `M${corner.x},${corner.y} h${eyeSize} v${eyeSize} h-${eyeSize} Z M${corner.x+mod},${corner.y+mod} v${eyeSize-2*mod} h${eyeSize-2*mod} v-${eyeSize-2*mod} Z`;
            break;
        }
        
        path.setAttribute("d", d.replace(/\s+/g," "));
        path.setAttribute("fill", shapeFill);
        path.setAttribute("fill-rule", "evenodd");
        overlayGroup?.appendChild(path);
      });
      
      // Draw Standardized Eye Balls (3x3 module grid centered)
      const ballSize = mod * 3;
      corners.forEach(corner => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const bcx = corner.x + eyeSize / 2;
        const bcy = corner.y + eyeSize / 2;
        const br = ballSize / 2;
        let bd = "";
        
        switch (safeEyeBallType) {
          case "dot":    bd = `M${bcx},${bcy-br} A${br},${br} 0 1,1 ${bcx},${bcy+br} A${br},${br} 0 1,1 ${bcx},${bcy-br} Z`; break;
          case "diamond":bd = `M${bcx},${bcy-br} L${bcx+br},${bcy} L${bcx},${bcy+br} L${bcx-br},${bcy} Z`; break;
          case "star":
            const p = []; for(let i=0;i<10;i++){const ang=i*Math.PI/5-Math.PI/2; const r=i%2?br*0.4:br; p.push(`${bcx+r*Math.cos(ang)},${bcy+r*Math.sin(ang)}`);}
            bd = `M${p.join(" L")} Z`; break;
          case "square":
          default: bd = `M${bcx-br},${bcy-br} h${ballSize} v${ballSize} h-${ballSize} Z`; break;
        }
        path.setAttribute("d", bd);
        path.setAttribute("fill", shapeFill);
        overlayGroup?.appendChild(path);
      });

      // CORE FIX: Take over Body Module drawing if custom shape is selected
      const isCustomBody = ["heart", "star5", "four-star", "pentagon", "hexagon"].includes(safeBodyType);
      if (isCustomBody) {
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (!qrInternal.isDark(r, c)) continue;
            // Skip finder pattern zones
            if ((r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7)) continue;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const mcx = c * mod + mod / 2;
            const mcy = r * mod + mod / 2;
            const msize = mod * 0.95; // modules slightly smaller for definition
            const mr = msize / 2;
            let md = "";

            switch (safeBodyType) {
              case "heart":
                md = `M${mcx},${mcy+mr} C${mcx-msize*0.7},${mcy} ${mcx-msize*0.9},${mcy-mr} ${mcx},${mcy-msize*0.2} C${mcx+msize*0.9},${mcy-mr} ${mcx+msize*0.7},${mcy} ${mcx},${mcy+mr} Z`;
                break;
              case "star5":
                const p5 = []; for(let i=0;i<10;i++){const ang=i*Math.PI/5-Math.PI/2; const rad=i%2?mr*0.4:mr; p5.push(`${mcx+rad*Math.cos(ang)},${mcy+rad*Math.sin(ang)}`);}
                md = `M${p5.join(" L")} Z`;
                break;
              case "four-star":
                md = `M${mcx},${mcy-mr} Q${mcx+mr*0.2},${mcy} ${mcx+mr},${mcy} Q${mcx+mr*0.2},${mcy} ${mcx},${mcy+mr} Q${mcx-mr*0.2},${mcy} ${mcx-mr},${mcy} Q${mcx-mr*0.2},${mcy} ${mcx},${mcy-mr} Z`;
                break;
              case "pentagon":
                const pP = []; for(let i=0;i<5;i++){const ang=i*2*Math.PI/5-Math.PI/2; pP.push(`${mcx+mr*Math.cos(ang)},${mcy+mr*Math.sin(ang)}`);}
                md = `M${pP.join(" L")} Z`;
                break;
              case "hexagon":
                const pH = []; for(let i=0;i<6;i++){const ang=i*Math.PI/3-Math.PI/2; pH.push(`${mcx+mr*Math.cos(ang)},${mcy+mr*Math.sin(ang)}`);}
                md = `M${pH.join(" L")} Z`;
                break;
            }
            path.setAttribute("d", md);
            path.setAttribute("fill", shapeFill);
            overlayGroup?.appendChild(path);
          }
        }
      }
    };

    const t = setTimeout(injectCustomShapes, 50); 
    return () => clearTimeout(t);
  }, [qrValue, fgColor, bgColor, selectedShape, ecLevel, colorMode, gradientColor1, gradientColor2, gradientAngle, bodyType, eyeFrameType, eyeBallType, limits.customization, limits.logoUpload, logoFile, base64Logo, qrRef.current, activeTemplate]);


  const handleSave = async () => {
    if (!editId && isLimitReached) {
      toast.error(`You have reached your limit of ${limits.qrLimit} QR codes. Upgrade your plan to create more.`);
      return;
    }

    let finalLogoUrl = logoFile;

    // Handle logo upload if it's a local blob
    if (logoFile?.startsWith("blob:")) {
      const toastId = toast.loading("Saving your customized logo...");
      try {
        const response = await fetch(logoFile);
        const blob = await response.blob();
        const fileExt = blob.type.split('/')[1] || 'png';
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `${editId || trackingIdRef.current}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('user_uploads')
          .upload(filePath, blob);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('user_uploads').getPublicUrl(filePath);
        finalLogoUrl = data.publicUrl;
        toast.success("Logo saved!", { id: toastId });
      } catch (error: any) {
        toast.error("Logo save failed: " + error.message, { id: toastId });
        // IMPORTANT: Prevent saving blob URLs to the database
        finalLogoUrl = null as any;
      }
    }

    const payload = {
      name: qrName || inputValue.slice(0, 40) || "Untitled QR",
      type: activeType,
      content: inputValue,
      fg_color: limits.customization !== "none" ? fgColor : "#0f172a",
      bg_color: limits.customization !== "none" ? bgColor : "#ffffff",
      ec_level: limits.customization === "full" ? ecLevel : "H (30%)",
      frame: limits.customization === "full" ? selectedFrame : "None",
      shape: limits.customization !== "none" ? selectedShape : "Square",
      logo_url: (limits.logoUpload && finalLogoUrl?.startsWith("http")) ? finalLogoUrl : null,
      lead_capture_enabled: leadCaptureEnabled,
    };

    if (editId) {
      await updateQrCode(editId, payload);
    } else {
      await createQrCode({
        ...payload,
        id: trackingIdRef.current as any,
      });
      // Only reset/refresh AFTER successful save
      trackingIdRef.current = crypto.randomUUID();
      setQrName("");
      setInputValue("https://scanovax.com");
      setLogoFile(undefined);
    }
  };

  const handleUpgrade = () => navigate("/#pricing");

  // ─── Shared capture helper: single source of truth for download & share ────────
  // Captures the QR visual (shape + template + colors + logo) as displayed in preview.
  const captureQrImage = async (pixelRatio = 4): Promise<string> => {
    const target = qrExportRef.current || previewCaptureRef.current;
    if (!target) throw new Error("Preview not ready");
    return toPng(target, {
      pixelRatio,
      cacheBust: true,
      skipAutoScale: true,
      backgroundColor: activeTemplate ? undefined : (bgColor || '#ffffff'),
    });
  };

  const handleDownloadPNG = async () => {
    const toastId = toast.loading("Generating high-resolution QR...");
    try {
      const dataUrl = await captureQrImage(4);
      const link = document.createElement('a');
      link.download = `${qrName || "qr-code"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("Download failed", err);
      toast.error("Download failed. Try again.", { id: toastId });
      qrCodeInstance.current.download({ name: qrName || "qr-code", extension: "png" });
    }
  };

  const handleDownloadSVG = async () => {
    if (!limits.exports.includes("svg")) {
      toast.error("SVG export requires a Premium or Elegant plan.");
      return;
    }
    const toastId = toast.loading("Generating SVG...");
    try {
      const target = qrExportRef.current || previewCaptureRef.current;
      if (!target) { toast.dismiss(toastId); return; }
      const dataUrl = await toSvg(target);
      const link = document.createElement('a');
      link.download = `${qrName || "qr-code"}.svg`;
      link.href = dataUrl;
      link.click();
      toast.success("Downloaded SVG!", { id: toastId });
    } catch (err) {
      qrCodeInstance.current.download({ name: qrName || "qr-code", extension: "svg" });
      toast.dismiss(toastId);
    }
  };

  const handleDownloadPDF = async () => {
    if (!limits.exports.includes("svg")) {
      toast.error("PDF export requires a Premium or Elegant plan.");
      return;
    }
    const toastId = toast.loading("Generating PDF...");
    try {
      const dataUrl = await captureQrImage(3);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const qrSize = 120;
      const x = (210 - qrSize) / 2;
      const y = (297 - qrSize) / 2;
      pdf.addImage(dataUrl, 'PNG', x, y, qrSize, qrSize);
      pdf.save(`${qrName || "qr-code"}.pdf`);
      toast.success("PDF saved!", { id: toastId });
    } catch (err) {
      toast.error("PDF generation failed.");
      toast.dismiss(toastId);
    }
  };

  // ─── Share — uses the SAME capture as Download for full consistency ──────────
  // Shape masks, template overlays, colors, logo — all preserved.
  const handleShare = async (platform: "whatsapp" | "facebook" | "instagram" | "youtube", subType?: string) => {
    const url  = encodeURIComponent(qrValue);
    const text = encodeURIComponent("Check out my new QR Code!");

    const toastId = toast.loading("Preparing image...");
    let blob: Blob | null = null;

    try {
      const dataUrl = await captureQrImage(3);
      const res = await fetch(dataUrl);
      blob = await res.blob();
    } catch (err) {
      console.error("Preview capture failed, falling back to raw QR", err);
      blob = (await qrCodeInstance.current.getRawData("png")) as Blob | null;
    }

    toast.dismiss(toastId);
    if (!blob) return;

    // 1. Try native Web Share API (shares the full preview image)
    const file = new File([blob], `${qrName || 'qr-code'}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: 'ScanovaX QR Code', text: 'Here is my QR Code!', files: [file] });
        toast.success(`Shared successfully via your device!`);
        return;
      } catch (err: any) {
        console.log("Web Share API closed or failed", err);
      }
    }

    // 2. Platform fallbacks — download the full preview image, then open platform
    const triggerDownload = () => {
      const a = document.createElement('a');
      a.download = `${qrName || 'qr-code'}.png`;
      a.href = URL.createObjectURL(blob!);
      a.click();
    };

    if (['instagram', 'youtube', 'facebook'].includes(platform) && subType) {
      toast.success(`Saving QR for ${platform} ${subType}... Attach it in the app.`);
      triggerDownload();
      navigator.clipboard.writeText(qrValue).catch(() => {});
      setTimeout(() => toast.success("Content copied! Paste it in your post."), 2000);
      return;
    }

    switch (platform) {
      case "whatsapp":
        toast.success("Downloading QR... Attach it in WhatsApp!");
        triggerDownload();
        window.open(`https://api.whatsapp.com/send?text=${text}%20${url}`, "_blank");
        break;
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
        break;
      case "instagram":
      case "youtube":
        navigator.clipboard.writeText(qrValue).catch(() => {});
        toast.success(`Content link copied for ${platform}!`);
        break;
    }
  };


  return (
    <DashboardLayout>
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold mb-2">{editId ? "Edit QR Code" : "QR Generator"}</h1>
              <p className="text-muted-foreground">{editId ? "Modify your existing QR code settings." : "Create, customize, and download your QR code."}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium mb-1">
                {codes.length} / {limits.qrLimit === Infinity ? "Unlimited" : limits.qrLimit} QR Codes
              </p>
              {limits.qrLimit !== Infinity && (
                <div className="w-32 h-1.5 bg-accent rounded-full overflow-hidden ml-auto">
                  <div
                    className={`h-full rounded-full ${isLimitReached ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, (codes.length / limits.qrLimit) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {window.location.hostname === "localhost" && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-amber-600 mb-0.5 text-sm">Working in Localhost</p>
              <p className="text-xs text-amber-600/80 line-clamp-1">Shared QR codes generated here will point to `localhost` and might not work for others. Use the live deployment for sharing.</p>
            </div>
          </motion.div>
        )}

        {isLimitReached && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-8 flex items-center justify-between">
            <div>
              <p className="font-semibold text-destructive mb-1">QR Code Limit Reached</p>
              <p className="text-sm text-destructive/80">You've reached your plan's limit of {limits.qrLimit} QR codes. You cannot save any more until you upgrade.</p>
            </div>
            <Link to="/#pricing" className="bg-destructive text-destructive-foreground px-5 py-2.5 flex items-center gap-2 rounded-lg text-sm font-medium hover:opacity-90 shrink-0">
              Upgrade Plan <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-[1fr_380px] gap-12 border-t border-border pt-8">
          {/* Config Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.1 }}
            className="space-y-8 min-w-0"
          >
            {/* 1. QR Type Carousel */}
            <div>
              <h3 className="label-caps text-muted-foreground mb-3 font-bold flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px]">1</span>
                Select QR Type
              </h3>
              
              <div className="relative group/carousel flex items-center">
                {/* Left Arrow */}
                {showLeftArrow && (
                  <button
                    onClick={() => scrollTypesBy('left')}
                    className="absolute -left-4 z-10 p-1.5 rounded-full bg-background border border-border shadow-md hover:bg-accent text-foreground transition-all flex items-center justify-center"
                    aria-label="Scroll left"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                )}

                {/* Scroll Container */}
                <div 
                  ref={typeScrollRef}
                  onScroll={handleTypeScroll}
                  className="flex overflow-x-auto gap-3 py-1 snap-x relative w-full scrollbar-none scroll-smooth"
                >
                  {qrTypes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveType(t.id);
                        if (["url", "text", "social", "app", "video", "maps", "payments", "review", "meet", "presentation"].includes(t.id)) {
                          setInputValue("");
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all btn-press shrink-0 min-w-[90px] snap-center ${activeType === t.id
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground line-clamp-1"
                        }`}
                    >
                      <t.icon className="w-5 h-5 shrink-0" />
                      <span className="truncate w-full text-center pointer-events-none px-1">{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* Right Arrow */}
                {showRightArrow && (
                  <button
                    onClick={() => scrollTypesBy('right')}
                    className="absolute -right-4 z-10 p-1.5 rounded-full bg-background border border-border shadow-md hover:bg-accent text-foreground transition-all flex items-center justify-center"
                    aria-label="Scroll right"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                )}
              </div>
            </div>

            {/* 2. QR Name */}
            <div>
              <h3 className="label-caps text-muted-foreground mb-3 font-bold flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px]">2</span>
                Name your QR Code
              </h3>
              <input
                type="text"
                value={qrName}
                onChange={(e) => setQrName(e.target.value)}
                placeholder="e.g. Product Launch Campaign"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              />
            </div>

            {/* 3. Dynamic Content Form */}
            <div>
              <h3 className="label-caps text-muted-foreground mb-3 font-bold flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px]">3</span>
                Enter Content
              </h3>

              {["image", "pdf", "resume", "menu"].includes(activeType) && (
                <div className="border border-border rounded-lg p-6 bg-background/50 border-dashed text-center">
                  <input
                    type="file"
                    accept={activeType === "image" ? "image/*" : ".pdf,image/*"}
                    onChange={handleImageUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm font-medium">Click to upload {activeType.toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">Max size 5MB</span>
                  </label>
                  {inputValue.startsWith("http") && (
                    <div className="mt-4 p-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="text-xs text-primary font-medium truncate">File uploaded successfully!</span>
                    </div>
                  )}
                </div>
              )}

              {activeType === "wifi" && (
                <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Network Name (SSID)</label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="My Home WiFi"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Password</label>
                    <input
                      type="password"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Encryption</label>
                    <div className="flex gap-2">
                      {["WPA", "WEP", "nopass"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setWifiEncryption(t)}
                          className={`flex-1 py-1.5 rounded-md border text-[10px] font-bold uppercase transition-all ${wifiEncryption === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                        >
                          {t === "nopass" ? "None" : t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeType === "email" && (
                <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">To</label>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="hello@example.com"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Inquiry about..."
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Message Body</label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Type your message here..."
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                </div>
              )}

              {activeType === "text" && (
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={getPlaceholder()}
                  rows={4}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow resize-none"
                />
              )}

              {["url", "social", "app", "video", "maps", "payments", "review", "meet", "presentation"].includes(activeType) && (
                <input
                  type={activeType === "url" ? "url" : "text"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={getPlaceholder()}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                />
              )}
            </div>

            {/* Customize Button and Modal */}
            <div className="pt-4">
              <Dialog open={isCustomizing} onOpenChange={setIsCustomizing}>
                <DialogTrigger asChild>
                  <button className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all group">
                    <Palette className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-primary">Customize Design / Color / Decorate QR Code</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                       <Palette className="w-6 h-6 text-primary" />
                       Customize Your QR Code
                    </DialogTitle>
                  </DialogHeader>

                  <Tabs defaultValue="dot-style" className="w-full mt-4">
                    <TabsList className="grid grid-cols-3 w-full bg-accent/50 p-1 mb-1">
                      <TabsTrigger value="dot-style" className="text-xs font-bold">Shapes</TabsTrigger>
                      <TabsTrigger value="shapes" className="text-xs font-bold">QR Frame</TabsTrigger>
                      <TabsTrigger value="colors" className="text-xs font-bold">Colors</TabsTrigger>
                    </TabsList>
                    <TabsList className="grid grid-cols-3 w-full bg-accent/50 p-1">
                      <TabsTrigger value="stickers" className="text-xs font-bold">Stickers</TabsTrigger>
                      <TabsTrigger value="pre-designed" className="text-xs font-bold">Pre-designed</TabsTrigger>
                      <TabsTrigger value="extra" className="text-xs font-bold">Extra</TabsTrigger>
                    </TabsList>

                    {/* ── NEW: Shapes tab with 3 sub-controls ── */}
                    <TabsContent value="dot-style" className="mt-4 space-y-6">

                      {/* 1. Body Type */}
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">🔹 Body Type <span className="normal-case font-normal">(QR dot pattern)</span></h4>
                        <div className="grid grid-cols-4 gap-2">
                          {bodyTypes.map((b) => {
                            const sel = bodyType === b.id;
                            const c   = sel ? "hsl(var(--primary))" : "hsl(var(--foreground)/0.4)";
                            const bg2 = sel ? "hsl(var(--primary)/0.08)" : "hsl(var(--accent))";
                            return (
                              <button key={b.id} onClick={() => setBodyType(b.id)}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                                  sel ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-foreground/30"
                                }`}
                              >
                                <svg width="44" height="44" viewBox="0 0 100 100" fill="none">
                                  <rect width="100" height="100" rx="8" fill={bg2} />
                                  {b.preview(c)}
                                </svg>
                                <span className="text-[9px] font-bold text-center leading-tight">{b.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Eye Frame Type */}
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">🔹 Eye Frame <span className="normal-case font-normal">(corner squares)</span></h4>
                        <div className="grid grid-cols-4 gap-2">
                          {eyeFrameTypes.map((ef) => {
                            const sel = eyeFrameType === ef.id;
                            const c   = sel ? "hsl(var(--primary))" : "hsl(var(--foreground)/0.4)";
                            const bg2 = sel ? "hsl(var(--primary)/0.08)" : "hsl(var(--accent))";
                            return (
                              <button key={ef.id} onClick={() => setEyeFrameType(ef.id)}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                                  sel ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-foreground/30"
                                }`}
                              >
                                <svg width="44" height="44" viewBox="0 0 100 100" fill="none">
                                  <rect width="100" height="100" rx="8" fill={bg2} />
                                  {ef.preview(c)}
                                </svg>
                                <span className="text-[9px] font-bold text-center leading-tight">{ef.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Eye Ball Type */}
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">🔹 Eye Ball <span className="normal-case font-normal">(inner corner dot)</span></h4>
                        <div className="grid grid-cols-4 gap-2">
                          {eyeBallTypes.map((eb) => {
                            const sel = eyeBallType === eb.id;
                            const c   = sel ? "hsl(var(--primary))" : "hsl(var(--foreground)/0.4)";
                            const bg2 = sel ? "hsl(var(--primary)/0.08)" : "hsl(var(--accent))";
                            return (
                              <button key={eb.id} onClick={() => setEyeBallType(eb.id)}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                                  sel ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-foreground/30"
                                }`}
                              >
                                <svg width="44" height="44" viewBox="0 0 100 100" fill="none">
                                  <rect width="100" height="100" rx="8" fill={bg2} />
                                  {eb.preview(c)}
                                </svg>
                                <span className="text-[9px] font-bold text-center leading-tight">{eb.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-foreground text-center">Each control is independent — changes update the live preview instantly.</p>
                    </TabsContent>

                    <TabsContent value="extra" className="mt-6">
                       <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Advanced Settings</h4>
                       <div className="space-y-6">
                          <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-background/50 group hover:border-primary/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground">Lead Capture Form</p>
                                <p className="text-[10px] text-muted-foreground">Collect visitor details before redirecting</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setLeadCaptureEnabled(!leadCaptureEnabled)}
                              type="button"
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${leadCaptureEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${leadCaptureEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>

                          <div className="bg-muted/30 p-4 rounded-xl border border-border">
                            <h5 className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Error Correction Level</h5>
                            <div className="grid grid-cols-4 gap-2">
                              {corrections.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setErrorLevel(c)}
                                  className={`py-1.5 rounded-md border text-[10px] font-bold uppercase transition-all ${errorLevel === c ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:bg-accent"}`}
                                >
                                  {c.split(" ")[0]}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                              Higher levels keep QR scannable even if partly damaged or covered. <span className="text-primary font-bold">L=7%, M=15%, Q=25%, H=30%</span>.
                            </p>
                          </div>
                       </div>
                    </TabsContent>

                    {/* ── Existing: QR Frame (outline shape) ── */}
                    <TabsContent value="shapes" className="mt-6">
                       <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">QR Outline Shape</h4>
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {allShapes.map((s) => {
                          const isSelected = selectedShape === s.id;
                          const fill = isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.35)";
                          const bg = isSelected ? "hsl(var(--primary) / 0.08)" : "hsl(var(--accent))";
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelectedShape(s.id)}
                              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-foreground/30"
                              }`}
                            >
                              {s.isPng ? (
                                <div className="w-[52px] h-[52px] bg-accent rounded-lg flex items-center justify-center overflow-hidden">
                                  <img src={s.src} alt={s.label} className="w-10 h-10 object-contain drop-shadow-sm" style={{ filter: isSelected ? 'opacity(1)' : 'opacity(0.6)' }} />
                                </div>
                              ) : (
                                <svg width="52" height="52" viewBox="0 0 100 100" fill="none">
                                  <rect width="100" height="100" rx="8" fill={bg} />
                                  {s.previewCircle && <circle cx="50" cy="50" r="44" fill={fill} />}
                                  {s.previewPoints && <polygon points={s.previewPoints} fill={fill} />}
                                  {s.previewPath   && <path d={s.previewPath}   fill={fill} />}
                                </svg>
                              )}
                              <span className="text-[10px] font-bold text-center leading-tight">{s.label}</span>
                            </button>
                          );
                        })}
                       </div>
                       <p className="text-[10px] text-muted-foreground mt-3 text-center">Changes the outer clip shape. Dots and eyes stay unchanged.</p>

                       <div className="mt-8 bg-accent/30 border border-border p-5 rounded-2xl shadow-sm space-y-6">
                         {/* Group 1: Internal QR Controls */}
                         <div className="space-y-4">
                           <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest border-b border-border/50 pb-2">Internal QR Controls</p>
                           
                           <div>
                             <div className="flex justify-between items-center mb-2">
                               <h4 className="text-sm font-bold text-foreground">Internal QR Scale</h4>
                               <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{Math.round(qrScale * 100)}%</span>
                             </div>
                             <input type="range" min="0.5" max="1.5" step="0.05" value={qrScale} onChange={(e) => setQrScale(parseFloat(e.target.value))} className="w-full accent-primary hover:accent-primary/80 transition-all cursor-pointer h-2 bg-border rounded-lg appearance-none" />
                             <p className="text-[9px] text-muted-foreground mt-1 text-left">Shrinks the QR Code inside</p>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                             <div>
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[11px] font-bold text-muted-foreground uppercase text-left">Internal QR Move ↔</h4>
                                 <span className="text-[10px] font-bold text-muted-foreground">{qrOffsetX > 0 ? `+${qrOffsetX}` : qrOffsetX}%</span>
                               </div>
                               <input type="range" min="-50" max="50" step="1" value={qrOffsetX} onChange={(e) => setQrOffsetX(parseInt(e.target.value))} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                             </div>

                             <div>
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[11px] font-bold text-muted-foreground uppercase text-left">Internal QR Move ↕</h4>
                                 <span className="text-[10px] font-bold text-muted-foreground">{qrOffsetY > 0 ? `+${qrOffsetY}` : qrOffsetY}%</span>
                               </div>
                               <input type="range" min="-50" max="50" step="1" value={qrOffsetY} onChange={(e) => setQrOffsetY(parseInt(e.target.value))} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                             </div>
                           </div>
                         </div>

                         {/* Group 2: Frame / Shape Controls */}
                         <div className="space-y-4 pt-4 border-t border-border/50">
                           <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest border-b border-border/50 pb-2">Frame / Shape Controls</p>
                           
                           <div>
                             <div className="flex justify-between items-center mb-2">
                               <h4 className="text-sm font-bold text-foreground">Frame Scale</h4>
                               <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{Math.round(shapeScale * 100)}%</span>
                             </div>
                             <input type="range" min="0.5" max="1.5" step="0.05" value={shapeScale} onChange={(e) => setShapeScale(parseFloat(e.target.value))} className="w-full accent-primary hover:accent-primary/80 transition-all cursor-pointer h-2 bg-border rounded-lg appearance-none" />
                             <p className="text-[9px] text-muted-foreground mt-1 text-left">Shrinks the entire shape boundary</p>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                             <div>
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[11px] font-bold text-muted-foreground uppercase text-left">Frame Move ↔</h4>
                                 <span className="text-[10px] font-bold text-muted-foreground">{shapeOffsetX > 0 ? `+${shapeOffsetX}` : shapeOffsetX}%</span>
                               </div>
                               <input type="range" min="-50" max="50" step="1" value={shapeOffsetX} onChange={(e) => setShapeOffsetX(parseInt(e.target.value))} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                             </div>

                             <div>
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[11px] font-bold text-muted-foreground uppercase text-left">Frame Move ↕</h4>
                                 <span className="text-[10px] font-bold text-muted-foreground">{shapeOffsetY > 0 ? `+${shapeOffsetY}` : shapeOffsetY}%</span>
                               </div>
                               <input type="range" min="-50" max="50" step="1" value={shapeOffsetY} onChange={(e) => setShapeOffsetY(parseInt(e.target.value))} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                             </div>
                           </div>
                         </div>
                       </div>
                    </TabsContent>

                    <TabsContent value="pre-designed" className="mt-6">
                       <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Visual Templates</h4>
                       {activeTemplate && (
                         <div className="mb-3 flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                           <span className="text-xs font-semibold text-primary flex-1">
                             ✅ Template active: <span className="font-bold">{preDesignTemplates.find(t => t.id === activeTemplate)?.label}</span>
                           </span>
                           <button
                             onClick={() => { setActiveTemplate(null); toast.success("Template removed!"); }}
                             className="flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md text-xs font-bold transition-colors"
                             title="Deselect template"
                           >
                             <X className="w-3 h-3" /> Remove
                           </button>
                         </div>
                       )}
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                         {preDesignTemplates.map((template) => (
                           <div key={template.id} className="relative">
                             <button
                               className={`w-full flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all group ${
                                 activeTemplate === template.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                               }`}
                               onClick={() => {
                                 if (activeTemplate === template.id) {
                                   // clicking same template again = deselect
                                   setActiveTemplate(null);
                                   toast.success("Template removed!");
                                 } else {
                                   setActiveTemplate(template.id);
                                   toast.success(`Applied ${template.label} template!`);
                                 }
                               }}
                             >
                                <div className="w-full aspect-square bg-accent rounded-lg flex items-center justify-center overflow-hidden border border-border/50 group-hover:shadow-sm relative">
                                  <img src={template.src} alt={template.label} className="w-full h-full object-contain" />
                                  {activeTemplate === template.id && (
                                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                      <span className="text-[10px] font-black text-primary bg-white/90 px-1.5 py-0.5 rounded-full shadow">ACTIVE</span>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[11px] font-bold ${activeTemplate === template.id ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`}>{template.label}</span>
                             </button>
                             {/* X close button - only on selected template */}
                             {activeTemplate === template.id && (
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setActiveTemplate(null);
                                   toast.success("Template removed!");
                                 }}
                                 className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-destructive text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 hover:bg-destructive/80 transition-all z-30 border-2 border-background"
                                 title="Remove Template"
                               >
                                 <X className="w-4 h-4" />
                               </button>
                             )}
                           </div>
                         ))}
                       </div>
                       <p className="text-[10px] text-muted-foreground mt-3 text-center">Click a template to apply. Click again or press ✕ to deselect.</p>

                       {/* QR Visual Transform Controls for Templates */}
                       <div className="mt-8 bg-accent/30 border border-border p-5 rounded-2xl shadow-sm space-y-6">
                         {/* Group 1: Internal QR Controls */}
                         <div className="space-y-4">
                           <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest border-b border-border/50 pb-2">Internal QR Controls</p>
                           
                           <div>
                             <div className="flex justify-between items-center mb-2">
                               <h4 className="text-sm font-bold text-foreground">Internal QR Scale</h4>
                               <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{Math.round(qrScale * 100)}%</span>
                             </div>
                             <input type="range" min="0.5" max="1.5" step="0.05" value={qrScale} onChange={(e) => setQrScale(parseFloat(e.target.value))} className="w-full accent-primary hover:accent-primary/80 transition-all cursor-pointer h-2 bg-border rounded-lg appearance-none" />
                             <p className="text-[9px] text-muted-foreground mt-1 text-left">Shrinks the QR Code inside</p>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                             <div>
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[11px] font-bold text-muted-foreground uppercase text-left">Internal QR Move ↔</h4>
                                 <span className="text-[10px] font-bold text-muted-foreground">{qrOffsetX > 0 ? `+${qrOffsetX}` : qrOffsetX}%</span>
                               </div>
                               <input type="range" min="-50" max="50" step="1" value={qrOffsetX} onChange={(e) => setQrOffsetX(parseInt(e.target.value))} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                             </div>

                             <div>
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[11px] font-bold text-muted-foreground uppercase text-left">Internal QR Move ↕</h4>
                                 <span className="text-[10px] font-bold text-muted-foreground">{qrOffsetY > 0 ? `+${qrOffsetY}` : qrOffsetY}%</span>
                               </div>
                               <input type="range" min="-50" max="50" step="1" value={qrOffsetY} onChange={(e) => setQrOffsetY(parseInt(e.target.value))} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                             </div>
                           </div>
                         </div>

                         {/* Group 2: Frame / Shape Controls */}
                         <div className="space-y-4 pt-4 border-t border-border/50">
                           <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest border-b border-border/50 pb-2">Frame / Shape Controls</p>
                           
                           <div>
                             <div className="flex justify-between items-center mb-2">
                               <h4 className="text-sm font-bold text-foreground">Frame Scale</h4>
                               <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{Math.round(shapeScale * 100)}%</span>
                             </div>
                             <input type="range" min="0.5" max="1.5" step="0.05" value={shapeScale} onChange={(e) => setShapeScale(parseFloat(e.target.value))} className="w-full accent-primary hover:accent-primary/80 transition-all cursor-pointer h-2 bg-border rounded-lg appearance-none" />
                             <p className="text-[9px] text-muted-foreground mt-1 text-left">Shrinks the entire shape boundary</p>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                             <div>
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[11px] font-bold text-muted-foreground uppercase text-left">Frame Move ↔</h4>
                                 <span className="text-[10px] font-bold text-muted-foreground">{shapeOffsetX > 0 ? `+${shapeOffsetX}` : shapeOffsetX}%</span>
                               </div>
                               <input type="range" min="-50" max="50" step="1" value={shapeOffsetX} onChange={(e) => setShapeOffsetX(parseInt(e.target.value))} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                             </div>

                             <div>
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[11px] font-bold text-muted-foreground uppercase text-left">Frame Move ↕</h4>
                                 <span className="text-[10px] font-bold text-muted-foreground">{shapeOffsetY > 0 ? `+${shapeOffsetY}` : shapeOffsetY}%</span>
                               </div>
                               <input type="range" min="-50" max="50" step="1" value={shapeOffsetY} onChange={(e) => setShapeOffsetY(parseInt(e.target.value))} className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer" />
                             </div>
                           </div>
                         </div>
                       </div>
                    </TabsContent>

                    <TabsContent value="stickers" className="mt-6">
                       <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Logo & Stickers</h4>
                       <div className="space-y-6">
                          <div>
                            <p className="text-xs font-bold text-muted-foreground mb-2">Upload Custom Logo</p>
                            <label className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors cursor-pointer block">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const url = URL.createObjectURL(e.target.files[0]);
                                    setLogoFile(url);
                                  }
                                }}
                              />
                              <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                              <p className="text-xs font-bold text-muted-foreground">Drop Image Here</p>
                            </label>
                            {logoFile && (
                              <button onClick={() => setLogoFile(undefined)} className="text-[10px] font-bold text-destructive hover:underline mt-2">
                                Remove Logo
                              </button>
                            )}
                          </div>
                       </div>
                    </TabsContent>

                    <TabsContent value="colors" className="mt-6">
                       <div className="space-y-6">

                         {/* Foreground Color Mode Toggle */}
                         <div>
                           <h5 className="text-[10px] font-bold text-muted-foreground uppercase mb-3">QR Body Color</h5>
                           {/* Mode selection buttons */}
                           <div className="flex gap-2 mb-4 p-1 bg-accent/50 rounded-lg">
                             <button
                               onClick={() => setColorMode("single")}
                               className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                                 colorMode === "single"
                                   ? "bg-background border border-border shadow-sm text-foreground"
                                   : "text-muted-foreground hover:text-foreground"
                               }`}
                             >
                               🎨 Single Color
                             </button>
                             <button
                               onClick={() => setColorMode("gradient")}
                               className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                                 colorMode === "gradient"
                                   ? "bg-background border border-border shadow-sm text-foreground"
                                   : "text-muted-foreground hover:text-foreground"
                               }`}
                             >
                               🌈 Gradient
                             </button>
                           </div>

                           {/* Single Color Mode */}
                           {colorMode === "single" && (
                             <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-background">
                               <input
                                 type="color"
                                 value={fgColor}
                                 onChange={(e) => setFgColor(e.target.value)}
                                 className="w-10 h-10 rounded-lg cursor-pointer border-none"
                               />
                               <div>
                                 <span className="text-xs font-bold block">{fgColor}</span>
                                 <span className="text-[10px] text-muted-foreground">Solid QR Color</span>
                               </div>
                             </div>
                           )}

                           {/* Gradient Mode */}
                           {colorMode === "gradient" && (
                             <div className="space-y-4">
                               {/* Preset gradients */}
                               <div>
                                 <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase">Presets</p>
                                 <div className="grid grid-cols-3 gap-2">
                                   {gradientPresets.map((preset) => (
                                     <button
                                       key={preset.label}
                                       onClick={() => { setGradientColor1(preset.c1); setGradientColor2(preset.c2); }}
                                       className={`h-9 rounded-lg border-2 transition-all ${
                                         gradientColor1 === preset.c1 && gradientColor2 === preset.c2
                                           ? "border-primary ring-2 ring-primary/30"
                                           : "border-transparent hover:border-foreground/20"
                                       }`}
                                       style={{ background: `linear-gradient(135deg, ${preset.c1}, ${preset.c2})` }}
                                       title={preset.label}
                                     />
                                   ))}
                                 </div>
                               </div>
                               {/* Custom gradient color pickers */}
                               <div className="grid grid-cols-2 gap-3">
                                 <div className="flex items-center gap-2 p-3 border border-border rounded-xl bg-background">
                                   <input
                                     type="color"
                                     value={gradientColor1}
                                     onChange={(e) => setGradientColor1(e.target.value)}
                                     className="w-8 h-8 rounded cursor-pointer border-none shrink-0"
                                   />
                                   <div>
                                     <span className="text-[10px] font-bold block">{gradientColor1}</span>
                                     <span className="text-[10px] text-muted-foreground">Start</span>
                                   </div>
                                 </div>
                                 <div className="flex items-center gap-2 p-3 border border-border rounded-xl bg-background">
                                   <input
                                     type="color"
                                     value={gradientColor2}
                                     onChange={(e) => setGradientColor2(e.target.value)}
                                     className="w-8 h-8 rounded cursor-pointer border-none shrink-0"
                                   />
                                   <div>
                                     <span className="text-[10px] font-bold block">{gradientColor2}</span>
                                     <span className="text-[10px] text-muted-foreground">End</span>
                                   </div>
                                 </div>
                               </div>
                               {/* Angle slider */}
                               <div>
                                 <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                                   Angle: {gradientAngle}°
                                 </label>
                                 <input
                                   type="range"
                                   min="0"
                                   max="360"
                                   value={gradientAngle}
                                   onChange={(e) => setGradientAngle(Number(e.target.value))}
                                   className="w-full accent-primary"
                                 />
                               </div>
                               {/* Live gradient preview bar */}
                               <div
                                 className="h-6 rounded-lg border border-border"
                                 style={{ background: `linear-gradient(${gradientAngle}deg, ${gradientColor1}, ${gradientColor2})` }}
                               />
                             </div>
                           )}
                         </div>

                         {/* Background Color — always a single solid color */}
                         <div>
                           <h5 className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Background Color</h5>
                           <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-background">
                             <input
                               type="color"
                               value={bgColor}
                               onChange={(e) => setBgColor(e.target.value)}
                               className="w-10 h-10 rounded-lg cursor-pointer border-none"
                             />
                             <div>
                               <span className="text-xs font-bold block">{bgColor}</span>
                               <span className="text-[10px] text-muted-foreground">QR Background</span>
                             </div>
                           </div>
                         </div>

                       </div>
                    </TabsContent>

                    <TabsContent value="extra" className="mt-6">
                       <div className="grid grid-cols-2 gap-8">
                          <div>
                            <h4 className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-wider">Frames</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {frames.map((f) => (
                                <button key={f} onClick={() => setSelectedFrame(f)}
                                  className={`px-3 py-2 rounded-lg border text-[10px] font-bold transition-all ${selectedFrame === f ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>{f}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-wider">Correction</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {corrections.map((c) => (
                                <button key={c} onClick={() => setErrorLevel(c)}
                                  className={`px-3 py-2 rounded-lg border text-[10px] font-bold transition-all ${errorLevel === c ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>{c}</button>
                              ))}
                            </div>
                          </div>
                       </div>
                    </TabsContent>
                  </Tabs>

                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={() => setIsCustomizing(false)}
                      className="bg-primary text-primary-foreground px-8 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                    >
                      Apply Customization
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </motion.div>

          {/* Live Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.2 }}
            className="lg:sticky lg:top-24 h-fit"
          >
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              <p className="label-caps text-muted-foreground mb-4">Live Preview</p>

              <div
                ref={previewCaptureRef}
                className="qr-preview flex flex-col items-center justify-center p-2 rounded-xl border border-border mb-6"
                style={{ backgroundColor: (limits.customization !== "none" && !activeTemplate) ? bgColor : "#ffffff" }}
              >
                {selectedFrame !== "None" && !activeTemplate && (
                  <p className="text-xs font-medium mb-3" style={{ color: limits.customization !== "none" ? fgColor : "#0f172a" }}>
                    {selectedFrame === "Scan Me" ? "📱 Scan Me" : selectedFrame === "Point Here" ? "👆 Point Here" : "🔗 Follow Us"}
                  </p>
                )}
                  {/* Hidden SVG clip-path definitions */}
                  <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden="true">
                    <defs>
                      <clipPath id="qr-clip-diamond" clipPathUnits="objectBoundingBox">
                        <polygon points="0.5,0 1,0.5 0.5,1 0,0.5" />
                      </clipPath>
                      <clipPath id="qr-clip-heart" clipPathUnits="objectBoundingBox">
                        <path d="M0.5,0.80 C0.15,0.60 0.05,0.42 0.05,0.30 C0.05,0.17 0.14,0.08 0.26,0.08 C0.36,0.08 0.45,0.16 0.5,0.22 C0.55,0.16 0.64,0.08 0.74,0.08 C0.86,0.08 0.95,0.17 0.95,0.30 C0.95,0.42 0.85,0.60 0.5,0.80 Z" />
                      </clipPath>
                      <clipPath id="qr-clip-star" clipPathUnits="objectBoundingBox">
                        <polygon points="0.5,0.05 0.61,0.35 0.95,0.35 0.68,0.57 0.79,0.91 0.5,0.70 0.21,0.91 0.32,0.57 0.05,0.35 0.39,0.35" />
                      </clipPath>
                      <clipPath id="qr-clip-pentagon" clipPathUnits="objectBoundingBox">
                        <polygon points="0.5,0.05 0.95,0.38 0.78,0.95 0.22,0.95 0.05,0.38" />
                      </clipPath>
                      <clipPath id="qr-clip-hexagon" clipPathUnits="objectBoundingBox">
                        <polygon points="0.5,0.05 0.93,0.275 0.93,0.725 0.5,0.95 0.07,0.725 0.07,0.275" />
                      </clipPath>
                    </defs>
                  </svg>

                <div className="mb-4 w-full flex items-center justify-center p-2 bg-white rounded-xl shadow-sm border border-border/50">
                  {/* ── QR Visual export target — Download & Share capture strictly this inner div ── */}
                  <div
                    ref={qrExportRef}
                    className="w-full relative flex items-center justify-center"
                  >
                    {(() => {
                      const shapeDef = allShapes.find(s => s.id === selectedShape) || allShapes[0];
                    const isSquare = selectedShape === "Square";
                    const templateDef = preDesignTemplates.find(t => t.id === activeTemplate);
                    
                    // Unified Safe Zone Logic (MIS - Maximum Inscribed Square)
                    const safeZone = shapeDef.safeZone || { cx: 0.5, cy: 0.5, size: 0.85 };
                    
                    const cBg = limits.customization !== 'none' ? bgColor : '#ffffff';
                    const cFg = colorMode === "gradient" ? gradientColor1 : (limits.customization !== "none" ? fgColor : "#0f172a");
                    const activeBgDot = bodyTypes.find(b => b.id === (limits.customization !== "none" ? bodyType : "square")) || bodyTypes[0];
                    
                    // Gap Infilling (Decorative Background Grid)
                    const GRID_SIZE = 25; // Higher resolution for gap infilling
                    const dummyGrid = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => Math.random() > 0.05 ? 1 : 0);
                    const patternSize = 100 / GRID_SIZE;

                    const actualSrc = solidProcessedMasks[selectedShape] || shapeDef?.src;
                    const combinedMask = (shapeDef?.isPng && actualSrc && !isSquare) ? `url("${actualSrc}")` : undefined;

                    const finalQrSize = safeZone.size * 0.82 * qrScale; 

                    const outerStyle: React.CSSProperties = {
                      maskImage: combinedMask,
                      maskSize: '100% 100%',
                      maskPosition: 'center',
                      maskRepeat: 'no-repeat',
                      WebkitMaskImage: combinedMask,
                      WebkitMaskSize: '100% 100%',
                      WebkitMaskPosition: 'center',
                      WebkitMaskRepeat: 'no-repeat',
                      clipPath: shapeDef?.clip,
                      borderRadius: shapeDef?.radius,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: cBg, // Always apply chosen BG to shape
                      position: 'relative',
                      width: '100%',
                      height: '100%'
                    };

                    const qrPosStyle: React.CSSProperties = {
                      position: 'absolute',
                      left: `${(safeZone.cx - finalQrSize / 2) * 100 + qrOffsetX}%`,
                      top:  `${(safeZone.cy - finalQrSize / 2) * 100 + qrOffsetY}%`,
                      width: `${finalQrSize * 100}%`,
                      height: `${finalQrSize * 100}%`,
                      zIndex: 10,
                      boxSizing: 'border-box',
                    };

                    // The actual layered QR structure with mask, gap fill, and QR data
                    const renderedQrContent = (
                      <div style={{...outerStyle, transform: `translate(${shapeOffsetX}%, ${shapeOffsetY}%) scale(${shapeScale})`, transformOrigin: "center"}}>
                        {shapeDef && !isSquare && (
                          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                            <defs>
                              <pattern id={`gap-fill-${activeBgDot?.id}`} width={`${patternSize}%`} height={`${patternSize}%`} patternUnits="userSpaceOnUse" viewBox="0 0 100 100">
                                <g transform="scale(1.1)">
                                  {activeBgDot?.preview(cFg)}
                                </g>
                              </pattern>
                              <mask id="safe-zone-punch">
                                <rect width="100%" height="100%" fill="white" />
                                <rect
                                  x={`${(safeZone.cx - safeZone.size / 2) * 100}%`}
                                  y={`${(safeZone.cy - safeZone.size / 2) * 100}%`}
                                  width={`${safeZone.size * 100}%`}
                                  height={`${safeZone.size * 100}%`}
                                  fill="black"
                                />
                              </mask>
                            </defs>
                            <rect width="100%" height="100%" fill={`url(#gap-fill-${activeBgDot?.id})`} mask="url(#safe-zone-punch)" />
                          </svg>
                        )}
                        <div style={qrPosStyle}>
                          <div ref={qrRef} className="w-full h-full" />
                        </div>
                      </div>
                    );

                    // ─── Template Mode (Styling Layer placed inside Template Boundaries) ───
                    if (templateDef) {
                      const wb = (templateDef as any).whitebox as { left: number; right: number; top: number; bottom: number };

                      const hSpan = wb.right  - wb.left;
                      const vSpan = wb.bottom - wb.top;
                      const shapeContainerSide = Math.min(hSpan, vSpan) * 0.96; // 96% fit within white-box

                      const wbCx  = (wb.left + wb.right)  / 2;
                      const wbCy  = (wb.top  + wb.bottom) / 2;
                      
                      const shapeLeft = (wbCx - shapeContainerSide / 2) * 100;
                      const shapeTop  = (wbCy - shapeContainerSide / 2) * 100;
                      const shapeWidth = shapeContainerSide * 100;
                      const shapeHeight = shapeContainerSide * 100;

                      return (
                        <div
                          className="mx-auto relative shadow-lg"
                          style={{
                            width: '100%',
                            maxWidth: '340px',
                            aspectRatio: '440 / 535',
                            backgroundImage: `url(${templateDef.src})`,
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: `${shapeLeft}%`,
                              top: `${shapeTop}%`,
                              width: `${shapeWidth}%`,
                              height: `${shapeHeight}%`,
                              zIndex: 10,
                            }}
                          >
                            {renderedQrContent}
                          </div>
                        </div>
                      );
                    }

                    // ─── Normal / Shape Mode ────────────────────────────────────────────────
                    return (
                      <div className="max-w-[460px] mx-auto w-full aspect-square relative flex items-center justify-center">
                        {renderedQrContent}
                      </div>
                    );
                  })()}
                  </div>
                </div>
                <div className="w-full text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Target Content</p>
                  <p className="text-xs font-mono text-foreground/70 truncate px-4">
                    {inputValue || "Empty"}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center justify-center gap-2 bg-foreground text-background px-5 py-3 rounded-lg text-sm font-medium hover:opacity-90 btn-press">
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="center">
                    <DropdownMenuItem onClick={handleDownloadPNG}>
                      Download PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDownloadSVG}
                      disabled={!limits.exports.includes("svg")}
                    >
                      Download SVG {!limits.exports.includes("svg") && <Lock className="w-3 h-3 ml-auto" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDownloadPDF}
                      disabled={!limits.exports.includes("svg")}
                    >
                      Download PDF {!limits.exports.includes("svg") && <Lock className="w-3 h-3 ml-auto" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center justify-center gap-2 border border-border px-5 py-3 rounded-lg text-sm font-medium hover:bg-accent transition-colors btn-press">
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="center">

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>WhatsApp</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleShare("whatsapp", "Chat")}>Chat</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare("whatsapp", "Status")}>Status</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Instagram</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleShare("instagram", "Post")}>Post</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare("instagram", "Story")}>Story</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare("instagram", "Reel")}>Reel</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Facebook</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleShare("facebook", "Post")}>Post</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare("facebook", "Story")}>Story</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare("facebook", "Reel")}>Reel</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>YouTube</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleShare("youtube", "Post")}>Post</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare("youtube", "Shorts")}>Shorts</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>

                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  onClick={handleSave}
                  disabled={isCreating || !inputValue || isLimitReached}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-medium hover:opacity-90 btn-press disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : <Save className="w-4 h-4" />}
                  {editId ? (isCreating ? "Updating…" : "Update QR Code") : (isLimitReached ? "Limit Reached" : isCreating ? "Saving…" : "Save QR Code")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
