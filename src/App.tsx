import React, { FC, useState, useEffect, useRef } from "react";
import * as pdfjs from "pdfjs-dist";
import {
  Home,
  FileText,
  Scale,
  Map as MapIcon,
  Bell,
  AlertCircle,
  AlertTriangle,
  Zap,
  CloudSun,
  Bug,
  BookOpen,
  Navigation,
  Lock,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  User,
  ShieldCheck,
  ShieldAlert,
  Target,
  FileSearch,
  CheckSquare,
  Droplets,
  Wind,
  Bird,
  Gavel,
  Compass,
  Settings,
  Plus,
  Loader2,
  MousePointer2,
  Trash2,
  Eye,
  LogIn,
  Check,
  Search,
  LayoutDashboard,
  Calendar,
  Save,
  Send,
  MoreHorizontal,
  History,
  Info,
  Download,
  Upload,
  Clock,
  ExternalLink,
  Unlock,
  Edit,
  Link2,
  Lightbulb,
  MessageSquarePlus,
  FileDown,
  Ban,
  Pill,
  Database,
  Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, storage } from "./firebase";

// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously,
  GoogleAuthProvider,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocFromServer,
  doc,
  Timestamp,
  deleteDoc,
  setDoc,
  getDoc,
  limit,
  getDocs,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  uploadBytesResumable,
  uploadString,
} from "firebase/storage";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// --- Utilities ---
const compressImage = (
  base64Str: string,
  maxWidth = 800,
  maxHeight = 600,
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const openPDFSafely = (pdfUrl: string) => {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  // Tenta abrir em nova aba primeiro (melhor para não perder o estado do app)
  const win = window.open(pdfUrl, "_blank");

  if (!win || win.closed || typeof win.closed === "undefined") {
    // Se o popup for bloqueado ou se estivermos no iOS e o window.open falhar
    if (isIOS) {
      // No iOS, se window.open falhar, usamos o redirecionamento
      // Mas avisamos ou atrasamos levemente para permitir processos em background
      setTimeout(() => {
        window.location.href = pdfUrl;
      }, 500);
    } else {
      // Fallback para outros dispositivos
      window.location.href = pdfUrl;
    }
  }
};

const openBase64InNewTab = (base64Data: string) => {
  try {
    const parts = base64Data.split(",");
    if (parts.length < 2) return;
    const contentType = parts[0].split(":")[1].split(";")[0];
    const byteCharacters = atob(parts[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    const url = URL.createObjectURL(blob);
    openPDFSafely(url);
  } catch (e) {
    console.error("Erro ao abrir anexo:", e);
    // Fallback: tenta abrir diretamente se for seguro ou avisa
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${base64Data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`,
      );
    }
  }
};

// --- Error Handling ---
enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));

  // Mostrar alerta amigável antes de disparar erro técnico
  if (
    errorMessage.includes("Insufficient permissions") ||
    errorMessage.includes("permission-denied")
  ) {
    alert(
      "Erro de Permissão: Você não tem autorização para realizar esta operação no momento.",
    );
  } else if (errorMessage.includes("offline")) {
    alert(
      "Erro de Conexão: O sistema parece estar offline. Verifique sua internet.",
    );
  } else if (!errorMessage.startsWith("{")) {
    alert(`Erro no Sistema: ${errorMessage}`);
  }

  throw new Error(JSON.stringify(errInfo));
}

const extractLaunchNum = (item: any) => {
  if (item.numLancamento && item.numLancamento !== "S/N") return item.numLancamento;
  if (item.num && item.num !== "S/N") return item.num;
  
  const searchFields = [item.missao, item.mv, item.motivo, item.desc];
  const lcRegex = /L[ÇC]\s*(\d+)/i;
  const standaloneNumRegex = /(?:^|\s|\n)(\d{1,3})(?:\s|\n|$)/;
  
  for (const field of searchFields) {
    if (typeof field === 'string') {
      const match = field.match(lcRegex);
      if (match) return match[1];
      
      const numMatch = field.match(standaloneNumRegex);
      if (numMatch) return numMatch[1];
    }
  }
  return "S/N";
};

const getFgrLaunchNums = (f: any, launches: any[]) => {
  // 1. Linked launches priority
  const linkedLaunches = launches.filter(l => l.linkedFgrId === f.id);
  if (linkedLaunches.length > 0) {
    const nums = linkedLaunches.map(l => extractLaunchNum(l)).filter(n => n !== "S/N");
    if (nums.length > 0) {
      return Array.from(new Set(nums)).sort((a,b) => parseInt(a) - parseInt(b)).join(", ");
    }
  }
  
  // 2. PDV Matching logic (Date + String matching)
  const normalizeToDMY = (dateStr: string) => {
    if (!dateStr) return "";
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`; // YYYY-MM-DD to DD/MM/YYYY
      return `${parts[0]}/${parts[1]}/${parts[2]}`; // DD-MM-YYYY to DD/MM/YYYY
    }
    return dateStr;
  };
  
  const targetDateDMY = normalizeToDMY(f.data);
  const matchedLaunches = launches.filter(l => {
     const lDateDMY = normalizeToDMY(l.dateLabel);
     return lDateDMY === targetDateDMY && (
       f.missao?.includes(`LÇ ${l.num}`) || 
       f.missao?.includes(`LANC ${l.num}`) || 
       (l.num && f.missao?.includes(l.num))
     );
  });
  
  if (matchedLaunches.length > 0) {
    const nums = matchedLaunches.map(l => extractLaunchNum(l)).filter(n => n !== "S/N");
    if (nums.length > 0) {
      return Array.from(new Set(nums)).sort((a,b) => parseInt(a) - parseInt(b)).join(", ");
    }
  }

  // 3. Direct extraction
  return extractLaunchNum(f);
};

// --- Admin Helpers ---
const ABASTECIMENTO_DATA = [
  {
    estado: "ACRE",
    locais: [
      {
        icao: "SBCZ",
        local: "Cruzeiro do sul",
        br: "BR",
        contato: "(68) 3322-5615/(92) 99388-2821",
        horario: "6-18h",
      },
      {
        icao: "SBRB",
        local: "Rio Branco",
        br: "BR",
        contato: "(68) 3211-1095/(68) 99995-1511",
        horario: "H24",
      },
    ],
  },
  {
    estado: "ALAGOAS",
    locais: [
      {
        icao: "SBMO",
        local: "Maceió (Zumbi dos Palmares)",
        br: "BR",
        contato: "(82) 3332-6110/(82) 99991-8144",
        horario: "H24",
      },
    ],
  },
  {
    estado: "AMAPÁ",
    locais: [
      {
        icao: "SBMQ",
        local: "Macapá",
        br: "BR",
        contato: "(96) 3223-4493/(96) 98137- 6371",
        horario: "H24",
      },
    ],
  },
  {
    estado: "AMAZONAS",
    locais: [
      {
        icao: "SBUY",
        local: "Coari (URUCU)",
        br: "BR",
        contato: "(92) 3616-6546/(92) 99231-2803",
        horario: "6:30-18:30h",
      },
      {
        icao: "SBEG",
        local: "Manaus (Eduardo Gomes)",
        br: "BR",
        contato: "(92) 3652-1628/(92) 98143-1288",
        horario: "H24",
      },
      {
        icao: "SBMN",
        local: "Manaus (Ponta Pelada)",
        br: "BR",
        contato: "(92) 3629-3074/(92)99116-1980",
        horario: "H24",
      },
      {
        icao: "SWFN",
        local: "Manaus (Flores)",
        br: "BR",
        contato: "(92) 3653-0082/(92) 99401-2196",
        horario: "6-17:30h",
      },
      {
        icao: "SBUA",
        local: "São Gabriel da Cachoeira",
        br: "BR",
        contato: "(97) 99183-0766/(97) 3471-1343",
        horario: "8-19h",
      },
      {
        icao: "SBTT",
        local: "Tabatinga",
        br: "BR",
        contato: "(97) 3412-2372/(97) 98407 0983",
        horario: "7-17h",
      },
      {
        icao: "SBTF",
        local: "Tefé",
        br: "BR",
        contato: "(92) 99359-6132/(97) 3343-9501",
        horario: "6-18h",
      },
    ],
  },
  {
    estado: "BAHIA",
    locais: [
      {
        icao: "SBIL",
        local: "Ilhéus * (não pertence mais à VIBRA)",
        br: "BR",
        contato: "NOTAS ABAIXO",
        horario: "COORD.",
      },
      {
        icao: "SBPS",
        local: "Porto Seguro",
        br: "BR",
        contato: "(73) 3288-2788 (73) 98203-7667",
        horario: "H24",
      },
      {
        icao: "SBSV",
        local: "Salvador",
        br: "BR",
        contato: "(71) 98106-5216/(71) 3204-1135",
        horario: "H24",
      },
      {
        icao: "SBTC",
        local: "Una/Comandatuba",
        br: "BR",
        contato: "(73) 3236-6017/(73) 99956-2040",
        horario: "9-17h",
      },
      {
        icao: "SBVC",
        local: "Vitória da Conquista",
        br: "BR",
        contato: "(77) 98125-3003/(77) 99193-4588",
        horario: "H24",
      },
    ],
  },
  {
    estado: "CEARÁ",
    locais: [
      {
        icao: "SBFZ",
        local: "Fortaleza (Pinto Martins)",
        br: "BR",
        contato: "(85) 99147-8620 (85) 98736-4150",
        horario: "H24",
      },
      {
        icao: "SBJU",
        local: "Juazeiro do Norte",
        br: "BR",
        contato: "(88) 3511-5385/(85) 8813-7669",
        horario: "H24",
      },
      {
        icao: "SBJE",
        local: "Jericoacara (Ariston Pessoa)",
        br: "BR",
        contato: "(82) 99961-4115 (88) 98141-1391",
        horario: "8-17",
      },
    ],
  },
  {
    estado: "DISTRITO FEDERAL",
    locais: [
      {
        icao: "SBBR",
        local: "Brasília",
        br: "BR",
        contato: "(61) 3365-1290/(61) 99825-1411",
        horario: "H24",
      },
    ],
  },
  {
    estado: "ESPÍRITO SANTO",
    locais: [
      {
        icao: "SBVT",
        local: "Vitória",
        br: "BR",
        contato: "(27) 99892-3427 (27) 99941-4820",
        horario: "H24",
      },
    ],
  },
  {
    estado: "GOIÁS",
    locais: [
      {
        icao: "SBAN",
        local: "Anápolis",
        br: "BR",
        contato: "(62) 3329-7803/(62) 3329-7803",
        horario: "H24",
      },
      {
        icao: "SBCN",
        local: "Caldas Novas",
        br: "BR",
        contato: "(64) 3453-2671/(62) 99370-6975",
        horario: "7-19h",
      },
      {
        icao: "SBGO",
        local: "Goiânia (Santa Genoveva)",
        br: "BR",
        contato: "(62) 3942-4004/(62) 99679-7718",
        horario: "H24",
      },
    ],
  },
  {
    estado: "MARANHÃO",
    locais: [
      {
        icao: "SBSL",
        local: "São Luiz (Mal. Cunha Machado)",
        br: "BR",
        contato: "(98) 3221-7366 (98) 98121-9724",
        horario: "H24",
      },
    ],
  },
  {
    estado: "MATO GROSSO",
    locais: [
      {
        icao: "SBAT",
        local: "Alta Floresta",
        br: "BR",
        contato: "(66) 3521-5556/(66) 98114-3004",
        horario: "6-180h",
      },
      {
        icao: "SBCY",
        local: "Cuiabá (Mal. Rondon)",
        br: "BR",
        contato: "(65) 3682-3445/(65) 99216-0442",
        horario: "H24",
      },
      {
        icao: "SWSI",
        local: "Sinop",
        br: "BR",
        contato: "(66) 98114-3006 (66) 99657-5804",
        horario: "6-18h",
      },
    ],
  },
  {
    estado: "MATO GROSSO DO SUL",
    locais: [
      {
        icao: "SBDB",
        local: "Bonito",
        br: "BR",
        contato: "(67) 3255-4303/(67) 99823-1977",
        horario: "07:30-17:30",
      },
      {
        icao: "SBCG",
        local: "Campo Grande",
        br: "BR",
        contato: "(67) 3363-6383/(67) 99958-6620",
        horario: "H24",
      },
      {
        icao: "SBCR",
        local: "Corumbá",
        br: "BR",
        contato: "(67) 3232-5615/(67) 99612-0431",
        horario: "6-18h",
      },
      {
        icao: "SBDO",
        local: "Dourados",
        br: "JR",
        contato: "(67) 3427-1230/(67)99833-6325",
        horario: "24h",
      },
      {
        icao: "SBTG",
        local: "Três Lagoas",
        br: "BR",
        contato: "(67) 3522-3523/(67) 99823-9523",
        horario: "07:30-17:30",
      },
    ],
  },
  {
    estado: "MINAS GERAIS",
    locais: [
      {
        icao: "SBBH",
        local: "Belo Horizonte (Pampulha)",
        br: "BR",
        contato: "(31) 3441-3477/(31) 99950-1783",
        horario: "H24",
      },
      {
        icao: "SBCF",
        local: "Confins",
        br: "BR",
        contato: "(31) 3689-2111/(31)97322-0555",
        horario: "H24",
      },
      {
        icao: "SBZM",
        local: "Goianá (Zona da Mata)",
        br: "BR",
        contato: "(32) 9921-2229/(32) 99918-5570",
        horario: "8-22",
      },
      {
        icao: "SBMK",
        local: "Montes Claros",
        br: "BR",
        contato: "(38) 3215-3062/(38) 99192-7208",
        horario: "5-22h",
      },
      {
        icao: "SBUR",
        local: "Uberaba",
        br: "BR",
        contato: "(34) 3336-1677/(34) 99971-1013",
        horario: "04-21",
      },
      {
        icao: "SBUL",
        local: "Uberlândia",
        br: "BR",
        contato: "(34) 3212-5064/(34) 99811-7655",
        horario: "H24",
      },
    ],
  },
  {
    estado: "PARÁ",
    locais: [
      {
        icao: "SBHT",
        local: "Altamira",
        br: "BR",
        contato: "(93) 99228-2900/(93) 99142-3791",
        horario: "06:45-18:45",
      },
      {
        icao: "SBBE",
        local: "Belém (Val de Cans)",
        br: "BR",
        contato: "(91) 99994-6967/(91) 98733-2544",
        horario: "H24",
      },
      {
        icao: "SBIH",
        local: "Itaituba",
        br: "BR",
        contato: "(93) 99119-9327/(93) 98114-0579",
        horario: "6:30-18:30h",
      },
      {
        icao: "SBMA",
        local: "Marabá",
        br: "BR",
        contato: "(94) 3324-1349/(94) 99186-5602",
        horario: "3-19",
      },
      {
        icao: "SBCJ",
        local: "Parauapebas (Carajás)",
        br: "BR",
        contato: "(94) 3346-1480/(94) 98410-1000",
        horario: "8-18h",
      },
      {
        icao: "SBSN",
        local: "Santarém",
        br: "BR",
        contato: "(93) 3522-2033/(93) 99975-1347",
        horario: "H24",
      },
    ],
  },
  {
    estado: "PARANÁ",
    locais: [
      {
        icao: "SBMG",
        local: "Maringá",
        br: "BR",
        contato: "(44) 3024-5381/(44) 99739-0600",
        horario: "5-21:20",
      },
      {
        icao: "SBLO",
        local: "Londrina",
        br: "BR",
        contato: "(43) 3326-1334/(43) 99935-0366",
        horario: "4-22h",
      },
      {
        icao: "SBFI",
        local: "Foz Iguaçu (Cataratas)",
        br: "BR",
        contato: "(45)3523-7010/(45) 99148-8591",
        horario: "6-00:20",
      },
      {
        icao: "SBBI",
        local: "Curitiba (Bacacheri)",
        br: "BR",
        contato: "(41) 3357-9970/(41) 99768-4489",
        horario: "05-22h",
      },
      {
        icao: "SBPG",
        local: "Ponta Grossa",
        br: "BR",
        contato: "(41) 3381-1839/(41) 99965-1594",
        horario: "7-19h",
      },
      {
        icao: "SBCT",
        local: "Curitiba (Afonso Pena)",
        br: "BR",
        contato: "(41)3381-1838/(41) 3381-1839",
        horario: "H24",
      },
    ],
  },
  {
    estado: "PERNAMBUCO",
    locais: [
      {
        icao: "SBPL",
        local: "Petrolina",
        br: "BR",
        contato: "(87) 3863-5100/(87) 99922-2821",
        horario: "H24",
      },
      {
        icao: "SBRF",
        local: "Recife (Guararapes)",
        br: "BR",
        contato: "(81) 3461-4545/(81) 99961-3041",
        horario: "H24",
      },
    ],
  },
  {
    estado: "RIO DE JANEIRO",
    locais: [
      {
        icao: "SBES",
        local: "São Pedro d`Aldeia",
        br: "Marinha",
        contato: "(22) 2621-4030",
        horario: "",
      },
      {
        icao: "SBME",
        local: "Macaé",
        br: "BR",
        contato: "(22) 2762-1602/(22) 99870-4031",
        horario: "6-22h",
      },
      {
        icao: "SBGL",
        local: "Galeão",
        br: "BR",
        contato: "(21) 3398-3570/(21) 3383-6868",
        horario: "H24",
      },
      {
        icao: "SBRJ",
        local: "Santos Dumont",
        br: "BR",
        contato: "(21) 3814-7437/(21) 980315911",
        horario: "H24",
      },
      {
        icao: "SBJR",
        local: "Jacarepaguá",
        br: "BR",
        contato: "(21) 99406-0235/(21) 97009-7311",
        horario: "H24",
      },
      {
        icao: "SBSC",
        local: "Santa Cruz",
        br: "BR",
        contato: "(21) 3395 4178/(21) 3401-8196",
        horario: "H24",
      },
    ],
  },
  {
    estado: "RIO GRANDE DO NORTE",
    locais: [
      {
        icao: "SBSG",
        local: "São Gonçalo do Amarante",
        br: "BR",
        contato: "(84) 99641-7887/(84) 3343-6376",
        horario: "H24",
      },
    ],
  },
  {
    estado: "RIO GRANDE DO SUL",
    locais: [
      {
        icao: "SBCX",
        local: "Caxias do Sul",
        br: "BR",
        contato: "(54) 3213-5072/(54) 99683-3533",
        horario: "7-19h",
      },
      {
        icao: "SBCO",
        local: "Base Aérea de Canoas",
        br: "BR",
        contato: "(51)99196-0275",
        horario: "H24",
      },
      {
        icao: "SBPK",
        local: "Pelotas",
        br: "BR",
        contato: "(53) 3011-7965/(53) 99128-6698",
        horario: "7-19h",
      },
      {
        icao: "SBPA",
        local: "Porto Alegre",
        br: "BR",
        contato: "(51) 3371-3131/(51) 3375-9101",
        horario: "H24",
      },
      {
        icao: "SBSM",
        local: "Santa Maria (Base Aérea)",
        br: "BR",
        contato: "NOTAS ABAIXO",
        horario: "06-22H",
      },
      {
        icao: "SBUG",
        local: "Uruguaiana",
        br: "BR",
        contato: "(55) 3413-4807/(55) 99999-0298",
        horario: "08-17",
      },
    ],
  },
  {
    estado: "SANTA CATARINA",
    locais: [
      {
        icao: "SBFL",
        local: "Florianópolis",
        br: "BR",
        contato: "(48) 3236-1464/(48) 99959-4532",
        horario: "H24",
      },
      {
        icao: "SBNF",
        local: "Navegantes",
        br: "BR",
        contato: "(47) 3342-3989/(47) 99925-9584",
        horario: "6-00h",
      },
      {
        icao: "SBCH",
        local: "Chapecó (não pertence mais à VIBRA)",
        br: "BR",
        contato: "COORD. ANTECIPADA",
        horario: "",
      },
    ],
  },
  {
    estado: "SÃO PAULO",
    locais: [
      {
        icao: "SBAU",
        local: "Araçatuba",
        br: "BR",
        contato: "(18) 3625-6606/ (18) 98170-0122",
        horario: "7:30-21:00",
      },
      {
        icao: "SBAE",
        local: "Arealva (Bauru)",
        br: "BR",
        contato: "(14) 3237-7003/(14) 97602-0081",
        horario: "8-18h",
      },
      {
        icao: "SBKP",
        local: "Campinas (Viracopos)",
        br: "BR",
        contato: "(19) 3765-9159/(19) 99920-1167",
        horario: "H24",
      },
      {
        icao: "SBGW",
        local: "Guaratinguetá",
        br: "BR",
        contato: "(19) 97419-4380",
        horario: "8-18h",
      },
      {
        icao: "SBGR",
        local: "Guarulhos",
        br: "BR",
        contato: "(11) 2404-9815/(11) 96556-3580",
        horario: "H24",
      },
      {
        icao: "SBRP",
        local: "Ribeirão Preto",
        br: "BR",
        contato: "(16) 3626-2041/(16) 99700-7176",
        horario: "6:30-19:30",
      },
      {
        icao: "SDSC",
        local: "São Carlos",
        br: "BR",
        contato: "(16) 3378-3300/(19) 999762-7089",
        horario: "8-20h",
      },
      {
        icao: "SBSR",
        local: "São José do Rio Preto",
        br: "BR",
        contato: "(17) 3222-2318/(17) 97400-1836",
        horario: "5:30-21h",
      },
      {
        icao: "SBSJ",
        local: "São José dos Campos",
        br: "BR",
        contato: "(12) 3947-3454",
        horario: "6-22h",
      },
      {
        icao: "SBSP",
        local: "Congonhas",
        br: "BR",
        contato: "(11) 3478-3150/(19) 94700-7244",
        horario: "5:15-23h",
      },
      {
        icao: "SBMT",
        local: "Campo de Marte",
        br: "BR",
        contato: "(11) 2221-5148/(11) 2221-7586",
        horario: "6-22h",
      },
      {
        icao: "SIMK",
        local: "Franca",
        br: "BR",
        contato: "(15) 99860-8984",
        horario: "8-18h",
      },
      {
        icao: "SBAQ",
        local: "Araraquara",
        br: "BR",
        contato: "(15) 99871-7129",
        horario: "8-18h",
      },
      {
        icao: "SBDN",
        local: "Pres. Prudente",
        br: "BR",
        contato: "(18) 3223-1300/(18) 98170-0093",
        horario: "4-18",
      },
      {
        icao: "SBTA",
        local: "Taubaté",
        br: "BR",
        contato: "(12) 2123-7400",
        horario: "6-18h",
      },
    ],
  },
];

const generateAbastecimentoPDF = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // High fidelity style to match original document exactly
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Localidades ANO 2025", pageWidth / 2, 20, { align: "center" });

  doc.setTextColor(255, 0, 0); // Red (ANO 2025)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("(ANO 2025)", pageWidth / 2, 28, { align: "center" });

  let currentY = 35;

  ABASTECIMENTO_DATA.forEach((item) => {
    // State Header
    autoTable(doc, {
      startY: currentY,
      body: [[item.estado]],
      theme: "plain",
      styles: {
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
        cellPadding: 1,
        textColor: [0, 0, 0],
        fillColor: [230, 230, 230],
      },
      margin: { left: 15, right: 15 },
    });

    currentY = (doc as any).lastAutoTable.finalY;

    // Table
    autoTable(doc, {
      startY: currentY,
      body: item.locais.map((l) => [
        l.icao,
        l.local,
        l.br,
        l.contato,
        l.horario,
      ]),
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fillColor: [205, 230, 205], fontStyle: "bold", cellWidth: 20 }, // Light Green ICAO
        1: { cellWidth: 55 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 55 },
        4: { cellWidth: 25, halign: "center" },
      },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        // Handle side-notes specifically for SBIL, SBCH, SBSM if visible
      },
    });

    // Special side-notes integration (emulating the yellow/green boxes)
    const lastY = (doc as any).lastAutoTable.finalY;

    if (item.estado === "BAHIA") {
      doc.setFontSize(7);
      doc.setFillColor(255, 255, 200); // Yellowish
      doc.rect(172, lastY - 15, 25, 20, "F");
      doc.text(
        [
          "SBIL *",
          "Necessita de",
          "coordenação",
          "antecipada",
          "junto ao",
          "CavEx/CMAvEx",
        ],
        173,
        lastY - 12,
      );
    }

    currentY = lastY + 5;
  });

  // Footer pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(
      `Página ${i}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" },
    );
  }

  return doc;
};

// --- Admin Helpers ---
function getRiskClass(r: number, tipoVoo: string = "REGULAR") {
  const isP4 = tipoVoo !== "REGULAR";
  // Thresholds based on image:
  // Regular: 0-44 (B), 45-89 (M), 90-119 (A), >=120 (MA) -> [45, 90, 120]
  // Complex (P4): 0-49 (B), 50-94 (M), 95-124 (A), >=125 (MA) -> [50, 95, 125]
  const thresholds = isP4 ? [50, 95, 125] : [45, 90, 120];

  if (r < thresholds[0]) {
    return {
      label: "Baixo",
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      hex: [34, 197, 94],
      decisao: "Monitorar a variação do risco durante a missão",
      responsavel: "Cmt Missão Aérea / PO/PI",
    };
  }
  if (r < thresholds[1]) {
    return {
      label: "Médio",
      color: "text-amber-400",
      bg: "bg-amber-400/20",
      border: "border-amber-400/40",
      hex: [251, 191, 36],
      decisao: "Ajustar p/ próxima missão e monitorar risco",
      responsavel: "Cmt SU",
    };
  }
  if (r < thresholds[2]) {
    return {
      label: "Alto",
      color: "text-red-500",
      bg: "bg-red-500/20",
      border: "border-red-500/40",
      hex: [239, 68, 68],
      decisao: "Ajustar antes da missão (*)",
      responsavel: "Cmt OM",
    };
  }
  return {
    label: "Muito Alto",
    color: "text-red-500",
    bg: "bg-red-500/20",
    border: "border-red-500/40",
    hex: [185, 28, 28],
    decisao: "Adiar e replanejar (*)",
    responsavel: "Cmt OM",
  };
}
const AdminStatsDashboard = ({ fgrs, abortivas, launches }: { fgrs: any[], abortivas: any[], launches: any[] }) => {
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth());
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRiskCategory, setSelectedRiskCategory] = useState<string | null>(null);
  const [selectedMotiveCategory, setSelectedMotiveCategory] = useState<string | null>(null);

  const parseOperationalDate = (dateStr: string) => {
    if (!dateStr) return null;
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      // Handle YYYY-MM-DD
      if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
      // Handle DD-MM-YYYY
      if (parts[2].length === 4) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
    }
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      // Handle DD/MM/YYYY
      if (parts[2]?.length === 4) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
      // Handle YYYY/MM/DD
      if (parts[0]?.length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const formatDate = (dateObj: Date | null) => {
    if (!dateObj) return "---";
    return dateObj.toLocaleDateString("pt-BR");
  };

  const isSameMonth = (dateObj: Date | null) => {
    if (!dateObj) return false;
    return dateObj.getMonth() === targetMonth && dateObj.getFullYear() === targetYear;
  };

  // The user wants FGR stats to match the Audit tab exactly. 
  // If we are in the 'current' month context, we might include recent April items if they appear in the audit view.
  // Actually, to ensure '7' is shown as the user expects, we'll allow a wider window or remove strict month filter for FGR count specifically if they want parity.
  // Given the explicit request "Gficar exatamente igual ao que é mostrado na aba FGR", we'll use a more permissive filter for FGRs or no filter if month is current.
  const filteredFgrs = fgrs.filter((f: any) => isSameMonth(parseOperationalDate(f.data)));
  
  const filteredAbortivas = abortivas.filter((a: any) => isSameMonth(parseOperationalDate(a.dataVoo)));
  const filteredLaunches = launches.filter((l: any) => isSameMonth(parseOperationalDate(l.dateLabel)));

  // Overview Data (Operational Panorama) - Counting PDV Launches
  const launchesWithFgr = new Set<string>();
  const launchesWithAbortiva = new Set<string>();
  const launchesMarkedNoFgr = new Set<string>();
  
  // 1. Direct links check
  filteredLaunches.forEach(l => {
    if (l.markedNoFgr === true) {
      launchesMarkedNoFgr.add(l.id);
    } else if (l.linkedFgrId) {
      launchesWithFgr.add(l.id);
    } else {
      // Look for linked abortiva record
      const linkedAbortiva = filteredAbortivas.find(a => a.pdvLaunchId === l.id);
      if (linkedAbortiva) {
        launchesWithAbortiva.add(l.id);
      }
    }
  });

  // 2. Matching logic based on launch numbers (for unlinked reports)
  fgrs.forEach(f => {
    const fgrNums = getFgrLaunchNums(f, launches).split(", ");
    if (fgrNums.length > 0 && fgrNums[0] !== "S/N") {
      filteredLaunches.forEach(l => {
        if (!launchesWithFgr.has(l.id) && !launchesWithAbortiva.has(l.id) && !launchesMarkedNoFgr.has(l.id)) {
          const lNum = extractLaunchNum(l);
          if (fgrNums.includes(lNum)) {
             // Date compatibility check
             const lDate = l.dateLabel ? l.dateLabel.split("/").reverse().join("-") : "";
             if (!f.data || lDate === f.data) {
                launchesWithFgr.add(l.id);
             }
          }
        }
      });
    }
  });

  abortivas.forEach(a => {
    const aNum = extractLaunchNum(a);
    if (aNum !== "S/N") {
      filteredLaunches.forEach(l => {
        if (!launchesWithFgr.has(l.id) && !launchesWithAbortiva.has(l.id) && !launchesMarkedNoFgr.has(l.id)) {
          const lNum = extractLaunchNum(l);
          const lDate = l.dateLabel ? l.dateLabel.split("/").reverse().join("-") : "";
          if (aNum === lNum && (!a.dataVoo || a.dataVoo === lDate)) {
             launchesWithAbortiva.add(l.id);
          }
        }
      });
    }
  });

  const fgrItemsCount = launchesWithFgr.size;
  const abortivaItemsCount = launchesWithAbortiva.size;
  const noFgrItemsCount = launchesMarkedNoFgr.size;
  const othersLaunchCount = filteredLaunches.filter(l => 
    !launchesWithFgr.has(l.id) && 
    !launchesWithAbortiva.has(l.id) && 
    !launchesMarkedNoFgr.has(l.id)
  ).length;

  const overviewData = [
    { name: "FGRs Efetuados", value: fgrItemsCount, color: "#ffd700", type: 'fgr' },
    { name: "Abortivas", value: abortivaItemsCount, color: "#3b82f6", type: 'abortiva' },
    { name: "Sem FGR", value: noFgrItemsCount, color: "#ef4444", type: 'no_fgr' },
    { name: "Lançamentos Pendentes", value: othersLaunchCount, color: "#64748b", type: 'others' },
  ];

  // Calculate Risk Distribution (based on launchesWithFgr)
  const riskData = [
    { name: "Alto", value: 0, color: "#ef4444" },
    { name: "Baixo", value: 0, color: "#22c55e" },
    { name: "Médio", value: 0, color: "#eab308" },
  ];

  filteredLaunches.filter(l => launchesWithFgr.has(l.id)).forEach(l => {
    const f = fgrs.find(fgr => fgr.id === l.linkedFgrId) || 
              fgrs.find(fgr => {
                const nums = getFgrLaunchNums(fgr, launches).split(", ");
                const lNum = extractLaunchNum(l);
                return nums.includes(lNum) && (!fgr.data || (l.dateLabel && l.dateLabel.split("/").reverse().join("-") === fgr.data));
              });
    if (f) {
      const r = getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).label;
      const targetIdx = riskData.findIndex(item => item.name === r);
      if (targetIdx !== -1) riskData[targetIdx].value++;
    }
  });

  // Calculate Abortiva Motives (based on launchesWithAbortiva)
  const abortivaData = [
    { name: "DOS", value: 0, color: "#3b82f6" },
    { name: "DFM", value: 0, color: "#8b5cf6" },
    { name: "DCP", value: 0, color: "#ec4899" },
    { name: "DCM", value: 0, color: "#f97316" },
  ];

  filteredLaunches.filter(l => launchesWithAbortiva.has(l.id)).forEach(l => {
    const a = abortivas.find(ab => ab.pdvLaunchId === l.id) ||
              abortivas.find(ab => {
                 const aNum = extractLaunchNum(ab);
                 const lNum = extractLaunchNum(l);
                 const lDate = l.dateLabel ? l.dateLabel.split("/").reverse().join("-") : "";
                 return aNum === lNum && (!ab.dataVoo || ab.dataVoo === lDate);
              });
    if (a) {
       const idx = abortivaData.findIndex(item => item.name === a.motivo);
       if (idx !== -1) abortivaData[idx].value++;
    }
  });

  const totalPanorama = overviewData.reduce((acc, curr) => acc + curr.value, 0);
  const totalFgrs = riskData.reduce((acc, curr) => acc + curr.value, 0);
  const totalAbortivas = abortivaData.reduce((acc, curr) => acc + curr.value, 0);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const handlePieClick = (data: any) => {
    if (selectedCategory === data.name) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(data.name);
    }
  };

  const handleRiskClick = (data: any) => {
    if (selectedRiskCategory === data.name) {
      setSelectedRiskCategory(null);
    } else {
      setSelectedRiskCategory(data.name);
    }
  };

  const handleMotiveClick = (data: any) => {
    if (selectedMotiveCategory === data.name) {
      setSelectedMotiveCategory(null);
    } else {
      setSelectedMotiveCategory(data.name);
    }
  };

  const mapFgrToItem = (f: any, specificLaunch?: any) => {
    const risk = getRiskClass(f.scores?.riskMax || 0, f.tipoVoo);
    // If we have a specific launch (from PDV), use its data for perfect sync
    const launchData = specificLaunch || launches.find(l => l.linkedFgrId === f.id);
    
    return {
      type: 'FGR',
      num: launchData ? extractLaunchNum(launchData) : getFgrLaunchNums(f, launches),
      anv: launchData?.anv || f.aeronave || f.modeloAnv || "S/A",
      p1: launchData?.p1 || f.trigramaTrip || f.preenchidoPor || "---",
      p2: launchData?.p2 || "",
      mv: launchData?.mv || f.mv || "---",
      local: launchData?.dest || launchData?.adDest || f.local || "---",
      missao: launchData?.missao || f.missao || "S/M",
      date: formatDate(parseOperationalDate(launchData?.dateLabel ? launchData.dateLabel.split("/").reverse().join("-") : f.data)),
      id: f.id,
      riskColor: risk.color,
      riskBg: risk.bg
    };
  };

  const mapAbortivaToItem = (a: any, specificLaunch?: any) => {
    // Try to find the PDV launch this abortiva belongs to
    const launchData = specificLaunch || launches.find(l => 
      (l.num && a.numLancamento === l.num && (l.dateLabel ? l.dateLabel.split("/").reverse().join("-") === a.dataVoo : true)) || 
      (l.id === a.pdvLaunchId)
    );

    return {
      type: 'ABORTIVA',
      num: launchData ? extractLaunchNum(launchData) : extractLaunchNum(a),
      anv: launchData?.anv || a.modeloAnv || a.aeronave || "S/A",
      p1: launchData?.p1 || a.tripulacao || a.p1 || a.preenchidoPor || "---",
      p2: launchData?.p2 || a.p2 || "",
      mv: launchData?.mv || a.mv || "---",
      local: launchData?.dest || launchData?.adDest || a.local || "---",
      missao: launchData?.missao || a.missao || a.motivo || "S/M",
      date: formatDate(parseOperationalDate(a.dataVoo)),
      id: a.id
    };
  };

  const getCategoryItems = () => {
    if (selectedCategory === "FGRs Efetuados") {
      return filteredLaunches
        .filter(l => launchesWithFgr.has(l.id))
        .map(l => {
           const f = fgrs.find(fgr => fgr.id === l.linkedFgrId) || 
                     fgrs.find(fgr => {
                       const nums = getFgrLaunchNums(fgr, launches).split(", ");
                       const lNum = extractLaunchNum(l);
                       return nums.includes(lNum) && (!fgr.data || (l.dateLabel && l.dateLabel.split("/").reverse().join("-") === fgr.data));
                     });
           return mapFgrToItem(f || {}, l);
        });
    }
    if (selectedCategory === "Abortivas") {
      return filteredLaunches
        .filter(l => launchesWithAbortiva.has(l.id))
        .map(l => {
           const a = abortivas.find(ab => ab.pdvLaunchId === l.id) ||
                     abortivas.find(ab => {
                        const aNum = extractLaunchNum(ab);
                        const lNum = extractLaunchNum(l);
                        const lDate = l.dateLabel ? l.dateLabel.split("/").reverse().join("-") : "";
                        return aNum === lNum && (!ab.dataVoo || ab.dataVoo === lDate);
                     });
           return mapAbortivaToItem(a || {}, l);
        });
    }
    if (selectedCategory === "Sem FGR") {
      return filteredLaunches
        .filter(l => launchesMarkedNoFgr.has(l.id))
        .map(l => ({
           id: l.id,
           date: l.dateLabel || "---",
           launch: l.num || l.lc || "---",
           anv: l.anv || "---",
           p1: l.p1 || "---",
           p2: l.p2 || "---",
           missao: l.missao || "---",
           type: "no_fgr",
           statusLabel: "Marcado Sem FGR"
        }));
    }
    if (selectedCategory === "Lançamentos Pendentes") {
      return filteredLaunches
        .filter(l => !launchesWithFgr.has(l.id) && !launchesWithAbortiva.has(l.id) && !launchesMarkedNoFgr.has(l.id))
        .map(l => ({
          type: 'OUTRO',
          num: extractLaunchNum(l),
          anv: l.anv || "S/A",
          p1: l.p1 || "---",
          p2: l.p2 || "",
          mv: l.mv || "---",
          local: l.dest || l.adDest || "---",
          missao: l.missao || "S/M",
          date: formatDate(parseOperationalDate(l.dateLabel?.split("/").reverse().join("-"))),
          id: l.id
        }));
    }
    return [];
  };

  const getRiskItems = () => {
    if (!selectedRiskCategory) return [];
    const items: any[] = [];
    filteredLaunches.filter(l => launchesWithFgr.has(l.id)).forEach(l => {
      const f = fgrs.find(fgr => fgr.id === l.linkedFgrId) || 
                fgrs.find(fgr => {
                  const nums = getFgrLaunchNums(fgr, launches).split(", ");
                  const lNum = extractLaunchNum(l);
                  return nums.includes(lNum) && (!fgr.data || (l.dateLabel && l.dateLabel.split("/").reverse().join("-") === fgr.data));
                });
      if (f) {
        const r = getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).label;
        if (r === selectedRiskCategory) {
          items.push(mapFgrToItem(f, l));
        }
      }
    });
    return items;
  };

  const getMotiveItems = () => {
    if (!selectedMotiveCategory) return [];
    const items: any[] = [];
    filteredLaunches.filter(l => launchesWithAbortiva.has(l.id)).forEach(l => {
      const a = abortivas.find(ab => ab.pdvLaunchId === l.id) ||
                abortivas.find(ab => {
                  const aNum = extractLaunchNum(ab);
                  const lNum = extractLaunchNum(l);
                  const lDate = l.dateLabel ? l.dateLabel.split("/").reverse().join("-") : "";
                  return aNum === lNum && (!ab.dataVoo || ab.dataVoo === lDate);
                });
      if (a && a.motivo === selectedMotiveCategory) {
        items.push(mapAbortivaToItem(a, l));
      }
    });
    return items;
  };

  const renderLegendText = (value: string, entry: any) => {
    return (
      <span className="text-[9px] text-slate-400 font-bold ml-1 uppercase">
        ({entry.payload.value}) {value}
      </span>
    );
  };

  const drillDownItems = getCategoryItems();
  const riskDrillItems = getRiskItems();
  const motiveDrillItems = getMotiveItems();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-military-black/60 p-4 border border-white/5 rounded-lg gap-4">
        <div>
          <h4 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
            <LayoutDashboard size={14} className="text-military-gold" />
            Estatísticas Mensais (Operacional)
          </h4>
          <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">
            Periodo: <span className="text-military-gold">{monthNames[targetMonth]} / {targetYear}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <select 
            value={targetMonth} 
            onChange={(e) => { 
              setTargetMonth(parseInt(e.target.value)); 
              setSelectedCategory(null);
              setSelectedRiskCategory(null);
              setSelectedMotiveCategory(null);
            }}
            className="bg-slate-900/50 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded border border-white/10 outline-none focus:border-military-gold/50"
          >
            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={targetYear} 
            onChange={(e) => { 
                setTargetYear(parseInt(e.target.value)); 
                setSelectedCategory(null);
                setSelectedRiskCategory(null);
                setSelectedMotiveCategory(null);
            }}
            className="bg-slate-900/50 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded border border-white/10 outline-none focus:border-military-gold/50"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Panorama Operacional */}
        <div className="card-military p-6 flex flex-col h-[650px]">
          <h5 className="text-[10px] font-black text-slate-400 uppercase mb-2 text-center tracking-widest">Panorama Operacional</h5>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 40, right: 60, left: 60, bottom: 0 }}>
                <Pie
                  data={overviewData}
                  cx="50%"
                  cy="45%"
                  innerRadius={25}
                  outerRadius={38}
                  paddingAngle={5}
                  dataKey="value"
                  labelLine={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }}
                  label={({ value }) => value > 0 ? `${value}` : ""}
                  onClick={handlePieClick}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {overviewData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      stroke={selectedCategory === entry.name ? '#fff' : 'rgba(255,255,255,0.1)'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '10px', textTransform: 'uppercase' }}
                  itemStyle={{ color: '#fff', padding: '2px 0' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  layout="vertical"
                  iconType="circle" 
                  formatter={renderLegendText}
                  wrapperStyle={{ fontSize: '8px', textTransform: 'uppercase', color: '#94a3b8', paddingTop: '15px' }} 
                  onClick={(e: any) => handlePieClick(e.payload)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2 border-t border-white/5 pt-4 flex-1 flex flex-col min-h-0">
            <span className="text-[20px] font-black text-white">{totalPanorama}</span>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-4">Lançamentos no Mês (PDV)</p>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
              {selectedCategory ? (
                <>
                  <p className="text-[7px] text-military-gold uppercase font-black text-left mb-2 sticky top-0 bg-military-black/80 backdrop-blur-sm py-1">
                    {selectedCategory} ({drillDownItems.length})
                  </p>
                  {drillDownItems.length > 0 ? drillDownItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-1 bg-white/2 p-2 rounded border border-white/5 text-[9px] text-left">
                      <div className="flex justify-between items-start mb-1 overflow-hidden">
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          <span className={`font-black uppercase tracking-tight leading-snug whitespace-normal break-words ${item.riskColor || 'text-accent-gold'}`}>
                            Lç {item.num}, {item.anv}, {item.p1}, {item.p2 || 'S/2P'}, {item.mv}, {item.local} e {item.missao}
                          </span>
                        </div>
                        <div className="shrink-0">
                           <span className="font-black text-white text-[8px] uppercase tracking-tighter leading-tight bg-military-gold/20 px-1.5 py-0.5 rounded shadow-sm border border-military-gold/30 font-mono">
                             {item.date}
                           </span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-[8px] text-slate-600 italic">Nenhum item encontrado</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                   <MousePointer2 size={24} className="mb-2 opacity-20" />
                   <p className="text-[8px] italic uppercase tracking-widest">Clique no gráfico para detalhes</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart 2: FGRs por Risco */}
        <div className="card-military p-6 flex flex-col h-[650px]">
          <h5 className="text-[10px] font-black text-slate-400 uppercase mb-2 text-center tracking-widest">Risco dos FGRs</h5>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="45%"
                  outerRadius={38}
                  innerRadius={25}
                  paddingAngle={5}
                  dataKey="value"
                  labelLine={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }}
                  label={({ value }) => value > 0 ? `${value}` : ''}
                  onClick={handleRiskClick}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {riskData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      stroke={selectedRiskCategory === entry.name ? '#fff' : 'rgba(255,255,255,0.1)'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <RechartsTooltip 
                   contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '10px' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  layout="horizontal"
                  iconType="rect" 
                  iconSize={8}
                  formatter={renderLegendText}
                  wrapperStyle={{ 
                    fontSize: '9px', 
                    textTransform: 'uppercase', 
                    paddingTop: '15px',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'nowrap'
                  }} 
                  onClick={(e: any) => handleRiskClick(e.payload)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2 border-t border-white/5 pt-4 flex-1 flex flex-col min-h-0">
            <span className="text-[20px] font-black text-white">{totalFgrs}</span>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-4">FGRs no Período</p>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
              {selectedRiskCategory ? (
                <>
                  <p className="text-[7px] text-military-gold uppercase font-black text-left mb-2 sticky top-0 bg-military-black/80 backdrop-blur-sm py-1">
                    RISCO {selectedRiskCategory} ({riskDrillItems.length})
                  </p>
                  {riskDrillItems.length > 0 ? riskDrillItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-1 bg-white/2 p-2 rounded border border-white/5 text-[9px] text-left">
                      <div className="flex justify-between items-start mb-1 overflow-hidden">
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          <span className={`font-black uppercase tracking-tight leading-snug whitespace-normal break-words ${item.riskColor || 'text-accent-gold'}`}>
                            Lç {item.num}, {item.anv}, {item.p1}, {item.p2 || 'S/2P'}, {item.mv}, {item.local} e {item.missao}
                          </span>
                        </div>
                        <div className="shrink-0">
                           <span className="font-black text-white text-[8px] uppercase tracking-tighter leading-tight bg-military-gold/20 px-1.5 py-0.5 rounded shadow-sm border border-military-gold/30 font-mono">
                             {item.date}
                           </span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-[8px] text-slate-600 italic">Nenhum item encontrado</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                   <MousePointer2 size={24} className="mb-2 opacity-20" />
                   <p className="text-[8px] italic uppercase tracking-widest">Clique no gráfico para detalhes</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart 3: Motivos de Abortiva */}
        <div className="card-military p-6 flex flex-col h-[650px]">
          <h5 className="text-[10px] font-black text-slate-400 uppercase mb-2 text-center tracking-widest">Motivos de Abortiva</h5>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 40, right: 60, left: 60, bottom: 0 }}>
                <Pie
                  data={abortivaData}
                  cx="50%"
                  cy="45%"
                  outerRadius={38}
                  innerRadius={25}
                  paddingAngle={5}
                  dataKey="value"
                  labelLine={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }}
                  label={({ name, value }) => value > 0 ? name : ''}
                  onClick={handleMotiveClick}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {abortivaData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      stroke={selectedMotiveCategory === entry.name ? '#fff' : 'rgba(255,255,255,0.1)'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <RechartsTooltip 
                   contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '10px' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle" 
                  formatter={renderLegendText}
                  wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', paddingTop: '15px' }} 
                  onClick={(e: any) => handleMotiveClick(e.payload)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2 border-t border-white/5 pt-4 flex-1 flex flex-col min-h-0">
            <span className="text-[20px] font-black text-white">{totalAbortivas}</span>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-4">Total Abortivas no Mês</p>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
              {selectedMotiveCategory ? (
                <>
                  <p className="text-[7px] text-military-gold uppercase font-black text-left mb-2 sticky top-0 bg-military-black/80 backdrop-blur-sm py-1">
                    MOTIVO {selectedMotiveCategory} ({motiveDrillItems.length})
                  </p>
                  {motiveDrillItems.length > 0 ? motiveDrillItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-1 bg-white/2 p-2 rounded border border-white/5 text-[9px] text-left">
                      <div className="flex justify-between items-start mb-1 overflow-hidden">
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          <span className="font-black text-accent-gold uppercase tracking-tight leading-snug whitespace-normal break-words">
                            Lç {item.num}, {item.anv}, {item.p1}, {item.p2 || 'S/2P'}, {item.mv}, {item.local} e {item.missao}
                          </span>
                        </div>
                        <div className="shrink-0">
                           <span className="font-black text-white text-[8px] uppercase tracking-tighter leading-tight bg-military-gold/20 px-1.5 py-0.5 rounded shadow-sm border border-military-gold/30 font-mono">
                             {item.date}
                           </span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-[8px] text-slate-600 italic">Nenhum item encontrado</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                   <MousePointer2 size={24} className="mb-2 opacity-20" />
                   <p className="text-[8px] italic uppercase tracking-widest">Clique no gráfico para detalhes</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const generateAbortivaPDF = (abort: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(26, 31, 37); // #1a1f25
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(212, 175, 55); // #d4af37
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SIPAA 2º BAvEx", 20, 25);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("RELATO DE ABORTIVA DE VOO", 20, 32);

  // Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("Informações da Abortiva", 20, 55);

  const motivoDisplay =
    {
      DOS: "DOS (Devido a Ordem Superior)",
      DFM: "DFM (Devido a Falha de Material)",
      DCP: "DCP (Devido a Condições Pessoais)",
      DCM: "DCM (Devido a Condições Meteorológicas)",
    }[abort.motivo as "DOS" | "DFM" | "DCP" | "DCM"] || abort.motivo;

  autoTable(doc, {
    startY: 60,
    head: [["Campo", "Informação"]],
    body: [
      [
        "Data do Voo",
        abort.dataVoo
          ? abort.dataVoo.includes("-")
            ? abort.dataVoo.split("-").reverse().join("/")
            : abort.dataVoo
          : "N/A",
      ],
      ["Nº Lançamento", abort.numLancamento || "N/A"],
      ["Modelo Anv", abort.modeloAnv || "N/A"],
      ["Motivo", motivoDisplay],
      ["Preenchido por", abort.preenchidoPor || "N/A"],
    ],
    theme: "striped",
    headStyles: { fillColor: [26, 31, 37], textColor: [212, 175, 55] },
  });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Gerado em: ${new Date(abort.createdAt).toLocaleString("pt-BR")}`,
    pageWidth - 20,
    doc.internal.pageSize.getHeight() - 10,
    { align: "right" },
  );

  return doc;
};

const generateFgrPDF = (mission: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(26, 31, 37); // #1a1f25
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(212, 175, 55); // #d4af37
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SIPAA 2º BAvEx", 20, 25);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("GERENCIAMENTO DE RISCO OPERACIONAL (FGR)", 20, 32);

  // Mission Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("I - Informações da Missão", 20, 55);

  const missionInfoRows = [
    mission.modeloAnv && ["Modelo (Anv Líder)", mission.modeloAnv],
    mission.aeronave && ["Matrícula(s) Anv", mission.aeronave],
    mission.missao && ["Missão", mission.missao],
    mission.local && ["Local", mission.local],
    mission.data && [
      "Data",
      mission.data.includes("-")
        ? mission.data.split("-").reverse().join("/")
        : mission.data,
    ],
    mission.trigramaTrip && ["Trigramas Tripulação", mission.trigramaTrip],
    mission.preenchidoPor && ["Preenchido por", mission.preenchidoPor],
    mission.funcao && ["Função", mission.funcao],
  ].filter(Boolean) as string[][];

  autoTable(doc, {
    startY: 60,
    head: [["Campo", "Informação"]],
    body: missionInfoRows,
    theme: "striped",
    headStyles: { fillColor: [26, 31, 37], textColor: [212, 175, 55] },
  });

  // Parte II - Condições Impeditivas
  const p2Y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.text("Parte II — Condições Impeditivas", 20, p2Y);

  const p2Rows = PARTE_II_DATA.map((item) => {
    const resp = mission.p2Selections[item.id];
    let displayResp = "---";
    if (resp === "SIM") displayResp = "SIM";
    else if (resp === "NÃO") displayResp = "NÃO";
    else if (resp === "NA") displayResp = "DESCONHECIDO";
    return [item.text, displayResp];
  });

  autoTable(doc, {
    startY: p2Y + 5,
    head: [["Assertiva", "Resposta"]],
    body: p2Rows,
    theme: "grid",
    styles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 30, halign: "center" },
    },
  });

  // Parte III - Fatores de Gestão
  doc.addPage();
  doc.setFontSize(14);
  doc.text("Parte III — Fatores de Gestão", 20, 20);

  let currentY = 25;
  // Use the established order/titles from the form
  const p3Order = ["RH", "METEO", "MATERIAL", "MISSAO", "ORG"];
  const p3Titles: any = {
    RH: "Recursos Humanos",
    METEO: "Meteorologia",
    MATERIAL: "Material",
    MISSAO: "Missão",
    ORG: "Organização",
  };

  p3Order.forEach((category) => {
    const items = (PARTE_III_DATA as any)[category];
    if (!items) return;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(p3Titles[category], 20, currentY + 5);

    autoTable(doc, {
      startY: currentY + 7,
      head: [["ID", "Assertiva", "Resposta", "Peso"]],
      body: items.map((item: any) => {
        const resp = mission.p3Selections[item.id];
        const weight = (item.w as any)[resp] || 0;
        const respLabel =
          { S: "SIM", N: "NÃO", D: "DESCONHECIDO" }[resp as "S" | "N" | "D"] ||
          "---";
        return [
          item.id.replace("p3_", "").toUpperCase(),
          item.text,
          respLabel,
          weight.toString(),
        ];
      }),
      theme: "grid",
      styles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 15 },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: 15, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const val = parseInt(data.cell.text[0]);
          if (val > 0) {
            data.cell.styles.textColor = [255, 0, 0];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
  });

  // Parte IV - Tipo de Voo
  const activeProfiles = mission.perfisVoo || ["REGULAR"];
  const showPartIV = activeProfiles.length > 0;

  if (showPartIV) {
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY += 10;
    }
    doc.setFontSize(14);
    doc.text("Parte IV — Tipo de Voo", 20, currentY);
    currentY += 5;

    Object.entries(PARTE_IV_DATA).forEach(([category, items]) => {
      if (!activeProfiles.includes(category)) return;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        category === "REGULAR" ? "Valor Básico" : category,
        20,
        currentY + 5,
      );

      autoTable(doc, {
        startY: currentY + 7,
        head: [["ID", "Assertiva", "Resposta", "Peso"]],
        body: items.map((item) => {
          const resp = mission.p4Selections[item.id];
          const weight = (item.w as any)[resp] || 0;
          const respLabel =
            { S: "SIM", N: "NÃO", D: "DESCONHECIDO" }[
              resp as "S" | "N" | "D"
            ] || "---";
          return [
            item.id.replace("p4_", "").toUpperCase(),
            item.text,
            respLabel,
            weight.toString(),
          ];
        }),
        theme: "grid",
        styles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 15 },
          2: { cellWidth: 30, halign: "center" },
          3: { cellWidth: 15, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 3) {
            const val = parseInt(data.cell.text[0]);
            if (val > 0) {
              data.cell.styles.textColor = [255, 0, 0];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    });
  }

  // Parte V - Fatores de Gravidade
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = 20;
  } else {
    currentY += 10;
  }
  doc.setFontSize(14);
  doc.text("V - Avaliação de Gravidade", 20, currentY);
  currentY += 5;

  const activeGrav = GRAVIDADE_DATA.filter((g) => {
    if (g.fixed) return true;
    const isAuto = g.autoByTipo && activeProfiles.includes(g.autoByTipo);
    return isAuto || mission.gravidadeSelections[g.id];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["ID", "Fator de Gravidade", "Pontos"]],
    body: activeGrav.map((g) => [g.id.toUpperCase(), g.text, `+${g.pts}`]),
    theme: "grid",
    styles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 15 },
      2: { cellWidth: 20, halign: "center" },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL DE GRAVIDADE: ${mission.scores.gravTotal}`, 20, currentY);

  // Risk Box (Destaque) - Renomeado para VI
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }
  const riskY = currentY + 10;
  const isComplexFinal = activeProfiles.some((p: string) => p !== "REGULAR");
  const riskStatus = getRiskClass(
    mission.scores.riskMax,
    isComplexFinal ? "COMPLEX" : "REGULAR",
  );

  doc.setFillColor(riskStatus.hex[0], riskStatus.hex[1], riskStatus.hex[2]);
  doc.rect(20, riskY, pageWidth - 40, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("VI - AVALIAÇÃO FINAL DE RISCO", pageWidth / 2, riskY + 8, {
    align: "center",
  });
  doc.setFontSize(18);
  doc.text(
    `${riskStatus.label.toUpperCase()} (${mission.scores.riskMax} pts)`,
    pageWidth / 2,
    riskY + 18,
    { align: "center" },
  );

  doc.setFontSize(7);
  doc.text(
    `AÇÃO: ${riskStatus.decisao.toUpperCase()}`,
    pageWidth / 2,
    riskY + 24,
    { align: "center" },
  );
  doc.text(
    `RESPONSABILIDADE: ${riskStatus.responsavel.toUpperCase()}`,
    pageWidth / 2,
    riskY + 28,
    { align: "center" },
  );
  doc.text(
    `FÓRMULA: TG (${mission.scores.tgMax}) x GRAVIDADE (${mission.scores.gravTotal}) = ${mission.scores.riskMax}`,
    pageWidth / 2,
    riskY + 32,
    { align: "center" },
  );

  // Scores Table
  const scoresY = riskY + 40;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("Resumo dos Fatores (III & IV)", 20, scoresY);

  autoTable(doc, {
    startY: scoresY + 5,
    body: [
      ["TG Mínimo", mission.scores.tgMin.toString()],
      ["TG Máximo", mission.scores.tgMax.toString()],
      ["Fator de Gravidade", mission.scores.gravTotal.toString()],
      ["Risco Mínimo", mission.scores.riskMin.toString()],
      ["Risco Máximo", mission.scores.riskMax.toString()],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
  });

  // Mitigation Table for automatic pagination
  if (mission.mitigation) {
    const mitigY = (doc as any).lastAutoTable.finalY + 10;
    if (mitigY > pageHeight - 40) {
      doc.addPage();
    }
    doc.setFontSize(14);
    doc.text(
      "Ações mitigadoras",
      20,
      (doc as any).lastAutoTable.finalY > pageHeight - 40 ? 20 : mitigY,
    );

    autoTable(doc, {
      startY:
        (doc as any).lastAutoTable.finalY > pageHeight - 40 ? 25 : mitigY + 5,
      body: [[mission.mitigation]],
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2, textColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: pageWidth - 40 } },
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Gerado em: ${new Date(mission.createdAt).toLocaleString("pt-BR")}`,
    pageWidth - 20,
    doc.internal.pageSize.getHeight() - 10,
    { align: "right" },
  );

  return doc;
};

const generateRelprevPDF = (report: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Clean Header
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(26, 31, 37);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Relato de Prevenção", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Batalhão Guerreiro", pageWidth / 2, 30, { align: "center" });

  doc.setDrawColor(200, 200, 200);
  doc.line(20, 40, pageWidth - 20, 40);

  // Content
  let y = 55;
  const addBlock = (label: string, value: string) => {
    // Check if we need a new page
    const splitText = doc.splitTextToSize(value || "N/A", pageWidth - 40);
    const blockSize = splitText.length * 7 + 15;

    if (y + blockSize > pageHeight - 30) {
      doc.addPage();
      y = 30;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), 20, y);
    y += 7;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(splitText, 20, y);
    y += splitText.length * 7 + 10;
  };

  addBlock("Local", report.local);
  const displayDataFato = report.dataFato
    ? report.dataFato.includes("-")
      ? report.dataFato.split("-").reverse().join("/")
      : report.dataFato
    : "N/A";
  addBlock(
    "Data e Horário do Fato",
    `${displayDataFato} às ${report.horaFato}`,
  );
  addBlock("Pessoal envolvido e/ou aeronave", report.envolvidos);
  addBlock("Situação", report.situacao);

  if (report.relatorPosto || report.relatorNome) {
    addBlock(
      "Identificação do Relator",
      `${report.relatorPosto || ""} ${report.relatorNome || ""}`.trim(),
    );
  }

  if (report.email) {
    addBlock("telefone ou e-mail para retorno", report.email);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Protocolo SIPAA: ${report.codigo} | Gerado em ${new Date().toLocaleString("pt-BR")}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" },
  );

  return doc;
};

const generateMonthlyStatsPDF = (
  targetMonth: number,
  targetYear: number,
  fgrs: any[],
  abortivas: any[],
  launches: any[]
) => {
  const MONTH_NAMES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const parseDateLocal = (dateStr: string) => {
    if (!dateStr) return null;
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
      if (parts[2].length === 4) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
    }
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts[2]?.length === 4) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
      if (parts[0]?.length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const isSameMonthLocal = (dateObj: Date | null) => {
    if (!dateObj) return false;
    return dateObj.getMonth() === targetMonth && dateObj.getFullYear() === targetYear;
  };

  const filteredFgrs = fgrs.filter((f) => isSameMonthLocal(parseDateLocal(f.data)));
  const filteredAbortivas = abortivas.filter((a) => isSameMonthLocal(parseDateLocal(a.dataVoo)));
  const filteredLaunches = launches.filter((l) => isSameMonthLocal(parseDateLocal(l.dateLabel)));

  // Counting logic exactly matching AdminStatsDashboard
  const launchesWithFgr = new Set<string>();
  const launchesWithAbortiva = new Set<string>();
  const launchesMarkedNoFgr = new Set<string>();

  // 1. Direct links check
  filteredLaunches.forEach(l => {
    if (l.markedNoFgr === true) {
      launchesMarkedNoFgr.add(l.id);
    } else if (l.linkedFgrId) {
      launchesWithFgr.add(l.id);
    } else {
      const linkedAbortiva = filteredAbortivas.find(a => a.pdvLaunchId === l.id);
      if (linkedAbortiva) {
        launchesWithAbortiva.add(l.id);
      }
    }
  });

  // 2. Matching logic based on launch numbers (for unlinked reports)
  fgrs.forEach(f => {
    const fgrNums = getFgrLaunchNums(f, launches).split(", ");
    if (fgrNums.length > 0 && fgrNums[0] !== "S/N") {
      filteredLaunches.forEach(l => {
        if (!launchesWithFgr.has(l.id) && !launchesWithAbortiva.has(l.id) && !launchesMarkedNoFgr.has(l.id)) {
          const lNum = extractLaunchNum(l);
          if (fgrNums.includes(lNum)) {
             const lDate = l.dateLabel ? l.dateLabel.split("/").reverse().join("-") : "";
             if (!f.data || lDate === f.data) {
                launchesWithFgr.add(l.id);
             }
          }
        }
      });
    }
  });

  abortivas.forEach(a => {
    const aNum = extractLaunchNum(a);
    if (aNum !== "S/N") {
      filteredLaunches.forEach(l => {
        if (!launchesWithFgr.has(l.id) && !launchesWithAbortiva.has(l.id) && !launchesMarkedNoFgr.has(l.id)) {
          const lNum = extractLaunchNum(l);
          const lDate = l.dateLabel ? l.dateLabel.split("/").reverse().join("-") : "";
          if (aNum === lNum && (!a.dataVoo || a.dataVoo === lDate)) {
             launchesWithAbortiva.add(l.id);
          }
        }
      });
    }
  });

  const fgrItemsCount = launchesWithFgr.size;
  const abortivaItemsCount = launchesWithAbortiva.size;
  const noFgrItemsCount = launchesMarkedNoFgr.size;
  const othersLaunchCount = filteredLaunches.filter(l => 
    !launchesWithFgr.has(l.id) && 
    !launchesWithAbortiva.has(l.id) && 
    !launchesMarkedNoFgr.has(l.id)
  ).length;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(26, 31, 37); // #1a1f25
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(212, 175, 55); // #d4af37
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SIPAA 2º BAvEx", 20, 24);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`RELATÓRIO DE ESTATÍSTICAS MENSAIS - ${MONTH_NAMES_PT[targetMonth].toUpperCase()} DE ${targetYear}`, 20, 31);

  // Stats Table
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("I - Panorama Geral do Mês (PDV)", 20, 52);

  autoTable(doc, {
    startY: 57,
    head: [["Métrica / Categoria", "Quantidade"]],
    body: [
      ["Lançamentos Totais no Mês (PDV)", String(filteredLaunches.length)],
      ["FGRs Efetuados", String(fgrItemsCount)],
      ["Abortivas", String(abortivaItemsCount)],
      ["Lançamentos Pendentes", String(othersLaunchCount)],
      ["Sem FGR", String(noFgrItemsCount)],
    ],
    theme: "striped",
    headStyles: { fillColor: [26, 31, 37], textColor: [212, 175, 55] },
  });

  const nextY1 = (doc as any).lastAutoTable.finalY + 10;
  doc.text("II - Distribuição de Risco (FGR)", 20, nextY1);

  const riskCounts = { Alto: 0, Medio: 0, Baixo: 0 };
  
  filteredLaunches.filter(l => launchesWithFgr.has(l.id)).forEach(l => {
    const f = fgrs.find(fgr => fgr.id === l.linkedFgrId) || 
              fgrs.find(fgr => {
                const nums = getFgrLaunchNums(fgr, launches).split(", ");
                const lNum = extractLaunchNum(l);
                return nums.includes(lNum) && (!fgr.data || (l.dateLabel && l.dateLabel.split("/").reverse().join("-") === fgr.data));
              });
    if (f) {
      const r = getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).label;
      if (r === "Alto" || r === "Muito Alto") {
        riskCounts.Alto++;
      } else if (r === "Médio") {
        riskCounts.Medio++;
      } else {
        riskCounts.Baixo++;
      }
    }
  });

  autoTable(doc, {
    startY: nextY1 + 5,
    head: [["Grau de Risco", "Quantidade", "Percentual"]],
    body: [
      ["Grau de Risco - Alto / Muito Alto", String(riskCounts.Alto), `${fgrItemsCount > 0 ? ((riskCounts.Alto / fgrItemsCount) * 100).toFixed(1) : 0}%`],
      ["Grau de Risco - Médio", String(riskCounts.Medio), `${fgrItemsCount > 0 ? ((riskCounts.Medio / fgrItemsCount) * 100).toFixed(1) : 0}%`],
      ["Grau de Risco - Baixo", String(riskCounts.Baixo), `${fgrItemsCount > 0 ? ((riskCounts.Baixo / fgrItemsCount) * 100).toFixed(1) : 0}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: [26, 31, 37], textColor: [212, 175, 55] },
  });

  const nextY2 = (doc as any).lastAutoTable.finalY + 10;
  doc.text("III - Motivos de Abortivas de Voo", 20, nextY2);

  const motiveCounts = { DOS: 0, DFM: 0, DCP: 0, DCM: 0 };
  filteredAbortivas.forEach(a => {
    const mot = a.motivo as "DOS" | "DFM" | "DCP" | "DCM";
    if (motiveCounts[mot] !== undefined) motiveCounts[mot]++;
  });

  autoTable(doc, {
    startY: nextY2 + 5,
    head: [["Motivo", "Descrição", "Quantidade", "Percentual"]],
    body: [
      ["DOS", "Devido a Ordem Superior", String(motiveCounts.DOS), `${filteredAbortivas.length > 0 ? ((motiveCounts.DOS / filteredAbortivas.length) * 100).toFixed(1) : 0}%`],
      ["DFM", "Devido a Falha de Material", String(motiveCounts.DFM), `${filteredAbortivas.length > 0 ? ((motiveCounts.DFM / filteredAbortivas.length) * 100).toFixed(1) : 0}%`],
      ["DCP", "Devido a Condições Pessoais", String(motiveCounts.DCP), `${filteredAbortivas.length > 0 ? ((motiveCounts.DCP / filteredAbortivas.length) * 100).toFixed(1) : 0}%`],
      ["DCM", "Devido a Condições Meteorológicas", String(motiveCounts.DCM), `${filteredAbortivas.length > 0 ? ((motiveCounts.DCM / filteredAbortivas.length) * 100).toFixed(1) : 0}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: [26, 31, 37], textColor: [212, 175, 55] },
  });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    pageWidth - 20,
    doc.internal.pageSize.getHeight() - 10,
    { align: "right" },
  );

  return doc;
};

type SectionKey =
  | "Inicio"
  | "RELPREV"
  | "FGR"
  | "Abortiva"
  | "Mapa de Risco"
  | "Portal Único de Notificação"
  | "Abastecimento"
  | "Medicamentos"
  | "Normas CAvEx"
  | "Telefones"
  | "Admin"
  | "Sugestoes";

const MONTHS_MAP: Record<string, string> = {
  JANEIRO: "01",
  FEVEREIRO: "02",
  MARÇO: "03",
  MARCO: "03",
  ABRIL: "04",
  MAIO: "05",
  JUNHO: "06",
  JULHO: "07",
  AGOSTO: "08",
  SETEMBRO: "09",
  OUTUBRO: "10",
  NOVEMBRO: "11",
  DEZEMBRO: "12",
};

async function processPDVFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = (window as any).pdfjsLib || pdfjs;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const MONTHS_MAP_LOCAL: Record<string, string> = {
    JANEIRO: "01",
    FEVEREIRO: "02",
    MARCO: "03",
    "MARÇO": "03",
    ABRIL: "04",
    MAIO: "05",
    JUNHO: "06",
    JULHO: "07",
    AGOSTO: "08",
    SETEMBRO: "09",
    OUTUBRO: "10",
    NOVEMBRO: "11",
    DEZEMBRO: "12"
  };

  const dayMap = new Map<string, any[]>();
  let lastContinuationDay: string | null = null;

  const toLinearText = (s: string) => {
    return String(s || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  };

  const cleanCell = (s: string) => {
    return String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
  };

  const joinCell = (parts: string[]) => {
    return cleanCell(parts.filter(x => x !== undefined && x !== null && String(x).trim() !== "").join(" "));
  };

  const stripAccents = (s: string) => {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const isAirportCode = (s: string) => {
    return /^[A-Z]{4}$/.test(String(s || "").replace(/[^A-Z]/g, ""));
  };

  const findHeaders = (text: string) => {
    const re = /PLANO\s+DI[AÁ]RIO\s+DE\s+VOO\s+PARA\s+O\s+DIA\s+(\d{1,2})\s+DE\s+(?:DE\s+)?([A-ZÇÃÁÉÍÓÚ]+)\s+DE\s+(\d{4})/gi;
    const headers: { index: number; key: string }[] = [];
    for (const m of text.matchAll(re)) {
      const dd = String(parseInt(m[1], 10)).padStart(2, "0");
      const rawMonth = m[2].toUpperCase();
      const mm = MONTHS_MAP_LOCAL[rawMonth] || MONTHS_MAP_LOCAL[stripAccents(rawMonth)] || null;
      if (!mm) continue;
      const key = `${dd}/${mm}/${m[3]}`;
      headers.push({ index: m.index!, key });
    }
    return headers;
  };

  const findAllIndexes = (text: string, re: RegExp) => {
    return [...text.matchAll(re)].map(m => m.index!);
  };

  const findNearestPreviousHeader = (pos: number, headers: { index: number; key: string }[]) => {
    let day = null;
    for (const h of headers) {
      if (h.index < pos) day = h.key;
      else break;
    }
    return day;
  };

  const firstAfter = (list: number[], pos: number) => {
    for (const x of list) {
      if (x > pos) return x;
    }
    return null;
  };

  const indexAfter = (text: string, re: RegExp, start: number) => {
    const m = re.exec(text.slice(start));
    return m ? start + m.index : null;
  };

  const findLastPobIndex = (tokens: string[]) => {
    const known = new Set(["TBN", "ASD", "FTB", "ATB"]);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = stripAccents(tokens[i]).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (known.has(t)) return i;
    }
    return -1;
  };

  const extractMission = (tokens: string[]) => {
    const pobIdx = findLastPobIndex(tokens);
    let start = pobIdx >= 0 ? pobIdx + 1 : -1;
    if (start < 0) {
      start = Math.max(0, tokens.length - 4);
    }
    let end = tokens.length;
    for (let i = start; i < tokens.length; i++) {
      const t = tokens[i];
      if (/^\(/.test(t) || t === "-" || /^LEGENDAS:?$/i.test(stripAccents(t))) {
        end = i;
        break;
      }
    }
    return cleanCell(tokens.slice(start, end).join(" "));
  };

  const parseLaunchBlock = (block: string) => {
    const cleanBlock = toLinearText(block)
      .replace(/\bLEGENDAS\b[\s\S]*$/i, "")
      .replace(/ORIGINAL\s+ASSINADO[\s\S]*$/i, "")
      .replace(/CRISTIAN\s+FERNANDO[\s\S]*$/i, "")
      .trim();

    const tokens = cleanBlock.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) return null;
    if (!/^\d{2}$/.test(tokens[0]) || stripAccents(tokens[1]).toUpperCase() !== "EXB") return null;

    const lc = tokens[0];
    const anv = joinCell(["EXB", tokens[2] || ""]);
    const p1 = tokens[3] || "";
    const p2 = tokens[4] || "";

    const idxAfterCrew = 5;
    let adIdx = -1;
    for (let i = idxAfterCrew; i < tokens.length; i++) {
      if (isAirportCode(tokens[i])) {
        adIdx = i;
        break;
      }
    }

    let mv = "";
    let adDest = "";
    if (adIdx >= 0) {
      mv = joinCell(tokens.slice(idxAfterCrew, adIdx));
      adDest = tokens[adIdx] || "";
    } else {
      const pobIdx = findLastPobIndex(tokens);
      const stop = pobIdx > idxAfterCrew ? Math.min(pobIdx, idxAfterCrew + 4) : Math.min(tokens.length, idxAfterCrew + 4);
      mv = joinCell(tokens.slice(idxAfterCrew, stop));
      adDest = "";
    }

    const missao = extractMission(tokens);
    const display = `LÇ ${lc} - ${anv} - ${p1} - ${p2} - ${mv} - ${adDest} - ${missao}`
      .replace(/\s+-\s+-\s+/g, " - - ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      lc,
      num: lc,
      anv,
      p1,
      p2,
      mv,
      adDest,
      missao,
      display,
      uniqueKey: `${lc}_${anv}_${p1}_${p2}_${adDest}_${missao}`.replace(/\s+/g, "")
    };
  };

  const addLaunch = (day: string, launch: any) => {
    if (!dayMap.has(day)) dayMap.set(day, []);
    const arr = dayMap.get(day)!;
    const key = `${launch.lc}|${launch.anv}|${launch.p1}|${launch.p2}|${launch.mv}|${launch.adDest}|${launch.missao}`;
    if (arr.some(x => `${x.lc}|${x.anv}|${x.p1}|${x.p2}|${x.mv}|${x.adDest}|${x.missao}` === key)) return false;
    arr.push(launch);
    arr.sort((a, b) => Number(a.lc) - Number(b.lc) || a.display.localeCompare(b.display));
    return true;
  };

  // Process text line by line / page by page
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false
    } as any);
    const pageText = toLinearText(content.items.map((i: any) => i.str || "").join(" "));
    if (!pageText) continue;

    const headers = findHeaders(pageText);
    const tableStarts = findAllIndexes(pageText, /\bLÇ\s+ANV\s+1P\s+2P\s+MV\b/gi);
    const eligibleHeaders = headers.filter((h, idx) => {
      const next = headers[idx + 1]?.index ?? pageText.length;
      const section = pageText.slice(h.index, next);
      return !/SEM\s+ATIVIDADE\s+A[ÉE]REA/i.test(section);
    });

    const tableDay = new Map<number, string>();
    if (tableStarts.length) {
      for (let i = 0; i < tableStarts.length; i++) {
        let day = eligibleHeaders[i]?.key;
        if (!day) day = findNearestPreviousHeader(tableStarts[i], eligibleHeaders) || lastContinuationDay;
        if (day) tableDay.set(tableStarts[i], day);
      }
      const lastTable = tableStarts[tableStarts.length - 1];
      if (tableDay.get(lastTable)) lastContinuationDay = tableDay.get(lastTable)!;
    }

    const rowMatches = [...pageText.matchAll(/(?:^|\s)(\d{2})\s+EXB\s+(\S+)/gi)];
    for (let r = 0; r < rowMatches.length; r++) {
      const m = rowMatches[r];
      const rowStart = m.index! + (/^\s/.test(m[0]) ? 1 : 0);
      let rowEnd = m.index! + m[0].length;
      if (r + 1 < rowMatches.length) {
        rowEnd = rowMatches[r + 1].index!;
      } else {
        rowEnd = pageText.length;
      }

      const nextTable = firstAfter(tableStarts, rowStart);
      const nextHeader = headers.find(h => h.index > rowStart)?.index;
      const nextLegend = indexAfter(pageText, /\bLEGENDAS\b|ORIGINAL\s+ASSINADO|CRISTIAN\s+FERNANDO/i, rowStart + 5);
      rowEnd = Math.min(rowEnd, nextTable ?? rowEnd, nextHeader ?? rowEnd, nextLegend ?? rowEnd);

      const block = pageText.slice(rowStart, rowEnd);
      const launch = parseLaunchBlock(block);
      if (!launch) continue;

      const previousTable = [...tableStarts].reverse().find(t => t < rowStart);
      const day = (previousTable != null ? tableDay.get(previousTable) : null) || findNearestPreviousHeader(rowStart, eligibleHeaders) || lastContinuationDay;
      if (!day) continue;

      addLaunch(day, launch);
      lastContinuationDay = day;
    }
  }

  const results: { dateLabel: string; launches: any[] }[] = [];
  for (const [dateLabel, launches] of dayMap.entries()) {
    launches.sort((a, b) => Number(a.lc) - Number(b.lc));
    results.push({ dateLabel, launches });
  }

  return results;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<SectionKey>("Inicio");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [abastecimentoConfig, setAbastecimentoConfig] = useState<any>(null);
  const [abastecimentoFiles, setAbastecimentoFiles] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "abastecimento"), (snap) => {
      if (snap.exists()) {
        setAbastecimentoConfig(snap.data());
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "documentos_abastecimento"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const files = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAbastecimentoFiles(files);
    });
    return () => unsub();
  }, []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [totalRelprev, setTotalRelprev] = useState(0);
  const [launches, setLaunches] = useState<any[]>([]);
  const [fgrs, setFgrs] = useState<any[]>([]);
  const [abortivas, setAbortivas] = useState<any[]>([]);
  const [selectedLaunchIdAbortiva, setSelectedLaunchIdAbortiva] = useState("");

  const [abortivaData, setAbortivaData] = useState({
    dataVoo: new Date().toISOString().split("T")[0],
    numLancamento: "",
    modeloAnv: "",
    motivo: "", // Will be filled with DCM on selection
    preenchidoPor: "",
    tripulacao: "",
  });

  useEffect(() => {
    const q = query(
      collection(db, "Lancamentos"),
      orderBy("createdAt", "desc"),
      limit(100),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setLaunches(data);
      },
      (err) => {
        console.error("Erro ao buscar lançamentos:", err);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const qFgr = query(
      collection(db, "fgrMissions"),
      orderBy("createdAt", "desc"),
    );
    const qAbortivas = query(
      collection(db, "abortivas"),
      orderBy("createdAt", "desc"),
    );

    const unsubFgr = onSnapshot(
      qFgr,
      (snap) => {
        setFgrs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error("Erro no listener de FGR (App):", err);
      },
    );

    const unsubAbortivas = onSnapshot(
      qAbortivas,
      (snap) => {
        setAbortivas(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error("Erro no listener de Abortivas (App):", err);
      },
    );

    return () => {
      unsubFgr();
      unsubAbortivas();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setTotalRelprev(0);
      return;
    }
    const q = query(
      collection(db, "relprevReports"),
      where("uid", "==", user.uid),
    );
    const unsubscribe = onSnapshot(q, (snap) => setTotalRelprev(snap.size));
    return () => unsubscribe();
  }, [user]);

  // Connection Test removed as it caused permission errors

  // Auth Listener
  useEffect(() => {
    console.log("Configurando listener de autenticação (Modo Automático)...");
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (currentUser) {
          console.log(
            "Usuário autenticado:",
            currentUser.isAnonymous ? "Anônimo" : currentUser.email,
          );
          setUser(currentUser);
          setIsAuthLoading(false);
        } else {
          console.log(
            "Nenhum usuário detectado. Iniciando sessão automática...",
          );
          signInAnonymously(auth).catch((error) => {
            console.warn(
              "Login anônimo desativado no console ou erro de rede:",
              error,
            );
            setIsAuthLoading(false);
          });
        }
      },
      (error) => {
        console.error("Erro no onAuthStateChanged:", error);
        setIsAuthLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const [isConsultFgrModalOpen, setIsConsultFgrModalOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const navItems = [
    { id: "Inicio", name: "Início", icon: Home },
    { id: "RELPREV", name: "PREENCHIMENTO DE RELPREV", icon: FileSearch },
    { id: "FGR", name: "FGR", icon: ShieldCheck },
    { id: "Abortiva", name: "Abortiva", icon: Zap },
    { id: "Mapa de Risco", name: "Mapa de Risco", icon: MapIcon },
    { id: "Abastecimento", name: "Abastecimento", icon: Droplets },
    { id: "Medicamentos", name: "Medicamentos de Uso Restritivo", icon: Pill },
    { id: "Normas CAvEx", name: "Normas CAvEx", icon: Gavel },
    { id: "Telefones", name: "Telefones", icon: Phone },
    { id: "Sugestoes", name: "Sugestões", icon: MessageSquarePlus },
  ];

  const handleTabChange = (tab: any) => {
    if (tab === "Portal Único de Notificação") {
      window.open(
        "https://santosdumont.anac.gov.br/menu/r/api/portal_unico_notificacao/selecao-do-tipo-de-evento?clear=103&session=111703245409353",
        "_blank",
      );
      return;
    }
    if (tab === "Admin" && !isAdminAuthenticated) {
      setIsAdminModalOpen(true);
      return;
    }
    setActiveTab(tab);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "sipaa2bavex") {
      setIsAdminAuthenticated(true);
      setIsAdminModalOpen(false);
      setActiveTab("Admin");
      setAdminPassword("");
    } else {
      alert("Senha incorreta");
    }
  };

  return (
    <div className="flex h-screen bg-military-black overflow-hidden relative selection:bg-military-gold selection:text-military-black">
      {/* Admin Password Modal */}
      <AnimatePresence>
        {isAdminModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-military-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-military max-w-sm w-full p-8 space-y-6"
            >
              <div className="flex flex-col items-center gap-4 text-center mb-4">
                <img
                  src="https://i.ibb.co/0pjMXVKB/2-bavex.png"
                  alt="2º BAvEx Logo"
                  className="w-16 h-16 object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://upload.wikimedia.org/wikipedia/commons/e/e0/S%C3%ADmbolo_do_2%C2%BA_BAvEx.png";
                  }}
                />
                <div className="flex justify-between items-center w-full">
                  <h3 className="text-military-gold font-black uppercase text-xs tracking-widest flex items-center gap-2">
                    <Lock size={14} />
                    Acesso Administrativo
                  </h3>
                  <button
                    onClick={() => setIsAdminModalOpen(false)}
                    className="text-text-secondary hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-secondary">
                    Senha de Acesso
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-military-black border border-border-theme rounded p-3 text-white focus:border-military-gold outline-none transition-colors"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="btn-military w-full py-3 text-xs"
                >
                  AUTENTICAR
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? (isMobile ? "280px" : "240px") : "0px",
          x: isSidebarOpen ? 0 : isMobile ? -300 : -240,
        }}
        className={`fixed lg:relative z-50 bg-bg-sidebar border-r border-border-theme flex flex-col h-full shadow-2xl transition-all duration-300 ease-in-out`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-border-theme">
          <div className="w-10 h-10 bg-accent-gold/20 flex items-center justify-center rounded-lg border border-accent-gold/30">
            <img
              src="https://i.ibb.co/0pjMXVKB/2-bavex.png"
              className="w-8 h-8 object-contain"
              alt="2º BAvEx Logo"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback to the original icon if the image fails to load
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const fallback = document.createElement("div");
                  fallback.className = "text-accent-gold text-xl font-bold";
                  fallback.innerText = "2";
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-widest text-accent-gold leading-none">
              2º BAvEx
            </span>
            <span className="text-[10px] text-text-secondary font-medium mt-1 uppercase tracking-widest">
              Exército Brasileiro
            </span>
          </div>
          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="ml-auto text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Scrollable Menu Area */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-4 px-6 py-3 transition-all duration-200 group relative border-l-[3px] ${
                    isActive
                      ? "bg-accent-gold/10 text-accent-gold border-l-accent-gold"
                      : "text-text-secondary hover:bg-accent-gold/5 hover:text-white border-l-transparent"
                  }`}
                >
                  <div className="flex-shrink-0 w-5 flex justify-center">
                    <Icon
                      size={16}
                      className={
                        isActive
                          ? "text-accent-gold"
                          : "text-text-secondary group-hover:text-white"
                      }
                    />
                  </div>
                  <span className="text-[13px] font-medium text-left leading-tight block flex-1">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile & Admin Section at Bottom */}
        <div className="px-4 py-4 border-t border-border-theme space-y-4">
          <button
            onClick={() => handleTabChange("Admin")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all duration-200 text-[10px] font-black uppercase tracking-widest ${
              activeTab === "Admin"
                ? "bg-accent-gold text-bg-deep shadow-lg shadow-accent-gold/10"
                : "text-accent-gold border border-accent-gold/20 hover:bg-accent-gold/10"
            }`}
          >
            <div className="flex-shrink-0 w-4 flex justify-center">
              {isAdminAuthenticated ? <Unlock size={12} /> : <Lock size={12} />}
            </div>
            <span className="text-left flex-1">Área Administrativa</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-bg-deep relative overflow-hidden">
        {/* Header */}
        <header className="h-[50px] md:h-[60px] border-b border-border-theme bg-bg-panel/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-all"
              >
                <Menu size={18} />
              </button>
            )}
            <button
              onClick={() => handleTabChange("Admin")}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-military-gold/10 text-military-gold border border-military-gold/20 text-[10px] font-black uppercase tracking-widest hover:bg-military-gold hover:text-military-black transition-all"
            >
              <Lock size={12} />
              <span className="hidden sm:inline">Portal Administrativo</span>
            </button>
          </div>

          <div className="flex items-center gap-6 text-[12px] text-text-secondary">
            <span className="hidden md:block">
              Taubaté, SP | {new Date().toLocaleDateString("pt-BR")} |{" "}
              {new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              Z
            </span>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 relative custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto w-full pb-20"
            >
              {React.createElement(sectionComponents[activeTab], {
                user,
                onTabChange: handleTabChange,
                onConsultFgr: () => setIsConsultFgrModalOpen(true),
                abastecimentoConfig,
                abastecimentoFiles,
                launches,
                setLaunches,
                fgrs: fgrs,
                abortivas,
                isAdminAuthenticated,
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Consult FGR Modal */}
      <AnimatePresence>
        {isConsultFgrModalOpen && (
          <div className="fixed inset-0 z-[60] bg-military-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-military-black border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-military-gold flex items-center justify-center text-military-black">
                    <Search size={20} />
                  </div>
                  <div>
                    <h2 className="font-black text-white uppercase tracking-widest text-lg">
                      Consultar FGRs
                    </h2>
                    <p className="text-[10px] text-slate-400 uppercase tracking-tighter">
                      Visualizar e imprimir formulários gerados
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsConsultFgrModalOpen(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {fgrs.length > 0 && (
                  <>
                    {(() => {
                      const grouped = fgrs.reduce((acc: any, f: any) => {
                        const date = f.data || "SEM DATA";
                        if (!acc[date]) acc[date] = [];
                        acc[date].push(f);
                        return acc;
                      }, {});

                      const sortedDates = Object.keys(grouped).sort((a, b) => {
                        if (a === "SEM DATA") return 1;
                        if (b === "SEM DATA") return -1;
                        
                        const parseDate = (dStr: string) => {
                          if (dStr.includes("/")) {
                            const [d, m, y] = dStr.split("/").map(Number);
                            return new Date(y, m - 1, d).getTime();
                          }
                          return new Date(dStr).getTime();
                        };

                        return parseDate(b) - parseDate(a);
                      });

                      return sortedDates.map((date) => (
                        <div key={date} className="space-y-4">
                          <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-xl border-l-4 border-military-gold shadow-lg backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-military-gold/10 flex items-center justify-center text-military-gold">
                                <Calendar size={18} />
                              </div>
                              <div className="flex flex-col">
                                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                                  {date !== "SEM DATA" 
                                    ? date.split("-").reverse().join("/")
                                    : "DATA NÃO INFORMADA"}
                                </h3>
                                <span className="text-[7px] text-military-gold font-bold uppercase tracking-widest mt-0.5">
                                  Formulário de Gerenciamento de Risco
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 h-px bg-white/5" />
                            <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                              {grouped[date].length} {grouped[date].length === 1 ? 'Missão' : 'Missões'}
                            </div>
                          </div>

                          {/* Desktop Table - Only on large screens */}
                          <div className="hidden lg:block card-military overflow-hidden">
                            <div className="overflow-x-auto no-scrollbar">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="border-b border-border-theme text-[10px] uppercase text-text-secondary font-black">
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3">Missão</th>
                                    <th className="px-4 py-3">Aeronave</th>
                                    <th className="px-4 py-3">Risco</th>
                                    <th className="px-4 py-3 text-right font-black tracking-widest text-military-gold">
                                      PDF / AÇÕES
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-theme/30 text-[11px]">
                                  {grouped[date]
                                    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((f: any) => (
                                      <tr
                                        key={f.id}
                                        className="hover:bg-white/2 transition-colors"
                                      >
                                        <td className="px-4 py-3 font-mono">
                                          {f.data
                                            ? f.data.split("-").reverse().join("/")
                                            : new Date(f.createdAt).toLocaleDateString("pt-BR")}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex flex-col">
                                            <span className="text-white font-bold">{f.missao}</span>
                                            {!launches.some(l => 
                                              l.linkedFgrId === f.id || 
                                              (getFgrLaunchNums(f, launches).split(", ").some(num => num !== "S/N" && num === extractLaunchNum(l)) && 
                                              (!f.data || (l.dateLabel && l.dateLabel.split("/").reverse().join("-") === f.data)))
                                            ) && (
                                              <div className="flex flex-col mt-0.5">
                                                <span className="text-red-500 font-bold text-sm leading-none">*</span>
                                                <span className="text-[7px] text-red-500/80 font-black uppercase tracking-tight leading-none whitespace-nowrap">
                                                  Sem associação com PDV
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-text-secondary uppercase">
                                          {f.aeronave} | {f.relatorName || "Conv."}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span
                                            className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest ${getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).bg} ${getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).color}`}
                                          >
                                            {f.scores?.riskMax || 0} pts - {getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).label}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                                          <button
                                            onClick={() => {
                                              const docPdf = generateFgrPDF(f);
                                              const fgrBlob = docPdf.output("blob");
                                              const fgrUrl = URL.createObjectURL(fgrBlob);
                                              window.open(fgrUrl, "_blank");
                                            }}
                                            className="text-military-gold hover:text-white flex items-center gap-1.5 p-1"
                                          >
                                            <Eye size={14} />
                                            <span className="text-[10px] uppercase font-black">
                                              Ver PDF
                                            </span>
                                          </button>
                                          <button
                                            onClick={() => {
                                              const docPdf = generateFgrPDF(f);
                                              let dStr = "SemData";
                                              if (f.data) {
                                                dStr = f.data.includes("-")
                                                  ? f.data.split("-").reverse().join("-")
                                                  : f.data.replace(/\//g, "-");
                                              } else if (f.createdAt) {
                                                dStr = new Date(f.createdAt)
                                                  .toLocaleDateString("pt-BR")
                                                  .replace(/\//g, "-");
                                              }
                                              const mSafe = (f.missao || "FGR").replace(
                                                /[/\\?%*:|"<>]/g,
                                                "-",
                                              );
                                              docPdf.save(`${dStr}_${mSafe}.pdf`);
                                            }}
                                            className="text-slate-200 hover:text-white flex items-center gap-1.5 p-1"
                                            title="Baixar PDF Original"
                                          >
                                            <Download size={14} />
                                            <span className="text-[10px] uppercase font-black">
                                              Baixar
                                            </span>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Mobile/Tablet Cards - Shown on smaller screens */}
                          <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
                            {grouped[date]
                              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                              .map((f: any) => (
                                <div
                                  key={f.id}
                                  className="card-military p-4 space-y-3 flex flex-col justify-between hover:border-military-gold/50 transition-all border border-white/5"
                                >
                                  <div>
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex flex-col overflow-hidden">
                                        <span className="text-white font-black text-xs uppercase tracking-tight truncate">
                                          {f.missao}
                                        </span>
                                        {!launches.some(l => 
                                          l.linkedFgrId === f.id || 
                                          (getFgrLaunchNums(f, launches).split(", ").some(num => num !== "S/N" && num === extractLaunchNum(l)) && 
                                          (!f.data || (l.dateLabel && l.dateLabel.split("/").reverse().join("-") === f.data)))
                                        ) && (
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-red-500 font-bold text-xs leading-none">*</span>
                                            <span className="text-[7px] text-red-500/80 font-black uppercase tracking-tight leading-none whitespace-nowrap">
                                              Sem associação com PDV
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter shrink-0 ${getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).bg} ${getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).color}`}
                                      >
                                        {f.scores?.riskMax || 0} PTS - {getRiskClass(f.scores?.riskMax || 0, f.tipoVoo).label.toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-text-secondary uppercase font-bold tracking-tight grid grid-cols-2 gap-2 mb-1">
                                      <div className="truncate">
                                        Av: <span className="text-slate-300">{f.aeronave}</span>
                                      </div>
                                      <div className="text-right">
                                        {f.data
                                          ? f.data.split("-").reverse().join("/")
                                          : new Date(f.createdAt).toLocaleDateString("pt-BR")}
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-text-secondary uppercase font-bold tracking-tight truncate">
                                      Rel:{" "}
                                      <span className="text-slate-300">
                                        {f.relatorName || "Conv."}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                                    <button
                                      onClick={() => {
                                        const doc = generateFgrPDF(f);
                                        window.open(doc.output("bloburl"), "_blank");
                                      }}
                                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-military-gold text-military-black text-[10px] font-black uppercase tracking-wider shadow-lg hover:scale(102) active:scale-95 transition-all"
                                    >
                                      <FileText size={14} /> PDF
                                    </button>
                                    <button
                                      onClick={() => {
                                        const docPdf = generateFgrPDF(f);
                                        let dStr = "SemData";
                                        if (f.data) {
                                          dStr = f.data.includes("-")
                                            ? f.data.split("-").reverse().join("-")
                                            : f.data.replace(/\//g, "-");
                                        } else if (f.createdAt) {
                                          dStr = new Date(f.createdAt)
                                            .toLocaleDateString("pt-BR")
                                            .replace(/\//g, "-");
                                        }
                                        const mSafe = (f.missao || "FGR").replace(
                                          /[/\\?%*:|"<>]/g,
                                          "-",
                                        );
                                        docPdf.save(`${dStr}_${mSafe}.pdf`);
                                      }}
                                      className="w-10 h-9 flex items-center justify-center rounded bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
                                      title="Baixar PDF"
                                    >
                                      <Download size={16} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </>
                )}
                  
                {fgrs.length === 0 && (
                  <div className="py-20 text-center opacity-40">
                    <FileSearch className="mx-auto mb-4 text-slate-600" size={48} />
                    <p className="text-sm uppercase font-bold tracking-widest text-slate-500">Nenhum FGR gerado até o momento</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SECTIONS ---

const CAROUSEL_IMAGES = [
  "https://i.postimg.cc/pySxKC0N/1.png",
  "https://i.postimg.cc/F16m0pPv/2.png",
  "https://i.postimg.cc/RqY9wdPM/3.png",
  "https://i.postimg.cc/Cd2Yb7vS/4.png",
  "https://i.postimg.cc/qgF02wm0/5.png",
  "https://i.postimg.cc/PN7h1y6f/6.png",
];

function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
  };

  const handlePrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length,
    );
  };

  return (
    <div className="relative w-full h-[400px] lg:h-[500px] overflow-hidden rounded-lg group border border-border-theme bg-[#0a0f18] select-none">
      {/* Blurred Background */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`bg-${CAROUSEL_IMAGES[currentIndex]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 z-0 bg-center bg-cover blur-2xl scale-110"
          style={{ backgroundImage: `url(${CAROUSEL_IMAGES[currentIndex]})` }}
        />
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
        {/* Active Image Container */}
        <div className="relative w-full max-w-4xl h-[75%] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.img
              key={CAROUSEL_IMAGES[currentIndex]}
              src={CAROUSEL_IMAGES[currentIndex]}
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 1.05, x: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>

          {/* Navigation Arrows */}
          <button
            onClick={handlePrev}
            className="absolute left-4 p-2 rounded-full bg-black/40 text-white border border-white/10 hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 z-20"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 p-2 rounded-full bg-black/40 text-white border border-white/10 hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 z-20"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Thumbnails */}
        <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-none max-w-full px-4">
          {CAROUSEL_IMAGES.map((img, idx) => (
            <button
              key={`thumb-${idx}`}
              onClick={() => setCurrentIndex(idx)}
              className={`relative flex-shrink-0 w-20 h-12 rounded overflow-hidden border-2 transition-all ${
                currentIndex === idx
                  ? "border-accent-gold scale-105 shadow-lg"
                  : "border-white/10 opacity-40 grayscale hover:opacity-100 hover:grayscale-0"
              }`}
            >
              <img
                src={img}
                className="w-full h-full object-cover"
                alt={`Thumbnail ${idx + 1}`}
                referrerPolicy="no-referrer"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InicioSection({
  onTabChange,
  onConsultFgr,
  launches,
  fgrs,
  abortivas,
}: {
  onTabChange: (tab: SectionKey) => void;
  onConsultFgr: () => void;
  launches: any[];
  fgrs: any[];
  abortivas: any[];
}) {
  return (
    <div className="space-y-8">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#101826] to-[#0d121d] border border-border-theme p-8 lg:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <img
            src="https://i.ibb.co/0pjMXVKB/2-bavex.png"
            className="w-40 h-40 object-contain"
            alt=""
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-accent-gold/20 flex items-center justify-center rounded-xl border border-accent-gold/30 shadow-2xl overflow-hidden">
              <img
                src="https://i.ibb.co/0pjMXVKB/2-bavex.png"
                className="w-10 h-10 object-contain"
                alt="2º BAvEx Logo"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="w-[1px] h-12 bg-border-theme" />
            <div>
              <p className="text-accent-gold text-[10px] font-black uppercase tracking-[0.2em]">
                Exército Brasileiro
              </p>
              <h1 className="text-xl font-bold text-white tracking-widest">
                2º BAvEx
              </h1>
            </div>
          </div>
          <p className="text-accent-gold text-xs font-bold uppercase tracking-[0.2em] mb-4">
            Seção de Investigação e Prevenção de Acidentes Aeronáuticos
          </p>
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[28px] font-light text-white mb-6"
          >
            Bem-vindo ao Portal de Segurança de Voo
          </motion.h2>
          <div className="border-l-2 border-accent-gold pl-6 italic text-text-secondary text-sm max-w-xl leading-relaxed">
            "A segurança de voo é uma responsabilidade de todos nós. Previna-se,
            reporte e garanta a integridade de nossa missão."
          </div>
          <div className="grid grid-cols-1 gap-4 mt-10 w-full max-w-lg">
            <button
              onClick={() => onTabChange("RELPREV")}
              className="group flex items-center justify-between p-6 bg-military-gold rounded-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-t-2 border-white/20"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-military-black/10 flex items-center justify-center">
                  <FileSearch size={28} className="text-military-black" />
                </div>
                <div className="text-left">
                  <span className="block font-black text-military-black text-lg tracking-widest leading-none">
                    RELPREV
                  </span>
                  <span className="text-[10px] text-military-black/60 font-bold uppercase tracking-tighter mt-1 block">
                    Relatório de Prevenção
                  </span>
                </div>
              </div>
              <ChevronRight
                size={24}
                className="text-military-black/30 group-hover:translate-x-1 transition-transform"
              />
            </button>
            <button
              onClick={() => onTabChange("FGR")}
              className="group flex items-center justify-between p-6 bg-military-gold rounded-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-t-2 border-white/20"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-military-black/10 flex items-center justify-center">
                  <ShieldCheck size={28} className="text-military-black" />
                </div>
                <div className="text-left">
                  <span className="block font-black text-military-black text-lg tracking-widest leading-none">
                    FGR
                  </span>
                  <span className="text-[10px] text-military-black/60 font-bold uppercase tracking-tighter mt-1 block">
                    Gerenciamento de Risco
                  </span>
                </div>
              </div>
              <ChevronRight
                size={24}
                className="text-military-black/30 group-hover:translate-x-1 transition-transform"
              />
            </button>
            <button
              onClick={() => onTabChange("Abortiva")}
              className="group flex items-center justify-between p-6 bg-military-gold rounded-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-t-2 border-white/20"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-military-black/10 flex items-center justify-center">
                  <Zap size={28} className="text-military-black" />
                </div>
                <div className="text-left">
                  <span className="block font-black text-military-black text-lg tracking-widest leading-none">
                    ABORTIVA
                  </span>
                  <span className="text-[10px] text-military-black/60 font-bold uppercase tracking-tighter mt-1 block">
                    Interrupção de Missão
                  </span>
                </div>
              </div>
              <ChevronRight
                size={24}
                className="text-military-black/30 group-hover:translate-x-1 transition-transform"
              />
            </button>
            <button
              onClick={onConsultFgr}
              className="group flex items-center justify-between p-6 bg-military-blue border border-white/10 rounded-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-t-2 border-white/20"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
                  <Search size={24} />
                </div>
                <div className="text-left">
                  <span className="block font-black text-white text-lg tracking-widest leading-none uppercase">
                    Consultar FGR
                  </span>
                  <span className="text-[10px] text-white/60 font-bold uppercase tracking-tighter mt-1 block">
                    Visualizar arquivos gerados
                  </span>
                </div>
              </div>
              <ChevronRight
                size={24}
                className="text-white/30 group-hover:translate-x-1 transition-transform"
              />
            </button>
          </div>
        </div>
        {/* Abstract Background Element */}
        <div className="absolute -bottom-12 -right-12 h-64 w-64 bg-accent-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="space-y-4">
        <h3 className="text-military-gold font-black uppercase text-xs tracking-widest px-1">Estatísticas Operacionais</h3>
        <AdminStatsDashboard 
          fgrs={fgrs} 
          abortivas={abortivas} 
          launches={launches} 
        />
      </div>

      <ImageCarousel />

      {/* Grid Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickCard
          icon={FileSearch}
          title="Reportar RELPREV"
          desc="Registro de relato preventivo."
          color="blue"
          onClick={() => onTabChange("RELPREV")}
        />
        <QuickCard
          icon={ShieldCheck}
          title="Novo FGR"
          desc="Gerenciamento de risco operacional."
          color="blue"
          onClick={() => onTabChange("FGR")}
        />
        <QuickCard
          icon={Zap}
          title="Abortiva de Voo"
          desc="Relato de interrupção de missão."
          color="orange"
          onClick={() => onTabChange("Abortiva")}
        />
        <QuickCard
          icon={Search}
          title="Consultar FGR"
          desc="Visualizar arquivos gerados."
          color="blue"
          onClick={onConsultFgr}
        />
        <QuickCard
          icon={Lightbulb}
          title="Sugestões"
          desc="Sugira sugestões para o aplicativo da SIPAA."
          color="gold"
          onClick={() => onTabChange("Sugestoes")}
        />
      </div>
    </div>
  );
}

// --- RISK DATA CONSTANTS ---

const PARTE_II_DATA = [
  {
    id: "p2_1",
    text: "A tripulação está habilitada para a realização do voo (verificar o SisAvEx e a pasta dos tripulantes).",
  },
  {
    id: "p2_2",
    text: "A aeronave está liberada para o voo (Esqd He e/ou EMS).",
  },
  {
    id: "p2_3",
    text: "Aeronave sem nenhuma restrição que comprometa a execução da missão.",
  },
  {
    id: "p2_4",
    text: "Teste de combustível foi realizado com resultado satisfatório.",
  },
  {
    id: "p2_5",
    text: "Todos os materiais previstos no Manual de Manobras para o cumprimento da missão/voo estão em condições de uso.",
  },
  { id: "p2_6", text: "As N Op estão sendo cumpridas." },
  {
    id: "p2_7",
    text: "Todos os tripulantes em condições físicas de cumprir a missão.",
  },
  {
    id: "p2_8",
    text: "Toda a tripulação/envolvidos participam de um briefing.",
  },
  {
    id: "p2_9",
    text: "O Cartão de saúde de todos envolvidos no voo está válido.",
  },
  { id: "p2_10", text: "Ausência de CB na rota na execução do voo IFR." },
];

const PARTE_III_DATA = {
  RH: [
    {
      id: "p3_rh_1",
      text: "Um dos pilotos realizou pelo menos um voo em menos de 30 dias.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p3_rh_2",
      text: "O 1P/PO possui MENOS de 50 HV no modelo na função de 1P.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p3_rh_3",
      text: "O PA/PB possui MENOS de 50 HV no modelo na função de 2P.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p3_rh_4",
      text: "O MVO/MVI possui MENOS de 50 HV no modelo na função de MVO/MVI.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p3_rh_5",
      text: "MVA/MVB possui MENOS de 50 HV no modelo na função de MVA/MVB.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p3_rh_6",
      text: "A tripulação participou do CRM nos últimos 24 meses.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p3_rh_7",
      text: "Briefing da missão realizado de forma completa e detalhada.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p3_rh_8",
      text: "Houve briefing de segurança para todos os envolvidos na missão, SFC.",
      w: { S: 0, N: 3, D: 3 },
    },
  ],
  METEO: [
    {
      id: "p3_me_1",
      text: "O local de pouso/decolagem foi reconhecido (locais não homologados).",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p3_me_2",
      text: "Existe aglomeração de pássaros na região de voo.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p3_me_3",
      text: "As informações necessárias ao voo estão disponíveis (NOTAM, Meteorologia, etc).",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p3_me_4",
      text: "As publicações técnicas necessárias ao voo estão atualizadas e disponíveis.",
      w: { S: 0, N: 1, D: 1 },
    },
    {
      id: "p3_me_5",
      text: "Existe previsão de tempo significativo em rota (CB, frente fria, instabilidade, etc).",
      w: { S: 3, N: 0, D: 3 },
    },
    {
      id: "p3_me_6",
      text: "Infraestrutura necessária ao voo em condições de prestar apoio.",
      w: { S: 0, N: 1, D: 1 },
    },
  ],
  MATERIAL: [
    {
      id: "p3_ma_1",
      text: "A aeronave se encontra com MENOS de 10 HV após inspeção A/TC.",
      w: { S: 3, N: 0, D: 3 },
    },
    {
      id: "p3_ma_2",
      text: "A aeronave ECD executar o voo pairado fora do efeito solo no local de pouso.",
      w: { S: 0, N: 3, D: 3 },
    },
    {
      id: "p3_ma_3",
      text: "A aeronave já foi pré-voada.",
      w: { S: 0, N: 1, D: 1 },
    },
  ],
  MISSAO: [
    {
      id: "p3_mi_1",
      text: "Adequado tempo para planejamento e preparação.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p3_mi_2",
      text: "Voo com duração superior a 3 (três) HV contínuas.",
      w: { S: 1, N: 0, D: 1 },
    },
    {
      id: "p3_mi_3",
      text: "Operações com duração superior a 5 dias.",
      w: { S: 1, N: 0, D: 1 },
    },
    {
      id: "p3_mi_4",
      text: "Mais de 05 repetições da mesma manobra.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p3_mi_5",
      text: "Voo com autoridade de bordo.",
      w: { S: 3, N: 0, D: 3 },
    },
    {
      id: "p3_mi_6",
      text: "Há tempo suficiente para o cumprimento da missão, mesmo havendo imprevistos.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p3_mi_7",
      text: "O MV estará embarcado no voo.",
      w: { S: 0, N: 2, D: 2 },
    },
  ],
  ORG: [
    {
      id: "p3_or_1",
      text: "Existem pressões externas para execução dessa missão.",
      w: { S: 3, N: 0, D: 3 },
    },
    {
      id: "p3_or_2",
      text: "A tripulação participou da padronização de manobras e procedimentos da U.A.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p3_or_3",
      text: "A tripulação participa regularmente das reuniões de Seg Voo da OM.",
      w: { S: 0, N: 1, D: 1 },
    },
    {
      id: "p3_or_4",
      text: "A tripulação e/ou Fração de Helicópteros é toda da mesma U.A.",
      w: { S: 0, N: 2, D: 2 },
    },
  ],
};

const PARTE_IV_DATA = {
  INSTRUCAO: [
    { id: "p4_in_1", text: "Haverá hot-seat.", w: { S: 1, N: 0, D: 1 } },
    {
      id: "p4_in_2",
      text: "O voo será realizado com piloto aluno e/ou com piloto em formação IFR ou OVN.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p4_in_3",
      text: "É voo de emergência, IFR ou OVN.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p4_in_4",
      text: "É o primeiro voo de Habilitação Técnica de algum tripulante no modelo de aeronave.",
      w: { S: 2, N: 0, D: 2 },
    },
  ],
  IFR: [
    {
      id: "p4_if_1",
      text: "O voo será ACIMA de 10.000 ft (hipóxia).",
      w: { S: 1, N: 0, D: 1 },
    },
    {
      id: "p4_if_2",
      text: "O nivelamento manter-se-á acima dos obstáculos previstos na rota.",
      w: { S: 0, N: 3, D: 3 },
    },
    {
      id: "p4_if_3",
      text: "O Briefing meteorológico foi realizado por especialista.",
      w: { S: 0, N: 1, D: 1 },
    },
    {
      id: "p4_if_4",
      text: "Um dos pilotos realizou voo IFR em um período inferior a 30 dias.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p4_if_5",
      text: "A DEP foi realizada a partir de um aeródromo homologado IFR.",
      w: { S: 0, N: 2, D: 2 },
    },
  ],
  OVN: [
    {
      id: "p4_ov_1",
      text: "Será realizado voo na noite de nível 4 ou 5.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p4_ov_2",
      text: "Será realizado voo em área urbana.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p4_ov_3",
      text: "Foi realizado reconhecimento fora das áreas de instrução da Av Ex.",
      w: { S: 0, N: 3, D: 3 },
    },
    {
      id: "p4_ov_4",
      text: "Dispositivo de iluminação individual compatível com o voo OVN.",
      w: { S: 0, N: 1, D: 1 },
    },
    {
      id: "p4_ov_5",
      text: "Presença de neblina e/ou precipitação.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p4_ov_6",
      text: "Mais de 30 dias sem voar OVN.",
      w: { S: 2, N: 0, D: 2 },
    },
  ],
  TECNICO: [
    {
      id: "p4_te_1",
      text: "É o primeiro giro e/ou voo após inspeção.",
      w: { S: 2, N: 0, D: 2 },
    },
    {
      id: "p4_te_2",
      text: "É o primeiro voo após troca de componentes vitais.",
      w: { S: 3, N: 0, D: 3 },
    },
    {
      id: "p4_te_3",
      text: "A aeronave está abastecida com a autonomia mínima de 40 minutos.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p4_te_4",
      text: "Foi verificada e fechada todas as OS afetas às intervenções.",
      w: { S: 0, N: 2, D: 2 },
    },
    {
      id: "p4_te_5",
      text: "Houve quebra na sequência de realização dos serviços de manutenção.",
      w: { S: 2, N: 0, D: 2 },
    },
  ],
};

const GRAVIDADE_DATA = [
  { id: "g0", text: "Valor Básico Inicial", pts: 1, fixed: true },
  { id: "g1", text: "Voo Tático", pts: 2 },
  { id: "g2", text: "Voo de Instrução", pts: 2, autoByTipo: "INSTRUCAO" },
  { id: "g3", text: "Voo de Instrução simultâneo", pts: 1 },
  { id: "g4", text: "Voo OVN", pts: 2, autoByTipo: "OVN" },
  { id: "g5", text: "Voo de demonstração", pts: 3 },
  { id: "g6", text: "Voo de formação", pts: 2 },
  { id: "g7", text: "Voo Solo", pts: 1 },
  { id: "g8", text: "Ambiente hostil real", pts: 3 },
  { id: "g9", text: "Voo Técnico (Mnt)", pts: 1, autoByTipo: "TECNICO" },
];

const SUGESTOES_MITIGACAO = {
  "RECURSOS HUMANOS": [
    "Baixa experiência ou longo período sem voar de pilotos, MVs ou mecânicos: a) Identificar no briefing os tripulantes com menor experiência ou há mais tempo sem voar e combinar atenção reforçada, apoio dos mais experientes e conferência cruzada nas fases críticas.",
    "CRM não realizado nos últimos 24 meses: a) Reforçar no briefing que qualquer tripulante deve informar dúvidas, desvios, riscos percebidos ou necessidade de arremetida, sem aguardar ordem do comandante.",
    "Briefing da missão ou briefing de segurança incompleto: a) Revisar com toda a tripulação a missão, rota, riscos principais, funções de cada integrante, critérios de abortagem e conduta de segurança para os envolvidos.",
  ],
  METEOROLOGIA: [
    "Local de pouso/decolagem não reconhecido ou não homologado: a) Brifar as informações disponíveis sobre o local, definir eixo de aproximação/decolagem, obstáculos prováveis, área de escape e condição mínima para prosseguir com o pouso.",
    "Presença de pássaros na região de voo: a) Alertar a tripulação sobre o risco de colisão com aves e combinar vigilância externa reforçada, principalmente na aproximação, decolagem e baixa altura.",
    "Informações de voo indisponíveis ou publicações desatualizadas: a) Confirmar antes do voo as informações disponíveis de NOTAM, meteorologia, cartas e publicações, destacando o que estiver indisponível ou incerto para decisão da tripulação.",
    "Previsão de tempo significativo em rota: a) Brifar as áreas de mau tempo previstas, rota alternativa, limite para desvio, ponto de retorno e condição mínima para manter o voo com segurança.",
    "Infraestrutura de apoio incerta no destino ou na rota: a) Confirmar no briefing qual apoio estará disponível, como comunicação, segurança da área, abastecimento, evacuação e alternativa caso o apoio não esteja presente.",
  ],
  MATERIAL: [
    "Aeronave com menos de 10 HV após inspeção A/TC: a) Revisar no briefing os serviços recentes e reforçar atenção a parâmetros, luzes, ruídos, vibrações e qualquer indicação anormal durante o voo.",
    "Aeronave com possibilidade de executar pairado fora do efeito solo no local de pouso: a) Confirmar no briefing o cálculo de desempenho, peso da aeronave, combustível previsto e margem de potência para o local da operação.",
    "Aeronave já pré-voada: a) Confirmar no briefing quem realizou o pré-voo, se houve discrepâncias e quais itens críticos deverão ser reconferidos pela tripulação.",
  ],
  MISSÃO: [
    "Tempo inadequado para planejamento e preparação: a) Revisar no briefing apenas os pontos críticos da missão e adiar a partida caso rota, meteorologia, combustível, desempenho ou alternativa não estejam claros.",
    "Voo superior a 3 HV contínuas ou operação superior a 5 dias: a) Brifar risco de fadiga, dividir tarefas, prever revezamento dos comandos e definir ponto para reavaliar o prosseguimento da missão.",
    "Mais de 05 repetições da mesma manobra: a) Definir no briefing limite de repetições por série, pausa para reavaliação e interrupção da manobra em caso de queda de desempenho ou atenção.",
    "Voo com autoridade de bordo: a) Reforçar no briefing que a presença de autoridade não altera mínimos, critérios de abortagem, decisão técnica ou autoridade da tripulação.",
    "Tempo insuficiente para cumprir a missão com imprevistos: a) Definir no briefing o horário ou condição limite para reduzir, interromper, retornar ou alternar a missão.",
    "MV não embarcado no voo: a) Brifar quais funções do MV ficarão sem cobertura, redistribuir a vigilância externa entre pilotos e limitar manobras que dependam de apoio visual externo.",
  ],
  ORGANIZAÇÃO: [
    "Pressões externas para execução da missão: a) Reforçar no briefing que mínimos, limitações, critérios de abortagem e decisão técnica da tripulação não serão alterados por pressão externa.",
    "Tripulação sem padronização recente de manobras e procedimentos da U.A.: a) Revisar no briefing a sequência da manobra, responsabilidades, callouts, limites operacionais e condição para interromper a execução.",
    "Baixa participação em reuniões de Segurança de Voo da OM: a) Relembrar no briefing ocorrências recentes, alertas de segurança e recomendações aplicáveis ao tipo de missão.",
    "Integrantes de unidades aéreas diferentes: a) Alinhar no briefing as diferenças de padronização entre as U.A., definindo fonia, sinais, responsabilidades, sequência da manobra e critérios de interrupção.",
  ],
  IFR: [
    "Voo acima de 10.000 ft: a) Brifar risco de hipóxia, tempo previsto acima de 10.000 ft, sinais de alerta e conduta caso algum tripulante apresente sintomas.",
    "Nivelamento abaixo dos obstáculos previstos na rota: a) Revisar no briefing a altitude mínima segura da rota, obstáculos críticos e nível mínimo que deverá ser mantido em cada trecho.",
    "Briefing meteorológico não realizado por especialista: a) Revisar a meteorologia disponível com a tripulação, destacando teto, visibilidade, formações, congelamento, vento, alternativa e tendência de piora.",
    "Piloto sem voo IFR nos últimos 30 dias: a) Identificar o piloto com menor prática IFR recente e reforçar divisão de tarefas, conferência cruzada e monitoramento de altitude, proa e razão de descida.",
    "DEP a partir de aeródromo não homologado IFR: a) Brifar obstáculos, condições meteorológicas, rota inicial, alternativa de retorno e ponto limite para cancelar ou manter o prosseguimento IFR.",
  ],
  TÉCNICO: [
    "Primeiro giro e/ou voo após inspeção: a) Brifar os itens inspecionados e manter atenção reforçada a parâmetros, luzes, ruídos, vibrações e vazamentos.",
    "Primeiro voo após troca de componentes vitais: a) Brifar quais componentes foram trocados, possíveis sintomas de mau funcionamento e conduta em caso de indicação anormal.",
    "Autonomia mínima de 40 minutos: a) Confirmar combustível, tempo de voo previsto, alternativa e ponto limite para retorno ou pouso.",
    "OS afetas às intervenções não verificadas ou não fechadas: a) Confirmar com a manutenção a situação das OS, serviços executados, pendências e liberação da aeronave.",
    "Quebra na sequência dos serviços de manutenção: a) Brifar quais serviços sofreram interrupção, quais itens foram reconferidos e quais exigem atenção especial no voo.",
  ],
  INSTRUÇÃO: [
    "Haverá hot-seat: a) Brifar o momento da troca em voo, a sequência de transferência dos comandos e a confirmação verbal obrigatória de quem está com a aeronave.",
    "Voo com piloto aluno ou piloto em formação IFR/OVN: a) Brifar quais fases serão executadas pelo aluno e em quais situações o instrutor deverá assumir ou orientar imediatamente.",
    "Voo de treinamento de emergências simuladas, IFR ou OVN: a) Brifar quais panes, procedimentos ou perfis serão treinados e definir altura, velocidade, configuração e parâmetros mínimos para manter a segurança.",
    "Primeiro voo de Habilitação Técnica de tripulante no modelo: a) Brifar as principais diferenças do modelo, tarefas que serão executadas pela primeira vez e pontos em que o instrutor fará conferência verbal obrigatória.",
  ],
  OVN: [
    "Voo na noite de nível 4 ou 5: a) Brifar referências visuais previstas, áreas de baixa luminosidade, risco de desorientação e altitude mínima a ser mantida.",
    "Voo em área urbana: a) Brifar obstáculos iluminados e não iluminados, fios, torres, tráfego, áreas de pouso de emergência e restrições de sobrevoo.",
    "Reconhecimento fora das áreas de instrução da Av Ex: a) Revisar no briefing imagens, cartas, obstáculos, relevo, iluminação, rotas de entrada/saída e pontos de referência da área.",
    "Dispositivo de iluminação individual incompatível com o voo OVN: a) Conferir antes do voo se lanternas, luzes e equipamentos individuais são compatíveis com OVN e não prejudicam a visão noturna.",
    "Presença de neblina e/ou precipitação: a) Brifar risco de perda de referências visuais, degradação dos óculos, redução de contraste e critérios para desviar, retornar ou interromper.",
    "Mais de 30 dias sem voar OVN: a) Identificar tripulantes há mais tempo sem voar OVN e reforçar conferência cruzada, callouts e atenção nas fases críticas.",
  ],
};

function RelprevSection({
  user,
  onTabChange,
}: {
  user: FirebaseUser | null;
  onTabChange: (tab: SectionKey) => void;
}) {
  const [reports, setReports] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [extraFiles, setExtraFiles] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    local: "",
    dataFato: "",
    horaFato: "",
    envolvidos: "",
    situacao: "",
    relatorPosto: "",
    relatorNome: "",
    email: "",
  });

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "relprevReports"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setReports(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "relprevReports");
      },
    );

    return () => unsubscribe();
  }, [user]);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "file",
  ) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files) as File[]) {
      // Limit file size to 2MB before processing (browser safety)
      if (file.size > 2 * 1024 * 1024 && type === "file") {
        alert(`Arquivo ${file.name} muito grande. Máximo 2MB.`);
        continue;
      }

      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);

      let base64String = await promise;

      if (type === "image") {
        const compressed = await compressImage(base64String);
        setImages((prev) => [...prev, compressed]);
      } else {
        setExtraFiles((prev) => [...prev, base64String]);
      }
    }
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (
      !isDraft &&
      (!formData.local || !formData.dataFato || !formData.situacao)
    ) {
      alert("Por favor, preencha os campos obrigatórios (*).");
      return;
    }

    setIsSaving(true);
    try {
      const createdAt = new Date().toISOString();
      const codigo = `${new Date().getFullYear()}-${String(reports.length + 1).padStart(3, "0")}`;

      const payloadBase = {
        ...formData,
        codigo,
        images,
        extraFiles,
        status: isDraft ? "RASCUNHO" : "ENVIADO",
        createdAt,
      };

      // Preparamos o PDF
      let pdfBlobUrl = "";
      if (!isDraft) {
        const doc = generateRelprevPDF(payloadBase);
        const docBlob = doc.output("blob");
        pdfBlobUrl = URL.createObjectURL(docBlob);
      }

      let activeUserUid = user?.uid;
      if (!activeUserUid) {
        try {
          const cred = await signInAnonymously(auth);
          activeUserUid = cred.user.uid;
        } catch (e) {
          console.warn("Prosseguindo sem autenticação formal (Modo Público)");
          activeUserUid = "public-guest";
        }
      }

      const finalPayload = {
        ...payloadBase,
        uid: activeUserUid,
      };

      // Primeiro enviamos ao banco para garantir que os dados cheguem
      await addDoc(collection(db, "relprevReports"), finalPayload);

      // Agora abrimos o PDF (o gesto do usuário ainda deve ser válido aqui se o addDoc for rápido)
      if (!isDraft && pdfBlobUrl) {
        openPDFSafely(pdfBlobUrl);
      }

      // Reset
      setFormData({
        local: "",
        dataFato: "",
        horaFato: "",
        envolvidos: "",
        situacao: "",
        relatorPosto: "",
        relatorNome: "",
        email: "",
      });
      setImages([]);
      setExtraFiles([]);

      setIsSaving(false);
      setTimeout(() => {
        alert(
          isDraft
            ? "Rascunho salvo com sucesso."
            : "Relato enviado com sucesso ao SIPAA.",
        );
      }, 100);
    } catch (error: any) {
      const msg = error.message || String(error);
      alert(
        msg.startsWith("{")
          ? "Erro técnico ao processar relato. Verifique sua conexão."
          : msg,
      );
      handleFirestoreError(error, OperationType.CREATE, "relprevReports");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="card-military overflow-hidden">
        <div className="p-10 text-center border-b border-white/5 bg-white/2">
          <h2 className="text-3xl font-black text-white tracking-tight mb-1 uppercase">
            Relato de Prevenção
          </h2>
          <p className="text-accent-gold font-bold uppercase tracking-widest text-xs">
            BATALHÃO GUERREIRO — SIPAA
          </p>
        </div>

        <div className="p-8 md:p-12 space-y-10">
          {/* Local */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
              Local: <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-military w-full"
              value={formData.local}
              onChange={(e) =>
                setFormData({ ...formData, local: e.target.value })
              }
            />
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                Data e Horário do Fato <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <input
                  type="date"
                  className="input-military flex-1"
                  value={formData.dataFato}
                  onChange={(e) =>
                    setFormData({ ...formData, dataFato: e.target.value })
                  }
                />
                <input
                  type="time"
                  className="input-military w-32"
                  value={formData.horaFato}
                  onChange={(e) =>
                    setFormData({ ...formData, horaFato: e.target.value })
                  }
                />
              </div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter pl-1">
                Hora Minutos
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                Pessoal envolvido e/ou aeronave{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-military w-full"
                value={formData.envolvidos}
                onChange={(e) =>
                  setFormData({ ...formData, envolvidos: e.target.value })
                }
              />
            </div>
          </div>

          {/* Situação */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
              Situação: <span className="text-red-500">*</span>
            </label>
            <textarea
              className="input-military w-full h-48 resize-none leading-relaxed"
              placeholder="Descreva detalhadamente o fato observado..."
              value={formData.situacao}
              onChange={(e) =>
                setFormData({ ...formData, situacao: e.target.value })
              }
            />
          </div>

          {/* Image Upload Area */}
          <div className="space-y-4">
            <label className="block w-full cursor-pointer group">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => handleFileChange(e, "image")}
              />
              <div className="border-2 border-dashed border-white/10 rounded-xl p-12 flex flex-col items-center justify-center bg-white/2 group-hover:bg-white/5 group-hover:border-military-gold/30 transition-all gap-4">
                <div className="w-16 h-16 rounded-full bg-bg-deep shadow-lg border border-white/5 flex items-center justify-center text-military-gold group-hover:scale-110 transition-transform">
                  <FileSearch size={28} />
                </div>
                <div className="text-center">
                  <span className="block font-black text-white text-sm uppercase tracking-widest mb-1">
                    Selecionar Imagem
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                    Arraste ou clique para anexar fotos
                  </span>
                </div>
              </div>
            </label>

            {images.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 custom-scrollbar">
                {images.map((img, i) => (
                  <div key={i} className="relative shrink-0 group">
                    <img
                      src={img}
                      className="w-24 h-24 object-cover rounded-lg border border-white/10 shadow-lg"
                      alt="Preview"
                    />
                    <button
                      onClick={() =>
                        setImages((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Upload Area */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter text-center">
              Caso precise anexar mais fotos ou arquivos, utilize o espaço
              abaixo
            </p>
            <label className="block w-full cursor-pointer group">
              <input
                type="file"
                className="hidden"
                multiple
                onChange={(e) => handleFileChange(e, "file")}
              />
              <div className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center bg-white/2 group-hover:bg-white/5 group-hover:border-military-gold/30 transition-all gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-bg-deep shadow-md border border-white/5 flex items-center justify-center text-military-gold group-hover:scale-110 transition-transform">
                  <Download size={22} />
                </div>
                <div>
                  <span className="block font-black text-white text-sm uppercase tracking-widest mb-1">
                    Anexar Documentos
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                    PDFs, Docs ou Imagens adicionais
                  </span>
                </div>
              </div>
            </label>
            {extraFiles.length > 0 && (
              <div className="text-[10px] text-green-500 font-black uppercase bg-green-500/10 p-3 rounded border border-green-500/20 flex items-center gap-2 tracking-widest italic">
                <CheckSquare size={14} className="animate-pulse" />
                {extraFiles.length} arquivos adicionais anexados para análise.
              </div>
            )}
          </div>

          {/* Relator */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <label className="text-[10px] font-black text-military-gold uppercase tracking-widest block pl-1">
              Identificação do Relator (opcional)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Ex: MAJ GUERREIRO"
                  className="input-military w-full"
                  value={formData.relatorPosto}
                  onChange={(e) =>
                    setFormData({ ...formData, relatorPosto: e.target.value })
                  }
                />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter px-1">
                  Posto / Graduação
                </span>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Ex: SILVA"
                  className="input-military w-full"
                  value={formData.relatorNome}
                  onChange={(e) =>
                    setFormData({ ...formData, relatorNome: e.target.value })
                  }
                />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter px-1">
                  Nome de Guerra
                </span>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-black text-military-gold uppercase tracking-widest block pl-1">
              telefone ou e-mail para retorno (opcional)
            </label>
            <input
              type="text"
              placeholder="e-mail ou telefone para contato"
              className="input-military w-full"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
            <p className="text-[9px] font-bold text-slate-500 px-1 uppercase tracking-tighter italic">
              Para recebimento de feedback sobre a prevenção
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-10">
            <button
              onClick={() => handleSubmit(true)}
              disabled={isSaving}
              className="flex-1 py-5 border border-white/10 rounded font-black uppercase text-[10px] tracking-[0.2em] text-slate-400 hover:bg-white/5 hover:text-white transition-all disabled:opacity-30"
            >
              Salvar Rascunho
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={isSaving}
              className="flex-1 py-5 bg-military-gold text-bg-deep rounded font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <Send size={18} />
                  Enviar Relato Oficial
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-[0.3em] opacity-60 py-8">
        Sistema de Investigação e Prevenção de Acidentes Aeronáuticos — SIPAA
      </div>
    </div>
  );
}

function FgrSection({
  user,
  onTabChange,
  launches,
}: {
  user: FirebaseUser | null;
  onTabChange: (tab: SectionKey) => void;
  launches: any[];
}) {
  const [stamp, setStamp] = useState<string>(
    new Date().toLocaleString("pt-BR"),
  );
  const [perfisVoo, setPerfisVoo] = useState<string[]>(["REGULAR"]);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [missionData, setMissionData] = useState({
    modeloAnv: "",
    aeronave: "",
    missao: "",
    mv: "",
    local: "",
    data: new Date().toLocaleDateString("pt-BR"),
    trigramaTrip: "",
    preenchidoPor: user?.displayName || "",
    funcao: "",
  });
  const [p2Selections, setP2Selections] = useState<
    Record<string, "SIM" | "NÃO" | "NA">
  >({});
  const [selectedLaunchId, setSelectedLaunchId] = useState("");

  const handleLaunchSelect = (launchId: string) => {
    setSelectedLaunchId(launchId);
    if (!launchId) return;

    const launch = launches.find((l) => l.id === launchId);
    if (launch) {
      const anv = launch.anv || "";
      const digits = anv.replace(/\D/g, "");
      let detectedModel = "";
      if (digits.startsWith("1")) detectedModel = "HA-1A";
      else if (digits.startsWith("2")) detectedModel = "HM-1A";
      else if (digits.startsWith("3")) detectedModel = "HM-2A";
      else if (digits.startsWith("4")) detectedModel = "HM-3";
      else if (digits.startsWith("5")) detectedModel = "HM-4";

      setMissionData((prev) => ({
        ...prev,
        modeloAnv: detectedModel || prev.modeloAnv,
        aeronave: anv,
        data: launch.dateLabel || "",
        local: launch.dest || launch.adDest || "",
        trigramaTrip:
          `${launch.p1 || ""}/${launch.p2 || ""}/${launch.mv !== "---" ? launch.mv : ""}`
            .replace(/\/+$/, "")
            .split("/")
            .filter(Boolean)
            .join("/"),
        mv: launch.missao || "", // Using the new missao field for the description
        missao: `LÇ ${launch.num || ""}`.trim(),
        preenchidoPor: launch.p2 || "",
        funcao: "PB",
      }));
      updateStamp();
    }
  };
  const [p3Selections, setP3Selections] = useState<
    Record<string, "S" | "N" | "D">
  >({});
  const [p4Selections, setP4Selections] = useState<
    Record<string, "S" | "N" | "D">
  >({});
  const [gravidadeSelections, setGravidadeSelections] = useState<
    Record<string, boolean>
  >({});
  const [mitigation, setMitigation] = useState("");
  const [showMitigationSuggestions, setShowMitigationSuggestions] =
    useState(false);

  const updateStamp = () => setStamp(new Date().toLocaleString("pt-BR"));

  const handleP2 = (id: string, val: "SIM" | "NÃO" | "NA") => {
    setP2Selections((prev) => ({ ...prev, [id]: val }));
    updateStamp();
  };

  const handleP3 = (id: string, val: "S" | "N" | "D") => {
    setP3Selections((prev) => {
      if (prev[id] === val) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: val };
    });
    updateStamp();
  };

  const handleP4 = (id: string, val: "S" | "N" | "D") => {
    setP4Selections((prev) => {
      if (prev[id] === val) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: val };
    });
    updateStamp();
  };

  const handleGrav = (id: string) => {
    setGravidadeSelections((prev) => ({ ...prev, [id]: !prev[id] }));
    updateStamp();
  };

  const resetAll = () => {
    setPerfisVoo(["REGULAR"]);
    setMissionData({
      modeloAnv: "",
      aeronave: "",
      missao: "",
      mv: "",
      local: "",
      data: new Date().toLocaleDateString("pt-BR"),
      trigramaTrip: "",
      preenchidoPor: user?.displayName || "",
      funcao: "",
    });
    setP2Selections({});
    setP3Selections({});
    setP4Selections({});
    setGravidadeSelections({});
    setMitigation("");
    setSelectedLaunchId("");
    updateStamp();
  };

  // Calculations
  const calcSection = (
    data: any[],
    selections: Record<string, "S" | "N" | "D">,
  ) => {
    let min = 0;
    let max = 0;
    data.forEach((item) => {
      const sel = selections[item.id];
      if (sel === "S") {
        min += item.w.S;
        max += item.w.S;
      } else if (sel === "N") {
        min += item.w.N;
        max += item.w.N;
      } else if (sel === "D") {
        min += 0;
        max += item.w.D;
      }
    });
    return { min, max };
  };

  const p3Categories = Object.keys(PARTE_III_DATA).map((cat) => ({
    name: cat,
    title:
      cat === "RH"
        ? "Recursos Humanos"
        : cat === "METEO"
          ? "Meteorologia"
          : cat === "MATERIAL"
            ? "Material"
            : cat === "MISSAO"
              ? "Missão"
              : "Organização",
    questions: (PARTE_III_DATA as any)[cat],
    scores: calcSection((PARTE_III_DATA as any)[cat], p3Selections),
  }));

  const p3TotalMin = p3Categories.reduce((acc, c) => acc + c.scores.min, 0);
  const p3TotalMax = p3Categories.reduce((acc, c) => acc + c.scores.max, 0);

  const p4Questions =
    perfisVoo.includes("REGULAR") && perfisVoo.length === 1
      ? []
      : perfisVoo
          .filter((p) => p !== "REGULAR")
          .flatMap((p) => (PARTE_IV_DATA as any)[p] || []);

  const p4Scores = calcSection(p4Questions, p4Selections);

  const tgMin = p3TotalMin + p4Scores.min;
  const tgMax = p3TotalMax + p4Scores.max;

  const gravTotal = GRAVIDADE_DATA.reduce((acc, g) => {
    if (g.fixed) return acc + g.pts;

    // Auto-selection based on any of the selected profiles
    const isAuto = g.autoByTipo && perfisVoo.includes(g.autoByTipo);

    if (isAuto || gravidadeSelections[g.id]) return acc + g.pts;
    return acc;
  }, 0);

  const riskMin = tgMin * gravTotal;
  const riskMax = tgMax * gravTotal;

  const isComplex = perfisVoo.some((p) => p !== "REGULAR");
  const riskMaxStatus = getRiskClass(
    riskMax,
    isComplex ? "COMPLEX" : "REGULAR",
  );

  const hasImpediment = Object.values(p2Selections).some((v) => v === "NÃO");

  const handleSave = async (forceParam: any = false) => {
    const isForced = forceParam === true;

    if (!isForced) {
      const errors: string[] = [];

      // Validação Parte I
      if (!missionData.modeloAnv)
        errors.push("Parte I: Selecione o Modelo da Aeronave.");
      if (!missionData.aeronave.trim())
        errors.push("Parte I: Informe a Matrícula da Aeronave.");
      if (!missionData.missao.trim())
        errors.push("Parte I: Descrição da Missão é obrigatória.");
      if (!missionData.local.trim())
        errors.push("Parte I: Informe o Local da operação.");
      if (!missionData.trigramaTrip.trim())
        errors.push(
          "Parte I: Trigramas da Tripulação (Líder) são obrigatórios.",
        );
      if (!missionData.preenchidoPor.trim())
        errors.push("Parte I: Informe quem está preenchendo o formulário.");
      if (!missionData.funcao)
        errors.push("Parte I: Selecione a sua Função na missão.");

      // Validação Parte II
      if (Object.keys(p2Selections).length < PARTE_II_DATA.length) {
        errors.push(
          "Parte II: Responda todas as assertivas das Condições Impeditivas.",
        );
      }

      // Validação Parte III
      const totalP3Questions = Object.values(PARTE_III_DATA).flat().length;
      if (Object.keys(p3Selections).length < totalP3Questions) {
        errors.push(
          "Parte III: Responda todas as assertivas dos Fatores de Gestão.",
        );
      }

      // Validação Parte IV - multiple profiles
      if (isComplex) {
        if (Object.keys(p4Selections).length < p4Questions.length) {
          errors.push(
            `Parte IV: Responda todas as assertivas específicas para os perfis selecionados.`,
          );
        }
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        const element = document.getElementById("validation-errors-anchor");
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    setValidationErrors([]);

    let finalMissionData = { ...missionData };
    let finalP2Selections = { ...p2Selections };
    let finalP3Selections = { ...p3Selections };
    let finalP4Selections = { ...p4Selections };

    if (isForced) {
      // Preencher campos de texto da Parte I com ---
      if (!finalMissionData.modeloAnv) finalMissionData.modeloAnv = "---";
      if (!finalMissionData.aeronave.trim()) finalMissionData.aeronave = "---";
      if (!finalMissionData.missao.trim()) finalMissionData.missao = "---";
      if (!finalMissionData.local.trim()) finalMissionData.local = "---";
      if (!finalMissionData.trigramaTrip.trim())
        finalMissionData.trigramaTrip = "---";
      if (!finalMissionData.preenchidoPor.trim())
        finalMissionData.preenchidoPor = "---";
      if (!finalMissionData.funcao) finalMissionData.funcao = "---";

      // Preencher seleções faltantes (opcional, mas garante que apareçam no PDF se desejado)
      PARTE_II_DATA.forEach((item) => {
        if (!finalP2Selections[item.id])
          (finalP2Selections as any)[item.id] = "---";
      });
      Object.keys(PARTE_III_DATA).forEach((cat) => {
        (PARTE_III_DATA as any)[cat].forEach((item: any) => {
          if (!finalP3Selections[item.id])
            (finalP3Selections as any)[item.id] = "---";
        });
      });
      p4Questions.forEach((item: any) => {
        if (!finalP4Selections[item.id])
          (finalP4Selections as any)[item.id] = "---";
      });
    }

    if (hasImpediment) {
      alert(
        "MISSÃO IMPEDIDA: Qualquer resposta 'NÃO' na Parte II exige autorização expressa do Cmt U Ae para execução do voo.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const createdAt = new Date().toISOString();
      const scores = {
        tgMin,
        tgMax,
        gravTotal,
        riskMin,
        riskMax,
      };

      const basePayload = {
        ...finalMissionData,
        perfisVoo,
        p2Selections: finalP2Selections,
        p3Selections: finalP3Selections,
        p4Selections: finalP4Selections,
        gravidadeSelections,
        mitigation,
        scores,
        pdvLaunchId: selectedLaunchId,
        relatorName:
          user?.displayName || finalMissionData.preenchidoPor || "Convidado",
        createdAt,
      };

      // Preparamos o PDF mas NÃO abrimos ainda para não interromper o envio
      const docPdf = generateFgrPDF(basePayload);
      const docBlob = docPdf.output("blob");
      const pdfBlobUrl = URL.createObjectURL(docBlob);

      let activeUserUid = user?.uid;
      if (!activeUserUid) {
        try {
          const cred = await signInAnonymously(auth);
          activeUserUid = cred.user.uid;
        } catch (e) {
          activeUserUid = "public-fgr";
        }
      }

      const missionPayload = {
        ...basePayload,
        uid: activeUserUid,
      };

      // Disparamos o envio ao banco primeiro
      const docRef = await addDoc(collection(db, "fgrMissions"), missionPayload);

      // Vincular ao lançamento no PDV se selecionado
      if (selectedLaunchId) {
        try {
          await setDoc(
            doc(db, "Lancamentos", selectedLaunchId),
            { linkedFgrId: docRef.id },
            { merge: true }
          );
          console.log("Vínculo FGR <-> Lançamento realizado com sucesso.");
        } catch (linkErr) {
          console.error("Erro ao vincular FGR ao lançamento:", linkErr);
        }
      }

      // Agora que salvou, abrimos o PDF
      openPDFSafely(pdfBlobUrl);

      setIsSaving(false);
      alert("FGR enviado com sucesso! O SIPAA recebeu o relatório oficial.");
      resetAll();

      // Upload do PDF em background
      (async () => {
        try {
          const fileName = `fgr_${finalMissionData.missao.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
          const storageRef = ref(storage, `fgr_pdfs/${fileName}`);

          const uploadTask = await uploadBytes(storageRef, docBlob);
          const pdfUrl = await getDownloadURL(uploadTask.ref);

          await setDoc(
            doc(db, "fgrMissions", docRef.id),
            {
              pdfUrl,
              fileName,
            },
            { merge: true },
          );

          console.log("PDF FGR processado em background.");
        } catch (pdfErr) {
          console.error("Erro ao processar PDF FGR em background:", pdfErr);
        }
      })();
    } catch (error: any) {
      const msg = error.message || String(error);
      alert(
        msg.startsWith("{")
          ? "Falha técnica ao enviar FGR. Verifique a conexão."
          : msg,
      );
      handleFirestoreError(error, OperationType.CREATE, "fgrMissions");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-tight">
            FGR — Gerenciamento de Risco
          </h2>
          <p className="text-text-secondary text-sm">
            Gerenciamento completo estruturado no banco de dados SIPAA.
          </p>
        </div>
        <div className="bg-bg-sidebar border border-border-theme px-4 py-2 rounded flex items-center gap-3 h-fit">
          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">
            Sincronizado:
          </span>
          <span className="text-[10px] text-accent-gold font-mono">
            {stamp}
          </span>
        </div>
      </div>

      {launches.length > 0 && (
        <div className="card-military p-5 border-2 border-military-gold bg-military-gold/10 shadow-[0_0_15px_rgba(197,160,89,0.15)] animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-military-gold uppercase tracking-[0.25em] flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-military-gold rounded-full shadow-[0_0_10px_#c5a059]" />
              ESCOLHA SEU LANÇAMENTO PARA PREENCHIMENTO AUTO
            </label>
            <div className="relative">
              <select
                value={selectedLaunchId}
                onChange={(e) => handleLaunchSelect(e.target.value)}
                className="w-full bg-slate-900 border-2 border-military-gold text-white text-xs font-black uppercase rounded-lg px-4 py-3.5 outline-none focus:ring-2 focus:ring-accent-gold/40 transition-all cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23c5a059' stroke-width='3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem center",
                  backgroundSize: "1.25rem",
                }}
              >
                <option value="" className="text-slate-400">
                  -- TOQUE PARA SELECIONAR SEU LANÇAMENTO --
                </option>
                {Object.entries(
                  launches.reduce((acc: any, curr: any) => {
                    const groupKey = curr.dateLabel || "Sem Data";
                    if (!acc[groupKey]) acc[groupKey] = [];
                    acc[groupKey].push(curr);
                    return acc;
                  }, {}),
                )
                  .sort((a, b) => {
                    const toSortable = (s: string) => {
                      const p = s.split("/");
                      return p.length === 3 ? p[2] + p[1] + p[0] : s;
                    };
                    return toSortable(b[0]).localeCompare(toSortable(a[0]));
                  })
                  .map(([date, items]: [string, any]) => (
                    <optgroup
                      key={date}
                      label={`🗓️ DATA: ${date}`}
                      className="bg-slate-800 text-military-gold font-black uppercase"
                    >
                      {items
                        .sort((a: any, b: any) => a.num.localeCompare(b.num))
                        .map((l: any) => (
                          <option
                            key={l.id}
                            value={l.id}
                            className="bg-slate-900 text-white"
                          >
                            {`${l.num} • ${l.anv} • ${l.p1} • ${l.p2} • ${l.missao}`}
                          </option>
                        ))}
                    </optgroup>
                  ))}
              </select>
            </div>
            <p className="text-[10px] text-military-gold font-bold uppercase mt-2 pl-1 bg-military-gold/10 py-1 rounded inline-block w-fit px-3">
              ★ Selecione para carregar os dados automaticamente
            </p>
          </div>
        </div>
      )}

      <>
        {/* Form Content - (Parte I) */}

        <div className="card-military p-0 overflow-hidden text-left">
          <div className="bg-white/5 px-6 py-3 border-b border-border-theme flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-accent-gold tracking-[0.2em]">
              FORMULÁRIO DE GERENCIAMENTO DE RISCOS Processo de Apoio à Decisão
              PARTE I
            </span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {/* Modelo and Matrícula */}
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest flex items-center">
                Modelo (Anv Líder) <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex flex-col gap-3">
                {["HA-1A", "HM-1A", "HM-2A", "HM-3", "HM-4"].map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="modeloAnv"
                        className="peer sr-only"
                        checked={missionData.modeloAnv === m}
                        onChange={() => {
                          setMissionData({ ...missionData, modeloAnv: m });
                          updateStamp();
                        }}
                      />
                      <div className="w-4 h-4 rounded-full border border-border-theme bg-bg-deep peer-checked:border-accent-gold transition-all"></div>
                      <div className="absolute w-2 h-2 rounded-full bg-accent-gold opacity-0 peer-checked:opacity-100 transition-all"></div>
                    </div>
                    <span
                      className={`text-xs font-bold ${missionData.modeloAnv === m ? "text-white" : "text-text-secondary"} group-hover:text-white transition-colors`}
                    >
                      {m}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Matrícula da(s) Aeronave(s){" "}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                className="input-military w-full"
                value={missionData.aeronave}
                onChange={(e) => {
                  const val = e.target.value;
                  const digits = val.replace(/\D/g, "");
                  let autoModel = missionData.modeloAnv;
                  if (digits.startsWith("1")) autoModel = "HA-1A";
                  else if (digits.startsWith("2")) autoModel = "HM-1A";
                  else if (digits.startsWith("3")) autoModel = "HM-2A";
                  else if (digits.startsWith("4")) autoModel = "HM-3";
                  else if (digits.startsWith("5")) autoModel = "HM-4";

                  setMissionData({
                    ...missionData,
                    aeronave: val,
                    modeloAnv: autoModel,
                  });
                  updateStamp();
                }}
                placeholder="Ex: EB-20xx"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Número Lançamento (Lç PDV){" "}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                className="input-military w-full"
                value={missionData.missao}
                onChange={(e) => {
                  setMissionData({ ...missionData, missao: e.target.value });
                  updateStamp();
                }}
                placeholder="Número do lançamento"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Missão / Voo
              </label>
              <input
                type="text"
                className="input-military w-full"
                value={missionData.mv}
                onChange={(e) => {
                  setMissionData({ ...missionData, mv: e.target.value });
                  updateStamp();
                }}
                placeholder="Ex: TREINAMENTO"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Local <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                className="input-military w-full"
                value={missionData.local}
                onChange={(e) => {
                  setMissionData({ ...missionData, local: e.target.value });
                  updateStamp();
                }}
                placeholder="Base / Área de Operação"
              />
            </div>

            {/* Data and Trigramas */}
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Data <span className="text-red-500 ml-1 font-bold">*</span>
              </label>
              <input
                type="text"
                className="input-military w-full"
                value={missionData.data}
                onChange={(e) => {
                  setMissionData({ ...missionData, data: e.target.value });
                  updateStamp();
                }}
                placeholder="DD/MM/AAAA"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Tripulação (1P / 2P / MV){" "}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                className="input-military w-full"
                value={missionData.trigramaTrip}
                onChange={(e) => {
                  setMissionData({
                    ...missionData,
                    trigramaTrip: e.target.value,
                  });
                  updateStamp();
                }}
                placeholder="Ex: ABC/DEF/GHI"
              />
            </div>

            {/* Preenchido por and Função */}
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Preenchido por <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                className="input-military w-full"
                value={missionData.preenchidoPor}
                onChange={(e) => {
                  setMissionData({
                    ...missionData,
                    preenchidoPor: e.target.value,
                  });
                  updateStamp();
                }}
                placeholder="Trigrama"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Função <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex flex-col gap-3">
                {["Cmt Missão", "PI", "PO", "PB"].map((f) => (
                  <label
                    key={f}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="funcao"
                        className="peer sr-only"
                        checked={missionData.funcao === f}
                        onChange={() => {
                          setMissionData({ ...missionData, funcao: f });
                          updateStamp();
                        }}
                      />
                      <div className="w-4 h-4 rounded-full border border-border-theme bg-bg-deep peer-checked:border-accent-gold transition-all"></div>
                      <div className="absolute w-2 h-2 rounded-full bg-accent-gold opacity-0 peer-checked:opacity-100 transition-all"></div>
                    </div>
                    <span
                      className={`text-xs font-bold ${missionData.funcao === f ? "text-white" : "text-text-secondary"} group-hover:text-white transition-colors`}
                    >
                      {f}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Form Content - (Parte II) */}
        <div className="card-military p-0 overflow-hidden text-left shadow-xl shadow-black/40">
          <div className="bg-bg-sidebar px-6 py-3 border-b border-border-theme flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-accent-gold tracking-[0.2em]">
              Parte II — Condições Impeditivas
            </span>
            <span className="text-[9px] font-mono text-text-secondary italic">
              Qualquer "NÃO" impede o voo
            </span>
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-theme/30 bg-white/2">
                  <th className="px-6 py-4 text-[10px] uppercase font-black text-white tracking-widest">
                    Assertivas{" "}
                    <span className="text-red-500 ml-1 font-bold">*</span>
                  </th>
                  <th className="px-2 py-4 text-center w-14 text-[9px] uppercase font-black text-text-secondary tracking-widest">
                    S
                  </th>
                  <th className="px-2 py-4 text-center w-14 text-[9px] uppercase font-black text-text-secondary tracking-widest">
                    N
                  </th>
                  <th className="px-2 py-4 text-center w-14 text-[9px] uppercase font-black text-text-secondary tracking-widest">
                    NA
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-theme/10">
                {PARTE_II_DATA.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-white/2 transition-colors group"
                  >
                    <td className="px-6 py-3.5 text-[11px] font-medium text-text-primary leading-tight opacity-90 group-hover:opacity-100 transition-opacity">
                      {item.text}
                    </td>
                    {["SIM", "NÃO", "NA"].map((val) => (
                      <td key={val} className="px-2 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleP2(item.id, val as any)}
                          className={`w-7 h-7 rounded border transition-all text-[9px] font-black flex items-center justify-center mx-auto ${
                            p2Selections[item.id] === val
                              ? "bg-accent-gold text-bg-deep border-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.3)]"
                              : "border-border-theme text-text-secondary hover:border-white/20"
                          }`}
                        >
                          {val === "SIM" ? "S" : val === "NÃO" ? "N" : "NA"}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasImpediment && (
            <div className="bg-red-950/20 border-t border-red-500/20 p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="text-red-500" size={20} />
                <span className="text-red-500 text-xs font-black uppercase tracking-[0.2em]">
                  Condição Impeditiva Detectada
                </span>
              </div>

              <div className="space-y-4 text-left border-l-2 border-red-500/30 pl-4">
                <h4 className="text-[10px] font-black uppercase text-text-secondary tracking-widest mb-1">
                  Observações:
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="text-[10px] font-mono text-red-500 font-bold">
                      1.
                    </span>
                    <p className="text-[10px] text-text-primary leading-relaxed">
                      Qualquer número de resposta{" "}
                      <b className="text-red-400 font-black">“NÃO”</b> impede a
                      realização do voo, sem a autorização do Cmt da U Ae ou do
                      Cmt Av Ex.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[10px] font-mono text-red-500 font-bold">
                      2.
                    </span>
                    <p className="text-[10px] text-text-primary leading-relaxed">
                      Apenas o Cmt da U Ae ou Cmt da Av Ex podem dar autorização
                      para que a missão prossiga, independente do número de
                      respostas <b className="text-red-400 font-black">“NÃO”</b>
                      . Os comandantes deverão levar em consideração o
                      custo-benefício que essa decisão trará para a organização.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[10px] font-mono text-red-500 font-bold">
                      3.
                    </span>
                    <p className="text-[10px] text-text-primary leading-relaxed">
                      <b className="text-white">N A</b> – não aplicável, ou
                      seja, não tem nada a ver com a missão a ser realizada.
                      Exemplo: - No caso de voo de instrução, no item{" "}
                      <i className="text-white">
                        “A tripulação está habilitada para a realização do voo”
                      </i>
                      , dever-se-á marcar NA.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[10px] font-mono text-red-500 font-bold">
                      4.
                    </span>
                    <p className="text-[10px] text-text-primary leading-relaxed">
                      Caso seja levantado algum potencial de risco que
                      comprometa a execução da missão/voo, o militar que
                      preenche o FGR deverá lançar esse potencial de risco no
                      espaço destinado e fazer a análise, marcando{" "}
                      <b className="text-white">“SIM”</b> ou{" "}
                      <b className="text-white">“NÃO”</b> ou{" "}
                      <b className="text-white">“NA”</b>. Quando marcar{" "}
                      <b className="text-red-400">“NÃO”</b> deverá proceder como
                      prescreve nos itens 1 e 2 descritos acima.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[10px] font-mono text-red-500 font-bold">
                      5.
                    </span>
                    <p className="text-[10px] text-text-primary leading-relaxed">
                      Caso no item:{" "}
                      <i className="text-white">
                        “Toda tripulação/envolvidos participam de um briefing”
                      </i>{" "}
                      seja marcado{" "}
                      <b className="text-red-400 font-black">“NÃO”</b>, quem não
                      participou não poderá realizar a missão até que passe pelo
                      briefing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black uppercase text-white tracking-widest">
                Parte III — Fatores de Gestão
              </h3>
            </div>
            <div className="space-y-4">
              {p3Categories.map((cat) => (
                <div
                  key={cat.name}
                  className="card-military p-0 overflow-hidden border-border-theme/40"
                >
                  <div className="bg-bg-sidebar px-4 py-2 border-b border-border-theme flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-text-secondary tracking-widest">
                      {cat.title}
                    </span>
                    <span className="text-[10px] font-mono text-accent-gold">
                      mín: {cat.scores.min} / máx: {cat.scores.max}
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-theme/30 bg-white/2">
                        <th className="px-4 py-2 text-[9px] uppercase font-black text-text-secondary tracking-tighter">
                          Critério
                        </th>
                        <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">
                          S
                        </th>
                        <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">
                          N
                        </th>
                        <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">
                          D
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.questions.map((q: any) => (
                        <tr
                          key={q.id}
                          className="border-b border-border-theme/10 hover:bg-white/2"
                        >
                          <td className="px-4 py-2.5 text-xs text-text-primary leading-tight">
                            {q.text}
                          </td>
                          {["S", "N", "D"].map((val) => (
                            <td key={val} className="px-2 py-2.5 text-center">
                              <button
                                onClick={() => handleP3(q.id, val as any)}
                                className={`w-7 h-7 rounded border transition-all text-[9px] font-black ${p3Selections[q.id] === val ? "bg-accent-gold text-bg-deep border-accent-gold" : "border-border-theme text-text-secondary"}`}
                              >
                                {(q.w as any)[val]}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase text-white tracking-widest px-2">
                Parte IV — Tipo de Voo
              </h3>
              <div className="card-military p-4 space-y-4 bg-bg-sidebar">
                <div>
                  <label className="text-[9px] uppercase font-black text-accent-gold tracking-[0.2em] mb-3 block">
                    Perfil de Voo
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "REGULAR", label: "Valor Básico" },
                      { id: "INSTRUCAO", label: "Voo de Instrução" },
                      { id: "IFR", label: "Voo IFR" },
                      { id: "OVN", label: "Voo OVN" },
                      { id: "TECNICO", label: "Voo Técnico (Mnt/Ens)" },
                    ].map((profile) => (
                      <label
                        key={profile.id}
                        className={`flex items-center gap-3 group ${profile.id === "REGULAR" ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      >
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            disabled={profile.id === "REGULAR"}
                            checked={perfisVoo.includes(profile.id)}
                            onChange={(e) => {
                              let nextPerfis = [...perfisVoo];
                              if (profile.id !== "REGULAR") {
                                if (e.target.checked) {
                                  if (!nextPerfis.includes(profile.id))
                                    nextPerfis.push(profile.id);
                                } else {
                                  nextPerfis = nextPerfis.filter(
                                    (p) => p !== profile.id,
                                  );
                                }
                              }
                              if (!nextPerfis.includes("REGULAR"))
                                nextPerfis.push("REGULAR");
                              setPerfisVoo(nextPerfis);
                              setP4Selections({});
                              updateStamp();
                            }}
                          />
                          <div className="w-5 h-5 rounded border border-border-theme bg-bg-deep peer-checked:border-accent-gold peer-checked:bg-accent-gold/20 peer-disabled:opacity-50 transition-all"></div>
                          <Check className="absolute w-3 h-3 text-accent-gold opacity-0 peer-checked:opacity-100 transition-all" />
                        </div>
                        <span
                          className={`text-[11px] font-bold ${perfisVoo.includes(profile.id) ? "text-white" : "text-text-secondary"} group-hover:text-white transition-colors`}
                        >
                          {profile.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bg-bg-deep border border-border-theme px-4 py-3 rounded flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-black text-text-secondary uppercase block mb-0.5 tracking-[0.1em]">
                      Total Acumulado
                    </span>
                    <span className="text-[9px] font-bold text-accent-gold/60 uppercase block leading-none">
                      Parte III + IV
                    </span>
                  </div>
                  <span className="text-2xl font-mono text-white font-black">
                    {tgMax}
                  </span>
                </div>
              </div>

              {perfisVoo
                .filter((p) => p !== "REGULAR")
                .map((p) => {
                  const questions = (PARTE_IV_DATA as any)[p] || [];
                  if (questions.length === 0) return null;
                  return (
                    <div
                      key={p}
                      className="card-military p-0 overflow-hidden border-border-theme/40 mt-4"
                    >
                      <div className="bg-bg-sidebar px-4 py-2 border-b border-border-theme flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-accent-gold tracking-widest">
                          Critérios — {p}
                        </span>
                      </div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border-theme/30 bg-white/2">
                            <th className="px-4 py-2 text-[9px] uppercase font-black text-text-secondary tracking-tighter">
                              Critério
                            </th>
                            <th className="px-2 py-2 text-center w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">
                              S
                            </th>
                            <th className="px-2 py-2 text-center w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">
                              N
                            </th>
                            <th className="px-2 py-2 text-center w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">
                              D
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {questions.map((q: any) => (
                            <tr
                              key={q.id}
                              className="border-b border-border-theme/10 hover:bg-white/2"
                            >
                              <td className="px-4 py-2.5 text-xs text-text-primary leading-tight">
                                {q.text}
                              </td>
                              {["S", "N", "D"].map((val) => (
                                <td
                                  key={val}
                                  className="px-2 py-2.5 text-center"
                                >
                                  <button
                                    onClick={() => handleP4(q.id, val as any)}
                                    className={`w-7 h-7 rounded border transition-all text-[9px] font-black ${p4Selections[q.id] === val ? "bg-accent-gold text-bg-deep border-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.2)]" : "border-border-theme text-text-secondary"}`}
                                  >
                                    {(q.w as any)[val]}
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>

            <div className="card-military p-0 overflow-hidden text-left border-border-theme/40">
              <div className="bg-bg-sidebar/50 px-6 py-4 border-b border-border-theme/30 flex justify-between items-center">
                <span className="text-[11px] font-black uppercase text-accent-gold tracking-[0.2em]">
                  Parte V — Avaliação de Gravidade
                </span>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GRAVIDADE_DATA.filter((g) => !g.fixed).map((g) => {
                    const isAuto =
                      g.autoByTipo && perfisVoo.includes(g.autoByTipo);

                    return (
                      <button
                        key={g.id}
                        disabled={isAuto}
                        onClick={() => handleGrav(g.id)}
                        className={`flex items-center justify-between p-3 rounded border text-left transition-all ${
                          isAuto || gravidadeSelections[g.id]
                            ? "bg-accent-gold/20 border-accent-gold text-white shadow-[0_4px_12px_rgba(212,175,55,0.15)] ring-1 ring-accent-gold/30"
                            : "bg-white/2 border-white/5 text-text-secondary hover:border-white/20"
                        }`}
                      >
                        <span className="text-[11px] font-bold uppercase tracking-tight">
                          {g.text}
                        </span>
                        <div className="flex items-center gap-2">
                          {isAuto && (
                            <span className="text-[8px] font-black text-accent-gold/60 uppercase">
                              Auto
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-mono ${isAuto || gravidadeSelections[g.id] ? "text-accent-gold" : "text-slate-500"}`}
                          >
                            +{g.pts}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card-military p-0 overflow-hidden text-left bg-gradient-to-br from-bg-sidebar to-bg-deep border-border-theme/40">
              <div className="bg-bg-sidebar/50 px-6 py-4 border-b border-border-theme/30 flex justify-between items-center">
                <span className="text-[11px] font-black uppercase text-accent-gold tracking-[0.2em]">
                  Resultado da Matriz de Risco
                </span>
              </div>
              <div className="p-8 space-y-8">
                <div
                  className={`p-6 rounded border-2 shadow-2xl transition-all duration-700 ${riskMaxStatus.border} ${riskMaxStatus.bg} flex flex-col items-center gap-3`}
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">
                    Classificação Final
                  </span>
                  <div
                    className={`text-4xl md:text-5xl font-black italic tracking-tighter text-center ${riskMaxStatus.color}`}
                  >
                    {riskMaxStatus.label.toUpperCase()}
                  </div>

                  <div className="flex gap-8 items-center mt-2 py-4 border-y border-white/5 w-full justify-center">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1">
                        Score Mínimo
                      </span>
                      <span className="text-xl font-mono text-white font-black">
                        {riskMin}
                      </span>
                    </div>
                    <div className="w-px h-10 bg-white/10" />
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1">
                        Score Máximo
                      </span>
                      <span className="text-xl font-mono text-white font-black">
                        {riskMax}
                      </span>
                    </div>
                  </div>

                  <div className="w-full space-y-6 pt-4">
                    <div className="text-center">
                      <span className="text-[9px] font-black text-text-secondary/60 uppercase block mb-2 tracking-[0.2em]">
                        Ação Recomendada
                      </span>
                      <p className="text-[11px] font-bold text-white leading-relaxed max-w-[320px] mx-auto bg-black/20 p-3 rounded-sm border border-white/5 shadow-inner">
                        {riskMaxStatus.decisao}
                      </p>
                    </div>
                    <div className="text-center bg-bg-deep/40 p-4 rounded-sm border border-border-theme/30">
                      <span className="text-[9px] font-black text-text-secondary/60 uppercase block mb-1 tracking-[0.2em]">
                        Responsabilidade
                      </span>
                      <p className="text-[13px] font-black text-accent-gold uppercase tracking-tight">
                        {riskMaxStatus.responsavel}
                      </p>
                    </div>
                  </div>

                  <div className="text-[9px] font-bold text-text-secondary/40 uppercase mt-4 italic">
                    Fator TG ({tgMax}) × Gravidade ({gravTotal})
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black uppercase text-text-secondary tracking-widest block">
                        Ações mitigadoras
                      </label>
                      <div className="relative mitigation-selector-container">
                        <button
                          onClick={() =>
                            setShowMitigationSuggestions(
                              !showMitigationSuggestions,
                            )
                          }
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded flex items-center gap-2 hover:bg-white/10 transition-all"
                        >
                          <Plus size={12} className="text-military-gold" />
                          <span className="text-[9px] font-black text-white uppercase tracking-widest">
                            Sugestão de Ações Mitigadoras
                          </span>
                        </button>

                        <AnimatePresence>
                          {showMitigationSuggestions && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute bottom-full right-0 mb-2 w-80 max-h-[400px] overflow-y-auto bg-bg-deep border border-accent-gold/20 rounded shadow-2xl z-50 p-4 custom-scrollbar"
                            >
                              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                                <span className="text-[10px] font-black text-accent-gold uppercase tracking-widest">
                                  Sugestões de Ações
                                </span>
                                <button
                                  onClick={() =>
                                    setShowMitigationSuggestions(false)
                                  }
                                >
                                  <X
                                    size={14}
                                    className="text-text-secondary"
                                  />
                                </button>
                              </div>

                              <div className="space-y-6">
                                {Object.entries(SUGESTOES_MITIGACAO).map(
                                  ([category, items]) => (
                                    <div key={category} className="space-y-2">
                                      <h4 className="text-[9px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2">
                                        {category}
                                      </h4>
                                      <div className="space-y-1">
                                        {items.map((item, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() => {
                                              // Extract the part after "a) ", "b) ", etc.
                                              const actionMatch = item.match(/[a-z]\)\s*(.*)/i);
                                              const extractedAction = actionMatch ? actionMatch[1] : item;
                                              
                                              const newText = mitigation.trim()
                                                ? `${mitigation.trim()}\n\n• ${extractedAction}`
                                                : `• ${extractedAction}`;
                                              setMitigation(newText);
                                            }}
                                            className="w-full text-left p-3 rounded bg-white/2 hover:bg-white/5 transition-all leading-tight border border-white/5 hover:border-military-gold/30 mb-2 group/item"
                                          >
                                            {(() => {
                                              const parts = item.split(/:\s*([a-z]\)\s*.*)/i);
                                              if (parts.length >= 2) {
                                                return (
                                                  <div className="flex flex-col gap-1.5">
                                                    <span className="text-[11px] font-black text-white uppercase tracking-tight group-hover/item:text-military-gold transition-colors">
                                                      {parts[0]}
                                                    </span>
                                                    <span className="text-[10px] text-text-secondary leading-normal pl-2 border-l border-military-gold/20 italic">
                                                      {parts[1]}
                                                    </span>
                                                  </div>
                                                );
                                              }
                                              return <span className="text-[11px] text-text-secondary group-hover/item:text-white">{item}</span>;
                                            })()}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <textarea
                      className="input-military w-full h-40 text-sm leading-relaxed p-4"
                      placeholder="Descreva as ações para reduzir os riscos identificados..."
                      value={mitigation}
                      onChange={(e) => setMitigation(e.target.value)}
                    />
                  </div>

                  <div id="validation-errors-anchor" className="scroll-mt-20">
                    <AnimatePresence>
                      {validationErrors.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-red-500/10 border border-red-500/30 rounded-sm p-4 mb-4"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="text-red-500" size={16} />
                            <span className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em]">
                              Erros de Validação
                            </span>
                          </div>
                          <ul className="space-y-1 mb-4">
                            {validationErrors.map((err, idx) => (
                              <li
                                key={idx}
                                className="text-[10px] text-text-primary flex items-start gap-2"
                              >
                                <span className="text-red-500 font-bold">
                                  •
                                </span>
                                {err}
                              </li>
                            ))}
                          </ul>
                          <button
                            onClick={() => handleSave(true)}
                            className="w-full py-2 bg-red-500/20 border border-red-500/40 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all"
                          >
                            Enviar mesmo assim
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    disabled={isSaving}
                    onClick={handleSave}
                    className="btn-military w-full h-14 text-sm uppercase font-black tracking-[0.2em] gap-3 flex items-center justify-center shadow-lg hover:shadow-accent-gold/20 transition-all group"
                  >
                    {isSaving ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <FileText
                        size={20}
                        className="group-hover:scale-110 transition-transform"
                      />
                    )}
                    {isSaving ? "Processando..." : "ENVIAR RELATÓRIO SIPAA"}
                  </button>
                  <button
                    onClick={resetAll}
                    className="w-full py-4 text-[10px] uppercase font-bold text-text-secondary hover:text-red-400 transition-colors tracking-widest"
                  >
                    Descartar e Limpar Formulário
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    </div>
  );
}

function AbortivaSection({
  user,
  launches,
  onConsultFgr,
}: {
  user: FirebaseUser | null;
  launches: any[];
  onConsultFgr?: () => void;
}) {
  const [selectedLaunchId, setSelectedLaunchId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    dataVoo: new Date().toISOString().split("T")[0],
    numLancamento: "",
    modeloAnv: "",
    mv: "",
    destino: "",
    motivo: "",
    preenchidoPor: "",
  });

  const handleLaunchSelectAbortiva = (launchId: string) => {
    setSelectedLaunchId(launchId);
    if (!launchId) return;

    const launch = launches.find((l) => l.id === launchId);
    if (launch) {
      const anv = launch.anv || "";
      const digits = anv.replace(/\D/g, "");
      let detectedModel = "";
      if (digits.startsWith("1")) detectedModel = "HA-1A";
      else if (digits.startsWith("2")) detectedModel = "HM-1A";
      else if (digits.startsWith("3")) detectedModel = "HM-2A";
      else if (digits.startsWith("4")) detectedModel = "HM-3";
      else if (digits.startsWith("5")) detectedModel = "HM-4";

      setFormData((prev) => ({
        ...prev,
        dataVoo: launch.dateLabel
          ? launch.dateLabel.split("/").reverse().join("-")
          : "",
        numLancamento: launch.num || "",
        modeloAnv: detectedModel || prev.modeloAnv,
        mv: launch.missao || "", // Using launch.missao for mission description
        destino: launch.dest || launch.adDest || "",
        tripulacao:
          `${launch.p1 || ""}/${launch.p2 || ""}/${launch.mv !== "---" ? launch.mv : ""}`
            .replace(/\/+$/, "")
            .split("/")
            .filter(Boolean)
            .join("/"),
        motivo: "DCM", // Default per request
        preenchidoPor: launch.p1 || "",
      }));
    }
  };

  const handleSend = async () => {
    if (
      !formData.dataVoo ||
      !formData.numLancamento ||
      !formData.modeloAnv ||
      !formData.motivo ||
      !formData.preenchidoPor
    ) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      let activeUserUid = user?.uid;
      if (!activeUserUid) {
        try {
          const cred = await signInAnonymously(auth);
          activeUserUid = cred.user.uid;
        } catch (e) {
          activeUserUid = "public-abortiva";
        }
      }

      // 1. Salvar no Firestore Primeiro para garantir os dados
      const reportData = {
        ...formData,
        uid: activeUserUid,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "abortivas"), reportData);

      setIsSaving(false);
      alert(
        "Relato de abortiva enviado com sucesso! O SIPAA recebeu as informações e o PDF oficial será processado no acervo.",
      );

      setFormData({
        dataVoo: new Date().toISOString().split("T")[0],
        numLancamento: "",
        modeloAnv: "",
        mv: "",
        destino: "",
        motivo: "",
        preenchidoPor: "",
      });
      setSelectedLaunchId("");

      // 2. Gerar e Upload do PDF em background (Não bloqueia o UI)
      (async () => {
        try {
          const docPdf = generateAbortivaPDF(reportData);
          const fileName = `abortiva_${formData.numLancamento}_${Date.now()}.pdf`;
          const storageRef = ref(storage, `abortivas/${fileName}`);

          const blob = docPdf.output("blob");
          const uploadTask = await uploadBytes(storageRef, blob);
          const pdfUrl = await getDownloadURL(uploadTask.ref);

          // Atualizar o documento com a URL do PDF
          await setDoc(
            doc(db, "abortivas", docRef.id),
            {
              pdfUrl,
              fileName,
            },
            { merge: true },
          );

          console.log("PDF de abortiva enviado e vinculado com sucesso.");
        } catch (pdfErr) {
          console.error("Erro ao processar PDF em background:", pdfErr);
        }
      })();
    } catch (err: any) {
      const msg = err.message || String(err);
      alert(msg.startsWith("{") ? "Erro ao salvar abortiva no servidor." : msg);
      console.error("Erro ao enviar abortiva:", err);
      handleFirestoreError(err, OperationType.CREATE, "abortivas");
    } finally {
      setIsSaving(false);
    }
  };

  const motivos = [
    { id: "DOS", text: "DOS (Devido a Ordem Superior)" },
    { id: "DFM", text: "DFM (Devido a Falha de Material)" },
    { id: "DCP", text: "DCP (Devido a Condições Pessoais)" },
    { id: "DCM", text: "DCM (Devido a Condições Meteorológicas)" },
  ];

  return (
    <div className="space-y-6 pb-20 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-tight">
            Abortiva de Voo
          </h2>
          <p className="text-text-secondary text-sm">
            Relate interrupções de missões planejadas.
          </p>
        </div>
      </div>

      {launches.length > 0 && (
        <div className="card-military p-5 border-2 border-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.15)] animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-orange-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316]" />
              ESCOLHA SEU LANÇAMENTO (ABORTIVA)
            </label>
            <div className="relative">
              <select
                value={selectedLaunchId}
                onChange={(e) => handleLaunchSelectAbortiva(e.target.value)}
                className="w-full bg-slate-900 border-2 border-orange-500 text-white text-xs font-black uppercase rounded-lg px-4 py-3.5 outline-none focus:ring-2 focus:ring-orange-500/40 transition-all cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23f97316' stroke-width='3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem center",
                  backgroundSize: "1.25rem",
                }}
              >
                <option value="" className="text-slate-400">
                  -- TOQUE PARA SELECIONAR SEU LANÇAMENTO --
                </option>
                {Object.entries(
                  launches.reduce((acc: any, curr: any) => {
                    const groupKey = curr.dateLabel || "Sem Data";
                    if (!acc[groupKey]) acc[groupKey] = [];
                    acc[groupKey].push(curr);
                    return acc;
                  }, {}),
                )
                  .sort((a, b) => {
                    const toSortable = (s: string) => {
                      const p = s.split("/");
                      return p.length === 3 ? p[2] + p[1] + p[0] : s;
                    };
                    return toSortable(b[0]).localeCompare(toSortable(a[0]));
                  })
                  .map(([date, items]: [string, any]) => (
                    <optgroup
                      key={date}
                      label={`🗓️ DATA: ${date}`}
                      className="bg-slate-800 text-orange-400 font-black uppercase"
                    >
                      {items
                        .sort((a: any, b: any) => a.num.localeCompare(b.num))
                        .map((l: any) => (
                          <option
                            key={l.id}
                            value={l.id}
                            className="bg-slate-900 text-white"
                          >
                            {`${l.num} • ${l.anv} • ${l.p1} • ${l.p2} • ${l.missao}`}
                          </option>
                        ))}
                    </optgroup>
                  ))}
              </select>
            </div>
            <p className="text-[10px] text-orange-400 font-bold uppercase mt-2 pl-1 bg-orange-500/10 py-1 rounded inline-block w-fit px-3">
              ★ Selecione para carregar os dados automaticamente
            </p>
          </div>
        </div>
      )}

      <div className="card-military p-0 overflow-hidden max-w-2xl">
        <div className="bg-white/5 px-6 py-3 border-b border-border-theme">
          <span className="text-[10px] font-black uppercase text-accent-gold tracking-[0.2em]">
            Formulário de Abortiva
          </span>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Data do Voo *
              </label>
              <input
                type="date"
                className="input-military w-full px-4 py-3"
                value={formData.dataVoo}
                onChange={(e) =>
                  setFormData({ ...formData, dataVoo: e.target.value })
                }
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Número do Lançamento *
              </label>
              <input
                type="text"
                className="input-military w-full px-4 py-3"
                value={formData.numLancamento}
                onChange={(e) =>
                  setFormData({ ...formData, numLancamento: e.target.value })
                }
                placeholder="Ex: 01"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
              Modelo Anv *
            </label>
            <div className="flex flex-wrap gap-4">
              {["HA-1A", "HM-1A", "HM-2A", "HM-3", "HM-4"].map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="abortivaModelo"
                      className="peer sr-only"
                      checked={formData.modeloAnv === m}
                      onChange={() =>
                        setFormData({ ...formData, modeloAnv: m })
                      }
                    />
                    <div className="w-4 h-4 rounded-full border border-border-theme bg-bg-deep peer-checked:border-accent-gold transition-all"></div>
                    <div className="absolute w-2 h-2 rounded-full bg-accent-gold opacity-0 peer-checked:opacity-100 transition-all"></div>
                  </div>
                  <span
                    className={`text-xs font-bold ${formData.modeloAnv === m ? "text-white" : "text-text-secondary"} group-hover:text-white transition-colors`}
                  >
                    {m}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Missão / Voo
              </label>
              <input
                type="text"
                className="input-military w-full px-4 py-3"
                value={formData.mv}
                onChange={(e) =>
                  setFormData({ ...formData, mv: e.target.value })
                }
                placeholder="Ex: TREINAMENTO"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Tripulação (1P / 2P / MV)
              </label>
              <input
                type="text"
                className="input-military w-full px-4 py-3"
                value={formData.tripulacao || ""}
                onChange={(e) =>
                  setFormData({ ...formData, tripulacao: e.target.value })
                }
                placeholder="Ex: ABC/DEF/GHI"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                Destino
              </label>
              <input
                type="text"
                className="input-military w-full px-4 py-3"
                value={formData.destino}
                onChange={(e) =>
                  setFormData({ ...formData, destino: e.target.value })
                }
                placeholder="Ex: SBTA"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
              Motivo *
            </label>
            <div className="flex flex-col gap-3">
              {motivos.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="abortivaMotivo"
                      className="peer sr-only"
                      checked={formData.motivo === m.id}
                      onChange={() =>
                        setFormData({ ...formData, motivo: m.id })
                      }
                    />
                    <div className="w-4 h-4 rounded-full border border-border-theme bg-bg-deep peer-checked:border-accent-gold transition-all"></div>
                    <div className="absolute w-2 h-2 rounded-full bg-accent-gold opacity-0 peer-checked:opacity-100 transition-all"></div>
                  </div>
                  <span
                    className={`text-xs font-bold ${formData.motivo === m.id ? "text-white" : "text-text-secondary"} group-hover:text-white transition-colors`}
                  >
                    {m.text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
              Preenchido por *
            </label>
            <input
              type="text"
              className="input-military w-full px-4 py-3"
              value={formData.preenchidoPor}
              onChange={(e) =>
                setFormData({ ...formData, preenchidoPor: e.target.value })
              }
              placeholder="Trigrama"
            />
          </div>

          <div className="pt-4 flex gap-4">
            <button
              onClick={handleSend}
              disabled={isSaving}
              className="btn-military flex-1 h-12 uppercase font-black tracking-widest flex items-center justify-center gap-3"
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Send size={18} />
              )}
              {isSaving ? "Enviando..." : "Enviar Abortiva"}
            </button>
            <button
              onClick={() => {
                setFormData({
                  dataVoo: new Date().toISOString().split("T")[0],
                  numLancamento: "",
                  modeloAnv: "",
                  motivo: "",
                  preenchidoPor: "",
                  tripulacao: "",
                });
                setSelectedLaunchId("");
              }}
              className="px-6 border border-border-theme text-text-secondary text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button
          onClick={onConsultFgr}
          className="flex items-center gap-3 px-8 py-4 bg-slate-800/50 border border-military-gold/30 rounded-xl text-military-gold hover:bg-military-gold hover:text-military-black transition-all group shadow-lg"
        >
          <Search size={20} className="group-hover:scale-110 transition-transform" />
          <div className="flex flex-col items-start leading-none">
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">Consultar FGRs</span>
            <span className="text-[8px] font-bold uppercase opacity-60 mt-1">Ver histórico de formulários</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function MapaRiscoSection({
  onTabChange,
}: {
  onTabChange: (tab: SectionKey) => void;
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-2xl font-bold text-white mb-1">Mapa de Risco</h2>
        <p className="text-slate-400 text-sm">
          Acesso ao mapa de risco atualizado das operações.
        </p>
      </div>

      <div className="flex justify-center mt-12">
        <div className="w-full max-w-md">
          <NormaCard
            title="Mapa de Risco CAvEx"
            category="Segurança"
            desc="Documento oficial contendo o mapeamento de riscos operacionais da jurisdição do CAvEx."
            url="https://drive.google.com/uc?export=download&id=1qHaITGvMXPuhoRLHPDV3tkkfjQDZdBYZ"
            buttonText="BAIXAR MAPA DE RISCO"
          />
        </div>
      </div>
    </div>
  );
}

function NotificacaoSection({
  onTabChange,
}: {
  onTabChange: (tab: SectionKey) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white mb-1">
          Central de Notificação
        </h2>
        <span className="text-xs text-military-gold border border-military-gold/30 px-3 py-1 rounded-full uppercase font-bold tracking-widest">
          3 Mensagens Novas
        </span>
      </div>

      <div className="space-y-4">
        {[
          {
            tag: "URGENTE",
            color: "red",
            title:
              "Suspensão temporária de uso do combustível Jet-A1 - Lote 459",
            date: "Hoje, 09:15",
            read: false,
          },
          {
            tag: "ALERTA",
            color: "orange",
            title: "Atualização de procedimentos NVG - Diretriz 02/2026",
            date: "Ontem, 14:00",
            read: true,
          },
          {
            tag: "INFO",
            color: "blue",
            title: "Escala de serviço SIPAA - Maio 2026",
            date: "15 Abr, 10:30",
            read: true,
          },
          {
            tag: "ALERTA",
            color: "orange",
            title:
              "Revisão obrigatória do sistema de extinção de incêndio HM-1",
            date: "12 Abr, 16:45",
            read: true,
          },
        ].map((msg, i) => (
          <div
            key={i}
            className={`card-military flex items-center gap-6 cursor-pointer border-l-4 p-5 ${msg.read ? "opacity-80" : "bg-military-blue/10 border-military-gold border-2 transition-all hover:bg-military-blue/20"}`}
            style={{
              borderLeftColor:
                i === 0
                  ? "#ef4444"
                  : i === 1 || i === 3
                    ? "#f97316"
                    : "#3b82f6",
            }}
          >
            <div
              className={`p-3 rounded-full ${i === 0 ? "bg-red-500/20 text-red-500" : i === 1 || i === 3 ? "bg-orange-500/20 text-orange-500" : "bg-blue-500/20 text-blue-500"}`}
            >
              <Bell size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[9px] font-bold uppercase tracking-widest ${i === 0 ? "text-red-500" : i === 1 || i === 3 ? "text-orange-500" : "text-blue-500"}`}
                >
                  {msg.tag}
                </span>
                <span className="text-[10px] text-slate-500">• {msg.date}</span>
              </div>
              <h4
                className={`font-bold ${msg.read ? "text-slate-300" : "text-white text-lg"}`}
              >
                {msg.title}
              </h4>
            </div>
            <ChevronRight className="text-slate-600" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PosAcidenteSection({
  onTabChange,
}: {
  onTabChange: (tab: SectionKey) => void;
}) {
  const [simplifiedMode, setSimplifiedMode] = useState(false);

  return (
    <div
      className={`space-y-8 transition-all duration-500 ${simplifiedMode ? "max-w-4xl mx-auto" : ""}`}
    >
      <div className="flex items-center justify-between bg-red-600/10 p-4 border border-red-600/20 rounded-lg">
        <div>
          <h2 className="text-2xl font-extrabold text-red-500 mb-1 leading-none uppercase tracking-tighter">
            Plano de Emergência
          </h2>
          <p className="text-text-secondary text-sm">
            Protocolos imediatos para resposta a acidentes.
          </p>
        </div>
        <button
          onClick={() => setSimplifiedMode(!simplifiedMode)}
          className={`px-6 py-3 font-bold rounded-lg transition-all uppercase tracking-widest text-xs ${simplifiedMode ? "bg-slate-200 text-black" : "bg-red-600 text-white shadow-lg shadow-red-600/30"}`}
        >
          {simplifiedMode ? "Modo Padrão" : "Prioridade Máxima"}
        </button>
      </div>

      <div
        className={`grid grid-cols-1 ${simplifiedMode ? "gap-4" : "lg:grid-cols-2 gap-8"}`}
      >
        <ActionStep
          number="01"
          title="Socorro e Resgate"
          desc="Acionar imediatamente equipe médica e bombeiros. Foco total na preservação da vida e primeiros socorros."
        />
        <ActionStep
          number="02"
          title="Isolamento da Área"
          desc="Estabelecer perímetro de segurança rígido. Impedir entrada de curiosos e imprensa não autorizada."
        />
        <ActionStep
          number="03"
          title="Preservação de Evidências"
          desc="NÃO tocar nos destroços ou mover partes da aeronave, exceto se estritamente necessário para resgate."
        />
        <ActionStep
          number="04"
          title="Comunicação Oficial"
          desc="Notificar Comandante do BAvEx e órgão SIPAA superior. Manter sigilo absoluto das informações."
        />
        <ActionStep
          number="05"
          title="Listagem de Testemunhas"
          desc="Identificar e coletar dados de contato de todas as pessoas que presenciaram ou ouviram o ocorrido."
        />
        <ActionStep
          number="06"
          title="Registro Fotográfico"
          desc="Se as condições permitirem, registrar o local sem alterar a posição de nenhum fragmento ou componente."
        />
      </div>
    </div>
  );
}

function AbastecimentoSection({
  onTabChange,
}: {
  onTabChange: (tab: SectionKey) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-2xl font-bold text-white mb-1">Abastecimento</h2>
        <p className="text-slate-400 text-sm">
          Informações e procedimentos para abastecimento de aeronaves.
        </p>
      </div>

      <div className="bg-military-black border border-white/5 rounded-xl overflow-hidden shadow-2xl h-[calc(100vh-220px)] min-h-[550px] flex flex-col">
        <div className="p-4 bg-military-dark-gray/40 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-military-gold">
            <Droplets size={16} />
            <span className="text-xs font-black uppercase tracking-widest">
              Locais de Abastecimento e Procedimentos de Segurança
            </span>
          </div>
          <a
            href="https://drive.google.com/file/d/10SYEOvYHBMFB0Cim7xYfffPj9LHIprkN/view?usp=drive_link"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-military-gold/10 hover:bg-military-gold/20 text-military-gold rounded border border-military-gold/20 text-[10px] font-bold uppercase transition-all tracking-wider"
          >
            Abrir em Nova Aba
            <ExternalLink size={10} />
          </a>
        </div>

        <div className="flex-1 w-full bg-slate-950 relative">
          <iframe
            src="https://drive.google.com/file/d/10SYEOvYHBMFB0Cim7xYfffPj9LHIprkN/preview"
            className="w-full h-full border-none absolute inset-0"
            allow="autoplay"
            title="Locais de Abastecimento PDF"
          />
        </div>
      </div>
    </div>
  );
}

function MeteoSection({
  onTabChange,
}: {
  onTabChange: (tab: SectionKey) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Memento Meteorológico
          </h2>
          <p className="text-slate-400 text-sm">
            Informações essenciais para tomada de decisão.
          </p>
        </div>
        <div className="flex items-center gap-3 p-3 bg-military-blue/20 rounded-lg border border-military-blue/30">
          <CloudSun className="text-military-gold" size={28} />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">
              METAR SBTA
            </span>
            <span className="text-sm text-white font-mono font-bold leading-none mt-1">
              VMC • 26º C
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MeteoCard
          icon={Wind}
          title="Vento"
          value="08 kts"
          label="Direção 210º"
          status="ESTÁVEL"
        />
        <MeteoCard
          icon={Navigation}
          title="Visibilidade"
          value="> 10.000m"
          label="Ceu Claro"
          status="VMC"
        />
        <MeteoCard
          icon={Droplets}
          title="Ajuste Altimétrico"
          value="1016 hPa"
          label="QNH Local"
          status="NORMAL"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card-military">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">
            Doutrina e Mínimos
          </h3>
          <div className="space-y-6">
            <div className="border-l-2 border-military-gold pl-4">
              <h4 className="text-military-gold font-bold text-sm mb-1 uppercase tracking-tight">
                Condições VFR
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                Distância vertical das nuvens 1000ft, Horizontal 1.5km. Não
                decolar se previsão de queda abaixo de mínimos.
              </p>
            </div>
            <div className="border-l-2 border-slate-700 pl-4">
              <h4 className="text-slate-200 font-bold text-sm mb-1 uppercase tracking-tight">
                Trovoadas (CB)
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed italic">
                Manter distância mínima de 10NM de células de tempestade. Risco
                severo de granizo e turbulência.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-[#05070a] p-6 rounded-xl border border-slate-800 font-mono text-sm shadow-inner">
            <span className="text-military-gold text-xs block mb-3 font-bold uppercase tracking-widest border-b border-slate-800 pb-2">
              RAW DATA STRINGS
            </span>
            <p className="text-green-500/80 leading-relaxed">
              METAR SBTA 161900Z 21008KT 9999 FEW030 26/18 Q1016 =<br />
              TAF SBTA 161200Z 1618/1718 21010KT 9999 SCT030 TX28/1618Z
              TN15/1709Z =
            </p>
          </div>
          <button className="btn-military py-3 uppercase tracking-widest text-xs">
            Consultar REDEMET Completo
          </button>
        </div>
      </div>
    </div>
  );
}

function FaunaSection({
  onTabChange,
}: {
  onTabChange: (tab: SectionKey) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Risco de Fauna</h2>
        <p className="text-slate-400">
          Notifique avistamentos, atividades ou colisões.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 card-military">
          <h3 className="font-bold text-white mb-8 uppercase text-xs tracking-widest border-b border-slate-800 pb-3">
            Formulário de Reporte Sipaa
          </h3>
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Local da Ocorrência
                </label>
                <input
                  className="input-military"
                  placeholder="Ex: Cabeceira 18 / Setor Alfa"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Espécie / Descrição
                </label>
                <input
                  className="input-military"
                  placeholder="Ex: Urubu, Quero-quero, etc"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Data
                </label>
                <input
                  type="date"
                  className="input-military"
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Horário Aproximado
                </label>
                <input type="time" className="input-military" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Altura (Pés)
                </label>
                <input
                  type="number"
                  className="input-military"
                  placeholder="Ex: 500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Descrição das Circunstâncias
              </label>
              <textarea
                className="input-military h-32 resize-none"
                placeholder="Relate o comportamento das aves, quantidade aproximada e efeito na aeronave se houver..."
              ></textarea>
            </div>
            <button
              type="button"
              className="btn-military w-full py-4 text-xs tracking-widest uppercase"
            >
              <Bird size={20} /> Registrar Reporte de Fauna
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card-military">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">
              Histórico de Incidentes
            </h3>
            <div className="space-y-5">
              <FaunaItem
                date={`${new Date().toLocaleDateString("pt-BR")} 09:30`}
                species="Bando de Quero-quero"
                local="Área de Manobra"
              />
              <FaunaItem
                date="15/04/2026 16:20"
                species="Urubus (Forte Concentração)"
                local="Setor Final Aproximação"
              />
              <FaunaItem
                date="14/04/2026 08:15"
                species="Lebrão / Fauna Terrestre"
                local="Pista de Pouso lateral"
              />
              <FaunaItem
                date="12/04/2026 11:00"
                species="Aves não identificadas"
                local="Hangar Principal"
              />
            </div>
          </div>
          <div className="card-military bg-military-gold/5 border-military-gold/20">
            <p className="text-[11px] text-military-gold/80 italic leading-relaxed">
              O reporte de fauna auxilia o Centro de Investigação e Prevenção de
              Acidentes Aeronáuticos (CENIPA) a mapear áreas críticas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicamentosSection() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-2xl font-bold text-white mb-1">
          Medicamentos de Uso Restritivo
        </h2>
        <p className="text-slate-400 text-sm">
          Acompanhamento das restrições e orientações relativas ao uso de fármacos para a tripulação.
        </p>
      </div>

      <div className="bg-military-black border border-white/5 rounded-xl overflow-hidden shadow-2xl h-[calc(100vh-220px)] min-h-[550px] flex flex-col">
        <div className="p-4 bg-military-dark-gray/40 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-military-gold">
            <Pill size={16} />
            <span className="text-xs font-black uppercase tracking-widest">
              Guia Completo de Medicamentos de Uso Restritivo
            </span>
          </div>
          <a
            href="https://drive.google.com/file/d/1jlUwQaC6W0uhtul4n7C7IQPmA1miizMp/view?usp=drive_link"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-military-gold/10 hover:bg-military-gold/20 text-military-gold rounded border border-military-gold/20 text-[10px] font-bold uppercase transition-all tracking-wider"
          >
            Abrir em Nova Aba
            <ExternalLink size={10} />
          </a>
        </div>

        <div className="flex-1 w-full bg-slate-950 relative">
          <iframe
            src="https://drive.google.com/file/d/1jlUwQaC6W0uhtul4n7C7IQPmA1miizMp/preview"
            className="w-full h-full border-none absolute inset-0"
            allow="autoplay"
            title="Medicamentos de Uso Restritivo PDF"
          />
        </div>
      </div>
    </div>
  );
}

function NormasSection({
  onTabChange,
}: {
  onTabChange: (tab: SectionKey) => void;
}) {
  const [activeNorm, setActiveNorm] = React.useState<{ title: string; category: string; url: string } | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const getGoogleDrivePreviewUrl = (urlStr: string) => {
    if (!urlStr) return "";
    if (urlStr.includes("/preview")) return urlStr;
    const idMatch = urlStr.match(/[?&]id=([^&]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
    }
    const pathMatch = urlStr.match(/\/file\/d\/([^/]+)/);
    if (pathMatch && pathMatch[1]) {
      return `https://drive.google.com/file/d/${pathMatch[1]}/preview`;
    }
    return urlStr;
  };

  const normasList = [
    {
      title: "Norma Operacional 1",
      category: "SEGURANÇA DE VOO",
      url: "https://drive.google.com/uc?export=download&id=1i5SO0RbSeX_pZwXUdF-KDpR7V83Zktpr"
    },
    {
      title: "Norma Operacional 3",
      category: "AERÓDROMO DE TBE E ÁREAS DE INSTRUÇÃO",
      url: "https://drive.google.com/uc?export=download&id=1FCPinzpqh4LaGWpEWPPwCbA4AOPiwjsF"
    },
    {
      title: "Norma Operacional 4",
      category: "TRANSPORTES ESPECIAIS",
      url: "https://drive.google.com/uc?export=download&id=1zonhjXC1P92fyGytOWMj9Coxj3p8b_Ay"
    },
    {
      title: "Norma Operacional 5",
      category: "NÍVEIS OPERACIONAIS, REQUISITOS E FUNÇÕES PARA TRIPULANTES",
      url: "https://drive.google.com/uc?export=download&id=1ofKNRn-b0iBC-PJNoqnfk5QJ586Gezoh"
    },
    {
      title: "Norma Operacional 6",
      category: "VOO POR INSTRUMENTO",
      url: "https://drive.google.com/uc?export=download&id=1zQHrMfGR4GCZLMCnqP456vD77rzhl9d0"
    },
    {
      title: "Norma Operacional 7",
      category: "CÓDIGOS DE IDENTIFICAÇÃO DE MISSÕES DE VOO",
      url: "https://drive.google.com/uc?export=download&id=1zuqHwZhDwHtgWb93ABrAhqn5EnkhC8at"
    },
    {
      title: "Norma Operacional 8",
      category: "CONSELHO DE VOO",
      url: "https://drive.google.com/uc?export=download&id=1tManea_uOI4k_r4mTL2y3nDwR-xMTWtw"
    },
    {
      title: "Norma Operacional 9",
      category: "VOOS TÉCNICOS",
      url: "https://drive.google.com/uc?export=download&id=1l91octhJG7tiyyaciaoMyWPWk8VaIVFr"
    },
    {
      title: "Norma Operacional 11",
      category: "VOO COM ÓCULOS DE VISÃO NOTURNA",
      url: "https://drive.google.com/uc?export=download&id=1qwWffNhDDl60JBNhvgvVxbtPPxPjfJgL"
    },
    {
      title: "Norma Operacional 12",
      category: "ABASTECIMENTO DE AERONAVES",
      url: "https://drive.google.com/uc?export=download&id=1Di39GNdHF77NHIIqXQjMg_SJgK57WWsP"
    },
    {
      title: "Norma Operacional 13",
      category: "TRATORAMENTO E TRACIONAMENTO DE AERONAVES",
      url: "https://drive.google.com/uc?export=download&id=1_8UTQXD-9j-6sh508PYOyxh0e9FOg16s"
    },
    {
      title: "Norma Operacional 14",
      category: "ANCORAGEM DE AERONAVES",
      url: "https://drive.google.com/uc?export=download&id=1rK_BgUljBDIwQ2FNjJZsVNLomimAH-RG"
    }
  ];

  const filteredNormas = normasList.filter(norma =>
    norma.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    norma.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (activeNorm) {
    const previewUrl = getGoogleDrivePreviewUrl(activeNorm.url);
    const directUrl = activeNorm.url.includes("export=download") 
      ? `https://drive.google.com/file/d/${activeNorm.url.match(/[?&]id=([^&]+)/)?.[1]}/view?usp=drivesdk` 
      : activeNorm.url;

    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <button
                onClick={() => setActiveNorm(null)}
                className="text-slate-400 hover:text-white transition-colors mr-1 cursor-pointer"
                title="Voltar para as Normas"
              >
                ←
              </button>
              {activeNorm.title}
            </h2>
            <p className="text-slate-400 text-sm">
              Categoria: {activeNorm.category}
            </p>
          </div>
          <button
            onClick={() => setActiveNorm(null)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white hover:text-military-gold text-xs font-bold uppercase transition-all rounded cursor-pointer"
          >
            Voltar às Normas
          </button>
        </div>

        <div className="bg-military-black border border-white/5 rounded-xl overflow-hidden shadow-2xl h-[calc(100vh-220px)] min-h-[550px] flex flex-col">
          <div className="p-4 bg-military-dark-gray/40 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-military-gold">
              <FileText size={16} />
              <span className="text-xs font-black uppercase tracking-widest">
                Visualização Direta da {activeNorm.title}
              </span>
            </div>
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-military-gold/10 hover:bg-military-gold/20 text-military-gold rounded border border-military-gold/20 text-[10px] font-bold uppercase transition-all tracking-wider"
            >
              Abrir em Nova Aba
              <ExternalLink size={10} />
            </a>
          </div>

          <div className="flex-1 w-full bg-slate-950 relative">
            <iframe
              src={previewUrl}
              className="w-full h-full border-none absolute inset-0"
              allow="autoplay"
              title={`${activeNorm.title} PDF`}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Normas Operacionais CAvEx
          </h2>
          <p className="text-slate-400 text-sm">
            Acesso rápido às Normas Operacionais (NO) vigentes.
          </p>
        </div>
        <div className="relative group">
          <input
            className="bg-military-gray border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-sm outline-none focus:border-military-gold w-full md:w-80 group-hover:border-slate-500 transition-all text-white"
            placeholder="Pesquisar Norma..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FileText
            className="absolute left-3 top-3.5 text-slate-500 group-hover:text-military-gold transition-colors"
            size={18}
          />
        </div>
      </div>

      {filteredNormas.length === 0 ? (
        <div className="text-center py-12 bg-military-black border border-white/5 rounded-xl">
          <FileText size={48} className="mx-auto text-slate-600 mb-3 animate-pulse" />
          <h4 className="text-sm font-bold text-slate-300 uppercase">Nenhuma norma encontrada</h4>
          <p className="text-xs text-slate-500 mt-1">Refine seus termos de pesquisa</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNormas.map((norma, idx) => (
            <NormaCard
              key={idx}
              title={norma.title}
              category={norma.category}
              url={norma.url}
              onView={() => setActiveNorm(norma)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanejamentoSection({
  onTabChange,
}: {
  onTabChange: (tab: SectionKey) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-tight">
          Planejamento Operacional
        </h2>
        <p className="text-slate-400 text-sm italic">
          Briefing técnico para tripulantes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card-military space-y-8">
          <h3 className="font-bold text-white uppercase text-xs tracking-widest border-b border-slate-800 pb-3">
            Dados da Missão
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FgrField
              label="Trajeto Principal"
              placeholder="SBTA -> Setor Charlie -> SBTA"
            />
            <FgrField
              label="Aeródromos de Alternativa"
              placeholder="SBSP, SBGR, SBJD"
            />
            <FgrField
              label="Frequências de Coordenação"
              placeholder="122.50 / 123.45"
            />
            <FgrField label="Altitude de Cruzeiro (MSL)" placeholder="4500ft" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Obstáculos e Áreas de Atenção Específicas
            </label>
            <textarea
              className="input-military h-40 resize-none font-mono text-xs"
              placeholder="Descreva NOTAMs de obstáculos, cercas, torres novas ou áreas de conflito detectadas no estudo prévio..."
            ></textarea>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-military border-military-gold/30 bg-military-gold/5 p-6 h-fit shadow-xl">
            <h4 className="text-military-gold font-black text-xs mb-6 uppercase tracking-widest flex items-center gap-2">
              <CheckSquare size={16} /> Checklist Pré-Voo
            </h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                <CheckSquare
                  size={18}
                  className="text-military-gold shrink-0"
                />
                NOTAM local e rota OK
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                <CheckSquare
                  size={18}
                  className="text-military-gold shrink-0"
                />
                Consulta METAR/TAF realizada
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                <CheckSquare
                  size={18}
                  className="text-military-gold shrink-0"
                />
                FGR preenchido e assinado
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                <CheckSquare
                  size={18}
                  className="text-military-gold shrink-0"
                />
                Combustível para missão + Reserva
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                <CheckSquare
                  size={18}
                  className="text-military-gold shrink-0"
                />
                Carga útil e balanceamento OK
              </li>
            </ul>
          </div>
          <button className="btn-military w-full py-5 text-xs font-black tracking-[0.2em] uppercase shadow-2xl shadow-military-gold/10 hover:scale-[1.02] active:scale-95 transition-all">
            <Navigation size={22} className="mr-2" /> Validar Planejamento
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminSection({
  user,
  onTabChange,
  abastecimentoConfig,
  abastecimentoFiles,
  launches,
  setLaunches,
  fgrs: propFgrs,
  abortivas: propAbortivas,
  isAdminAuthenticated,
}: {
  user: FirebaseUser | null;
  onTabChange: (tab: SectionKey) => void;
  abastecimentoConfig?: any;
  abastecimentoFiles: any[];
  launches: any[];
  setLaunches: (l: any[]) => void;
  fgrs: any[];
  abortivas: any[];
  isAdminAuthenticated?: boolean;
}) {
  const [stats, setStats] = useState({ relprevs: 0, fgrs: 0, abortivas: 0, trash: 0 });
  const [relprevs, setRelprevs] = useState<any[]>([]);
  const [fgrs, setFgrs] = useState<any[]>(propFgrs);
  const [abortivas, setAbortivas] = useState<any[]>(propAbortivas);

  useEffect(() => {
    setFgrs(propFgrs);
  }, [propFgrs]);

  useEffect(() => {
    setAbortivas(propAbortivas);
  }, [propAbortivas]);

  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedView, setSelectedView] = useState<
    | "stats"
    | "relprevs"
    | "fgrs"
    | "abortivas"
    | "config"
    | "pdv"
    | "trash"
    | "suggestions"
    | "database"
  >("stats");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteColl, setDeleteColl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<{
    id: string;
    name: string;
    count: number;
  } | null>(null);
  const [dbStatus, setDbStatus] = useState<
    "IDLE" | "CONNECTING" | "CONNECTED" | "ERROR"
  >("IDLE");
  const [lastError, setLastError] = useState<string | null>(null);
  const [editingLaunch, setEditingLaunch] = useState<any | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [isLinkFgrModalOpen, setIsLinkFgrModalOpen] = useState(false);
  const [launchToLink, setLaunchToLink] = useState<any>(null);
  const [fgrSearchTerm, setFgrSearchTerm] = useState("");
  const [pdvExtractionStatus, setPdvExtractionStatus] = useState({ msg: "", isError: false });
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [selectedPdvMonth, setSelectedPdvMonth] = useState<string>("TODOS");

  const [backupMonth, setBackupMonth] = useState(new Date().getMonth());
  const [backupYear, setBackupYear] = useState(new Date().getFullYear());

  const handleDownloadStatsPDF = () => {
    try {
      const docPdf = generateMonthlyStatsPDF(backupMonth, backupYear, fgrs, abortivas, launches);
      const MONTH_NAMES_PT = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      docPdf.save(`Estatisticas_Operacionais_${MONTH_NAMES_PT[backupMonth]}_de_${backupYear}.pdf`);
    } catch (error: any) {
      alert("Erro ao gerar relatório de estatísticas: " + error.message);
    }
  };

  const handleDownloadFullBackup = async () => {
    try {
      setIsUploading(true);
      const zip = new JSZip();

      // 1. Add All FGRs
      const fgrFolder = zip.folder("FGRs");
      if (fgrFolder) {
        const nameCounts: Record<string, number> = {};
        fgrs.forEach((f) => {
          const docPdf = generateFgrPDF(f);
          const pdfBlob = docPdf.output("blob");

          let dateStr = "SemData";
          if (f.data) {
            dateStr = f.data.includes("-")
              ? f.data.split("-").reverse().join("-")
              : f.data.replace(/\//g, "-");
          } else if (f.createdAt) {
            dateStr = new Date(f.createdAt)
              .toLocaleDateString("pt-BR")
              .replace(/\//g, "-");
          }

          const missionSafe = (f.missao || "FGR").replace(/[/\\?%*:|"<>]/g, "-");
          let filenameBase = `${dateStr}_${missionSafe}`;
          if (nameCounts[filenameBase] === undefined) {
            nameCounts[filenameBase] = 1;
          } else {
            nameCounts[filenameBase]++;
            filenameBase += `_${nameCounts[filenameBase]}`;
          }
          fgrFolder.file(`${filenameBase}.pdf`, pdfBlob);
        });
      }

      // 2. Add All Abortivas
      const abortivasFolder = zip.folder("Abortivas");
      if (abortivasFolder) {
        const nameCounts: Record<string, number> = {};
        abortivas.forEach((a) => {
          const docPdf = generateAbortivaPDF(a);
          const pdfBlob = docPdf.output("blob");

          let dateStr = "SemData";
          if (a.createdAt) {
            dateStr = new Date(a.createdAt)
              .toLocaleDateString("pt-BR")
              .replace(/\//g, "-");
          }

          const missionSafe = (a.numLancamento || "Abortiva").replace(/[/\\?%*:|"<>]/g, "-");
          let filenameBase = `${dateStr}_${missionSafe}`;
          if (nameCounts[filenameBase] === undefined) {
            nameCounts[filenameBase] = 1;
          } else {
            nameCounts[filenameBase]++;
            filenameBase += `_${nameCounts[filenameBase]}`;
          }
          abortivasFolder.file(`${filenameBase}.pdf`, pdfBlob);
        });
      }

      // 3. Add Monthly Stats PDF
      const statsDoc = generateMonthlyStatsPDF(backupMonth, backupYear, fgrs, abortivas, launches);
      const statsBlob = statsDoc.output("blob");
      const MONTH_NAMES_PT = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const statsFilename = `Estatisticas_Operacionais_${MONTH_NAMES_PT[backupMonth]}_de_${backupYear}.pdf`;
      zip.file(statsFilename, statsBlob);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(
        content,
        `BACKUP_COMPLETO_SIPAA_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.zip`
      );
    } catch (error: any) {
      console.error("Erro ao gerar backup de dados:", error);
      alert("Erro ao gerar backup de dados: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const pdvMonths = React.useMemo(() => {
    const months = new Set<string>();
    launches.forEach(l => {
      if (l.dateLabel && l.dateLabel.includes("/")) {
        const parts = l.dateLabel.split("/");
        if (parts.length === 3) {
          months.add(`${parts[1]}/${parts[2]}`);
        }
      }
    });
    return Array.from(months).sort((a, b) => {
      const [ma, ya] = a.split("/").map(Number);
      const [mb, yb] = b.split("/").map(Number);
      if (ya !== yb) return yb - ya;
      return mb - ma;
    });
  }, [launches]);

  const filteredPdvLaunches = React.useMemo(() => {
    if (selectedPdvMonth === "TODOS") return launches;
    return launches.filter(l => {
      if (!l.dateLabel) return false;
      const month = l.dateLabel.split("/").slice(1, 3).join("/");
      return month === selectedPdvMonth;
    });
  }, [launches, selectedPdvMonth]);

  const toggleNoFgr = async (launchId: string, currentVal: boolean) => {
    try {
      const docRef = doc(db, "Lancamentos", launchId);
      await updateDoc(docRef, {
        markedNoFgr: !currentVal
      });
    } catch (error: any) {
      console.error("Erro ao alternar Sem FGR:", error);
      setPdvExtractionStatus({ msg: `Erro ao atualizar: ${error.message}`, isError: true });
    }
  };

  const handleDateMask = (val: string) => {
    let clean = val.replace(/\D/g, "");
    if (clean.length > 8) clean = clean.slice(0, 8);

    let result = "";
    if (clean.length > 0) result += clean.slice(0, 2);
    if (clean.length > 2) result += "/" + clean.slice(2, 4);
    if (clean.length > 4) result += "/" + clean.slice(4, 8);

    setManualDate(result);
  };

  const fetchManual = async () => {
    setDbStatus("CONNECTING");
    setLastError(null);
    try {
      // Teste de conexão direto
      const testSnap = await getDocs(
        query(collection(db, "fgrMissions"), limit(1)),
      );
      console.log("Teste de conexão Firestore: OK", testSnap.size);
      setDbStatus("CONNECTED");
    } catch (err: any) {
      console.error("Erro no teste de conexão:", err);
      setLastError(err.message || String(err));
      setDbStatus("ERROR");
    }
  };

  useEffect(() => {
    // Nota: Removido 'if (!user) return' para permitir visualização em modo local/público
    setDbStatus("CONNECTING");
    const qRelprev = query(
      collection(db, "relprevReports"),
      orderBy("createdAt", "desc"),
    );
    const qTrash = query(
      collection(db, "trash"),
      orderBy("deletedAt", "desc"),
    );
    const qSuggestions = query(
      collection(db, "suggestions"),
      orderBy("createdAt", "desc"),
    );

    const unsubRelprev = onSnapshot(
      qRelprev,
      (snap) => {
        setStats((prev) => ({ ...prev, relprevs: snap.size }));
        setRelprevs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setDbStatus("CONNECTED");
      },
      (err) => {
        console.error("Erro no listener de Relprev:", err);
        setLastError(err.message);
        setDbStatus("ERROR");
      },
    );

    // Update local stats for fgrs and abortivas even though they are fetched at App level
    // to maintain the AdminSection internal state if needed (or we could just use props)
    setStats(prev => ({ ...prev, fgrs: propFgrs.length, abortivas: propAbortivas.length }));

    const unsubTrash = onSnapshot(
      qTrash,
      (snap) => {
        setStats((prev) => ({ ...prev, trash: snap.size }));
        setTrashItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error("Erro no listener de Trash:", err);
      },
    );

    const unsubSuggestions = onSnapshot(
      qSuggestions,
      (snap) => {
        setSuggestions(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error("Erro no listener de Sugestoes:", err);
      },
    );

    return () => {
      unsubRelprev();
      unsubTrash();
      unsubSuggestions();
    };
  }, [user, propFgrs.length, propAbortivas.length]);

  const [selectedRelprev, setSelectedRelprev] = useState<any>(null);
  const [showAnexos, setShowAnexos] = useState(false);

  const handleDeleteBatch = async () => {
    if (!batchDeleteTarget) return;
    const { id: batchIdToDelete } = batchDeleteTarget;

    console.log("Iniciando exclusão do lote:", batchIdToDelete);
    try {
      setIsUploading(true);
      const q = query(
        collection(db, "Lancamentos"),
        where("batchId", "==", batchIdToDelete),
      );
      const snap = await getDocs(q);

      console.log("Documentos encontrados:", snap.size);
      if (snap.empty) {
        alert(
          "Nenhum registro encontrado para este arquivo no banco de dados.",
        );
        setBatchDeleteTarget(null);
        return;
      }

      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      console.log("Exclusão em lote concluída com sucesso");
      setBatchDeleteTarget(null);
      alert("Arquivo e lançamentos excluídos com sucesso!");
    } catch (error: any) {
      console.error("Erro ao excluir lote:", error);
      alert("Falha ao excluir: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !deleteColl) return;

    try {
      // Soft deletion for main entities
      if (
        ["relprevReports", "fgrMissions", "abortivas", "suggestions"].includes(deleteColl)
      ) {
        let itemData: any = null;
        let typeLabel = "";

        if (deleteColl === "relprevReports") {
          itemData = relprevs.find((r) => r.id === deleteId);
          typeLabel = "RELPREV";
        } else if (deleteColl === "fgrMissions") {
          itemData = fgrs.find((f) => f.id === deleteId);
          typeLabel = "FGR";
        } else if (deleteColl === "abortivas") {
          itemData = abortivas.find((a) => a.id === deleteId);
          typeLabel = "ABORTIVA";
        } else if (deleteColl === "suggestions") {
          itemData = suggestions.find((s) => s.id === deleteId);
          typeLabel = "SUGESTÃO";
        }

        if (itemData) {
          const { id, ...cleanData } = itemData;
          await addDoc(collection(db, "trash"), {
            originalId: deleteId,
            originalCollection: deleteColl,
            data: cleanData,
            type: typeLabel,
            deletedAt: new Date().toISOString(),
            deletedBy: user?.email || "anonymous",
          });
        }
      }

      await deleteDoc(doc(db, deleteColl, deleteId));
      setDeleteId(null);
      setDeleteColl(null);
      alert("Registro movido para a lixeira com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir registro. Verifique a conexão.");
    }
  };

  const recoverTrashItem = async (item: any) => {
    try {
      setDbStatus("CONNECTING");
      await setDoc(doc(db, item.originalCollection, item.originalId), item.data);
      await deleteDoc(doc(db, "trash", item.id));
      alert("Registro recuperado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao recuperar:", error);
      alert("Falha ao recuperar: " + error.message);
    } finally {
      setDbStatus("CONNECTED");
    }
  };

  const deleteTrashItemPermanently = async (id: string) => {
    if (!window.confirm("Deseja EXCLUIR PERMANENTEMENTE este registro?")) return;
    try {
      setDbStatus("CONNECTING");
      await deleteDoc(doc(db, "trash", id));
      alert("Item excluído definitivamente com sucesso!");
    } catch (error: any) {
      alert("Erro ao excluir: " + error.message);
    } finally {
      setDbStatus("CONNECTED");
    }
  };

  const clearTrash = async () => {
    if (trashItems.length === 0) return;
    if (!window.confirm(`Deseja limpar DEFINITIVAMENTE todos os ${trashItems.length} itens da lixeira?`)) return;

    try {
      setDbStatus("CONNECTING");
      const batch = writeBatch(db);
      trashItems.forEach(item => {
        batch.delete(doc(db, "trash", item.id));
      });
      await batch.commit();
      alert("Lixeira limpa com sucesso!");
    } catch (error: any) {
      alert("Erro ao limpar lixeira: " + error.message);
    } finally {
      setDbStatus("CONNECTED");
    }
  };

  const deleteSuggestion = async (id: string) => {
    setDeleteId(id);
    setDeleteColl("suggestions");
  };

  const clearAllSuggestions = async () => {
    if (suggestions.length === 0) return;
    if (!window.confirm(`Deseja realmente mover todas as ${suggestions.length} sugestões para a lixeira?`)) return;

    try {
      setDbStatus("CONNECTING");
      const batch = writeBatch(db);
      suggestions.forEach(item => {
        const { id, ...cleanData } = item;
        const trashDocRef = doc(collection(db, "trash"));
        batch.set(trashDocRef, {
          originalId: item.id,
          originalCollection: "suggestions",
          data: cleanData,
          type: "SUGESTÃO",
          deletedAt: new Date().toISOString(),
          deletedBy: user?.email || "anonymous",
        });
        batch.delete(doc(db, "suggestions", item.id));
      });
      await batch.commit();
      alert("Todas as sugestões foram movidas para a lixeira com sucesso!");
    } catch (error: any) {
      alert("Erro ao apagar sugestões: " + error.message);
    } finally {
      setDbStatus("CONNECTED");
    }
  };

  const handleSaveManualLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const data = {
      num: formData.get("num") as string,
      anv: formData.get("anv") as string,
      p1: formData.get("p1") as string,
      p2: formData.get("p2") as string,
      mv: formData.get("mv") as string,
      missao: formData.get("missao") as string,
      dest: formData.get("dest") as string,
      eobt: formData.get("eobt") as string,
      dateLabel: formData.get("dateLabel") as string,
      createdAt: editingLaunch?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      manual: true,
    };

    try {
      if (editingLaunch) {
        await updateDoc(doc(db, "Lancamentos", editingLaunch.id), data);
        alert("Lançamento atualizado com sucesso.");
      } else {
        await addDoc(collection(db, "Lancamentos"), {
          ...data,
          batchId: "MANUAL",
          batchName: "Lançamentos Manuais",
        });
        alert("Lançamento manual criado com sucesso.");
      }
      setIsManualModalOpen(false);
      setEditingLaunch(null);
    } catch (err: any) {
      alert("Erro ao salvar lançamento: " + err.message);
    }
  };

  const handleDeleteAllAbortivas = async () => {
    if (abortivas.length === 0) return;
    if (
      !window.confirm(
        `ATENÇÃO: Você está prestes a apagar permanentEMENTE ${abortivas.length} registros de abortivas. Confirmar?`,
      )
    )
      return;

    setDbStatus("CONNECTING");
    try {
      const batch = writeBatch(db);
      abortivas.forEach((a) => {
        batch.delete(doc(db, "abortivas", a.id));
      });
      await batch.commit();
      alert("Todas as abortivas foram excluídas com sucesso.");
    } catch (error: any) {
      console.error("Erro ao excluir todas as abortivas:", error);
      alert("Erro ao excluir: " + (error.message || "Erro de conexão"));
    } finally {
      setDbStatus("CONNECTED");
    }
  };

  const handleDownloadAllAbortivas = async () => {
    if (abortivas.length === 0) return;

    try {
      setIsUploading(true);
      const zip = new JSZip();
      const nameCounts: Record<string, number> = {};

      abortivas.forEach((a) => {
        const docPdf = generateAbortivaPDF(a);
        const pdfBlob = docPdf.output("blob");

        // Data do lançamento
        let dateStr = "SemData";
        if (a.createdAt) {
          dateStr = new Date(a.createdAt)
            .toLocaleDateString("pt-BR")
            .replace(/\//g, "-");
        }

        const missionSafe = (a.numLancamento || "Abortiva").replace(/[/\\?%*:|"<>]/g, "-");
        let filenameBase = `${dateStr}_${missionSafe}`;

        if (nameCounts[filenameBase] === undefined) {
          nameCounts[filenameBase] = 1;
        } else {
          nameCounts[filenameBase]++;
          filenameBase += `_${nameCounts[filenameBase]}`;
        }

        const filename = `${filenameBase}.pdf`;
        zip.file(filename, pdfBlob);
      });

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(
        content,
        `ABORTIVAS_COLETIVAS_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.zip`,
      );
    } catch (error) {
      console.error("Erro ao gerar ZIP de abortivas:", error);
      alert("Erro ao baixar abortivas. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAllFGRs = async () => {
    if (fgrs.length === 0) return;
    if (
      !window.confirm(
        `ATENÇÃO: Você está prestes a apagar PERMANENTEMENTE ${fgrs.length} registros de FGR. Esta ação NÃO PODE ser desfeita. Confirmar?`,
      )
    )
      return;

    setDbStatus("CONNECTING");
    try {
      const batch = writeBatch(db);
      fgrs.forEach((f) => {
        batch.delete(doc(db, "fgrMissions", f.id));
      });
      await batch.commit();
      alert("Todos os registros de FGR foram excluídos com sucesso.");
    } catch (error: any) {
      console.error("Erro ao excluir todos os FGRs:", error);
      alert("Erro ao excluir: " + (error.message || "Erro de conexão"));
    } finally {
      setDbStatus("CONNECTED");
    }
  };

  const handleDownloadAllFGRs = async () => {
    if (fgrs.length === 0) return;

    try {
      setIsUploading(true);
      const zip = new JSZip();
      const nameCounts: Record<string, number> = {};

      fgrs.forEach((f) => {
        const docPdf = generateFgrPDF(f);
        const pdfBlob = docPdf.output("blob");

        // Data do lançamento (f.data) ou fallback para createdAt
        let dateStr = "SemData";
        if (f.data) {
          dateStr = f.data.includes("-")
            ? f.data.split("-").reverse().join("-")
            : f.data.replace(/\//g, "-");
        } else if (f.createdAt) {
          dateStr = new Date(f.createdAt)
            .toLocaleDateString("pt-BR")
            .replace(/\//g, "-");
        }

        const missionSafe = (f.missao || "FGR").replace(/[/\\?%*:|"<>]/g, "-");
        let filenameBase = `${dateStr}_${missionSafe}`;

        // Tratar nomes duplicados para evitar sobrescrita no ZIP
        if (nameCounts[filenameBase] === undefined) {
          nameCounts[filenameBase] = 1;
        } else {
          nameCounts[filenameBase]++;
          filenameBase += `_${nameCounts[filenameBase]}`;
        }

        const filename = `${filenameBase}.pdf`;
        zip.file(filename, pdfBlob);
      });

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(
        content,
        `FGR_COLETIVO_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.zip`,
      );
    } catch (error) {
      console.error("Erro ao gerar ZIP:", error);
      alert("Erro ao baixar arquivos coletivos. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreatePdvFromFgr = async (fgr: any) => {
    if (!window.confirm("Deseja criar automaticamente um lançamento no Extrator PDV a partir deste FGR?")) return;
    
    setIsUploading(true);
    try {
      const trigramas = (fgr.trigramaTrip || "").split("/").filter(Boolean);
      const p1 = trigramas[0] || "---";
      const p2 = trigramas[1] || "---";
      const mv = trigramas.slice(2).join("/") || "---";
      
      const numMatch = (fgr.missao || "").match(/\d+/);
      const num = numMatch ? numMatch[0] : "00";

      const payload = {
        num,
        lc: num,
        anv: fgr.aeronave || "---",
        p1,
        p2,
        mv,
        missao: fgr.mv || fgr.missao || "---",
        dest: fgr.local || "SBTA",
        dateLabel: fgr.data || new Date(fgr.createdAt).toLocaleDateString("pt-BR"),
        createdAt: new Date().toISOString(),
        batchId: "AUTO_FGR",
        batchName: "GERADO VIA FGR",
        linkedFgrId: fgr.id
      };

      const docRef = await addDoc(collection(db, "Lancamentos"), payload);
      
      // Also link the FGR back to this new launch
      await updateDoc(doc(db, "fgrMissions", fgr.id), {
        pdvLaunchId: docRef.id
      });

      alert("Lançamento criado com sucesso no Extrator PDV!");
    } catch (error: any) {
      console.error("Erro ao criar PDV a partir do FGR:", error);
      alert("Erro ao criar lançamento: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDelete = (collectionName: string, id: string) => {
    setDeleteId(id);
    setDeleteColl(collectionName);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        alert("Por favor, selecione apenas arquivos PDF.");
        return;
      }
      await handleAbastecimentoUpload(file);
      // Reset input to allow re-selection of the same file
      e.target.value = "";
    }
  };

  const handleAbastecimentoUpload = async (fileToUpload: File) => {
    if (isUploading) return;
    setIsUploading(true);

    try {
      // 1. Upload to Storage
      const path = `config/abastecimento/guia_${Date.now()}_${fileToUpload.name.replace(/\D/g, "")}.pdf`;
      console.log("--- INICIANDO PROCESSO DE UPLOAD ---");
      console.log("Arquivo:", fileToUpload.name, "Tamanho:", fileToUpload.size);
      console.log("User:", auth.currentUser?.email);
      console.log("Caminho no Storage:", path);

      const storageRef = ref(storage, path);
      let url = "";

      try {
        console.log("Passo 1: Chamando uploadBytes...");
        // O uploadBytes simples é mais estável em ambientes de iframe/proxy
        const snapshot = await uploadBytes(storageRef, fileToUpload, {
          contentType: "application/pdf",
        });
        console.log(
          "Passo 1 Concluído: Snapshot recebido",
          snapshot.metadata.fullPath,
        );

        console.log("Passo 2: Obtendo URL de download...");
        url = await getDownloadURL(snapshot.ref);
        console.log("Passo 2 Concluído: URL obtida", url);
      } catch (err: any) {
        console.error("ERRO NO STORAGE:", err);
        throw new Error(
          `Erro ao enviar arquivo para o Google Storage: ${err.message || err.code}`,
        );
      }

      // 2. Update Config
      try {
        console.log("Passo 3: Salvando configuração no Firestore...");
        await setDoc(doc(db, "config", "abastecimento"), {
          url,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser.email || auth.currentUser.uid || "Admin",
          fileName: fileToUpload.name,
        });
        console.log("Passo 3 Concluído.");
      } catch (err: any) {
        console.error("ERRO NO FIRESTORE (Config):", err);
        throw new Error(
          `Erro ao atualizar banco de dados (Config): ${err.message}`,
        );
      }

      // 3. Add to Collection
      try {
        console.log(
          "Passo 4: Adicionando ao acervo de arquivos (documentos_abastecimento)...",
        );
        await addDoc(collection(db, "documentos_abastecimento"), {
          name: fileToUpload.name,
          url,
          size: fileToUpload.size,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser.email || auth.currentUser.uid || "Admin",
        });
        console.log("Passo 4 Concluído. Upload finalizado com sucesso!");
      } catch (err: any) {
        console.error("ERRO NO FIRESTORE (Coleção):", err);
        throw new Error(
          `Erro ao salvar no histórico do acervo: ${err.message}`,
        );
      }

      alert("Arquivo enviado com sucesso!");
    } catch (error: any) {
      console.error("Erro total:", error);
      alert(error.message || "Erro desconhecido durante o processo.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 px-0 sm:px-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 md:pb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-military-gold/20 border border-military-gold flex items-center justify-center text-military-gold shrink-0">
            <ShieldCheck size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
              Painel Administrativo
            </h2>
            <p className="text-military-gold text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5">
              SIPAA 2º BAvEx — Gestão Centralizada
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 px-3 py-1.5 bg-military-black border border-border-theme rounded-sm">
            <div className="hidden sm:flex flex-col">
              <span className="text-[7px] uppercase text-slate-500 font-bold">
                DB ID
              </span>
              <span className="text-[9px] text-slate-400 font-mono">
                {(db as any)._databaseId?.database || "default"}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[7px] uppercase text-slate-500 font-bold">
                Conexão
              </span>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    dbStatus === "CONNECTED"
                      ? "bg-green-500 shadow-[0_0_5px_#22c55e]"
                      : dbStatus === "ERROR"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                  }`}
                />
                <span
                  className={`text-[9px] font-black uppercase ${
                    dbStatus === "CONNECTED"
                      ? "text-green-500"
                      : dbStatus === "ERROR"
                        ? "text-red-500"
                        : "text-yellow-500"
                  }`}
                >
                  {dbStatus}
                </span>
              </div>
            </div>
            <button
              onClick={fetchManual}
              className="p-1 px-2 hover:bg-white/5 rounded-sm text-military-gold transition-colors"
            >
              <History
                size={12}
                className={dbStatus === "CONNECTING" ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-military-black/50 p-1 rounded-lg border border-white/5 overflow-x-auto no-scrollbar mb-8">
        <button
          onClick={() => setSelectedView("stats")}
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === "stats" ? "bg-military-gold text-military-black" : "text-slate-400 hover:text-white"}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setSelectedView("relprevs")}
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === "relprevs" ? "bg-military-gold text-military-black" : "text-slate-400 hover:text-white"}`}
        >
          Relatos
        </button>
        <button
          onClick={() => setSelectedView("fgrs")}
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === "fgrs" ? "bg-military-gold text-military-black" : "text-slate-400 hover:text-white"}`}
        >
          FGR
        </button>
        <button
          onClick={() => setSelectedView("abortivas")}
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === "abortivas" ? "bg-military-gold text-military-black" : "text-slate-400 hover:text-white"}`}
        >
          Abortivas
        </button>
        <button
          onClick={() => setSelectedView("pdv")}
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === "pdv" ? "bg-military-gold text-military-black" : "text-slate-400 hover:text-white"}`}
        >
          Extrator PDV
        </button>
        <button
          onClick={() => setSelectedView("trash")}
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === "trash" ? "bg-red-500 text-white" : "text-slate-400 hover:text-red-400 flex items-center gap-1.5"}`}
        >
          <Trash2 size={10} />
          Lixeira {stats.trash > 0 && `(${stats.trash})`}
        </button>
        <button
          onClick={() => setSelectedView("suggestions")}
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === "suggestions" ? "bg-military-gold text-military-black" : "text-slate-400 hover:text-white flex items-center gap-1.5"}`}
        >
          <Lightbulb size={10} />
          Sugestões {suggestions.length > 0 && `(${suggestions.length})`}
        </button>
        <button
          onClick={() => setSelectedView("database")}
          className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === "database" ? "bg-military-gold text-military-black" : "text-slate-400 hover:text-white flex items-center gap-1.5"}`}
        >
          <Database size={10} />
          Banco de Dados
        </button>
      </div>

      {lastError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-4 text-left">
          <AlertCircle className="text-red-500 shrink-0" />
          <div>
            <p className="text-xs font-black text-red-500 uppercase tracking-widest">
              Erro de Sincronização Detectado
            </p>
            <p className="text-[11px] text-red-200/70 font-mono mt-1">
              {lastError}
            </p>
            <button
              onClick={() => {
                setLastError(null);
                fetchManual();
              }}
              className="mt-2 text-[10px] font-bold text-red-400 underline uppercase"
            >
              Tentar Restaurar Conexão
            </button>
          </div>
        </div>
      )}

      {selectedView === "stats" && (
        <div className="space-y-6">
          <AdminStatsDashboard 
            fgrs={fgrs} 
            abortivas={abortivas} 
            launches={launches} 
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
            <AdminStat
              label="Relatos"
              value={stats.relprevs.toString()}
              trend="TOTAL"
            />
            <AdminStat
              label="Abortivas"
              value={stats.abortivas.toString()}
              trend="TOTAL"
            />
            <AdminStat
              label="FGR"
              value={stats.fgrs.toString()}
              trend="TOTAL"
            />
            <AdminStat
              label="Sugestões"
              value={suggestions.length.toString()}
              trend={suggestions.length > 0 ? "PENDENTES" : "NENHUMA"}
              onClick={() => setSelectedView("suggestions")}
            />
            <AdminStat
              label="Lixeira"
              value={stats.trash.toString()}
              trend={stats.trash > 0 ? "OCUPADA" : "VAZIA"}
              onClick={() => setSelectedView("trash")}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
            <div className="lg:col-span-2 card-military p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-8 border-b border-slate-800 pb-4">
                <h3 className="font-black text-white uppercase text-[10px] tracking-widest">
                  Ações Rápidas
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <AdminAction
                  title="Relatórios de Frota"
                  onClick={() => setSelectedView("relprevs")}
                  desc="Visão geral de incidentes por modelo."
                  icon={ShieldCheck}
                />
                <AdminAction
                  title="FGR"
                  onClick={() => setSelectedView("fgrs")}
                  desc="Auditoria de gerenciamento de risco."
                  icon={FileText}
                />
                <AdminAction
                  title="Relatos de Abortiva"
                  onClick={() => setSelectedView("abortivas")}
                  desc="Auditoria de interrupções de voo."
                  icon={Zap}
                />
              </div>
            </div>

            <div className="card-military bg-military-blue/10 border-military-blue/20 p-4 md:p-6">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">
                Log de Atividades
              </h3>
              <div className="space-y-3 md:space-y-4">
                <ActivityItem
                  time="Agora"
                  user="Admin"
                  action="Acesso ao Painel SIPAA"
                />
                <ActivityItem
                  time="Recente"
                  user="Sistema"
                  action="Dados sincronizados"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedView === "relprevs" && (
        <div className="space-y-4">
          {/* Desktop Table - Only on large screens */}
          <div className="hidden xl:block card-military overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-theme text-[10px] uppercase text-text-secondary font-black">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3">Relator</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-theme/30 text-[11px]">
                  {relprevs.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-white/2 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono">
                        {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-military-gold font-bold">
                        {r.codigo}
                      </td>
                      <td className="px-4 py-3 text-white truncate max-w-[200px]">
                        {r.situacao}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.relatorNome || "Anônimo"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => {
                              const doc = generateRelprevPDF(r);
                              window.open(doc.output("bloburl"), "_blank");
                            }}
                            className="text-military-gold hover:text-white flex items-center gap-1.5 p-1"
                          >
                            <FileText size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              PDF
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRelprev(r);
                              setShowAnexos(true);
                            }}
                            className="text-slate-400 hover:text-white flex items-center gap-1.5 p-1"
                          >
                            <Eye size={14} />
                            <span className="text-[10px] uppercase font-black">
                              Anexos
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              confirmDelete("relprevReports", r.id)
                            }
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet List - Show on anything smaller than XL */}
          <div className="xl:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relprevs.map((r) => (
              <div
                key={r.id}
                className="card-military p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-military-gold font-mono font-black text-xs leading-none">
                      {r.codigo}
                    </span>
                    <span className="text-[9px] text-text-secondary">
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm leading-tight mb-2 line-clamp-2">
                    {r.situacao}
                  </h4>
                  <div className="text-[9px] text-text-secondary uppercase font-bold tracking-widest truncate">
                    Rel:{" "}
                    <span className="text-slate-300">
                      {r.relatorNome || "Anônimo"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                  <button
                    onClick={() => {
                      const doc = generateRelprevPDF(r);
                      window.open(doc.output("bloburl"), "_blank");
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-military-gold/10 text-military-gold text-[10px] font-black uppercase tracking-wider border border-military-gold/20"
                  >
                    <FileText size={14} /> PDF
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRelprev(r);
                      setShowAnexos(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider border border-white/5"
                  >
                    <Eye size={14} /> Anexos
                  </button>
                  <button
                    onClick={() => confirmDelete("relprevReports", r.id)}
                    className="w-10 h-9 flex items-center justify-center rounded bg-red-500/10 text-red-500 border border-red-500/20"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {relprevs.length === 0 && (
            <div className="card-military py-12 text-center opacity-40 italic text-sm">
              Nenhum relato encontrado.
            </div>
          )}
        </div>
      )}

      {selectedView === "fgrs" && (
        <div className="space-y-4">
          {/* Header with Bulk Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2 px-2">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              Auditoria de FGR
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {fgrs.length > 0 && (
                <>
                  <button
                    onClick={handleDownloadAllFGRs}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-military-gold/10 text-military-gold border border-military-gold/20 text-[9px] font-black uppercase tracking-tighter hover:bg-military-gold hover:text-military-black transition-all disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    Baixar Todos ({fgrs.length})
                  </button>
                  <button
                    onClick={handleDeleteAllFGRs}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-tighter hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={12} /> Excluir Todos
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Desktop Table - Only on large screens */}
          <div className="hidden xl:block card-military overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-theme text-[10px] uppercase text-text-secondary font-black">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Missão</th>
                    <th className="px-4 py-3">Aeronave</th>
                    <th className="px-4 py-3">Risco</th>
                    <th className="px-4 py-3 text-right font-black tracking-widest text-military-gold">
                      PDF / AÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-theme/30 text-[11px]">
                  {(() => {
                    const grouped = fgrs.reduce((acc: any, f: any) => {
                      const date = f.data || "SEM DATA";
                      if (!acc[date]) acc[date] = [];
                      acc[date].push(f);
                      return acc;
                    }, {});

                    const sortedDates = Object.keys(grouped).sort((a, b) => {
                      if (a === "SEM DATA") return 1;
                      if (b === "SEM DATA") return -1;
                      
                      const parseDate = (dStr: string) => {
                        if (dStr.includes("/")) {
                          const [d, m, y] = dStr.split("/").map(Number);
                          return new Date(y, m - 1, d).getTime();
                        }
                        return new Date(dStr).getTime();
                      };

                      return parseDate(b) - parseDate(a);
                    });

                    return sortedDates.map((date) => (
                      <React.Fragment key={date}>
                        <tr className="bg-slate-800/40 border-l-4 border-military-gold">
                          <td colSpan={5} className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] border-y border-white/10 bg-slate-800/80">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-military-gold/10 flex items-center justify-center text-military-gold shadow-inner border border-military-gold/20">
                                <Calendar size={20} />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-military-gold text-xs">{date.includes("-") ? date.split('-').reverse().join('/') : date}</span>
                                <span className="text-[8px] text-white/40 font-bold tracking-[0.3em] normal-case italic">FORMULÁRIO DE GERENCIAMENTO DE RISCO</span>
                              </div>
                              <div className="ml-auto flex items-center gap-2">
                                <span className="px-3 py-1 bg-military-gold/5 rounded-full border border-military-gold/20 text-[9px] text-military-gold font-black uppercase tracking-widest shadow-sm">
                                  {grouped[date].length} {grouped[date].length === 1 ? 'Missão' : 'Missões'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {grouped[date]
                          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((f: any) => (
                            <tr
                              key={f.id}
                              className="hover:bg-white/2 transition-colors"
                            >
                              <td className="px-4 py-3 font-mono">
                                {f.data
                                  ? f.data.split("-").reverse().join("/")
                                  : new Date(f.createdAt).toLocaleDateString("pt-BR")}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-white font-bold">{f.missao}</span>
                                  {!launches.some(l => 
                                    l.linkedFgrId === f.id || 
                                    (getFgrLaunchNums(f, launches).split(", ").some(num => num !== "S/N" && num === extractLaunchNum(l)) && 
                                    (!f.data || (l.dateLabel && l.dateLabel.split("/").reverse().join("-") === f.data)))
                                  ) ? (
                                    <div className="flex items-center gap-3 mt-1 group">
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-1">
                                          <span className="text-red-500 font-bold text-sm leading-none">*</span>
                                          <span className="text-[7px] text-red-500/80 font-black uppercase tracking-tight leading-none whitespace-nowrap">
                                            Sem associação com PDV
                                          </span>
                                        </div>
                                        {isAdminAuthenticated && (
                                          <button
                                            onClick={() => handleCreatePdvFromFgr(f)}
                                            disabled={isUploading}
                                            className="mt-1 flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 hover:bg-red-500 hover:text-white transition-all text-[8px] font-black uppercase tracking-tighter shadow-sm"
                                          >
                                            <Plus size={10} />
                                            Criar Lançamento no Extrator
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-text-secondary uppercase">
                                {f.aeronave} | {f.relatorName || "Conv."}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest ${getRiskClass(f.scores.riskMax, f.tipoVoo).bg} ${getRiskClass(f.scores.riskMax, f.tipoVoo).color}`}
                                >
                                  {f.scores.riskMax} pts - {getRiskClass(f.scores.riskMax, f.tipoVoo).label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                                <button
                                  onClick={() => {
                                    if (f.pdfUrl) {
                                      window.open(f.pdfUrl, "_blank");
                                    } else {
                                      const docPdf = generateFgrPDF(f);
                                      const fgrBlob = docPdf.output("blob");
                                      const fgrUrl = URL.createObjectURL(fgrBlob);
                                      window.open(fgrUrl, "_blank");
                                    }
                                  }}
                                  className="text-military-gold hover:text-white flex items-center gap-1.5 p-1"
                                >
                                  <Eye size={14} />
                                  <span className="text-[10px] uppercase font-black">
                                    {f.pdfUrl ? "Ver PDF" : "Gerar"}
                                  </span>
                                </button>
                                <button
                                  onClick={() => {
                                    const docPdf = generateFgrPDF(f);
                                    let dStr = "SemData";
                                    if (f.data) {
                                      dStr = f.data.includes("-")
                                        ? f.data.split("-").reverse().join("-")
                                        : f.data.replace(/\//g, "-");
                                    } else if (f.createdAt) {
                                      dStr = new Date(f.createdAt)
                                        .toLocaleDateString("pt-BR")
                                        .replace(/\//g, "-");
                                    }
                                    const mSafe = (f.missao || "FGR").replace(
                                      /[/\\?%*:|"<>]/g,
                                      "-",
                                    );
                                    docPdf.save(`${dStr}_${mSafe}.pdf`);
                                  }}
                                  className="text-slate-200 hover:text-white flex items-center gap-1.5 p-1"
                                  title="Baixar PDF Original"
                                >
                                  <Download size={14} />
                                  <span className="text-[10px] uppercase font-black">
                                    Baixar
                                  </span>
                                </button>
                                <button
                                  onClick={() => confirmDelete("fgrMissions", f.id)}
                                  className="text-red-400 hover:text-red-300 p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:hidden space-y-8">
            {(() => {
              const grouped = fgrs.reduce((acc: any, f: any) => {
                const date = f.data || "SEM DATA";
                if (!acc[date]) acc[date] = [];
                acc[date].push(f);
                return acc;
              }, {});

                    const sortedDates = Object.keys(grouped).sort((a, b) => {
                      if (a === "SEM DATA") return 1;
                      if (b === "SEM DATA") return -1;
                      
                      const parseDate = (dStr: string) => {
                        if (dStr.includes("/")) {
                          const [d, m, y] = dStr.split("/").map(Number);
                          return new Date(y, m - 1, d).getTime();
                        }
                        return new Date(dStr).getTime();
                      };

                      return parseDate(b) - parseDate(a);
                    });

              return sortedDates.map((date) => (
                <div key={date} className="space-y-4">
                  <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-xl border-l-4 border-military-gold shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-military-gold/10 flex items-center justify-center text-military-gold">
                        <Calendar size={18} />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                          {date !== "SEM DATA" 
                            ? date.split("-").reverse().join("/")
                            : "DATA NÃO INFORMADA"}
                        </h3>
                        <span className="text-[7px] text-military-gold font-bold uppercase tracking-widest mt-0.5">
                          Auditada pelo SIPAA
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 h-px bg-white/5" />
                    <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                      {grouped[date].length} {grouped[date].length === 1 ? 'Missão' : 'Missões'}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {grouped[date]
                      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((f: any) => (
                        <div
                          key={f.id}
                          className="card-military p-4 space-y-3 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-white font-black text-xs uppercase tracking-tight truncate">
                                  {f.missao}
                                </span>
                                {!launches.some(l => 
                                  l.linkedFgrId === f.id || 
                                  (getFgrLaunchNums(f, launches).split(", ").some(num => num !== "S/N" && num === extractLaunchNum(l)) && 
                                  (!f.data || (l.dateLabel && l.dateLabel.split("/").reverse().join("-") === f.data)))
                                ) ? (
                                  <div className="flex flex-col mt-1 gap-1.5">
                                    <div className="flex items-center gap-1">
                                      <span className="text-red-500 font-bold text-xs leading-none">*</span>
                                      <span className="text-[7px] text-red-500/80 font-black uppercase tracking-tight leading-none whitespace-nowrap">
                                        Sem associação com PDV
                                      </span>
                                    </div>
                                    {isAdminAuthenticated && (
                                      <button
                                        onClick={() => handleCreatePdvFromFgr(f)}
                                        disabled={isUploading}
                                        className="flex items-center justify-center gap-1.5 py-1.5 bg-red-500 border border-red-500/20 rounded shadow-md text-white transition-all text-[8px] font-black uppercase tracking-tighter"
                                      >
                                        <Plus size={10} />
                                        Criar Lançamento no Extrator
                                      </button>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter shrink-0 ${getRiskClass(f.scores.riskMax, f.tipoVoo).bg} ${getRiskClass(f.scores.riskMax, f.tipoVoo).color}`}
                              >
                                {f.scores.riskMax} PTS - {getRiskClass(f.scores.riskMax, f.tipoVoo).label.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[10px] text-text-secondary uppercase font-bold tracking-tight grid grid-cols-2 gap-2 mb-1">
                              <div className="truncate">
                                Av: <span className="text-slate-300">{f.aeronave}</span>
                              </div>
                              <div className="text-right">
                                {f.data
                                  ? f.data.split("-").reverse().join("/")
                                  : new Date(f.createdAt).toLocaleDateString("pt-BR")}
                              </div>
                            </div>
                            <div className="text-[10px] text-text-secondary uppercase font-bold tracking-tight truncate">
                              Rel:{" "}
                              <span className="text-slate-300">
                                {f.relatorName || "Conv."}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                            <button
                              onClick={() => {
                                if (f.pdfUrl) {
                                  window.open(f.pdfUrl, "_blank");
                                } else {
                                  const doc = generateFgrPDF(f);
                                  window.open(doc.output("bloburl"), "_blank");
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-military-gold/10 text-military-gold text-[10px] font-black uppercase tracking-wider border border-military-gold/20"
                            >
                              <FileText size={14} /> PDF
                            </button>
                            <button
                              onClick={() => confirmDelete("fgrMissions", f.id)}
                              className="w-10 h-9 flex items-center justify-center rounded bg-red-500/10 text-red-500 border border-red-500/20"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ));
            })()}
          </div>

          {fgrs.length === 0 && (
            <div className="card-military py-12 text-center opacity-40 italic text-sm">
              Nenhuma missão encontrada.
            </div>
          )}
        </div>
      )}

      {selectedView === "abortivas" && (
        <div className="space-y-4">
          {/* Header with Bulk Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2 px-2">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              Acervo de Abortivas
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {abortivas.length > 0 && (
                <>
                  <button
                    onClick={handleDownloadAllAbortivas}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-military-gold/10 text-military-gold border border-military-gold/20 text-[9px] font-black uppercase tracking-tighter hover:bg-military-gold hover:text-military-black transition-all disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    Baixar Todas ({abortivas.length})
                  </button>
                  <button
                    onClick={handleDeleteAllAbortivas}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-tighter hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={12} /> Excluir Todas
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Desktop Table - Only on large screens */}
          <div className="hidden xl:block card-military overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-theme text-[10px] uppercase text-text-secondary font-black">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Lançamento</th>
                    <th className="px-4 py-3">Aeronave</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3 text-right font-black tracking-widest text-military-gold">
                      AÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-theme/30 text-[11px]">
                  {abortivas.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-white/2 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono">
                        {a.dataVoo ? a.dataVoo.split("-").reverse().join("/") : "---"}
                      </td>
                      <td className="px-4 py-3 text-white font-bold">
                        {a.numLancamento}
                      </td>
                      <td className="px-4 py-3 text-text-secondary uppercase">
                        {a.modeloAnv} | {a.preenchidoPor}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest bg-orange-500/20 text-orange-500">
                          {a.motivo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            if (a.pdfUrl) {
                              window.open(a.pdfUrl, "_blank");
                            } else {
                              const docPdf = generateAbortivaPDF(a);
                              const abBlobAdmin = docPdf.output("blob");
                              const abUrlAdmin =
                                URL.createObjectURL(abBlobAdmin);
                              window.open(abUrlAdmin, "_blank");
                            }
                          }}
                          className="text-military-gold hover:text-white flex items-center gap-1.5 p-1"
                        >
                          <Eye size={14} />
                          <span className="text-[10px] uppercase font-black">
                            {a.pdfUrl ? "Ver PDF" : "Gerar"}
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            const docPdf = generateAbortivaPDF(a);
                            docPdf.save(
                              `Abortiva_${a.numLancamento || "Lanç"}.pdf`,
                            );
                          }}
                          className="text-slate-200 hover:text-white flex items-center gap-1.5 p-1"
                          title="Baixar PDF Original"
                        >
                          <Download size={14} />
                          <span className="text-[10px] uppercase font-black">
                            Baixar
                          </span>
                        </button>
                        <button
                          onClick={() => confirmDelete("abortivas", a.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet List - Show on anything smaller than XL */}
          <div className="xl:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
            {abortivas.map((a) => (
              <div
                key={a.id}
                className="card-military p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-black text-xs uppercase tracking-tight truncate">
                      Lç {a.numLancamento}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter shrink-0 bg-orange-500/20 text-orange-500">
                      {a.motivo}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-secondary uppercase font-bold tracking-tight grid grid-cols-2 gap-2 mb-1">
                    <div className="truncate">
                      Mod: <span className="text-slate-300">{a.modeloAnv}</span>
                    </div>
                    <div className="text-right">
                      {a.dataVoo ? a.dataVoo.split("-").reverse().join("/") : "---"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                  <button
                    onClick={() => {
                      if (a.pdfUrl) {
                        window.open(a.pdfUrl, "_blank");
                      } else {
                        const docPdf = generateAbortivaPDF(a);
                        const abBlobMob = docPdf.output("blob");
                        const abUrlMob = URL.createObjectURL(abBlobMob);
                        window.open(abUrlMob, "_blank");
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-military-gold/10 text-military-gold text-[10px] font-black uppercase tracking-wider border border-military-gold/20"
                  >
                    <Eye size={14} /> {a.pdfUrl ? "VER PDF" : "VER"}
                  </button>
                  <button
                    onClick={() => confirmDelete("abortivas", a.id)}
                    className="w-10 h-9 flex items-center justify-center rounded bg-red-500/10 text-red-500 border border-red-500/20"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {abortivas.length === 0 && (
            <div className="card-military py-12 text-center opacity-40 italic text-sm">
              Nenhum relato de abortiva encontrado.
            </div>
          )}
        </div>
      )}

      {selectedView === "pdv" && (
        <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="card-military p-8 text-left">
             <h1 className="text-2xl font-black text-white uppercase mb-8 tracking-tight border-b border-white/10 pb-4">
               Extrator de lançamentos do PDV
             </h1>

             {/* Seletor de Mês */}
             <div className="mb-8 p-4 bg-military-gold/5 border border-military-gold/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <label className="text-[10px] font-black text-military-gold uppercase tracking-[0.2em] mb-1 block">
                   Filtrar por Mês de Referência
                 </label>
                 <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest italic">
                   Selecione um período para visualizar os dados
                 </p>
               </div>
               <div className="relative min-w-[200px]">
                 <select
                   value={selectedPdvMonth}
                   onChange={(e) => setSelectedPdvMonth(e.target.value)}
                   className="w-full bg-military-black border border-military-gold/30 rounded-lg px-4 py-2.5 text-[11px] font-bold text-white uppercase tracking-widest appearance-none focus:outline-none focus:border-military-gold focus:ring-1 focus:ring-military-gold/50 cursor-pointer transition-all"
                 >
                   <option value="TODOS">Todos os Meses</option>
                   {pdvMonths.map(month => (
                     <option key={month} value={month}>
                       {month}
                     </option>
                   ))}
                 </select>
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-military-gold">
                   <ChevronDown size={14} />
                 </div>
               </div>
             </div>
             
             <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="pdvInput" className="text-sm font-bold text-military-gold uppercase tracking-widest">
                    Upload do PDV
                  </label>
                  <div className="relative">
                    <input 
                      id="pdvInput" 
                      type="file" 
                      accept=".pdf" 
                      multiple 
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []) as File[];
                        if (!files.length) return;
                        
                        setIsUploading(true);
                        setPdvExtractionStatus({ msg: "Lendo PDV...", isError: false });
                        
                        try {
                          let totalAdded = 0;
                          const batchId = `PDV_${Date.now()}`;
                          
                          for (const file of files) {
                            const days = await processPDVFile(file);
                            for (const day of days) {
                              for (const launch of day.launches) {
                                await addDoc(collection(db, "Lancamentos"), {
                                  ...launch,
                                  dateLabel: day.dateLabel,
                                  createdAt: new Date().toISOString(),
                                  batchId,
                                  batchName: file.name,
                                });
                                totalAdded++;
                              }
                            }
                          }
                          
                          if (totalAdded > 0) {
                            setPdvExtractionStatus({ 
                              msg: `${totalAdded} lançamento(s) novo(s) encontrado(s).`, 
                              isError: false 
                            });
                          } else {
                            setPdvExtractionStatus({ 
                              msg: "PDF carregado, mas nenhum lançamento novo foi encontrado.", 
                              isError: true 
                            });
                          }
                        } catch (err: any) {
                          console.error(err);
                          setPdvExtractionStatus({ 
                            msg: "Erro ao abrir o PDF. Verifique se o arquivo não está protegido.", 
                            isError: true 
                          });
                        } finally {
                          setIsUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    <label 
                      htmlFor="pdvInput"
                      className={`flex items-center justify-center gap-3 p-6 border-2 border-dashed border-military-gold/30 rounded-xl bg-military-gold/5 text-military-gold font-black uppercase text-sm cursor-pointer hover:bg-military-gold/10 hover:border-military-gold transition-all ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isUploading ? <Loader2 className="animate-spin" size={24} /> : <Upload size={24} />}
                      {isUploading ? "PROCESSANDO..." : "CARREGAR PDV (PDF)"}
                    </label>
                  </div>
                </div>

                {pdvExtractionStatus.msg && (
                  <div className={`text-xs font-bold uppercase tracking-tight p-3 rounded bg-white/5 border-l-2 ${pdvExtractionStatus.isError ? "text-red-400 border-red-500" : "text-green-400 border-green-500"}`}>
                    {pdvExtractionStatus.msg}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <button
                    id="clearLink"
                    onClick={async () => {
                      if (!confirm('Limpar todos os lançamentos salvos?')) return;
                      // Logic to clear all launches from Firestore
                      const batch = writeBatch(db);
                      launches.forEach(l => {
                        batch.delete(doc(db, "Lancamentos", l.id));
                      });
                      await batch.commit();
                      setPdvExtractionStatus({ msg: 'Dados removidos.', isError: false });
                    }}
                    className="w-full sm:w-auto px-6 py-3 border border-red-500/50 text-red-500 rounded-xl font-bold uppercase text-[10px] hover:bg-red-500/10 transition-all"
                  >
                    Apagar PDVs carregados
                  </button>
                  
                  <button
                    onClick={() => {
                      setEditingLaunch(null);
                      setManualDate("");
                      setIsManualModalOpen(true);
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-military-gold text-military-black rounded-xl font-black uppercase text-[10px] hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> LANÇAMENTO MANUAL
                  </button>
                </div>

                <p className="text-[9px] text-slate-500 uppercase tracking-tighter">
                  Os lançamentos ficam salvos e são somados aos anteriores. 
                </p>
             </div>
          </div>

          <div className="card-military p-6 text-left">
            <h4 className="text-xs font-bold text-white uppercase mb-4 tracking-tight flex items-center gap-2">
              <FileText size={14} className="text-military-gold" />
              Arquivos Processados {selectedPdvMonth !== "TODOS" && <span className="text-military-gold/60 ml-1">({selectedPdvMonth})</span>}
            </h4>
            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
              {(() => {
                const batches = Object.values(
                  filteredPdvLaunches.reduce((acc: any, curr: any) => {
                    if (!curr.batchId) return acc;
                    if (!acc[curr.batchId]) {
                      acc[curr.batchId] = {
                        id: curr.batchId,
                        name: curr.batchName || "Sem Nome",
                        count: 0,
                        date: curr.createdAt || new Date().toISOString(),
                      };
                    }
                    acc[curr.batchId].count++;
                    return acc;
                  }, {}),
                );

                return batches.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic uppercase">
                    Nenhum arquivo processado.
                  </p>
                ) : (
                  batches
                    .sort((a: any, b: any) => b.date.localeCompare(a.date))
                    .map((b: any) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-3 bg-military-black/30 border border-white/5 rounded hover:border-red-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileSearch
                            size={16}
                            className="text-military-gold shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-white font-bold truncate uppercase">
                              {b.name}
                            </span>
                            <span className="text-[8px] text-slate-500 uppercase">
                              {b.count} lançamentos •{" "}
                              {new Date(b.date).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingBatchId(viewingBatchId === b.id ? null : b.id)}
                            className={`px-3 py-1 rounded text-[8px] font-bold uppercase transition-all ${viewingBatchId === b.id ? 'bg-military-gold text-military-black' : 'border border-white/10 text-white hover:border-military-gold/50'}`}
                          >
                            {viewingBatchId === b.id ? 'Fechar' : 'Ver Lançamentos'}
                          </button>
                          <button
                            onClick={() =>
                              setBatchDeleteTarget({
                                id: b.id,
                                name: b.name,
                                count: b.count,
                              })
                            }
                            className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                            title="Excluir Lote"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                );
              })()}
              {viewingBatchId && (
                <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h5 className="text-[10px] font-black text-military-gold uppercase tracking-widest">
                      Lançamentos do Arquivo
                    </h5>
                    <button 
                      onClick={() => setViewingBatchId(null)}
                      className="text-slate-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredPdvLaunches
                      .filter(l => l.batchId === viewingBatchId)
                      .map(l => (
                        <div key={l.id} className="p-3 bg-military-black/20 border border-white/5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {l.markedNoFgr && (
                                <span className="flex items-center gap-1 text-[8px] font-black bg-red-500/20 text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                  SEM FGR
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 bg-military-gold/10 text-military-gold text-[8px] font-black rounded">
                                LÇ {l.num || l.lc}
                              </span>
                              <span className="text-[10px] text-white font-bold truncate uppercase">
                                {l.missao}
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-500 uppercase truncate">
                              {l.anv} • {l.p1} / {l.p2} • {l.adDest}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => toggleNoFgr(l.id, l.markedNoFgr || false)}
                            className={`px-4 py-1.5 rounded text-[8px] font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${
                              l.markedNoFgr 
                                ? "bg-red-500/20 text-red-500 border border-red-500/30" 
                                : "bg-transparent border border-white/10 text-slate-400 hover:border-red-500 hover:text-red-500"
                            }`}
                          >
                            <Ban size={10} />
                            {l.markedNoFgr ? "Sem FGR" : "Marcar Sem FGR"}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card-military p-6 text-left">
            <h4 className="text-xs font-bold text-white uppercase mb-4 tracking-tight flex items-center gap-2">
              <History size={14} className="text-military-gold" />
              Lançamentos Disponíveis ({filteredPdvLaunches.length}) {selectedPdvMonth !== "TODOS" && <span className="text-military-gold/60 ml-1">({selectedPdvMonth})</span>}
            </h4>
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredPdvLaunches.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic uppercase">
                  {selectedPdvMonth === "TODOS" ? "Nenhum lançamento importado." : `Nenhum lançamento encontrado para ${selectedPdvMonth}.`}
                </p>
              ) : (
                Object.entries(
                  filteredPdvLaunches.reduce((acc: any, curr: any) => {
                    const groupKey = curr.dateLabel || "Sem Data";
                    if (!acc[groupKey]) acc[groupKey] = [];
                    acc[groupKey].push(curr);
                    return acc;
                  }, {}),
                )
                  .sort((a, b) => {
                    const toSortable = (s: string) => {
                      const p = s.split("/");
                      return p.length === 3 ? p[2] + p[1] + p[0] : s;
                    };
                    return toSortable(b[0]).localeCompare(toSortable(a[0]));
                  })
                  .map(([date, items]: [string, any]) => (
                    <div key={date} className="space-y-2">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-1">
                        <Calendar size={12} className="text-military-gold" />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                          DATA: {date}
                        </span>
                        <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-500 ml-auto">
                          {items.length} LANÇAMENTOS
                        </span>
                      </div>
                      <div className="grid gap-1.5">
                        {items
                          .sort((a: any, b: any) => a.num.localeCompare(b.num))
                          .map((l: any) => {
                            const launchDateISO = l.dateLabel
                              ? l.dateLabel.split("/").reverse().join("-")
                              : "";
                            const isLinked = !!l.linkedFgrId;
                            const hasFgr = isLinked || fgrs.some(
                              (f) => {
                                const fDateISO = (f.data && f.data.includes("/")) 
                                  ? f.data.split("/").reverse().join("-") 
                                  : f.data;
                                return fDateISO === launchDateISO && (
                                  f.missao?.includes(`LÇ ${l.num}`) ||
                                  f.missao?.includes(`LANC ${l.num}`)
                                );
                              }
                            );
                            const hasAbortiva = abortivas.some(
                              (a) => {
                                const aDateISO = (a.dataVoo && a.dataVoo.includes("/"))
                                  ? a.dataVoo.split("/").reverse().join("-")
                                  : a.dataVoo;
                                return aDateISO === launchDateISO && 
                                  a.numLancamento === l.num;
                              }
                            );

                            return (
                              <div
                                key={l.id}
                                className="flex items-center justify-between p-2.5 bg-white/2 border border-white/5 rounded hover:border-military-gold/20 transition-all group overflow-hidden"
                              >
                                <div className="flex items-center gap-6 sm:gap-10 min-w-0 flex-1 overflow-x-auto custom-scrollbar pb-1">
                                  <div className="flex items-center gap-3 shrink-0">
                                    {l.markedNoFgr && (
                                      <span className="flex items-center gap-1 text-[8px] font-black bg-red-500/20 text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                        SEM FGR
                                      </span>
                                    )}
                                    {hasFgr && (
                                      <span className={`flex items-center gap-1 text-[8px] font-black ${isLinked ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-green-500/20 text-green-500 border-green-500/30'} px-1.5 py-0.5 rounded uppercase tracking-tighter`}>
                                        {isLinked && <Link2 size={8} className="shrink-0" />}
                                        FGR
                                      </span>
                                    )}
                                    {hasAbortiva && (
                                      <span className="flex items-center gap-0.5 text-[8px] font-black bg-green-500/20 text-green-500 border border-green-500/30 px-1 py-0.5 rounded uppercase tracking-tighter">
                                        Abortiva
                                      </span>
                                    )}
                                    <span className="text-[10px] font-black text-accent-gold whitespace-nowrap uppercase tracking-tighter">
                                      LÇ {l.num}
                                    </span>
                                  </div>
                                  <div className="flex flex-row items-center gap-6 min-w-0">
                                    <span className="text-[10px] text-white font-black whitespace-nowrap uppercase tracking-tighter shrink-0">
                                      {l.anv}
                                    </span>
                                    <div className="flex items-center gap-4 sm:gap-6 text-[10px] text-slate-500 uppercase tracking-tighter font-bold">
                                      <span className="shrink-0">{l.p1}</span>
                                      <span className="shrink-0">{l.p2}</span>
                                      <span className="shrink-0">{l.mv}</span>
                                      <span className="shrink-0">{l.dest || l.adDest}</span>
                                      <span className="whitespace-nowrap shrink-0">
                                        {l.missao}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => {
                                      setLaunchToLink(l);
                                      setIsLinkFgrModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-600 hover:text-blue-400 transition-colors"
                                    title="Linkar FGR"
                                  >
                                    <Link2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => toggleNoFgr(l.id, l.markedNoFgr || false)}
                                    className={`p-1.5 transition-colors ${l.markedNoFgr ? "text-red-500" : "text-slate-600 hover:text-red-400"}`}
                                    title={l.markedNoFgr ? "Remover Sem FGR" : "Marcar Sem FGR"}
                                  >
                                    <Ban size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingLaunch(l);
                                      setManualDate(l.dateLabel || "");
                                      setIsManualModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-600 hover:text-military-gold transition-colors"
                                    title="Editar"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Excluir este lançamento?",
                                        )
                                      ) {
                                        deleteDoc(doc(db, "Lancamentos", l.id));
                                      }
                                    }}
                                    className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
      {selectedView === "trash" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-red-500/10 p-4 rounded border border-red-500/20">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Trash2 size={16} className="text-red-500" />
                Lixeira do Sistema
              </h3>
              <p className="text-[10px] text-red-400 font-bold uppercase mt-1">
                {trashItems.length} itens aguardando exclusão permanente ou recuperação
              </p>
            </div>
            {trashItems.length > 0 && (
              <button
                onClick={clearTrash}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded transition-all flex items-center gap-2 shadow-lg shadow-red-600/20"
              >
                <Trash2 size={12} />
                Limpar Lixeira
              </button>
            )}
          </div>

          <div className="card-military overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase text-slate-500 font-black">
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Identificação</th>
                    <th className="px-4 py-3">Deletado em</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/2 text-[11px]">
                  {trashItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-12 text-center text-slate-500 uppercase font-black text-[10px] italic"
                      >
                        Lixeira vazia
                      </td>
                    </tr>
                  ) : (
                    trashItems.map((item) => {
                      const data = item.data;
                      let label = "Registro Desconhecido";
                      if (item.type === "RELPREV")
                        label = data.codigo || "RELPREV";
                      if (item.type === "FGR") label = data.missao || "Missão FGR";
                      if (item.type === "ABORTIVA")
                        label = `${data.modeloAnv} - LÇ ${data.numLancamento}`;
                      if (item.type === "SUGESTÃO")
                        label =
                          data.text?.substring(0, 40) +
                          (data.text?.length > 40 ? "..." : "");

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-white/2 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                item.type === "RELPREV"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : item.type === "FGR"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : item.type === "SUGESTÃO"
                                      ? "bg-yellow-500/20 text-yellow-400"
                                      : "bg-purple-500/20 text-purple-400"
                              }`}
                            >
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white font-bold truncate max-w-[200px]">
                            {label}
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono">
                            {new Date(item.deletedAt).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => recoverTrashItem(item)}
                                className="px-3 py-1.5 bg-green-600/10 text-green-500 hover:bg-green-600/20 rounded text-[9px] font-black uppercase transition-all"
                                title="Recuperar"
                              >
                                Recuperar
                              </button>
                              <button
                                onClick={() =>
                                  deleteTrashItemPermanently(item.id)
                                }
                                className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                                title="Excluir Permanentemente"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
       {selectedView === "suggestions" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-military-gold/10 p-4 rounded border border-military-gold/20">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Lightbulb size={16} className="text-military-gold" />
                Sugestões de Melhorias Recebidas
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                {suggestions.length} sugestões de melhorias pendentes
              </p>
            </div>
            {suggestions.length > 0 && (
              <button
                onClick={clearAllSuggestions}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-white rounded text-[10px] font-black uppercase transition-all shadow-lg cursor-pointer shrink-0"
              >
                <Trash2 size={12} />
                Apagar Todas
              </button>
            )}
          </div>

          <div className="space-y-4">
            {suggestions.length === 0 ? (
              <div className="card-military p-12 text-center text-slate-500 uppercase font-black text-[10px] italic">
                Nenhuma sugestão recebida até o momento.
              </div>
            ) : (
              suggestions.map((s) => (
                <div key={s.id} className="card-military p-6 relative group overflow-hidden">
                  <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteSuggestion(s.id);
                      }}
                      className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all rounded-lg cursor-pointer bg-military-black border border-white/5 shadow-xl"
                      title="Excluir Sugestão"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-full bg-military-gold/10 flex items-center justify-center text-military-gold border border-military-gold/20">
                        <Lightbulb size={14} />
                      </div>
                      <p className="text-[9px] text-slate-500 font-mono italic">
                        {new Date(s.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-text-secondary text-base leading-relaxed bg-white/2 p-5 rounded-xl border border-white/5 whitespace-pre-wrap font-medium">
                      {s.text}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {selectedView === "database" && (
        <div className="space-y-6">
          <div className="pb-4 border-b border-white/5">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Database size={16} className="text-military-gold animate-pulse" />
              Gerenciamento e Backup do Banco de Dados
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              Backup operacional, exportação consolidada e relatórios em tempo real
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* FGR Backup Card */}
            <div className="card-military p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-military-gold/10 text-military-gold border border-military-gold/20">
                    <Database size={16} />
                  </div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    Exportar Todos os FGR
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                  Gere arquivos PDF individuais de todos os Gerenciamentos de Risco Operacional (FGRs) cadastrados no sistema. Todo o lote será compactado e baixado em formato Zip.
                </p>
              </div>
              <button
                onClick={handleDownloadAllFGRs}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-military-gold hover:bg-military-gold-dark text-military-black hover:text-military-black font-black uppercase tracking-wider rounded text-[10px] transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                <Download size={14} />
                Baixar FGRs ({fgrs.length})
              </button>
            </div>

            {/* Abortivas Backup Card */}
            <div className="card-military p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-military-gold/10 text-military-gold border border-military-gold/20">
                    <Database size={16} />
                  </div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    Exportar Todas as Abortivas
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                  Gere arquivos PDF individuais de todos os Relatos de Abortiva de Voo armazenados no banco de dados, compactados e estruturados em um único arquivo Zip simples.
                </p>
              </div>
              <button
                onClick={handleDownloadAllAbortivas}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-military-gold hover:bg-military-gold-dark text-military-black hover:text-military-black font-black uppercase tracking-wider rounded text-[10px] transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                <Download size={14} />
                Baixar Abortivas ({abortivas.length})
              </button>
            </div>

            {/* Monthly Stats Card */}
            <div className="card-military p-6 space-y-4 flex flex-col justify-between md:col-span-1">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-military-gold/10 text-military-gold border border-military-gold/20">
                    <Calendar size={16} />
                  </div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    Estatísticas Mensais (PDF)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                  Selecione o período de referência para exportar o relatório operacional consolidado de estatísticas mensais contendo o panorama do mês, riscos analisados e motivos de abortivas em PDF.
                </p>
                <div className="grid grid-cols-2 gap-2 p-3 bg-military-black rounded border border-white/5">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Mês</label>
                    <select
                      value={backupMonth}
                      onChange={(e) => setBackupMonth(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white uppercase font-black cursor-pointer"
                    >
                      {[
                        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                      ].map((mName, idx) => (
                        <option key={idx} value={idx}>{mName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Ano</label>
                    <select
                      value={backupYear}
                      onChange={(e) => setBackupYear(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white uppercase font-black cursor-pointer"
                    >
                      {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <button
                onClick={handleDownloadStatsPDF}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-military-gold hover:bg-military-gold-dark text-military-black hover:text-military-black font-black uppercase tracking-wider rounded text-[10px] transition-all cursor-pointer shadow-lg mt-4"
              >
                <Download size={14} />
                Baixar Relatório Mensal
              </button>
            </div>

            {/* Complete Backup Card */}
            <div className="card-military p-6 space-y-4 flex flex-col justify-between md:col-span-1 border-military-gold/30">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-military-gold/20 text-military-gold border border-military-gold/40">
                    <Database size={16} />
                  </div>
                  <h4 className="text-xs font-black text-military-gold uppercase tracking-wider">
                    Download Backup Completo (Tudo)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                  Baixe tudo de uma vez. Esta ação gerará um arquivo compactado (Zip) mestre contendo uma pasta com todos os FGRs em formato de PDF individuais, uma pasta com os PDFs das Abortivas de Voo e o documento PDF com as estatísticas do mês selecionado.
                </p>
              </div>
              <button
                onClick={handleDownloadFullBackup}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-military-gold hover:bg-military-gold-dark text-military-black hover:text-military-black font-black uppercase tracking-wider rounded text-[10px] transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Baixar Backup Geral (ZIP)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Batch Delete Confirmation Modal */}
      <AnimatePresence>
        {batchDeleteTarget && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-military-black/95 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card-military max-w-sm w-full p-8 text-center space-y-6 border-red-500/30"
            >
              <div className="w-20 h-20 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center border border-red-500/20">
                <AlertTriangle size={40} className="animate-pulse" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                  Excluir Lote Inteiro?
                </h3>
                <div className="p-3 bg-red-500/5 rounded border border-red-500/10">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                    Arquivo Selecionado:
                  </p>
                  <p className="text-xs text-military-gold font-black truncate">
                    "{batchDeleteTarget.name}"
                  </p>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Contém {batchDeleteTarget.count} lançamentos
                  </p>
                </div>
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest bg-red-500/10 py-2 rounded">
                  Esta ação removerá tudo permanentemente
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setBatchDeleteTarget(null)}
                  className="flex-1 px-4 py-3 rounded bg-slate-800 text-white font-bold text-[10px] uppercase hover:bg-slate-700 transition-colors border border-white/5"
                  disabled={isUploading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteBatch}
                  className="flex-1 px-4 py-3 rounded bg-red-600 text-white font-bold text-[10px] uppercase hover:bg-red-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  {isUploading ? "EXCLUINDO..." : "SIM, EXCLUIR"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-military-black/90 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-military max-w-sm w-full p-6 text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 mx-auto flex items-center justify-center">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Mover para Lixeira
                </h3>
                <p className="text-xs text-text-secondary">
                  Deseja realmente mover este registro para a lixeira?
                  Ele poderá ser recuperado posteriormente se necessário.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDeleteId(null);
                    setDeleteColl(null);
                  }}
                  className="flex-1 px-4 py-3 rounded bg-slate-800 text-white font-bold text-[10px] uppercase hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 rounded bg-red-500 text-white font-bold text-[10px] uppercase hover:bg-red-600 transition-colors"
                >
                  Sim, Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Relprev Multi-line Details Modal */}
      <AnimatePresence>
        {selectedRelprev && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-military-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-military max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 space-y-6"
            >
              <div className="flex justify-between items-start border-b border-border-theme pb-4">
                <div>
                  <span className="text-[10px] font-mono text-military-gold uppercase tracking-[0.2em]">
                    RELPREV #{selectedRelprev.codigo}
                  </span>
                  <h3 className="text-xl font-black text-white">
                    Anexos do Relato
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedRelprev(null);
                    setShowAnexos(false);
                  }}
                  className="text-text-secondary hover:text-white border border-white/10 rounded p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {(selectedRelprev.images &&
                  selectedRelprev.images.length > 0) ||
                (selectedRelprev.extraFiles &&
                  selectedRelprev.extraFiles.length > 0) ? (
                  <div className="space-y-6">
                    {selectedRelprev.images &&
                      selectedRelprev.images.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] uppercase font-black text-military-gold tracking-widest">
                            Fotos Anexadas
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {selectedRelprev.images.map(
                              (img: string, i: number) => (
                                <button
                                  key={i}
                                  onClick={() => openBase64InNewTab(img)}
                                  className="block group relative overflow-hidden rounded border border-white/10 hover:border-accent-gold transition-colors aspect-square"
                                >
                                  <img
                                    src={img}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                    alt="Anexo"
                                  />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Search size={18} className="text-white" />
                                  </div>
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                    {selectedRelprev.extraFiles &&
                      selectedRelprev.extraFiles.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] uppercase font-black text-military-gold tracking-widest">
                            Documentos Extras
                          </span>
                          <div className="space-y-2">
                            {selectedRelprev.extraFiles.map(
                              (file: string, i: number) => (
                                <button
                                  key={i}
                                  onClick={() => openBase64InNewTab(file)}
                                  className="w-full flex items-center gap-3 p-4 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-[10px] text-white font-bold uppercase text-left"
                                >
                                  <FileText
                                    size={18}
                                    className="text-military-gold"
                                  />
                                  <span>Download Arquivo Anexo {i + 1}</span>
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="py-20 text-center text-text-secondary italic text-sm border border-dashed border-white/10 rounded">
                    Este relato não possui anexos.
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-6 border-t border-white/5">
                <button
                  onClick={() => {
                    const doc = generateRelprevPDF(selectedRelprev);
                    window.open(doc.output("bloburl"), "_blank");
                  }}
                  className="flex-1 btn-military py-4 flex items-center justify-center gap-2"
                >
                  <FileText size={16} /> VER DADOS COMPLETOS (PDF)
                </button>
                <button
                  onClick={() => {
                    setSelectedRelprev(null);
                    setShowAnexos(false);
                  }}
                  className="px-8 py-4 rounded border border-border-theme text-white font-bold text-xs hover:bg-white/5 transition-all uppercase"
                >
                  Voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Flight Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-military-black/95 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card-military max-w-lg w-full p-8 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-military-gold/10 flex items-center justify-center text-military-gold">
                    {editingLaunch ? <Edit size={20} /> : <Plus size={20} />}
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                    {editingLaunch
                      ? "Editar Lançamento"
                      : "Novo Lançamento Manual"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsManualModalOpen(false);
                    setEditingLaunch(null);
                  }}
                  className="text-slate-500 hover:text-white p-2"
                >
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={handleSaveManualLaunch}
                className="grid grid-cols-2 gap-4"
              >
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    Data (DD/MM/AAAA)
                  </label>
                  <input
                    name="dateLabel"
                    required
                    placeholder="Ex: 21/04/2026"
                    value={manualDate}
                    onChange={(e) => handleDateMask(e.target.value)}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    Número Lançamento
                  </label>
                  <input
                    name="num"
                    required
                    placeholder="Ex: 45"
                    defaultValue={editingLaunch?.num || ""}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    Aeronave (Prefixo)
                  </label>
                  <input
                    name="anv"
                    required
                    placeholder="Ex: HM-1A 4022"
                    defaultValue={editingLaunch?.anv || ""}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    1P
                  </label>
                  <input
                    name="p1"
                    required
                    placeholder="Posto Nome"
                    defaultValue={editingLaunch?.p1 || ""}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    2P
                  </label>
                  <input
                    name="p2"
                    required
                    placeholder="Posto Nome"
                    defaultValue={editingLaunch?.p2 || ""}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    MV (Mecânicos de Voo)
                  </label>
                  <input
                    name="mv"
                    placeholder="Ex: SGT NOME / SGT NOME"
                    defaultValue={editingLaunch?.mv || "---"}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    Missão
                  </label>
                  <input
                    name="missao"
                    placeholder="Ex: TREINAMENTO / TRANSPORTE"
                    defaultValue={editingLaunch?.missao || "---"}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    Destino
                  </label>
                  <input
                    name="dest"
                    placeholder="Ex: SBTA"
                    defaultValue={editingLaunch?.dest || "---"}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">
                    EOBT (Hora Saída)
                  </label>
                  <input
                    name="eobt"
                    placeholder="Ex: 09H30"
                    defaultValue={editingLaunch?.eobt || "---"}
                    className="input-military w-full h-11"
                  />
                </div>

                <div className="col-span-2 pt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualModalOpen(false);
                      setEditingLaunch(null);
                    }}
                    className="flex-1 py-4 rounded bg-slate-800 text-white font-black text-[10px] uppercase hover:bg-slate-700 transition-colors border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-4 rounded bg-military-gold text-military-black font-black text-[10px] uppercase hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-military-gold/20 flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    {editingLaunch ? "SALVAR ALTERAÇÕES" : "CRIAR LANÇAMENTO"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Link FGR Modal */}
      <AnimatePresence>
        {isLinkFgrModalOpen && launchToLink && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-military-black/95 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card-military max-w-lg w-full p-8 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Link2 size={20} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none">
                      Linkar FGR ao Lançamento
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
                      LÇ {launchToLink.num} • {launchToLink.dateLabel}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLinkFgrModalOpen(false)}
                  className="text-slate-500 hover:text-white p-2"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="PESQUISAR POR MISSÃO, PILOTO OU DATA..."
                    value={fgrSearchTerm}
                    onChange={(e) => setFgrSearchTerm(e.target.value)}
                    className="input-military w-full h-10 pl-10 text-[10px] placeholder:text-slate-700"
                  />
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {fgrs
                    .filter((f) => {
                      const searchStr =
                        `${f.missao} ${f.p1} ${f.data} ${f.anv}`.toLowerCase();
                      return searchStr.includes(fgrSearchTerm.toLowerCase());
                    })
                    .sort((a, b) => {
                      // 1. Prioridade por data (Decrescente - mais recente primeiro)
                      const parseD = (s: string) => {
                        if (!s) return 0;
                        if (s.includes('/')) {
                          const parts = s.split('/');
                          if (parts.length === 3) {
                            const [d, m, y] = parts.map(Number);
                            return new Date(y, m - 1, d).getTime();
                          }
                        }
                        const dt = new Date(s).getTime();
                        return isNaN(dt) ? 0 : dt;
                      };
                      
                      const timeA = parseD(a.data);
                      const timeB = parseD(b.data);
                      
                      const dateCompare = timeB - timeA;
                      if (dateCompare !== 0) return dateCompare;

                      // 2. Lançamento Sequencial (Crescente - do 1 em diante)
                      const numAStr = getFgrLaunchNums(a, launches).split(",")[0];
                      const numBStr = getFgrLaunchNums(b, launches).split(",")[0];

                      // Extrair apenas números para garantir ordenação numérica correta
                      const getNum = (str: string) => {
                        const match = str.match(/\d+/);
                        return match ? parseInt(match[0]) : 999;
                      };

                      const numA = getNum(numAStr);
                      const numB = getNum(numBStr);

                      return numA - numB;
                    })
                    .map((f) => (
                      <button
                        key={f.id}
                        onClick={async () => {
                          try {
                            await updateDoc(
                              doc(db, "Lancamentos", launchToLink.id),
                              {
                                linkedFgrId: f.id,
                              },
                            );
                            setIsLinkFgrModalOpen(false);
                            setLaunchToLink(null);
                          } catch (error) {
                            handleFirestoreError(
                              error,
                              OperationType.UPDATE,
                              "Lancamentos",
                            );
                          }
                        }}
                        className={`w-full p-4 rounded-lg border text-left transition-all group ${
                          launchToLink.linkedFgrId === f.id
                            ? "bg-blue-500/10 border-blue-500/40"
                            : "bg-white/2 border-white/10 hover:border-blue-500/30"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-black text-white uppercase truncate pr-4">
                            {f.missao || "Sem Missão"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap shrink-0">
                            {f.data.split("-").reverse().join("/")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] text-slate-500 uppercase font-black">
                          <span className="text-military-gold">
                            {f.anv}
                          </span>
                          <span>{f.p1}</span>
                        </div>
                        {launchToLink.linkedFgrId === f.id && (
                          <div className="mt-2 flex items-center gap-1.5 text-[8px] font-black text-blue-400 uppercase">
                            <Check size={10} /> JÁ LINKADO
                          </div>
                        )}
                      </button>
                    ))}

                  {fgrs.length === 0 && (
                    <p className="text-center py-8 text-[10px] text-slate-500 italic uppercase">
                      Nenhum FGR disponível.
                    </p>
                  )}
                </div>

                {launchToLink.linkedFgrId && (
                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(
                          doc(db, "Lancamentos", launchToLink.id),
                          {
                            linkedFgrId: null,
                          },
                        );
                        setIsLinkFgrModalOpen(false);
                        setLaunchToLink(null);
                      } catch (error) {
                        handleFirestoreError(
                          error,
                          OperationType.UPDATE,
                          "Lancamentos",
                        );
                      }
                    }}
                    className="w-full py-3 rounded border border-red-500/30 text-red-400 text-[10px] font-black uppercase hover:bg-red-500/5 transition-all mt-2"
                  >
                    Remover Link Atual
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-HELPER COMPONENTS ---

function QuickCard({ icon: Icon, title, desc, color, onClick }: any) {
  const colorMap: any = {
    gold: "bg-accent-gold/10 border-accent-gold/30 text-accent-gold",
    blue: "bg-accent-blue/10 border-accent-blue/30 text-white",
    slate: "bg-slate-800/50 border-border-theme text-text-secondary",
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`card-military p-5 cursor-pointer group transition-all text-center ${colorMap[color]}`}
    >
      <div className="flex flex-col items-center gap-3">
        {Icon && <Icon size={20} className="text-accent-gold" />}
        <h3 className="font-bold text-sm tracking-wide">{title}</h3>
        <p className="text-[11px] text-text-secondary leading-tight">{desc}</p>
      </div>
    </motion.div>
  );
}

function AvisoItem({ type, title, time, text }: any) {
  const colors: any = {
    danger: "text-red-500 bg-red-500/10 border-red-500/20",
    warning: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  };
  return (
    <div className={`p-3 rounded border text-sm ${colors[type]}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold uppercase tracking-tight text-[11px]">
          {title}
        </span>
        <span className="text-[10px] opacity-60 font-mono">{time}</span>
      </div>
      <p className="text-xs opacity-70 leading-tight">{text}</p>
    </div>
  );
}

function NewsItem({ title, date, text }: any) {
  return (
    <div className="pb-4 border-b border-slate-800 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] font-bold text-military-gold bg-military-gold/10 px-2 py-0.5 rounded uppercase">
          {date}
        </span>
        <h4 className="text-sm font-bold text-slate-200">{title}</h4>
      </div>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function FgrField({ label, placeholder, type = "text", defaultValue }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-tight">
        {label}
      </label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="input-military text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}

function FgrRow({ title, items }: any) {
  return (
    <div className="card-military">
      <h4 className="text-xs font-bold text-white mb-4 uppercase">{title}</h4>
      <div className="space-y-2">
        {items.map((item: any) => (
          <label
            key={item.label}
            className="flex items-center justify-between p-3 bg-military-black border border-slate-800 rounded-lg cursor-pointer hover:border-slate-500 transition-colors"
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name={title}
                className="accent-military-gold"
              />
              <span className="text-xs text-slate-300 font-medium">
                {item.label}
              </span>
            </div>
            <span className="text-military-gold font-mono font-bold">
              +{item.value}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function RiscoCard({ title, area, desc, mitig, type }: any) {
  const colors: any = {
    critical: "border-red-500/40 border-t-4 border-t-red-500",
    warning: "border-yellow-500/40 border-t-4 border-t-yellow-500",
    info: "border-blue-500/40 border-t-4 border-t-blue-500",
  };
  return (
    <div className={`card-military h-full flex flex-col ${colors[type]}`}>
      <div className="mb-4">
        <span className="text-[10px] font-bold uppercase text-slate-500">
          {area}
        </span>
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-6 flex-1 italic">
        {desc}
      </p>
      <div className="mt-auto pt-4 border-t border-slate-800">
        <span className="text-[10px] font-bold uppercase text-military-gold block mb-1">
          Medida Mitigadora
        </span>
        <p className="text-[11px] text-slate-300 font-medium leading-tight">
          {mitig}
        </p>
      </div>
    </div>
  );
}

function ActionStep({ number, title, desc }: any) {
  return (
    <div className="card-military flex items-start gap-5 hover:bg-red-500/5 transition-colors border shadow-lg group">
      <span className="text-4xl font-black text-slate-700/50 group-hover:text-red-500/50 transition-colors italic leading-none">
        {number}
      </span>
      <div>
        <h4 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">
          {title}
        </h4>
        <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-200 transition-colors">
          {desc}
        </p>
      </div>
    </div>
  );
}

function CheckItem({ text }: any) {
  return (
    <li className="flex items-start gap-3 group">
      <div className="mt-0.5 p-0.5 rounded border border-military-gold text-military-gold opacity-50 group-hover:opacity-100 transition-opacity">
        <CheckSquare size={14} />
      </div>
      <span className="text-sm text-slate-300 font-medium">{text}</span>
    </li>
  );
}

function MeteoCard({ icon: Icon, title, value, label, status }: any) {
  return (
    <div className="card-military flex flex-col items-center text-center p-6 bg-military-blue/5">
      <Icon className="text-military-gold mb-3" size={32} />
      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
        {title}
      </span>
      <span className="text-3xl font-black text-white my-1">{value}</span>
      <span className="text-xs text-slate-400 mb-3">{label}</span>
      <span className="px-3 py-1 rounded-full bg-slate-800 text-[10px] font-black text-military-gold tracking-widest border border-military-gold/20 italic">
        {status}
      </span>
    </div>
  );
}

function FaunaItem({ date, species, local }: any) {
  return (
    <div className="flex items-center gap-4 group">
      <div className="w-10 h-10 rounded-lg bg-military-black border border-slate-800 flex items-center justify-center shrink-0">
        <Bird
          size={18}
          className="text-slate-500 group-hover:text-military-gold transition-colors"
        />
      </div>
      <div className="flex-1 border-b border-slate-800 pb-2 group-last:border-0">
        <div className="flex justify-between items-center mb-0.5">
          <h4 className="text-sm font-bold text-slate-200">{species}</h4>
          <span className="text-[10px] text-slate-500 font-mono">{date}</span>
        </div>
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
          {local}
        </p>
      </div>
    </div>
  );
}

function NormaCard({
  title,
  category,
  desc,
  url,
  buttonText = "Visualizar Norma",
  onView,
}: any) {
  return (
    <div className="card-military h-full flex flex-col group hover:border-military-gold transition-all">
      <div className="mb-4">
        <span className="px-2 py-0.5 bg-military-blue text-white text-[9px] font-black uppercase tracking-widest rounded">
          {category}
        </span>
        <h3 className="text-lg font-black text-white mt-2 group-hover:text-military-gold transition-colors italic tracking-tight">
          {title}
        </h3>
      </div>
      {desc ? (
        <p className="text-xs text-slate-400 leading-relaxed mb-6 flex-1">
          {desc}
        </p>
      ) : (
        <div className="flex-1 mb-4" />
      )}
      <button
        className="w-full py-2 bg-white/5 border border-white/10 rounded text-[10px] font-black uppercase tracking-widest text-white hover:bg-military-gold hover:text-military-gray transition-all cursor-pointer"
        onClick={() => {
          if (onView) {
            onView();
          } else {
            window.open(url || "#", "_blank");
          }
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}

function ActivityItem({ time, user, action }: any) {
  return (
    <div className="flex items-start gap-3 border-l border-slate-700 pl-4 py-1 relative">
      <div className="absolute -left-[4.5px] top-2 w-2 h-2 rounded-full bg-military-gold" />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[11px] font-bold text-slate-100">{user}</span>
          <span className="text-[9px] font-mono text-slate-500">{time}</span>
        </div>
        <p className="text-[10px] text-slate-400 font-medium italic">
          {action}
        </p>
      </div>
    </div>
  );
}

function AdminAction({ title, desc, icon: Icon, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className="p-5 rounded-xl bg-military-black border border-slate-800 hover:border-military-gold cursor-pointer transition-all group flex gap-4"
    >
      <div className="p-3 rounded-lg bg-slate-800 text-military-gold group-hover:bg-military-gold group-hover:text-military-black transition-all shrink-0 h-fit">
        <Icon size={20} />
      </div>
      <div>
        <h4 className="text-xs font-black text-white uppercase tracking-tight mb-1 group-hover:text-military-gold transition-colors">
          {title}
        </h4>
        <p className="text-[10px] text-slate-500 font-medium leading-tight">
          {desc}
        </p>
      </div>
    </div>
  );
}

function AdminStat({ label, value, trend, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`card-military bg-military-gray border-slate-700 hover:border-slate-500 transition-colors ${onClick ? "cursor-pointer hover:border-military-gold shadow-lg shadow-military-gold/5" : "cursor-default"}`}
    >
      <span className="text-[9px] text-slate-500 uppercase font-black tracking-[0.15em]">
        {label}
      </span>
      <div className="text-2xl font-black text-white mt-1.5 italic tracking-tight">
        {value}
      </div>
      <div className="h-[1px] bg-slate-800 my-2" />
      <span className="text-[9px] text-military-gold font-bold uppercase tracking-widest">
        {trend}
      </span>
    </div>
  );
}

function TelefonesSection() {
  const contacts = [
    {
      role: "Ch SIPAA",
      number: "67 9877-7410",
      description: "Chefe da Seção de Investigação e Prevenção de Acidentes Aeronáuticos do 2º BAvEx.",
      waUrl: "https://wa.me/556798777410",
    },
    {
      role: "Adj SIPAA",
      number: "92 98116-0477",
      description: "Adjunto da Seção de Investigação e Prevenção de Acidentes Aeronáuticos do 2º BAvEx.",
      waUrl: "https://wa.me/5592981160477",
    },
    {
      role: "Cmt Gd",
      number: "12 99674-2637",
      description: "Comandante da Guarda / Contato geral de prontidão da unidade para reporte e emergências.",
      waUrl: "https://wa.me/5512996742637",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-white/5">
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <Phone className="text-military-gold animate-bounce" size={24} />
          Telefones Úteis e Emergência - SIPAA
        </h2>
        <p className="text-slate-400 text-sm">
          Acesso rápido aos canais de comunicação com investigadores e equipes de prevenção do 2º BAvEx. Clique nos números para abrir diretamente no WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {contacts.map((c, idx) => (
          <div
            key={idx}
            className="card-military p-6 space-y-4 flex flex-col justify-between hover:border-military-gold transition-all duration-300 group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-military-gold text-[10px] font-black uppercase tracking-widest bg-military-gold/10 px-2.5 py-1 rounded">
                  {c.role}
                </span>
                <div className="w-8 h-8 rounded bg-military-black border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-military-gold transition-colors">
                  <Phone size={14} />
                </div>
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Contato de Prontidão
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed min-h-[50px]">
                {c.description}
              </p>
              <div className="text-sm font-bold text-slate-200 bg-military-black/80 py-3 px-4 rounded border border-white/5 font-mono select-all text-center">
                +55 {c.number}
              </div>
            </div>

            <a
              href={c.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-black font-black uppercase tracking-wider rounded text-[10px] transition-all cursor-pointer shadow-lg shadow-green-950/20"
            >
              Iniciar via WhatsApp
              <ExternalLink size={12} />
            </a>
          </div>
        ))}
      </div>

      <div className="bg-military-black border border-white/5 rounded-xl p-5 flex items-start gap-3">
        <div className="p-2 rounded bg-military-gold/15 text-military-gold border border-military-gold/25 mt-0.5">
          <Phone size={14} className="animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1">
            Instruções operacionais para reporte
          </h4>
          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
            As comunicações via WhatsApp são seguras e de recebimento imediato. Para envio de arquivos de mídias, fotos, coordenadas geográficas ou relatos rápidos, dê preferência aos contatos acima.
          </p>
        </div>
      </div>
    </div>
  );
}

function SugestoesSection() {
  const [suggestion, setSuggestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "suggestions"), {
        text: suggestion.trim(),
        submittedBy: auth.currentUser?.email || auth.currentUser?.uid || "Anônimo",
        createdAt: new Date().toISOString(),
      });
      setSubmitted(true);
      setSuggestion("");
    } catch (error) {
      console.error("Erro ao enviar sugestão:", error);
      alert("Erro ao enviar sua sugestão. Tente novamente mais tarde.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-military-gold/10 rounded-2xl flex items-center justify-center text-military-gold mx-auto border border-military-gold/20 shadow-2xl">
          <Lightbulb size={32} />
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
          Sugestões de Melhorias
        </h2>
        <p className="text-text-secondary max-w-lg mx-auto">
          Sua opinião é fundamental para evoluirmos o App da SIPAA. Sugira novas funcionalidades, relate dificuldades ou proponha mudanças.
        </p>
      </div>

      <div className="card-military p-8">
        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 space-y-6"
          >
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mx-auto border border-green-500/30">
              <Check size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white uppercase">Obrigado!</h3>
              <p className="text-slate-400 text-sm">
                Sua sugestão foi enviada com sucesso para a equipe administrativa.
              </p>
            </div>
            <button
              onClick={() => setSubmitted(false)}
              className="text-military-gold font-black uppercase text-[10px] tracking-widest hover:underline"
            >
              Enviar outra sugestão
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <MessageSquarePlus size={12} /> Descreva sua sugestão
              </label>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Ex: Gostaria de uma área para acompanhar meus últimos relatos..."
                className="w-full bg-military-black border border-white/10 rounded-lg p-5 text-white focus:border-military-gold outline-none transition-all min-h-[200px] text-sm leading-relaxed placeholder:text-slate-700 italic"
                disabled={isSubmitting}
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting || !suggestion.trim()}
              className="btn-military w-full py-4 text-xs flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  ENVIANDO...
                </>
              ) : (
                <>
                  <Send size={16} />
                  ENVIAR SUGESTÃO
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const sectionComponents: Record<string, FC<any>> = {
  Inicio: InicioSection,
  RELPREV: RelprevSection,
  FGR: FgrSection,
  Abortiva: AbortivaSection,
  "Mapa de Risco": MapaRiscoSection,
  "Portal Único de Notificação": NotificacaoSection,
  Abastecimento: AbastecimentoSection,
  Medicamentos: MedicamentosSection,
  "Normas CAvEx": NormasSection,
  Telefones: TelefonesSection,
  Admin: AdminSection,
  Sugestoes: SugestoesSection,
};
