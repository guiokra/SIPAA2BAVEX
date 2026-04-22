import React, { FC, useState, useEffect, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
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
  ChevronRight,
  LogOut,
  User,
  ShieldCheck,
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
  Trash2,
  Eye,
  LogIn,
  Search,
  LayoutDashboard,
  Calendar,
  Save,
  Send,
  MoreHorizontal,
  History,
  Info,
  Check,
  Download,
  Upload,
  Clock,
  ExternalLink,
  Unlock,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, storage } from './firebase';

// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  signInAnonymously,
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
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
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Utilities ---
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 600): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
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
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const openBase64InNewTab = (base64Data: string) => {
  try {
    const parts = base64Data.split(',');
    if (parts.length < 2) return;
    const contentType = parts[0].split(':')[1].split(';')[0];
    const byteCharacters = atob(parts[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (e) {
    console.error("Erro ao abrir anexo:", e);
    // Fallback: tenta abrir diretamente se for seguro ou avisa
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${base64Data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  }
};

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Mostrar alerta amigável antes de disparar erro técnico
  if (errorMessage.includes('Insufficient permissions') || errorMessage.includes('permission-denied')) {
    alert("Erro de Permissão: Você não tem autorização para realizar esta operação no momento.");
  } else if (errorMessage.includes('offline')) {
    alert("Erro de Conexão: O sistema parece estar offline. Verifique sua internet.");
  } else if (!errorMessage.startsWith('{')) {
    alert(`Erro no Sistema: ${errorMessage}`);
  }
  
  throw new Error(JSON.stringify(errInfo));
}

// --- Admin Helpers ---
const ABASTECIMENTO_DATA = [
  { estado: 'ACRE', locais: [
    { icao: 'SBCZ', local: 'Cruzeiro do sul', br: 'BR', contato: '(68) 3322-5615/(92) 99388-2821', horario: '6-18h' },
    { icao: 'SBRB', local: 'Rio Branco', br: 'BR', contato: '(68) 3211-1095/(68) 99995-1511', horario: 'H24' }
  ]},
  { estado: 'ALAGOAS', locais: [
    { icao: 'SBMO', local: 'Maceió (Zumbi dos Palmares)', br: 'BR', contato: '(82) 3332-6110/(82) 99991-8144', horario: 'H24' }
  ]},
  { estado: 'AMAPÁ', locais: [
    { icao: 'SBMQ', local: 'Macapá', br: 'BR', contato: '(96) 3223-4493/(96) 98137- 6371', horario: 'H24' }
  ]},
  { estado: 'AMAZONAS', locais: [
    { icao: 'SBUY', local: 'Coari (URUCU)', br: 'BR', contato: '(92) 3616-6546/(92) 99231-2803', horario: '6:30-18:30h' },
    { icao: 'SBEG', local: 'Manaus (Eduardo Gomes)', br: 'BR', contato: '(92) 3652-1628/(92) 98143-1288', horario: 'H24' },
    { icao: 'SBMN', local: 'Manaus (Ponta Pelada)', br: 'BR', contato: '(92) 3629-3074/(92)99116-1980', horario: 'H24' },
    { icao: 'SWFN', local: 'Manaus (Flores)', br: 'BR', contato: '(92) 3653-0082/(92) 99401-2196', horario: '6-17:30h' },
    { icao: 'SBUA', local: 'São Gabriel da Cachoeira', br: 'BR', contato: '(97) 99183-0766/(97) 3471-1343', horario: '8-19h' },
    { icao: 'SBTT', local: 'Tabatinga', br: 'BR', contato: '(97) 3412-2372/(97) 98407 0983', horario: '7-17h' },
    { icao: 'SBTF', local: 'Tefé', br: 'BR', contato: '(92) 99359-6132/(97) 3343-9501', horario: '6-18h' }
  ]},
  { estado: 'BAHIA', locais: [
    { icao: 'SBIL', local: 'Ilhéus * (não pertence mais à VIBRA)', br: 'BR', contato: 'NOTAS ABAIXO', horario: 'COORD.' },
    { icao: 'SBPS', local: 'Porto Seguro', br: 'BR', contato: '(73) 3288-2788 (73) 98203-7667', horario: 'H24' },
    { icao: 'SBSV', local: 'Salvador', br: 'BR', contato: '(71) 98106-5216/(71) 3204-1135', horario: 'H24' },
    { icao: 'SBTC', local: 'Una/Comandatuba', br: 'BR', contato: '(73) 3236-6017/(73) 99956-2040', horario: '9-17h' },
    { icao: 'SBVC', local: 'Vitória da Conquista', br: 'BR', contato: '(77) 98125-3003/(77) 99193-4588', horario: 'H24' }
  ]},
  { estado: 'CEARÁ', locais: [
    { icao: 'SBFZ', local: 'Fortaleza (Pinto Martins)', br: 'BR', contato: '(85) 99147-8620 (85) 98736-4150', horario: 'H24' },
    { icao: 'SBJU', local: 'Juazeiro do Norte', br: 'BR', contato: '(88) 3511-5385/(85) 8813-7669', horario: 'H24' },
    { icao: 'SBJE', local: 'Jericoacara (Ariston Pessoa)', br: 'BR', contato: '(82) 99961-4115 (88) 98141-1391', horario: '8-17' }
  ]},
  { estado: 'DISTRITO FEDERAL', locais: [
    { icao: 'SBBR', local: 'Brasília', br: 'BR', contato: '(61) 3365-1290/(61) 99825-1411', horario: 'H24' }
  ]},
  { estado: 'ESPÍRITO SANTO', locais: [
    { icao: 'SBVT', local: 'Vitória', br: 'BR', contato: '(27) 99892-3427 (27) 99941-4820', horario: 'H24' }
  ]},
  { estado: 'GOIÁS', locais: [
    { icao: 'SBAN', local: 'Anápolis', br: 'BR', contato: '(62) 3329-7803/(62) 3329-7803', horario: 'H24' },
    { icao: 'SBCN', local: 'Caldas Novas', br: 'BR', contato: '(64) 3453-2671/(62) 99370-6975', horario: '7-19h' },
    { icao: 'SBGO', local: 'Goiânia (Santa Genoveva)', br: 'BR', contato: '(62) 3942-4004/(62) 99679-7718', horario: 'H24' }
  ]},
  { estado: 'MARANHÃO', locais: [
    { icao: 'SBSL', local: 'São Luiz (Mal. Cunha Machado)', br: 'BR', contato: '(98) 3221-7366 (98) 98121-9724', horario: 'H24' }
  ]},
  { estado: 'MATO GROSSO', locais: [
    { icao: 'SBAT', local: 'Alta Floresta', br: 'BR', contato: '(66) 3521-5556/(66) 98114-3004', horario: '6-180h' },
    { icao: 'SBCY', local: 'Cuiabá (Mal. Rondon)', br: 'BR', contato: '(65) 3682-3445/(65) 99216-0442', horario: 'H24' },
    { icao: 'SWSI', local: 'Sinop', br: 'BR', contato: '(66) 98114-3006 (66) 99657-5804', horario: '6-18h' }
  ]},
  { estado: 'MATO GROSSO DO SUL', locais: [
    { icao: 'SBDB', local: 'Bonito', br: 'BR', contato: '(67) 3255-4303/(67) 99823-1977', horario: '07:30-17:30' },
    { icao: 'SBCG', local: 'Campo Grande', br: 'BR', contato: '(67) 3363-6383/(67) 99958-6620', horario: 'H24' },
    { icao: 'SBCR', local: 'Corumbá', br: 'BR', contato: '(67) 3232-5615/(67) 99612-0431', horario: '6-18h' },
    { icao: 'SBDO', local: 'Dourados', br: 'JR', contato: '(67) 3427-1230/(67)99833-6325', horario: '24h' },
    { icao: 'SBTG', local: 'Três Lagoas', br: 'BR', contato: '(67) 3522-3523/(67) 99823-9523', horario: '07:30-17:30' }
  ]},
  { estado: 'MINAS GERAIS', locais: [
    { icao: 'SBBH', local: 'Belo Horizonte (Pampulha)', br: 'BR', contato: '(31) 3441-3477/(31) 99950-1783', horario: 'H24' },
    { icao: 'SBCF', local: 'Confins', br: 'BR', contato: '(31) 3689-2111/(31)97322-0555', horario: 'H24' },
    { icao: 'SBZM', local: 'Goianá (Zona da Mata)', br: 'BR', contato: '(32) 9921-2229/(32) 99918-5570', horario: '8-22' },
    { icao: 'SBMK', local: 'Montes Claros', br: 'BR', contato: '(38) 3215-3062/(38) 99192-7208', horario: '5-22h' },
    { icao: 'SBUR', local: 'Uberaba', br: 'BR', contato: '(34) 3336-1677/(34) 99971-1013', horario: '04-21' },
    { icao: 'SBUL', local: 'Uberlândia', br: 'BR', contato: '(34) 3212-5064/(34) 99811-7655', horario: 'H24' }
  ]},
  { estado: 'PARÁ', locais: [
    { icao: 'SBHT', local: 'Altamira', br: 'BR', contato: '(93) 99228-2900/(93) 99142-3791', horario: '06:45-18:45' },
    { icao: 'SBBE', local: 'Belém (Val de Cans)', br: 'BR', contato: '(91) 99994-6967/(91) 98733-2544', horario: 'H24' },
    { icao: 'SBIH', local: 'Itaituba', br: 'BR', contato: '(93) 99119-9327/(93) 98114-0579', horario: '6:30-18:30h' },
    { icao: 'SBMA', local: 'Marabá', br: 'BR', contato: '(94) 3324-1349/(94) 99186-5602', horario: '3-19' },
    { icao: 'SBCJ', local: 'Parauapebas (Carajás)', br: 'BR', contato: '(94) 3346-1480/(94) 98410-1000', horario: '8-18h' },
    { icao: 'SBSN', local: 'Santarém', br: 'BR', contato: '(93) 3522-2033/(93) 99975-1347', horario: 'H24' }
  ]},
  { estado: 'PARANÁ', locais: [
    { icao: 'SBMG', local: 'Maringá', br: 'BR', contato: '(44) 3024-5381/(44) 99739-0600', horario: '5-21:20' },
    { icao: 'SBLO', local: 'Londrina', br: 'BR', contato: '(43) 3326-1334/(43) 99935-0366', horario: '4-22h' },
    { icao: 'SBFI', local: 'Foz Iguaçu (Cataratas)', br: 'BR', contato: '(45)3523-7010/(45) 99148-8591', horario: '6-00:20' },
    { icao: 'SBBI', local: 'Curitiba (Bacacheri)', br: 'BR', contato: '(41) 3357-9970/(41) 99768-4489', horario: '05-22h' },
    { icao: 'SBPG', local: 'Ponta Grossa', br: 'BR', contato: '(41) 3381-1839/(41) 99965-1594', horario: '7-19h' },
    { icao: 'SBCT', local: 'Curitiba (Afonso Pena)', br: 'BR', contato: '(41)3381-1838/(41) 3381-1839', horario: 'H24' }
  ]},
  { estado: 'PERNAMBUCO', locais: [
    { icao: 'SBPL', local: 'Petrolina', br: 'BR', contato: '(87) 3863-5100/(87) 99922-2821', horario: 'H24' },
    { icao: 'SBRF', local: 'Recife (Guararapes)', br: 'BR', contato: '(81) 3461-4545/(81) 99961-3041', horario: 'H24' }
  ]},
  { estado: 'RIO DE JANEIRO', locais: [
    { icao: 'SBES', local: 'São Pedro d`Aldeia', br: 'Marinha', contato: '(22) 2621-4030', horario: '' },
    { icao: 'SBME', local: 'Macaé', br: 'BR', contato: '(22) 2762-1602/(22) 99870-4031', horario: '6-22h' },
    { icao: 'SBGL', local: 'Galeão', br: 'BR', contato: '(21) 3398-3570/(21) 3383-6868', horario: 'H24' },
    { icao: 'SBRJ', local: 'Santos Dumont', br: 'BR', contato: '(21) 3814-7437/(21) 980315911', horario: 'H24' },
    { icao: 'SBJR', local: 'Jacarepaguá', br: 'BR', contato: '(21) 99406-0235/(21) 97009-7311', horario: 'H24' },
    { icao: 'SBSC', local: 'Santa Cruz', br: 'BR', contato: '(21) 3395 4178/(21) 3401-8196', horario: 'H24' }
  ]},
  { estado: 'RIO GRANDE DO NORTE', locais: [
    { icao: 'SBSG', local: 'São Gonçalo do Amarante', br: 'BR', contato: '(84) 99641-7887/(84) 3343-6376', horario: 'H24' }
  ]},
  { estado: 'RIO GRANDE DO SUL', locais: [
    { icao: 'SBCX', local: 'Caxias do Sul', br: 'BR', contato: '(54) 3213-5072/(54) 99683-3533', horario: '7-19h' },
    { icao: 'SBCO', local: 'Base Aérea de Canoas', br: 'BR', contato: '(51)99196-0275', horario: 'H24' },
    { icao: 'SBPK', local: 'Pelotas', br: 'BR', contato: '(53) 3011-7965/(53) 99128-6698', horario: '7-19h' },
    { icao: 'SBPA', local: 'Porto Alegre', br: 'BR', contato: '(51) 3371-3131/(51) 3375-9101', horario: 'H24' },
    { icao: 'SBSM', local: 'Santa Maria (Base Aérea)', br: 'BR', contato: 'NOTAS ABAIXO', horario: '06-22H' },
    { icao: 'SBUG', local: 'Uruguaiana', br: 'BR', contato: '(55) 3413-4807/(55) 99999-0298', horario: '08-17' }
  ]},
  { estado: 'SANTA CATARINA', locais: [
    { icao: 'SBFL', local: 'Florianópolis', br: 'BR', contato: '(48) 3236-1464/(48) 99959-4532', horario: 'H24' },
    { icao: 'SBNF', local: 'Navegantes', br: 'BR', contato: '(47) 3342-3989/(47) 99925-9584', horario: '6-00h' },
    { icao: 'SBCH', local: 'Chapecó (não pertence mais à VIBRA)', br: 'BR', contato: 'COORD. ANTECIPADA', horario: '' }
  ]},
  { estado: 'SÃO PAULO', locais: [
    { icao: 'SBAU', local: 'Araçatuba', br: 'BR', contato: '(18) 3625-6606/ (18) 98170-0122', horario: '7:30-21:00' },
    { icao: 'SBAE', local: 'Arealva (Bauru)', br: 'BR', contato: '(14) 3237-7003/(14) 97602-0081', horario: '8-18h' },
    { icao: 'SBKP', local: 'Campinas (Viracopos)', br: 'BR', contato: '(19) 3765-9159/(19) 99920-1167', horario: 'H24' },
    { icao: 'SBGW', local: 'Guaratinguetá', br: 'BR', contato: '(19) 97419-4380', horario: '8-18h' },
    { icao: 'SBGR', local: 'Guarulhos', br: 'BR', contato: '(11) 2404-9815/(11) 96556-3580', horario: 'H24' },
    { icao: 'SBRP', local: 'Ribeirão Preto', br: 'BR', contato: '(16) 3626-2041/(16) 99700-7176', horario: '6:30-19:30' },
    { icao: 'SDSC', local: 'São Carlos', br: 'BR', contato: '(16) 3378-3300/(19) 999762-7089', horario: '8-20h' },
    { icao: 'SBSR', local: 'São José do Rio Preto', br: 'BR', contato: '(17) 3222-2318/(17) 97400-1836', horario: '5:30-21h' },
    { icao: 'SBSJ', local: 'São José dos Campos', br: 'BR', contato: '(12) 3947-3454', horario: '6-22h' },
    { icao: 'SBSP', local: 'Congonhas', br: 'BR', contato: '(11) 3478-3150/(19) 94700-7244', horario: '5:15-23h' },
    { icao: 'SBMT', local: 'Campo de Marte', br: 'BR', contato: '(11) 2221-5148/(11) 2221-7586', horario: '6-22h' },
    { icao: 'SIMK', local: 'Franca', br: 'BR', contato: '(15) 99860-8984', horario: '8-18h' },
    { icao: 'SBAQ', local: 'Araraquara', br: 'BR', contato: '(15) 99871-7129', horario: '8-18h' },
    { icao: 'SBDN', local: 'Pres. Prudente', br: 'BR', contato: '(18) 3223-1300/(18) 98170-0093', horario: '4-18' },
    { icao: 'SBTA', local: 'Taubaté', br: 'BR', contato: '(12) 2123-7400', horario: '6-18h' }
  ]}
];

const generateAbastecimentoPDF = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // High fidelity style to match original document exactly
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Localidades ANO 2025', pageWidth / 2, 20, { align: 'center' });
  
  doc.setTextColor(255, 0, 0); // Red (ANO 2025)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('(ANO 2025)', pageWidth / 2, 28, { align: 'center' });

  let currentY = 35;
  
  ABASTECIMENTO_DATA.forEach((item) => {
    // State Header
    autoTable(doc, {
      startY: currentY,
      body: [[item.estado]],
      theme: 'plain',
      styles: { 
        fontSize: 10, 
        fontStyle: 'bold', 
        halign: 'center',
        cellPadding: 1,
        textColor: [0, 0, 0],
        fillColor: [230, 230, 230]
      },
      margin: { left: 15, right: 15 }
    });
    
    currentY = (doc as any).lastAutoTable.finalY;

    // Table
    autoTable(doc, {
      startY: currentY,
      body: item.locais.map(l => [l.icao, l.local, l.br, l.contato, l.horario]),
      theme: 'grid',
      styles: { 
        fontSize: 7,
        cellPadding: 1.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { fillColor: [205, 230, 205], fontStyle: 'bold', cellWidth: 20 }, // Light Green ICAO
        1: { cellWidth: 55 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 55 },
        4: { cellWidth: 25, halign: 'center' }
      },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        // Handle side-notes specifically for SBIL, SBCH, SBSM if visible
      }
    });

    // Special side-notes integration (emulating the yellow/green boxes)
    const lastY = (doc as any).lastAutoTable.finalY;
    
    if (item.estado === 'BAHIA') {
      doc.setFontSize(7);
      doc.setFillColor(255, 255, 200); // Yellowish
      doc.rect(172, lastY - 15, 25, 20, 'F');
      doc.text(['SBIL *', 'Necessita de', 'coordenação', 'antecipada', 'junto ao', 'CavEx/CMAvEx'], 173, lastY - 12);
    }
    
    currentY = lastY + 5;
  });

  // Footer pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(`Página ${i}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  return doc;
};

// --- Admin Helpers ---
function getRiskClass(r: number, tipoVoo: string = 'REGULAR') {
  const isP4 = tipoVoo !== 'REGULAR';
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
      responsavel: "Cmt Missão Aérea / PO/PI"
    };
  }
  if (r < thresholds[1]) {
    return { 
      label: "Médio", 
      color: "text-yellow-500", 
      bg: "bg-yellow-500/10", 
      border: "border-yellow-500/30", 
      hex: [234, 179, 8],
      decisao: "Ajustar p/ próxima missão e monitorar risco",
      responsavel: "Cmt SU"
    };
  }
  if (r < thresholds[2]) {
    return { 
      label: "Alto", 
      color: "text-orange-500", 
      bg: "bg-orange-500/10", 
      border: "border-orange-500/30", 
      hex: [249, 115, 22],
      decisao: "Ajustar antes da missão (*)",
      responsavel: "Cmt OM"
    };
  }
  return { 
    label: "Muito Alto", 
    color: "text-red-500", 
    bg: "bg-red-500/10", 
    border: "border-red-500/30", 
    hex: [239, 68, 68],
    decisao: "Adiar e replanejar (*)",
    responsavel: "Cmt OM"
  };
};
const generateAbortivaPDF = (abort: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(26, 31, 37); // #1a1f25
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(212, 175, 55); // #d4af37
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SIPAA 2º BAvEx', 20, 25);
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('RELATO DE ABORTIVA DE VOO', 20, 32);
  
  // Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('Informações da Abortiva', 20, 55);
  
  const motivoDisplay = {
    'DOS': 'DOS (Devido a Ordem Superior)',
    'DFM': 'DFM (Devido a Falha de Material)',
    'DCP': 'DCP (Devido a Condições Pessoais)',
    'DCM': 'DCM (Devido a Condições Meteorológicas)'
  }[abort.motivo as 'DOS' | 'DFM' | 'DCP' | 'DCM'] || abort.motivo;

  autoTable(doc, {
    startY: 60,
    head: [['Campo', 'Informação']],
    body: [
      ['Data do Voo', abort.dataVoo || 'N/A'],
      ['Nº Lançamento', abort.numLancamento || 'N/A'],
      ['Modelo Anv', abort.modeloAnv || 'N/A'],
      ['Motivo', motivoDisplay],
      ['Preenchido por', abort.preenchidoPor || 'N/A']
    ],
    theme: 'striped',
    headStyles: { fillColor: [26, 31, 37], textColor: [212, 175, 55] }
  });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em: ${new Date(abort.createdAt).toLocaleString('pt-BR')}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  
  return doc;
};

const generateFgrPDF = (mission: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(26, 31, 37); // #1a1f25
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(212, 175, 55); // #d4af37
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SIPAA 2º BAvEx', 20, 25);
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('GERENCIAMENTO DE RISCO OPERACIONAL (FGR)', 20, 32);
  
  // Mission Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('I - Informações da Missão', 20, 55);
  
  autoTable(doc, {
    startY: 60,
    head: [['Campo', 'Informação']],
    body: [
      ['Modelo (Anv Líder)', mission.modeloAnv || 'N/A'],
      ['Matrícula(s) Anv', mission.aeronave || 'N/A'],
      ['Missão', mission.missao || 'N/A'],
      ['Local', mission.local || 'N/A'],
      ['Data', mission.data || 'N/A'],
      ['Trigramas Tripulação', mission.trigramaTrip || 'N/A'],
      ['Preenchido por', mission.preenchidoPor || 'N/A'],
      ['Função', mission.funcao || 'N/A']
    ],
    theme: 'striped',
    headStyles: { fillColor: [26, 31, 37], textColor: [212, 175, 55] }
  });

  // Parte II - Assertivas
  const p2Y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.text('II - Condições Impeditivas', 20, p2Y);
  
  autoTable(doc, {
    startY: p2Y + 5,
    head: [['Assertiva', 'Resposta']],
    body: PARTE_II_DATA.map(item => [
      item.text,
      mission.p2Selections[item.id] || 'N/A'
    ]),
    theme: 'grid',
    styles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 20, halign: 'center' } }
  });
  
  // Risk Box (Destaque)
  const riskY = (doc as any).lastAutoTable.finalY + 10;
  const riskStatus = getRiskClass(mission.scores.riskMax, mission.tipoVoo);
  
  doc.setFillColor(riskStatus.hex[0], riskStatus.hex[1], riskStatus.hex[2]);
  doc.rect(20, riskY, pageWidth - 40, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('V - AVALIAÇÃO FINAL DE RISCO', pageWidth / 2, riskY + 8, { align: 'center' });
  doc.setFontSize(18);
  doc.text(`${riskStatus.label.toUpperCase()} (${mission.scores.riskMax} pts)`, pageWidth / 2, riskY + 18, { align: 'center' });
  
  // Ação e Responsabilidade no PDF
  doc.setFontSize(7);
  doc.text(`AÇÃO: ${riskStatus.decisao.toUpperCase()}`, pageWidth / 2, riskY + 24, { align: 'center' });
  doc.text(`RESPONSABILIDADE: ${riskStatus.responsavel.toUpperCase()}`, pageWidth / 2, riskY + 28, { align: 'center' });

  // Scores Table
  const scoresY = riskY + 40;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('Resumo dos Fatores (III & IV)', 20, scoresY);
  
  autoTable(doc, {
    startY: scoresY + 5,
    body: [
      ['TG Mínimo', mission.scores.tgMin.toString()],
      ['TG Máximo', mission.scores.tgMax.toString()],
      ['Fator de Gravidade', mission.scores.gravTotal.toString()],
      ['Risco Mínimo', mission.scores.riskMin.toString()],
      ['Risco Máximo', mission.scores.riskMax.toString()]
    ],
    theme: 'grid',
    styles: { fontSize: 9 }
  });
 
  // Mitigation
  if (mission.mitigation) {
    const mitigY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text('Medidas Mitigadoras', 20, mitigY);
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(mission.mitigation, pageWidth - 40);
    doc.text(splitText, 20, mitigY + 7);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em: ${new Date(mission.createdAt).toLocaleString('pt-BR')}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  
  return doc;
};

const generateRelprevPDF = (report: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Clean Header
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(26, 31, 37);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Relato de Prevenção', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Batalhão Guerreiro', pageWidth / 2, 30, { align: 'center' });
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 40, pageWidth - 20, 40);

  // Content
  let y = 55;
  const addBlock = (label: string, value: string) => {
    // Check if we need a new page
    const splitText = doc.splitTextToSize(value || 'N/A', pageWidth - 40);
    const blockSize = (splitText.length * 7) + 15;
    
    if (y + blockSize > pageHeight - 30) {
      doc.addPage();
      y = 30;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), 20, y);
    y += 7;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(splitText, 20, y);
    y += (splitText.length * 7) + 10;
  };

  addBlock('Local', report.local);
  addBlock('Data e Horário do Fato', `${report.dataFato} às ${report.horaFato}`);
  addBlock('Pessoal envolvido e/ou aeronave', report.envolvidos);
  addBlock('Situação', report.situacao);
  
  if (report.relatorPosto || report.relatorNome) {
    addBlock('Identificação do Relator', `${report.relatorPosto || ''} ${report.relatorNome || ''}`.trim());
  }
  
  if (report.email) {
    addBlock('E-mail para retorno', report.email);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Protocolo SIPAA: ${report.codigo} | Gerado em ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
};

type SectionKey = 'Inicio' | 'RELPREV' | 'FGR' | 'Abortiva' | 'Mapa de Risco' | 'Portal Notificação' | 'Ações Pós-Acidente' | 'Abastecimento' | 'Memento Meteo' | 'Reporte Fauna' | 'Normas CAvEx' | 'Planeje seu Voo' | 'Admin';

const MONTHS_MAP: Record<string, string> = { 
  JANEIRO: '01', FEVEREIRO: '02', MARÇO: '03', MARCO: '03', ABRIL: '04', MAIO: '05', JUNHO: '06', 
  JULHO: '07', AGOSTO: '08', SETEMBRO: '09', OUTUBRO: '10', NOVEMBRO: '11', DEZEMBRO: '12' 
};

async function extractTextFromPdf(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
  }
  return fullText;
}

function parsePDV(text: string) {
  const dayRegex = /PLANO\s+DIÁRIO\s+DE\s+VOO\s+PARA\s+O\s+DIA\s+(\d{1,2})\s+DE\s+([A-ZÇÃÕÁÉÍÓÚ]+)\s+DE\s+(\d{4})/gi;
  const days = [];
  let matches = [...text.matchAll(dayRegex)];

  matches.forEach((match, index) => {
    const start = match.index || 0;
    const end = matches[index + 1] ? matches[index + 1].index : text.length;
    const block = text.slice(start, end);
    
    const dayNum = match[1].padStart(2, '0');
    const month = MONTHS_MAP[match[2].toUpperCase()] || '??';
    const dateLabel = `${dayNum}/${month}/${match[3]}`;

    const launchRegex = /(\d{2})\s+([A-Z]{2,3})\s+(\d{4})/g;
    const launches = [];
    let lMatch;
    
    while ((lMatch = launchRegex.exec(block)) !== null) {
      const lStart = lMatch.index;
      const lLine = block.slice(lStart, lStart + 500).split('\n')[0];
      const parts = lLine.split(/\s+/).filter(p => p.trim().length > 0);

      if (parts.length < 5) continue;

      const num = parts[0];
      const anv = `${parts[1]} ${parts[2]}`;
      const p1 = parts[3];
      const p2 = parts[4];

      let adDestIdx = -1;
      for (let i = 5; i < parts.length; i++) {
        if (/^[A-Z]{4}$/.test(parts[i])) { 
          adDestIdx = i;
          break;
        }
      }

      let mvStr = "---";
      let missaoStr = "---";
      if (adDestIdx > 5) {
        const mvSection = parts.slice(5, adDestIdx);
        if (mvSection.length > 1) {
          // Se tiver mais de um termo, assumimos o último como Missão (ex: TREINAMENTO)
          // e os anteriores como o MV (ex: SGT SILVA)
          missaoStr = mvSection[mvSection.length - 1];
          mvStr = mvSection.slice(0, -1).join(" ");
        } else {
          // Se tiver apenas um termo, é difícil saber se é MV ou Missão.
          // Pela lógica do user, Missão é obrigatório, então vamos assumir como Missão.
          missaoStr = mvSection[0];
          mvStr = "---";
        }
      }

      const dest = adDestIdx !== -1 ? parts[adDestIdx] : "---";

      let eobt = "---";
      for (let i = adDestIdx + 1; i < parts.length; i++) {
        if (/^\d{2}H\d{2}$/i.test(parts[i])) {
          eobt = parts[i];
          break;
        }
      }

      launches.push({ num, anv, p1, p2, mv: mvStr, missao: missaoStr, dest, eobt });
    }

    if (launches.length > 0) {
      days.push({ dateLabel, launches });
    }
  });
  return days;
}

const normalizePDVDate = (dateStr: string) => {
  if (!dateStr) return 'Sem Data';
  const parts = dateStr.toUpperCase().replace('PARA O DIA ', '').split(/\s+/);
  // Expected: ["14", "DE", "ABRIL", "DE", "2026"]
  const day = parts[0]?.padStart(2, '0');
  const monthName = parts[parts.length - 3] || ''; // "ABRIL"
  const year = parts[parts.length - 1] || ''; // "2026"
  const month = MONTHS_MAP[monthName] || '??';
  
  if (day && month !== '??' && year.length === 4) {
    return `${day}/${month}/${year}`;
  }
  return dateStr; // Fallback to raw if logic fails
};

export default function App() {
  const [activeTab, setActiveTab] = useState<SectionKey>('Inicio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [abastecimentoConfig, setAbastecimentoConfig] = useState<any>(null);
  const [abastecimentoFiles, setAbastecimentoFiles] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'abastecimento'), (snap) => {
      if (snap.exists()) {
        setAbastecimentoConfig(snap.data());
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'documentos_abastecimento'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const files = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAbastecimentoFiles(files);
    });
    return () => unsub();
  }, []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [totalRelprev, setTotalRelprev] = useState(0);
  const [launches, setLaunches] = useState<any[]>([]);
  const [selectedLaunchIdAbortiva, setSelectedLaunchIdAbortiva] = useState('');

  const [abortivaData, setAbortivaData] = useState({
    dataVoo: new Date().toISOString().split('T')[0],
    numLancamento: "",
    modeloAnv: "",
    motivo: "", // Will be filled with DCM on selection
    preenchidoPor: "",
    tripulacao: ""
  });

  useEffect(() => {
    const q = query(collection(db, 'Lancamentos'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLaunches(data);
    }, (err) => {
      console.error("Erro ao buscar lançamentos:", err);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setTotalRelprev(0);
      return;
    }
    const q = query(collection(db, 'relprevReports'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => setTotalRelprev(snap.size));
    return () => unsubscribe();
  }, [user]);

  // Connection Test removed as it caused permission errors

  // Auth Listener
  useEffect(() => {
    console.log('Configurando listener de autenticação (Modo Automático)...');
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        console.log('Usuário autenticado:', currentUser.isAnonymous ? 'Anônimo' : currentUser.email);
        setUser(currentUser);
        setIsAuthLoading(false);
      } else {
        console.log('Nenhum usuário detectado. Iniciando sessão automática...');
        signInAnonymously(auth).catch((error) => {
          console.warn('Login anônimo desativado no console ou erro de rede:', error);
          setIsAuthLoading(false);
        });
      }
    }, (error) => {
      console.error('Erro no onAuthStateChanged:', error);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = [
    { id: 'Inicio', name: 'Início', icon: Home },
    { id: 'RELPREV', name: 'RELPREV', icon: FileSearch },
    { id: 'FGR', name: 'FGR', icon: ShieldCheck },
    { id: 'Abortiva', name: 'Abortiva', icon: Zap },
    { id: 'Mapa de Risco', name: 'Mapa de Risco', icon: MapIcon },
    { id: 'Portal Notificação', name: 'Portal Notificação', icon: Bell },
    { id: 'Ações Pós-Acidente', name: 'Ações Pós-Acidente', icon: AlertTriangle },
    { id: 'Abastecimento', name: 'Abastecimento', icon: Droplets },
    { id: 'Memento Meteo', name: 'Memento Meteo', icon: CloudSun },
    { id: 'Reporte Fauna', name: 'Reporte Fauna', icon: Bird },
    { id: 'Normas CAvEx', name: 'Normas CAvEx', icon: Gavel },
    { id: 'Planeje seu Voo', name: 'Planeje seu Voo', icon: Compass },
  ];

  const handleTabChange = (tab: any) => {
    if (tab === 'Portal Notificação') {
      window.open('https://santosdumont.anac.gov.br/menu/r/api/portal_unico_notificacao/selecao-do-tipo-de-evento?clear=103&session=111703245409353', '_blank');
      return;
    }
    if (tab === 'Normas CAvEx') {
      window.open('https://drive.google.com/drive/folders/1EDnPJbjEb4dWJYQ_BODhr_HGLUggwtRh', '_blank');
      return;
    }
    if (tab === 'Abastecimento') {
      if (abastecimentoConfig?.url) {
        window.open(abastecimentoConfig.url, '_blank');
      } else {
        alert('Nenhum guia de abastecimento encontrado no sistema.');
      }
      return;
    }
    if (tab === 'Admin' && !isAdminAuthenticated) {
      setIsAdminModalOpen(true);
      return;
    }
    setActiveTab(tab);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'sipaa2bavex') {
      setIsAdminAuthenticated(true);
      setIsAdminModalOpen(false);
      setActiveTab('Admin');
      setAdminPassword('');
    } else {
      alert('Senha incorreta');
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
              <div className="flex justify-between items-center">
                <h3 className="text-military-gold font-black uppercase text-xs tracking-widest flex items-center gap-2">
                  <Lock size={14} />
                  Acesso Administrativo
                </h3>
                <button onClick={() => setIsAdminModalOpen(false)} className="text-text-secondary hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-text-secondary">Senha de Acesso</label>
                  <input 
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-military-black border border-border-theme rounded p-3 text-white focus:border-military-gold outline-none transition-colors"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-military w-full py-3 text-xs">
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
          width: isSidebarOpen ? (isMobile ? '280px' : '240px') : '0px',
          x: isSidebarOpen ? 0 : (isMobile ? -300 : -240)
        }}
        className={`fixed lg:relative z-50 bg-bg-sidebar border-r border-border-theme flex flex-col h-full shadow-2xl transition-all duration-300 ease-in-out`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-border-theme">
          <div className="logo-hex w-10 h-10 bg-gradient-to-br from-accent-gold to-accent-gold-dark flex items-center justify-center shadow-lg text-bg-deep font-bold text-[10px] text-center shrink-0">
            SIPAA
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-widest text-accent-gold leading-none">2º BAvEx</span>
            <span className="text-[10px] text-text-secondary font-medium mt-1 uppercase tracking-widest">Exército Brasileiro</span>
          </div>
          {isMobile && (
            <button onClick={() => setIsSidebarOpen(false)} className="ml-auto text-slate-400 hover:text-white transition-colors">
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
                  className={`w-full flex items-center gap-3 px-6 py-2.5 transition-all duration-200 group relative text-[13px] font-medium border-l-[3px] ${
                    isActive 
                      ? 'bg-accent-gold/10 text-accent-gold border-l-accent-gold' 
                      : 'text-text-secondary hover:bg-accent-gold/5 hover:text-white border-l-transparent'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-accent-gold' : 'text-text-secondary group-hover:text-white'} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile & Admin Section at Bottom */}
        <div className="px-4 py-4 border-t border-border-theme space-y-4">
          <button
            onClick={() => handleTabChange('Admin')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded transition-all duration-200 text-[10px] font-black uppercase tracking-widest ${
              activeTab === 'Admin'
                ? 'bg-accent-gold text-bg-deep shadow-lg shadow-accent-gold/10'
                : 'text-accent-gold border border-accent-gold/20 hover:bg-accent-gold/10'
            }`}
          >
            {isAdminAuthenticated ? <Unlock size={12} /> : <Lock size={12} />}
            <span>Área Administrativa</span>
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
            <div className="status-badge flex items-center gap-2 text-[12px] font-semibold text-[#27ae60] uppercase tracking-wider">
               <div className="status-dot w-2 h-2 bg-[#27ae60] rounded-full shadow-[0_0_8px_#27ae60]" />
               Operações: Normal (VMC)
            </div>
          </div>

          <div className="flex items-center gap-6 text-[12px] text-text-secondary">
            <span className="hidden md:block">Taubaté, SP | 24 OUT 2026 | 14:35 Z</span>
            <div className="h-4 w-[1px] bg-border-theme hidden sm:block" />
            <div className="relative p-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-bg-panel" />
            </div>
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
                abastecimentoConfig,
                abastecimentoFiles,
                launches,
                setLaunches
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- SECTIONS ---

function InicioSection({ onTabChange }: { onTabChange: (tab: SectionKey) => void }) {
  return (
    <div className="space-y-8">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#101826] to-[#0d121d] border border-border-theme p-8 lg:p-10 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
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
            "A segurança de voo é uma responsabilidade de todos nós. Previna-se, reporte e garanta a integridade de nossa missão."
          </div>
          <div className="flex flex-wrap gap-4 mt-8">
            <button 
              onClick={() => onTabChange('RELPREV')}
              className="btn-military shadow-lg shadow-accent-gold/10"
            >
              <FileSearch size={18} />
              RELPREV
            </button>
            <button 
              onClick={() => onTabChange('FGR')}
              className="px-6 py-2 border border-border-theme rounded-sm text-text-secondary hover:text-white hover:bg-white/5 transition-all text-sm font-semibold uppercase tracking-widest"
            >
              FGR
            </button>
          </div>
        </div>
        
        {/* Abstract Background Element */}
        <div className="absolute -bottom-12 -right-12 h-64 w-64 bg-accent-gold/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickCard 
          icon={FileSearch} 
          title="Reportar RELPREV" 
          desc="Registro de relato preventivo." 
          color="blue"
          onClick={() => onTabChange('RELPREV')}
        />
        <QuickCard 
          icon={ShieldCheck} 
          title="Novo FGR" 
          desc="Gerenciamento de risco operacional." 
          color="blue"
          onClick={() => onTabChange('FGR')}
        />
        <QuickCard 
          icon={Zap} 
          title="Abortiva de Voo" 
          desc="Relato de interrupção de missão." 
          color="orange"
          onClick={() => onTabChange('Abortiva')}
        />
        <QuickCard 
          icon={AlertTriangle} 
          title="Checklist Emergência" 
          desc="Protocolos de resposta rápida." 
          color="blue"
          onClick={() => onTabChange('Ações Pós-Acidente')}
        />
        <QuickCard 
          icon={Navigation} 
          title="METAR / TAF" 
          desc="Consulte meteorologia atual." 
          color="blue"
          onClick={() => onTabChange('Memento Meteo')}
        />
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-military flex flex-col items-start h-full">
          <span className="text-[10px] font-bold uppercase text-text-secondary tracking-widest mb-4">RELPREV Ativos</span>
          <div className="text-[32px] font-bold text-white mb-1">14</div>
          <span className="text-[10px] text-text-secondary tracking-tight">+2 nas últimas 24 horas</span>
        </div>
        <div className="card-military flex flex-col items-start h-full">
          <span className="text-[10px] font-bold uppercase text-text-secondary tracking-widest mb-4">FGR Gerados</span>
          <div className="text-[32px] font-bold text-white mb-1">08</div>
          <span className="text-[10px] text-text-secondary tracking-tight">Missões planejadas p/ hoje</span>
        </div>
        <div className="card-military flex flex-col items-start h-full bg-green-500/5 border-green-500/20">
          <span className="text-[10px] font-bold uppercase text-text-secondary tracking-widest mb-4">Risco Operacional Atual</span>
          <div className="w-full flex items-center justify-center p-2 rounded bg-green-500/20 text-green-500 font-bold uppercase text-xs border border-green-500/30 mb-4">
            Baixo
          </div>
          <p className="text-[11px] text-text-secondary leading-tight">
            Condições meteorológicas favoráveis. Manutenções preventivas em dia. Nível de fadiga controlado.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- RISK DATA CONSTANTS ---

const PARTE_II_DATA = [
  { id: "p2_1", text: "A tripulação está habilitada para a realização do voo (verificar o SisAvEx e a pasta dos tripulantes)." },
  { id: "p2_2", text: "A aeronave está liberada para o voo (Esqd He e/ou EMS)." },
  { id: "p2_3", text: "Aeronave sem nenhuma restrição que comprometa a execução da missão." },
  { id: "p2_4", text: "Teste de combustível foi realizado com resultado satisfatório." },
  { id: "p2_5", text: "Todos os materiais previstos no Manual de Manobras para o cumprimento da missão/voo estão em condições de uso." },
  { id: "p2_6", text: "As N Op estão sendo cumpridas." },
  { id: "p2_7", text: "Todos os tripulantes em condições físicas de cumprir a missão." },
  { id: "p2_8", text: "Toda a tripulação/envolvidos participam de um briefing." },
  { id: "p2_9", text: "O Cartão de saúde de todos envolvidos no voo está válido." },
  { id: "p2_10", text: "Ausência de CB na rota na execução do voo IFR." },
];

const PARTE_III_DATA = {
  RH: [
    { id: "p3_rh_1", text: "Um dos pilotos realizou pelo menos um voo em menos de 30 dias.", w: { S: 0, N: 2, D: 2 } },
    { id: "p3_rh_2", text: "O 1P/PO possui MENOS de 50 HV no modelo na função de 1P.", w: { S: 2, N: 0, D: 2 } },
    { id: "p3_rh_3", text: "O PA/PB possui MENOS de 50 HV no modelo na função de 2P.", w: { S: 2, N: 0, D: 2 } },
    { id: "p3_rh_4", text: "OM/OV/MV possui MENOS de 50 HV no modelo na função de MV/OM/VL.", w: { S: 2, N: 0, D: 2 } },
    { id: "p3_rh_5", text: "MVA/MVB possui MENOS de 50 HV no modelo na função de MVA/MVB.", w: { S: 2, N: 0, D: 2 } },
    { id: "p3_rh_6", text: "A tripulação participou do CRM nos últimos 24 meses.", w: { S: 0, N: 2, D: 2 } },
    { id: "p3_rh_7", text: "Briefing da missão realizado de forma completa e detalhada.", w: { S: 0, N: 2, D: 2 } },
    { id: "p3_rh_8", text: "Houve briefing de segurança para todos os envolvidos na missão, SFC.", w: { S: 0, N: 3, D: 3 } },
  ],
  METEO: [
    { id: "p3_me_1", text: "O local de pouso/decolagem foi reconhecido (locais não homologados).", w: { S: 0, N: 2, D: 2 } },
    { id: "p3_me_2", text: "Existe aglomeração de pássaros na região de voo.", w: { S: 2, N: 0, D: 2 } },
    { id: "p3_me_3", text: "As informações necessárias ao voo estão disponíveis (NOTAM, Meteorologia, etc).", w: { S: 0, N: 2, D: 2 } },
    { id: "p3_me_4", text: "As publicações técnicas necessárias ao voo estão atualizadas e disponíveis.", w: { S: 0, N: 1, D: 1 } },
    { id: "p3_me_5", text: "Existe previsão de tempo significativo em rota (CB, frente fria, instabilidade, etc).", w: { S: 3, N: 0, D: 3 } },
    { id: "p3_me_6", text: "Infraestrutura necessária ao voo em condições de prestar apoio.", w: { S: 0, N: 1, D: 1 } },
  ],
  MATERIAL: [
    { id: "p3_ma_1", text: "A aeronave se encontra com MENOS de 10 HV após inspeção A/TC.", w: { S: 3, N: 0, D: 3 } },
    { id: "p3_ma_2", text: "A aeronave RFD executar o voo pairado fora do efeito solo no local de pouso.", w: { S: 0, N: 3, D: 3 } },
    { id: "p3_ma_3", text: "A aeronave já foi pré-voada.", w: { S: 0, N: 1, D: 1 } },
  ],
  MISSAO: [
    { id: "p3_mi_1", text: "Adequado tempo para planejamento e preparação.", w: { S: 0, N: 2, D: 2 } },
    { id: "p3_mi_2", text: "Voo com duração superior a 3 (três) HV contínuas.", w: { S: 1, N: 0, D: 1 } },
    { id: "p3_mi_3", text: "Operações com duração superior a 5 dias.", w: { S: 1, N: 0, D: 1 } },
    { id: "p3_mi_4", text: "Mais de 05 repetições da mesma manobra.", w: { S: 2, N: 0, D: 2 } },
    { id: "p3_mi_5", text: "Voo com autoridade de bordo.", w: { S: 3, N: 0, D: 3 } },
    { id: "p3_mi_6", text: "Há tempo suficiente para o cumprimento da missão, mesmo havendo imprevistos.", w: { S: 0, N: 2, D: 2 } },
    { id: "p3_mi_7", text: "O MV estará embarcado no voo.", w: { S: 0, N: 2, D: 2 } },
  ],
  ORG: [
    { id: "p3_or_1", text: "Existem pressões externas para execução dessa missão.", w: { S: 3, N: 0, D: 3 } },
    { id: "p3_or_2", text: "A tripulação participou da padronização de manobras e procedimentos da U.A.", w: { S: 0, N: 2, D: 2 } },
    { id: "p3_or_3", text: "A tripulação participa regularmente das reuniões de Seg Voo da OM.", w: { S: 0, N: 1, D: 1 } },
    { id: "p3_or_4", text: "A tripulação e/ou Fração de Helicópteros é toda da mesma U.A.", w: { S: 0, N: 2, D: 2 } },
  ],
};

const PARTE_IV_DATA = {
  INSTRUCAO: [
    { id: "p4_in_1", text: "Haverá hot-seat.", w: { S: 1, N: 0, D: 1 } },
    { id: "p4_in_2", text: "O voo será realizado com piloto aluno e/ou com piloto em formação IFR ou OVN.", w: { S: 2, N: 0, D: 2 } },
    { id: "p4_in_3", text: "É voo de emergência, IFR ou OVN.", w: { S: 2, N: 0, D: 2 } },
    { id: "p4_in_4", text: "É o primeiro voo de Habilitação Técnica de algum tripulante no modelo de aeronave.", w: { S: 2, N: 0, D: 2 } },
  ],
  IFR: [
    { id: "p4_if_1", text: "O voo será ACIMA de 10.000 ft (hipóxia).", w: { S: 1, N: 0, D: 1 } },
    { id: "p4_if_2", text: "O nivelamento manter-se-á acima dos obstáculos previstos na rota.", w: { S: 0, N: 3, D: 3 } },
    { id: "p4_if_3", text: "O Briefing meteorológico foi realizado por especialista.", w: { S: 0, N: 1, D: 1 } },
    { id: "p4_if_4", text: "Um dos pilotos realizou voo IFR em um período inferior a 30 dias.", w: { S: 0, N: 2, D: 2 } },
    { id: "p4_if_5", text: "ADEP foi realizada a partir de um aeródromo homologado EPC.", w: { S: 0, N: 2, D: 2 } },
  ],
  OVN: [
    { id: "p4_ov_1", text: "Será realizado voo na noite de nível 4 ou 5.", w: { S: 2, N: 0, D: 2 } },
    { id: "p4_ov_2", text: "Será realizado voo em área urbana.", w: { S: 2, N: 0, D: 2 } },
    { id: "p4_ov_3", text: "Foi realizado reconhecimento fora das áreas de instrução da Av Ex.", w: { S: 0, N: 3, D: 3 } },
    { id: "p4_ov_4", text: "Dispositivo de iluminação individual compatível com o voo OVN.", w: { S: 0, N: 1, D: 1 } },
    { id: "p4_ov_5", text: "Presença de neblina e/ou precipitação.", w: { S: 2, N: 0, D: 2 } },
    { id: "p4_ov_6", text: "Mais de 30 dias sem voar OVN.", w: { S: 2, N: 0, D: 2 } },
  ],
  TECNICO: [
    { id: "p4_te_1", text: "É o primeiro giro e/ou voo após inspeção.", w: { S: 2, N: 0, D: 2 } },
    { id: "p4_te_2", text: "É o primeiro voo após troca de componentes vitais.", w: { S: 3, N: 0, D: 3 } },
    { id: "p4_te_3", text: "A aeronave está abastecida com a autonomia mínima de 40 minutos.", w: { S: 0, N: 2, D: 2 } },
    { id: "p4_te_4", text: "Foi verificada e fechada todas as OS afetas às intervenções.", w: { S: 0, N: 2, D: 2 } },
    { id: "p4_te_5", text: "Houve quebra na sequência de realização dos serviços de manutenção.", w: { S: 2, N: 0, D: 2 } },
  ]
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
  { id: "g9", text: "Voo Técnico (Mnt)", pts: 1, autoByTipo: "TECNICO" }
];

function RelprevSection({ user, onTabChange }: { user: FirebaseUser | null, onTabChange: (tab: SectionKey) => void }) {
  const [reports, setReports] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [extraFiles, setExtraFiles] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    local: '',
    dataFato: '',
    horaFato: '',
    envolvidos: '',
    situacao: '',
    relatorPosto: '',
    relatorNome: '',
    email: ''
  });

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'relprevReports'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'relprevReports');
    });

    return () => unsubscribe();
  }, [user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files) as File[]) {
      // Limit file size to 2MB before processing (browser safety)
      if (file.size > 2 * 1024 * 1024 && type === 'file') {
        alert(`Arquivo ${file.name} muito grande. Máximo 2MB.`);
        continue;
      }

      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      
      let base64String = await promise;

      if (type === 'image') {
        const compressed = await compressImage(base64String);
        setImages(prev => [...prev, compressed]);
      } else {
        setExtraFiles(prev => [...prev, base64String]);
      }
    }
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!isDraft && (!formData.local || !formData.dataFato || !formData.situacao)) {
      alert("Por favor, preencha os campos obrigatórios (*).");
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
          console.warn("Prosseguindo sem autenticação formal (Modo Público)");
          activeUserUid = 'public-guest';
        }
      }

      const codigo = `${new Date().getFullYear()}-${String(reports.length + 1).padStart(3, '0')}`;
      const payload = {
        ...formData,
        codigo,
        images,
        extraFiles,
        status: isDraft ? 'RASCUNHO' : 'ENVIADO',
        uid: activeUserUid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'relprevReports'), payload);

      if (!isDraft) {
        const doc = generateRelprevPDF(payload);
        window.open(doc.output('bloburl'), '_blank');
      }

      // Reset
      setFormData({
        local: '',
        dataFato: '',
        horaFato: '',
        envolvidos: '',
        situacao: '',
        relatorPosto: '',
        relatorNome: '',
        email: ''
      });
      setImages([]);
      setExtraFiles([]);
      
      setIsSaving(false);
      setTimeout(() => {
        alert(isDraft ? "Rascunho salvo com sucesso." : "Relato enviado com sucesso ao SIPAA.");
      }, 100);
    } catch (error: any) {
      const msg = error.message || String(error);
      alert(msg.startsWith('{') ? "Erro técnico ao processar relato. Verifique sua conexão." : msg);
      handleFirestoreError(error, OperationType.CREATE, 'relprevReports');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="card-military overflow-hidden">
        <div className="p-10 text-center border-b border-white/5 bg-white/2">
          <h2 className="text-3xl font-black text-white tracking-tight mb-1 uppercase">Relato de Prevenção</h2>
          <p className="text-accent-gold font-bold uppercase tracking-widest text-xs">BATALHÃO GUERREIRO — SIPAA</p>
        </div>

        <div className="p-8 md:p-12 space-y-10">
          {/* Local */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Local: <span className="text-red-500">*</span></label>
            <input 
              type="text"
              className="input-military w-full"
              value={formData.local}
              onChange={e => setFormData({...formData, local: e.target.value})}
            />
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Data e Horário do Fato <span className="text-red-500">*</span></label>
              <div className="flex gap-4">
                <input 
                  type="date"
                  className="input-military flex-1"
                  value={formData.dataFato}
                  onChange={e => setFormData({...formData, dataFato: e.target.value})}
                />
                <input 
                  type="time"
                  className="input-military w-32"
                  value={formData.horaFato}
                  onChange={e => setFormData({...formData, horaFato: e.target.value})}
                />
              </div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter pl-1">Hora Minutos</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Pessoal envolvido e/ou aeronave <span className="text-red-500">*</span></label>
              <input 
                type="text"
                className="input-military w-full"
                value={formData.envolvidos}
                onChange={e => setFormData({...formData, envolvidos: e.target.value})}
              />
            </div>
          </div>

          {/* Situação */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Situação: <span className="text-red-500">*</span></label>
            <textarea 
              className="input-military w-full h-48 resize-none leading-relaxed"
              placeholder="Descreva detalhadamente o fato observado..."
              value={formData.situacao}
              onChange={e => setFormData({...formData, situacao: e.target.value})}
            />
          </div>

          {/* Image Upload Area */}
          <div className="space-y-4">
            <label className="block w-full cursor-pointer group">
              <input type="file" className="hidden" accept="image/*" multiple onChange={e => handleFileChange(e, 'image')} />
              <div className="border-2 border-dashed border-white/10 rounded-xl p-12 flex flex-col items-center justify-center bg-white/2 group-hover:bg-white/5 group-hover:border-military-gold/30 transition-all gap-4">
                <div className="w-16 h-16 rounded-full bg-bg-deep shadow-lg border border-white/5 flex items-center justify-center text-military-gold group-hover:scale-110 transition-transform">
                  <FileSearch size={28} />
                </div>
                <div className="text-center">
                  <span className="block font-black text-white text-sm uppercase tracking-widest mb-1">Selecionar Imagem</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Arraste ou clique para anexar fotos</span>
                </div>
              </div>
            </label>
            
            {images.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 custom-scrollbar">
                {images.map((img, i) => (
                  <div key={i} className="relative shrink-0 group">
                    <img src={img} className="w-24 h-24 object-cover rounded-lg border border-white/10 shadow-lg" alt="Preview" />
                    <button 
                      onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
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
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter text-center">Caso precise anexar mais fotos ou arquivos, utilize o espaço abaixo</p>
            <label className="block w-full cursor-pointer group">
              <input type="file" className="hidden" multiple onChange={e => handleFileChange(e, 'file')} />
              <div className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center bg-white/2 group-hover:bg-white/5 group-hover:border-military-gold/30 transition-all gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-bg-deep shadow-md border border-white/5 flex items-center justify-center text-military-gold group-hover:scale-110 transition-transform">
                  <Download size={22} />
                </div>
                <div>
                  <span className="block font-black text-white text-sm uppercase tracking-widest mb-1">Anexar Documentos</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">PDFs, Docs ou Imagens adicionais</span>
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
            <label className="text-[10px] font-black text-military-gold uppercase tracking-widest block pl-1">Identificação do Relator (opcional)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <input 
                  type="text"
                  placeholder="Ex: MAJ GUERREIRO"
                  className="input-military w-full"
                  value={formData.relatorPosto}
                  onChange={e => setFormData({...formData, relatorPosto: e.target.value})}
                />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter px-1">Posto / Graduação</span>
              </div>
              <div className="space-y-2">
                <input 
                  type="text"
                  placeholder="Ex: SILVA"
                  className="input-military w-full"
                  value={formData.relatorNome}
                  onChange={e => setFormData({...formData, relatorNome: e.target.value})}
                />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter px-1">Nome de Guerra</span>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-black text-military-gold uppercase tracking-widest block pl-1">E-mail para retorno (opcional)</label>
            <input 
              type="email"
              placeholder="exemplo@exercito.mil.br"
              className="input-military w-full"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
            <p className="text-[9px] font-bold text-slate-500 px-1 uppercase tracking-tighter italic">Para recebimento de feedback sobre a prevenção</p>
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
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : (
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

function FgrSection({ user, onTabChange, launches }: { user: FirebaseUser | null, onTabChange: (tab: SectionKey) => void, launches: any[] }) {
  const [stamp, setStamp] = useState<string>(new Date().toLocaleString("pt-BR"));
  const [tipoVoo, setTipoVoo] = useState<string>("REGULAR");
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [missionData, setMissionData] = useState({
    modeloAnv: "",
    aeronave: "",
    missao: "",
    mv: "",
    local: "",
    data: new Date().toISOString().split('T')[0],
    trigramaTrip: "",
    preenchidoPor: user?.displayName || "",
    funcao: ""
  });
  const [p2Selections, setP2Selections] = useState<Record<string, 'SIM' | 'NÃO' | 'NA'>>({});
  const [selectedLaunchId, setSelectedLaunchId] = useState('');

  const handleLaunchSelect = (launchId: string) => {
    setSelectedLaunchId(launchId);
    if (!launchId) return;

    const launch = launches.find(l => l.id === launchId);
    if (launch) {
      const anv = launch.anv || '';
      const digits = anv.replace(/\D/g, '');
      let detectedModel = '';
      if (digits.startsWith('1')) detectedModel = 'HA-1A';
      else if (digits.startsWith('2')) detectedModel = 'HM-1A';
      else if (digits.startsWith('3')) detectedModel = 'HM-2A';
      else if (digits.startsWith('4')) detectedModel = 'HM-3';
      else if (digits.startsWith('5')) detectedModel = 'HM-4';

      setMissionData(prev => ({
        ...prev,
        modeloAnv: detectedModel || prev.modeloAnv,
        aeronave: anv,
        data: launch.dateLabel ? (launch.dateLabel.includes('/') ? launch.dateLabel.split('/').reverse().join('-') : launch.dateLabel) : '', 
        local: launch.dest || '',
        trigramaTrip: `${launch.p1 || ''}/${launch.p2 || ''}/${launch.mv !== '---' ? launch.mv : ''}`.replace(/\/+$/, '').split('/').filter(Boolean).join('/'),
        mv: launch.missao || '', // Using the new missao field for the description
        missao: `LÇ ${launch.num || ''}`.trim(),
        preenchidoPor: launch.p2 || '',
        funcao: 'PB'
      }));
      updateStamp();
    }
  };
  const [p3Selections, setP3Selections] = useState<Record<string, 'S' | 'N' | 'D'>>({});
  const [p4Selections, setP4Selections] = useState<Record<string, 'S' | 'N' | 'D'>>({});
  const [gravidadeSelections, setGravidadeSelections] = useState<Record<string, boolean>>({});
  const [mitigation, setMitigation] = useState("");

  const updateStamp = () => setStamp(new Date().toLocaleString("pt-BR"));

  const handleP2 = (id: string, val: 'SIM' | 'NÃO' | 'NA') => {
    setP2Selections(prev => ({ ...prev, [id]: val }));
    updateStamp();
  };

  const handleP3 = (id: string, val: 'S' | 'N' | 'D') => {
    setP3Selections(prev => {
      if (prev[id] === val) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: val };
    });
    updateStamp();
  };

  const handleP4 = (id: string, val: 'S' | 'N' | 'D') => {
    setP4Selections(prev => {
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
    setGravidadeSelections(prev => ({ ...prev, [id]: !prev[id] }));
    updateStamp();
  };

  const resetAll = () => {
    setTipoVoo("REGULAR");
    setMissionData({
      modeloAnv: "",
      aeronave: "",
      missao: "",
      mv: "",
      local: "",
      data: new Date().toISOString().split('T')[0],
      trigramaTrip: "",
      preenchidoPor: user?.displayName || "",
      funcao: ""
    });
    setP2Selections({});
    setP3Selections({});
    setP4Selections({});
    setGravidadeSelections({});
    setMitigation("");
    updateStamp();
  };

  // Calculations
  const calcSection = (data: any[], selections: Record<string, 'S' | 'N' | 'D'>) => {
    let min = 0;
    let max = 0;
    data.forEach(item => {
      const sel = selections[item.id];
      if (sel === 'S') {
        min += item.w.S;
        max += item.w.S;
      } else if (sel === 'N') {
        min += item.w.N;
        max += item.w.N;
      } else if (sel === 'D') {
        min += 0;
        max += item.w.D;
      }
    });
    return { min, max };
  };

  const p3Categories = Object.keys(PARTE_III_DATA).map(cat => ({
    name: cat,
    title: cat === 'RH' ? 'Recursos Humanos' : 
           cat === 'METEO' ? 'Meteorologia' : 
           cat === 'MATERIAL' ? 'Material' : 
           cat === 'MISSAO' ? 'Missão' : 'Organização',
    questions: (PARTE_III_DATA as any)[cat],
    scores: calcSection((PARTE_III_DATA as any)[cat], p3Selections)
  }));

  const p3TotalMin = p3Categories.reduce((acc, c) => acc + c.scores.min, 0);
  const p3TotalMax = p3Categories.reduce((acc, c) => acc + c.scores.max, 0);

  const p4Questions = tipoVoo === 'REGULAR' ? [] : (PARTE_IV_DATA as any)[tipoVoo] || [];
  const p4Scores = calcSection(p4Questions, p4Selections);

  const tgMin = p3TotalMin + p4Scores.min;
  const tgMax = p3TotalMax + p4Scores.max;

  const gravTotal = GRAVIDADE_DATA.reduce((acc, g) => {
    if (g.fixed) return acc + g.pts;
    const isRestricted = tipoVoo === "REGULAR" && 
      (g.id === "g2" || g.id === "g3" || g.id === "g4" || g.id === "g9");
    if (isRestricted) return acc;
    const isAuto = g.autoByTipo && g.autoByTipo === tipoVoo;
    if (isAuto || gravidadeSelections[g.id]) return acc + g.pts;
    return acc;
  }, 0);

  const riskMin = tgMin * gravTotal;
  const riskMax = tgMax * gravTotal;

  const riskMaxStatus = getRiskClass(riskMax, tipoVoo);

  const hasImpediment = Object.values(p2Selections).some(v => v === 'NÃO');

  const handleSave = async (forceParam: any = false) => {
    const isForced = forceParam === true; // Garante que eventos React não ativem o force por engano
    
    if (!isForced) {
      const errors: string[] = [];
      
      // Validação Parte I
      if (!missionData.modeloAnv) errors.push("Parte I: Selecione o Modelo da Aeronave.");
      if (!missionData.aeronave.trim()) errors.push("Parte I: Informe a Matrícula da Aeronave.");
      if (!missionData.missao.trim()) errors.push("Parte I: Descrição da Missão é obrigatória.");
      if (!missionData.local.trim()) errors.push("Parte I: Informe o Local da operação.");
      if (!missionData.trigramaTrip.trim()) errors.push("Parte I: Trigramas da Tripulação (Líder) são obrigatórios.");
      if (!missionData.preenchidoPor.trim()) errors.push("Parte I: Informe quem está preenchendo o formulário.");
      if (!missionData.funcao) errors.push("Parte I: Selecione a sua Função na missão.");

      // Validação Parte II
      if (Object.keys(p2Selections).length < PARTE_II_DATA.length) {
        errors.push("Parte II: Responda todas as assertivas das Condições Impeditivas.");
      }

      // Validação Parte III
      const totalP3Questions = Object.values(PARTE_III_DATA).flat().length;
      if (Object.keys(p3Selections).length < totalP3Questions) {
        errors.push("Parte III: Responda todas as assertivas dos Fatores de Gestão.");
      }

      // Validação Parte IV
      if (tipoVoo !== 'REGULAR') {
        const p4Questions = (PARTE_IV_DATA as any)[tipoVoo] || [];
        if (Object.keys(p4Selections).length < p4Questions.length) {
          errors.push(`Parte IV: Responda todas as assertivas específicas para voo ${tipoVoo}.`);
        }
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        // Rolar para o primeiro erro ou apenas alertar visualmente
        const element = document.getElementById('validation-errors-anchor');
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setValidationErrors([]);

    if (hasImpediment) {
       alert("MISSÃO IMPEDIDA: Qualquer resposta 'NÃO' na Parte II exige autorização expressa do Cmt U Ae para execução do voo.");
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
          activeUserUid = 'public-fgr';
        }
      }

      const scores = {
        tgMin,
        tgMax,
        gravTotal,
        riskMin,
        riskMax
      };

      const missionPayload = {
        ...missionData,
        tipoVoo,
        p2Selections,
        p3Selections,
        p4Selections,
        gravidadeSelections,
        mitigation,
        scores,
        uid: activeUserUid,
        relatorName: user?.displayName || missionData.preenchidoPor || 'Convidado',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'fgrMissions'), missionPayload);

      setIsSaving(false);
      alert("FGR enviado com sucesso! O SIPAA recebeu o relatório oficial.");
      resetAll();

      // Gerar e Upload do PDF em background (Não bloqueia o UI)
      (async () => {
        try {
          const docPdf = generateFgrPDF(missionPayload);
          const fileName = `fgr_${missionData.missao.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
          const storageRef = ref(storage, `fgr_pdfs/${fileName}`);
          
          const blob = docPdf.output('blob');
          const uploadTask = await uploadBytes(storageRef, blob);
          const pdfUrl = await getDownloadURL(uploadTask.ref);
          
          await setDoc(doc(db, 'fgrMissions', docRef.id), { 
            pdfUrl, 
            fileName 
          }, { merge: true });
          
          console.log("PDF FGR processado em background.");
          
          // Abre o PDF se possível (pode ser bloqueado se demorar muito)
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } catch (pdfErr) {
          console.error("Erro ao processar PDF FGR em background:", pdfErr);
        }
      })();
    } catch (error: any) {
      const msg = error.message || String(error);
      alert(msg.startsWith('{') ? "Falha técnica ao enviar FGR. Verifique a conexão." : msg);
      handleFirestoreError(error, OperationType.CREATE, 'fgrMissions');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-tight">FGR — Gerenciamento de Risco</h2>
          <p className="text-text-secondary text-sm">Gerenciamento completo estruturado no banco de dados SIPAA.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {launches.length > 0 && (
            <div className="flex flex-col gap-1 min-w-[240px]">
              <label className="text-[9px] font-black text-military-gold uppercase tracking-widest pl-1">Auto-Preencher via PDV</label>
              <select 
                value={selectedLaunchId}
                onChange={(e) => handleLaunchSelect(e.target.value)}
                className="bg-bg-sidebar border border-accent-gold/30 text-white text-[9px] font-bold uppercase rounded px-2 py-1.5 outline-none focus:border-accent-gold transition-colors cursor-pointer"
              >
                <option value="">SELECIONAR...</option>
                {Object.entries(launches.reduce((acc: any, curr: any) => {
                  const groupKey = curr.dateLabel || 'Sem Data';
                  if (!acc[groupKey]) acc[groupKey] = [];
                  acc[groupKey].push(curr);
                  return acc;
                }, {})).sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]: [string, any]) => (
                  <optgroup key={date} label={`DATA: ${date}`}>
                    {items.sort((a: any, b: any) => a.num.localeCompare(b.num)).map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {`${l.num} • ${l.anv} • ${l.p1}${l.mv && l.mv !== '---' ? ` • ${l.mv}` : ''}`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          <div className="bg-bg-sidebar border border-border-theme px-4 py-2 rounded flex items-center gap-3 h-fit mt-auto">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Sincronizado:</span>
            <span className="text-[10px] text-accent-gold font-mono">{stamp}</span>
          </div>
        </div>
      </div>

      <>
          {/* Form Content - (Parte I) */}
          <div className="card-military p-0 overflow-hidden text-left">
            <div className="bg-white/5 px-6 py-3 border-b border-border-theme flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-accent-gold tracking-[0.2em]">FORMULÁRIO DE GERENCIAMENTO DE RISCOS Processo de Apoio à Decisão PARTE I</span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {/* Modelo and Matrícula */}
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest flex items-center">
                  Modelo (Anv Líder) <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="flex flex-col gap-3">
                  {['HA-1A', 'HM-1A', 'HM-2A', 'HM-3', 'HM-4'].map(m => (
                    <label key={m} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="radio" 
                          name="modeloAnv" 
                          className="peer sr-only"
                          checked={missionData.modeloAnv === m}
                          onChange={() => { setMissionData({...missionData, modeloAnv: m}); updateStamp(); }}
                        />
                        <div className="w-4 h-4 rounded-full border border-border-theme bg-bg-deep peer-checked:border-accent-gold transition-all"></div>
                        <div className="absolute w-2 h-2 rounded-full bg-accent-gold opacity-0 peer-checked:opacity-100 transition-all"></div>
                      </div>
                      <span className={`text-xs font-bold ${missionData.modeloAnv === m ? 'text-white' : 'text-text-secondary'} group-hover:text-white transition-colors`}>{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                  Matrícula da(s) Aeronave(s) <span className="text-red-500 ml-1">*</span>
                </label>
                <input 
                  type="text" 
                  className="input-military w-full"
                  value={missionData.aeronave}
                  onChange={(e) => { 
                    const val = e.target.value;
                    const digits = val.replace(/\D/g, '');
                    let autoModel = missionData.modeloAnv;
                    if (digits.startsWith('1')) autoModel = 'HA-1A';
                    else if (digits.startsWith('2')) autoModel = 'HM-1A';
                    else if (digits.startsWith('3')) autoModel = 'HM-2A';
                    else if (digits.startsWith('4')) autoModel = 'HM-3';
                    else if (digits.startsWith('5')) autoModel = 'HM-4';
                    
                    setMissionData({
                      ...missionData, 
                      aeronave: val,
                      modeloAnv: autoModel
                    }); 
                    updateStamp(); 
                  }}
                  placeholder="Ex: EB-20xx" 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                  Número Lançamento (Lç PDV) <span className="text-red-500 ml-1">*</span>
                </label>
                <input 
                  type="text" 
                  className="input-military w-full"
                  value={missionData.missao}
                  onChange={(e) => { setMissionData({...missionData, missao: e.target.value}); updateStamp(); }}
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
                  onChange={(e) => { setMissionData({...missionData, mv: e.target.value}); updateStamp(); }}
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
                  onChange={(e) => { setMissionData({...missionData, local: e.target.value}); updateStamp(); }}
                  placeholder="Base / Área de Operação" 
                />
              </div>

              {/* Data and Trigramas */}
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                  Data <span className="text-red-500 ml-1">*</span>
                </label>
                <input 
                  type="date" 
                  className="input-military w-full"
                  value={missionData.data}
                  onChange={(e) => { setMissionData({...missionData, data: e.target.value}); updateStamp(); }}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                  Tripulação (1P / 2P / MV) <span className="text-red-500 ml-1">*</span>
                </label>
                <input 
                  type="text" 
                  className="input-military w-full"
                  value={missionData.trigramaTrip}
                  onChange={(e) => { setMissionData({...missionData, trigramaTrip: e.target.value}); updateStamp(); }}
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
                  onChange={(e) => { setMissionData({...missionData, preenchidoPor: e.target.value}); updateStamp(); }}
                  placeholder="Trigrama" 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                  Função <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="flex flex-col gap-3">
                  {['Cmt Missão', 'PI', 'PO', 'PB'].map(f => (
                    <label key={f} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="radio" 
                          name="funcao" 
                          className="peer sr-only"
                          checked={missionData.funcao === f}
                          onChange={() => { setMissionData({...missionData, funcao: f}); updateStamp(); }}
                        />
                        <div className="w-4 h-4 rounded-full border border-border-theme bg-bg-deep peer-checked:border-accent-gold transition-all"></div>
                        <div className="absolute w-2 h-2 rounded-full bg-accent-gold opacity-0 peer-checked:opacity-100 transition-all"></div>
                      </div>
                      <span className={`text-xs font-bold ${missionData.funcao === f ? 'text-white' : 'text-text-secondary'} group-hover:text-white transition-colors`}>{f}</span>
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
              <span className="text-[9px] font-mono text-text-secondary italic">Qualquer "NÃO" impede o voo</span>
            </div>
            <div className="p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-theme/30 bg-white/2">
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-white tracking-widest">Assertivas <span className="text-red-500 ml-1 font-bold">*</span></th>
                    <th className="px-2 py-4 text-center w-14 text-[9px] uppercase font-black text-text-secondary tracking-widest">S</th>
                    <th className="px-2 py-4 text-center w-14 text-[9px] uppercase font-black text-text-secondary tracking-widest">N</th>
                    <th className="px-2 py-4 text-center w-14 text-[9px] uppercase font-black text-text-secondary tracking-widest">NA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-theme/10">
                  {PARTE_II_DATA.map((item) => (
                    <tr key={item.id} className="hover:bg-white/2 transition-colors group">
                      <td className="px-6 py-3.5 text-[11px] font-medium text-text-primary leading-tight opacity-90 group-hover:opacity-100 transition-opacity">
                        {item.text}
                      </td>
                      {['SIM', 'NÃO', 'NA'].map((val) => (
                        <td key={val} className="px-2 py-3.5 text-center">
                          <button 
                            type="button"
                            onClick={() => handleP2(item.id, val as any)}
                            className={`w-7 h-7 rounded border transition-all text-[9px] font-black flex items-center justify-center mx-auto ${
                              p2Selections[item.id] === val 
                                ? 'bg-accent-gold text-bg-deep border-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.3)]' 
                                : 'border-border-theme text-text-secondary hover:border-white/20'
                            }`}
                          >
                            {val === 'SIM' ? 'S' : val === 'NÃO' ? 'N' : 'NA'}
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
                  <span className="text-red-500 text-xs font-black uppercase tracking-[0.2em]">Condição Impeditiva Detectada</span>
                </div>
                
                <div className="space-y-4 text-left border-l-2 border-red-500/30 pl-4">
                  <h4 className="text-[10px] font-black uppercase text-text-secondary tracking-widest mb-1">Observações:</h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <span className="text-[10px] font-mono text-red-500 font-bold">1.</span>
                      <p className="text-[10px] text-text-primary leading-relaxed">Qualquer número de resposta <b className="text-red-400 font-black">“NÃO”</b> impede a realização do voo, sem a autorização do Cmt da U Ae ou do Cmt Av Ex.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-[10px] font-mono text-red-500 font-bold">2.</span>
                      <p className="text-[10px] text-text-primary leading-relaxed">Apenas o Cmt da U Ae ou Cmt da Av Ex podem dar autorização para que a missão prossiga, independente do número de respostas <b className="text-red-400 font-black">“NÃO”</b>. Os comandantes deverão levar em consideração o custo-benefício que essa decisão trará para a organização.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-[10px] font-mono text-red-500 font-bold">3.</span>
                      <p className="text-[10px] text-text-primary leading-relaxed"><b className="text-white">N A</b> – não aplicável, ou seja, não tem nada a ver com a missão a ser realizada. Exemplo: - No caso de voo de instrução, no item <i className="text-white">“A tripulação está habilitada para a realização do voo”</i>, dever-se-á marcar NA.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-[10px] font-mono text-red-500 font-bold">4.</span>
                      <p className="text-[10px] text-text-primary leading-relaxed">Caso seja levantado algum potencial de risco que comprometa a execução da missão/voo, o militar que preenche o FGR deverá lançar esse potencial de risco no espaço destinado e fazer a análise, marcando <b className="text-white">“SIM”</b> ou <b className="text-white">“NÃO”</b> ou <b className="text-white">“NA”</b>. Quando marcar <b className="text-red-400">“NÃO”</b> deverá proceder como prescreve nos itens 1 e 2 descritos acima.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-[10px] font-mono text-red-500 font-bold">5.</span>
                      <p className="text-[10px] text-text-primary leading-relaxed">Caso no item: <i className="text-white">“Toda tripulação/envolvidos participam de um briefing”</i> seja marcado <b className="text-red-400 font-black">“NÃO”</b>, quem não participou não poderá realizar a missão até que passe pelo briefing.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-sm font-black uppercase text-white tracking-widest">Parte III — Fatores de Gestão</h3>
              </div>
              <div className="space-y-4">
                {p3Categories.map(cat => (
                  <div key={cat.name} className="card-military p-0 overflow-hidden border-border-theme/40">
                    <div className="bg-bg-sidebar px-4 py-2 border-b border-border-theme flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-text-secondary tracking-widest">{cat.title}</span>
                      <span className="text-[10px] font-mono text-accent-gold">mín: {cat.scores.min} / máx: {cat.scores.max}</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border-theme/30 bg-white/2">
                          <th className="px-4 py-2 text-[9px] uppercase font-black text-text-secondary tracking-tighter">Critério</th>
                          <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">S</th>
                          <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">N</th>
                          <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">D</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.questions.map((q: any) => (
                          <tr key={q.id} className="border-b border-border-theme/10 hover:bg-white/2">
                            <td className="px-4 py-2.5 text-xs text-text-primary leading-tight">{q.text}</td>
                            {['S', 'N', 'D'].map(val => (
                              <td key={val} className="px-2 py-2.5 text-center">
                                <button 
                                  onClick={() => handleP3(q.id, val as any)}
                                  className={`w-7 h-7 rounded border transition-all text-[9px] font-black ${p3Selections[q.id] === val ? 'bg-accent-gold text-bg-deep border-accent-gold' : 'border-border-theme text-text-secondary'}`}
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
                 <h3 className="text-sm font-black uppercase text-white tracking-widest px-2">Parte IV — Tipo de Voo</h3>
                 <div className="card-military p-4 flex gap-4 items-center bg-bg-sidebar">
                    <div className="flex-1">
                       <label className="text-[9px] uppercase font-black text-accent-gold tracking-[0.2em] mb-2 block">Perfil de Voo</label>
                       <select 
                         className="input-military w-full text-sm font-bold bg-bg-deep"
                         value={tipoVoo}
                         onChange={(e) => { setTipoVoo(e.target.value); updateStamp(); setP4Selections({}); }}
                       >
                         <option value="REGULAR">Voo Regular</option>
                         <option value="INSTRUCAO">Voo de Instrução</option>
                         <option value="IFR">Voo IFR</option>
                         <option value="OVN">Voo OVN</option>
                         <option value="TECNICO">Voo Técnico (Mnt/Ens)</option>
                       </select>
                    </div>
                    <div className="bg-bg-deep border border-border-theme px-4 py-2 rounded text-center">
                       <span className="text-[8px] font-black text-text-secondary uppercase block mb-1">Total (III+IV)</span>
                       <span className="text-lg font-mono text-white font-black">{tgMax}</span>
                    </div>
                 </div>

                 {tipoVoo !== 'REGULAR' && p4Questions.length > 0 && (
                   <div className="card-military p-0 overflow-hidden border-border-theme/40 mt-4">
                     <div className="bg-bg-sidebar px-4 py-2 border-b border-border-theme flex justify-between items-center">
                       <span className="text-[10px] font-bold uppercase text-accent-gold tracking-widest">Critérios Específicos — {tipoVoo}</span>
                     </div>
                     <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="border-b border-border-theme/30 bg-white/2">
                           <th className="px-4 py-2 text-[9px] uppercase font-black text-text-secondary tracking-tighter">Critério</th>
                           <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">S</th>
                           <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">N</th>
                           <th className="px-2 py-2 text-[center] w-12 font-black text-[9px] uppercase tracking-tighter text-text-secondary">D</th>
                         </tr>
                       </thead>
                       <tbody>
                         {p4Questions.map((q: any) => (
                           <tr key={q.id} className="border-b border-border-theme/10 hover:bg-white/2">
                             <td className="px-4 py-2.5 text-xs text-text-primary leading-tight">{q.text}</td>
                             {['S', 'N', 'D'].map(val => (
                               <td key={val} className="px-2 py-2.5 text-center">
                                 <button 
                                   onClick={() => handleP4(q.id, val as any)}
                                   className={`w-7 h-7 rounded border transition-all text-[9px] font-black ${p4Selections[q.id] === val ? 'bg-accent-gold text-bg-deep border-accent-gold' : 'border-border-theme text-text-secondary'}`}
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
                 )}
              </div>

                  <div className="card-military p-0 overflow-hidden text-left border-border-theme/40">
                     <div className="bg-bg-sidebar/50 px-6 py-4 border-b border-border-theme/30 flex justify-between items-center">
                        <span className="text-[11px] font-black uppercase text-accent-gold tracking-[0.2em]">Parte V — Avaliação de Gravidade</span>
                     </div>
                     <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {GRAVIDADE_DATA.filter(g => !g.fixed).map(g => {
                            const isAuto = g.autoByTipo && g.autoByTipo === tipoVoo;
                            const isRestricted = tipoVoo === "REGULAR" && 
                               (g.id === "g2" || g.id === "g3" || g.id === "g4" || g.id === "g9");
                            
                            if (isRestricted) return null;

                            return (
                              <button
                                key={g.id}
                                disabled={isAuto}
                                onClick={() => handleGrav(g.id)}
                                className={`flex items-center justify-between p-3 rounded border text-left transition-all ${
                                  (isAuto || gravidadeSelections[g.id]) 
                                    ? 'bg-accent-gold/20 border-accent-gold text-white' 
                                    : 'bg-white/2 border-white/5 text-text-secondary hover:border-white/20'
                                }`}
                              >
                                <span className="text-[11px] font-bold uppercase tracking-tight">{g.text}</span>
                                <span className={`text-[10px] font-mono ${isAuto || gravidadeSelections[g.id] ? 'text-accent-gold' : 'text-slate-500'}`}>+{g.pts}</span>
                              </button>
                            );
                          })}
                        </div>
                     </div>
                  </div>

                  <div className="card-military p-0 overflow-hidden text-left bg-gradient-to-br from-bg-sidebar to-bg-deep border-border-theme/40">
                     <div className="bg-bg-sidebar/50 px-6 py-4 border-b border-border-theme/30 flex justify-between items-center">
                        <span className="text-[11px] font-black uppercase text-accent-gold tracking-[0.2em]">Resultado da Matriz de Risco</span>
                     </div>
                     <div className="p-8 space-y-8">
                        <div className={`p-6 rounded border-2 shadow-2xl transition-all duration-700 ${riskMaxStatus.border} ${riskMaxStatus.bg} flex flex-col items-center gap-3`}>
                           <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">Classificação Final</span>
                           <div className={`text-4xl md:text-5xl font-black italic tracking-tighter text-center ${riskMaxStatus.color}`}>
                              {riskMaxStatus.label.toUpperCase()}
                           </div>
                           
                           <div className="flex gap-8 items-center mt-2 py-4 border-y border-white/5 w-full justify-center">
                              <div className="flex flex-col items-center">
                                 <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1">Score Mínimo</span>
                                 <span className="text-xl font-mono text-white font-black">{riskMin}</span>
                              </div>
                              <div className="w-px h-10 bg-white/10" />
                              <div className="flex flex-col items-center">
                                 <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-1">Score Máximo</span>
                                 <span className="text-xl font-mono text-white font-black">{riskMax}</span>
                              </div>
                           </div>

                           <div className="w-full space-y-6 pt-4">
                              <div className="text-center">
                                 <span className="text-[9px] font-black text-text-secondary/60 uppercase block mb-2 tracking-[0.2em]">Ação Recomendada</span>
                                 <p className="text-[11px] font-bold text-white leading-relaxed max-w-[320px] mx-auto bg-black/20 p-3 rounded-sm border border-white/5 shadow-inner">
                                    {riskMaxStatus.decisao}
                                 </p>
                              </div>
                              <div className="text-center bg-bg-deep/40 p-4 rounded-sm border border-border-theme/30">
                                 <span className="text-[9px] font-black text-text-secondary/60 uppercase block mb-1 tracking-[0.2em]">Responsabilidade</span>
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
                           <div>
                              <label className="text-[10px] font-black uppercase text-text-secondary tracking-widest mb-2 block">Medidas de Mitigação Exigidas</label>
                              <textarea 
                                className="input-military w-full h-32 text-sm leading-relaxed p-4"
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
                                     <span className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em]">Erros de Validação</span>
                                   </div>
                                   <ul className="space-y-1 mb-4">
                                     {validationErrors.map((err, idx) => (
                                       <li key={idx} className="text-[10px] text-text-primary flex items-start gap-2">
                                         <span className="text-red-500 font-bold">•</span>
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
                             {isSaving ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} className="group-hover:scale-110 transition-transform" />}
                             {isSaving ? 'Processando...' : 'ENVIAR RELATÓRIO SIPAA'}
                           </button>
                           <button onClick={resetAll} className="w-full py-4 text-[10px] uppercase font-bold text-text-secondary hover:text-red-400 transition-colors tracking-widest">Descartar e Limpar Formulário</button>
                        </div>
                     </div>
                  </div>
            </div>
          </div>
        </>
    </div>
  );
}

function AbortivaSection({ user, launches }: { user: FirebaseUser | null, launches: any[] }) {
  const [selectedLaunchId, setSelectedLaunchId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    dataVoo: new Date().toISOString().split('T')[0],
    numLancamento: "",
    modeloAnv: "",
    mv: "",
    destino: "",
    motivo: "",
    preenchidoPor: ""
  });

  const handleLaunchSelectAbortiva = (launchId: string) => {
    setSelectedLaunchId(launchId);
    if (!launchId) return;

    const launch = launches.find(l => l.id === launchId);
    if (launch) {
      const anv = launch.anv || '';
      const digits = anv.replace(/\D/g, '');
      let detectedModel = '';
      if (digits.startsWith('1')) detectedModel = 'HA-1A';
      else if (digits.startsWith('2')) detectedModel = 'HM-1A';
      else if (digits.startsWith('3')) detectedModel = 'HM-2A';
      else if (digits.startsWith('4')) detectedModel = 'HM-3';
      else if (digits.startsWith('5')) detectedModel = 'HM-4';

      setFormData(prev => ({
        ...prev,
        dataVoo: launch.dateLabel ? launch.dateLabel.split('/').reverse().join('-') : '',
        numLancamento: launch.num || '',
        modeloAnv: detectedModel || prev.modeloAnv,
        mv: launch.missao || '', // Using launch.missao for mission description
        destino: launch.dest || '',
        tripulacao: `${launch.p1 || ''}/${launch.p2 || ''}/${launch.mv !== '---' ? launch.mv : ''}`.replace(/\/+$/, '').split('/').filter(Boolean).join('/'),
        motivo: 'DCM', // Default per request
        preenchidoPor: launch.p1 || ''
      }));
    }
  };

  const handleSend = async () => {
    if (!formData.dataVoo || !formData.numLancamento || !formData.modeloAnv || !formData.motivo || !formData.preenchidoPor) {
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
          activeUserUid = 'public-abortiva';
        }
      }

      // 1. Salvar no Firestore Primeiro para garantir os dados
      const reportData = {
        ...formData,
        uid: activeUserUid,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'abortivas'), reportData);
      
      setIsSaving(false);
      alert("Relato de abortiva enviado com sucesso! O SIPAA recebeu as informações e o PDF oficial será processado no acervo.");
      
      setFormData({
        dataVoo: new Date().toISOString().split('T')[0],
        numLancamento: "",
        modeloAnv: "",
        mv: "",
        destino: "",
        motivo: "",
        preenchidoPor: ""
      });
      setSelectedLaunchId('');

      // 2. Gerar e Upload do PDF em background (Não bloqueia o UI)
      (async () => {
        try {
          const docPdf = generateAbortivaPDF(reportData);
          const fileName = `abortiva_${formData.numLancamento}_${Date.now()}.pdf`;
          const storageRef = ref(storage, `abortivas/${fileName}`);
          
          const blob = docPdf.output('blob');
          const uploadTask = await uploadBytes(storageRef, blob);
          const pdfUrl = await getDownloadURL(uploadTask.ref);
          
          // Atualizar o documento com a URL do PDF
          await setDoc(doc(db, 'abortivas', docRef.id), { 
            pdfUrl, 
            fileName 
          }, { merge: true });
          
          console.log("PDF de abortiva enviado e vinculado com sucesso.");
        } catch (pdfErr) {
          console.error("Erro ao processar PDF em background:", pdfErr);
        }
      })();
    } catch (err: any) {
      const msg = err.message || String(err);
      alert(msg.startsWith('{') ? "Erro ao salvar abortiva no servidor." : msg);
      console.error("Erro ao enviar abortiva:", err);
      handleFirestoreError(err, OperationType.CREATE, 'abortivas');
    } finally {
      setIsSaving(false);
    }
  };

  const motivos = [
    { id: 'DOS', text: 'DOS (Devido a Ordem Superior)' },
    { id: 'DFM', text: 'DFM (Devido a Falha de Material)' },
    { id: 'DCP', text: 'DCP (Devido a Condições Pessoais)' },
    { id: 'DCM', text: 'DCM (Devido a Condições Meteorológicas)' }
  ];

  return (
    <div className="space-y-6 pb-20 text-left">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-tight">Abortiva de Voo</h2>
        <p className="text-text-secondary text-sm">Relate interrupções de missões planejadas.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {launches.length > 0 && (
          <div className="flex flex-col gap-1 min-w-[240px]">
            <label className="text-[9px] font-black text-military-gold uppercase tracking-widest pl-1">Auto-Preencher via PDV</label>
            <select 
              value={selectedLaunchId}
              onChange={(e) => handleLaunchSelectAbortiva(e.target.value)}
              className="bg-bg-sidebar border border-accent-gold/30 text-white text-[9px] font-bold uppercase rounded px-2 py-1.5 outline-none focus:border-accent-gold transition-colors cursor-pointer"
            >
              <option value="">SELECIONAR...</option>
              {Object.entries(launches.reduce((acc: any, curr: any) => {
                const groupKey = curr.dateLabel || 'Sem Data';
                if (!acc[groupKey]) acc[groupKey] = [];
                acc[groupKey].push(curr);
                return acc;
              }, {})).sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]: [string, any]) => (
                <optgroup key={date} label={`DATA: ${date}`}>
                  {items.sort((a: any, b: any) => a.num.localeCompare(b.num)).map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {`${l.num} • ${l.anv} • ${l.p1}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card-military p-0 overflow-hidden max-w-2xl">
        <div className="bg-white/5 px-6 py-3 border-b border-border-theme">
          <span className="text-[10px] font-black uppercase text-accent-gold tracking-[0.2em]">Formulário de Abortiva</span>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Data do Voo *</label>
              <input 
                type="date" 
                className="input-military w-full px-4 py-3"
                value={formData.dataVoo}
                onChange={e => setFormData({...formData, dataVoo: e.target.value})}
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Número do Lançamento *</label>
              <input 
                type="text" 
                className="input-military w-full px-4 py-3"
                value={formData.numLancamento}
                onChange={e => setFormData({...formData, numLancamento: e.target.value})}
                placeholder="Ex: 01"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Modelo Anv *</label>
            <div className="flex flex-wrap gap-4">
              {['HA-1A', 'HM-1A', 'HM-2A', 'HM-3', 'HM-4'].map(m => (
                <label key={m} className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="radio" 
                      name="abortivaModelo" 
                      className="peer sr-only"
                      checked={formData.modeloAnv === m}
                      onChange={() => setFormData({...formData, modeloAnv: m})}
                    />
                    <div className="w-4 h-4 rounded-full border border-border-theme bg-bg-deep peer-checked:border-accent-gold transition-all"></div>
                    <div className="absolute w-2 h-2 rounded-full bg-accent-gold opacity-0 peer-checked:opacity-100 transition-all"></div>
                  </div>
                  <span className={`text-xs font-bold ${formData.modeloAnv === m ? 'text-white' : 'text-text-secondary'} group-hover:text-white transition-colors`}>{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Missão / Voo</label>
              <input 
                type="text" 
                className="input-military w-full px-4 py-3"
                value={formData.mv}
                onChange={e => setFormData({...formData, mv: e.target.value})}
                placeholder="Ex: TREINAMENTO"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Tripulação (1P / 2P / MV)</label>
              <input 
                type="text" 
                className="input-military w-full px-4 py-3"
                value={formData.tripulacao || ''}
                onChange={e => setFormData({...formData, tripulacao: e.target.value})}
                placeholder="Ex: ABC/DEF/GHI"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Destino</label>
              <input 
                type="text" 
                className="input-military w-full px-4 py-3"
                value={formData.destino}
                onChange={e => setFormData({...formData, destino: e.target.value})}
                placeholder="Ex: SBTA"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Motivo *</label>
            <div className="flex flex-col gap-3">
              {motivos.map(m => (
                <label key={m.id} className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="radio" 
                      name="abortivaMotivo" 
                      className="peer sr-only"
                      checked={formData.motivo === m.id}
                      onChange={() => setFormData({...formData, motivo: m.id})}
                    />
                    <div className="w-4 h-4 rounded-full border border-border-theme bg-bg-deep peer-checked:border-accent-gold transition-all"></div>
                    <div className="absolute w-2 h-2 rounded-full bg-accent-gold opacity-0 peer-checked:opacity-100 transition-all"></div>
                  </div>
                  <span className={`text-xs font-bold ${formData.motivo === m.id ? 'text-white' : 'text-text-secondary'} group-hover:text-white transition-colors`}>{m.text}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">Preenchido por *</label>
            <input 
              type="text" 
              className="input-military w-full px-4 py-3"
              value={formData.preenchidoPor}
              onChange={e => setFormData({...formData, preenchidoPor: e.target.value})}
              placeholder="Trigrama"
            />
          </div>

          <div className="pt-4 flex gap-4">
             <button 
               onClick={handleSend}
               disabled={isSaving}
               className="btn-military flex-1 h-12 uppercase font-black tracking-widest flex items-center justify-center gap-3"
             >
               {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
               {isSaving ? 'Enviando...' : 'Enviar Abortiva'}
             </button>
             <button 
               onClick={() => {
                 setFormData({ dataVoo: new Date().toISOString().split('T')[0], numLancamento: "", modeloAnv: "", motivo: "", preenchidoPor: "", tripulacao: "" });
                 setSelectedLaunchId('');
               }}
               className="px-6 border border-border-theme text-text-secondary text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
             >
               Limpar
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapaRiscoSection({ onTabChange }: { onTabChange: (tab: SectionKey) => void }) {
  return (
    <div className="space-y-8">
       <div>
          <h2 className="text-2xl font-bold text-white mb-1">Mapa de Risco Operacional</h2>
          <p className="text-slate-400">Visualização de ameaças e perigos atuais no setor.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <RiscoCard type="critical" title="Presença de Drones" area="Setor Leste (Setor de Testes)" desc="Aumento de avistamentos de drones civis não autorizados em área de aproximação final." mitig="Notificar controle local e manter vigilância redobrada." />
          <RiscoCard type="warning" title="Linhas de Transmissão" area="Taubaté - São José" desc="Nova estrutura de alta tensão instalada sem balizamento definitivo." mitig="Consultar NOTAM e evitar sobrevoo abaixo de 500ft AGU." />
          <RiscoCard type="info" title="Obra na Taxivaria" area="Hangar 2" desc="Movimentação de máquinas e pessoal pesado na taxivaria paralela ao meio-dia." mitig="Seguir orientações do fiscal de pátio." />
          <RiscoCard type="warning" title="Fauna: Urubus" area="Cabeceira 18" desc="Maior concentração de aves no período matutino devido a aterro próximo." mitig="Evitar decolagens de alta performance conforme horário." />
        </div>
    </div>
  );
}

function NotificacaoSection({ onTabChange }: { onTabChange: (tab: SectionKey) => void }) {
  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white mb-1">Central de Notificação</h2>
          <span className="text-xs text-military-gold border border-military-gold/30 px-3 py-1 rounded-full uppercase font-bold tracking-widest">3 Mensagens Novas</span>
       </div>

       <div className="space-y-4">
          {[
            { tag: 'URGENTE', color: 'red', title: 'Suspensão temporária de uso do combustível Jet-A1 - Lote 459', date: 'Hoje, 09:15', read: false },
            { tag: 'ALERTA', color: 'orange', title: 'Atualização de procedimentos NVG - Diretriz 02/2026', date: 'Ontem, 14:00', read: true },
            { tag: 'INFO', color: 'blue', title: 'Escala de serviço SIPAA - Maio 2026', date: '15 Abr, 10:30', read: true },
            { tag: 'ALERTA', color: 'orange', title: 'Revisão obrigatória do sistema de extinção de incêndio HM-1', date: '12 Abr, 16:45', read: true },
          ].map((msg, i) => (
            <div key={i} className={`card-military flex items-center gap-6 cursor-pointer border-l-4 p-5 ${msg.read ? 'opacity-80' : 'bg-military-blue/10 border-military-gold border-2 transition-all hover:bg-military-blue/20'}`} 
                 style={{ borderLeftColor: i === 0 ? '#ef4444' : i === 1 || i === 3 ? '#f97316' : '#3b82f6' }}>
              <div className={`p-3 rounded-full ${i === 0 ? 'bg-red-500/20 text-red-500' : i === 1 || i === 3 ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'}`}>
                <Bell size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${i === 0 ? 'text-red-500' : i === 1 || i === 3 ? 'text-orange-500' : 'text-blue-500'}`}>{msg.tag}</span>
                  <span className="text-[10px] text-slate-500">• {msg.date}</span>
                </div>
                <h4 className={`font-bold ${msg.read ? 'text-slate-300' : 'text-white text-lg'}`}>{msg.title}</h4>
              </div>
              <ChevronRight className="text-slate-600" />
            </div>
          ))}
       </div>
    </div>
  );
}

function PosAcidenteSection({ onTabChange }: { onTabChange: (tab: SectionKey) => void }) {
  const [simplifiedMode, setSimplifiedMode] = useState(false);
  
  return (
    <div className={`space-y-8 transition-all duration-500 ${simplifiedMode ? 'max-w-4xl mx-auto' : ''}`}>
       <div className="flex items-center justify-between bg-red-600/10 p-4 border border-red-600/20 rounded-lg">
          <div>
            <h2 className="text-2xl font-extrabold text-red-500 mb-1 leading-none uppercase tracking-tighter">Plano de Emergência</h2>
            <p className="text-text-secondary text-sm">Protocolos imediatos para resposta a acidentes.</p>
          </div>
          <button 
            onClick={() => setSimplifiedMode(!simplifiedMode)}
            className={`px-6 py-3 font-bold rounded-lg transition-all uppercase tracking-widest text-xs ${simplifiedMode ? 'bg-slate-200 text-black' : 'bg-red-600 text-white shadow-lg shadow-red-600/30'}`}
          >
            {simplifiedMode ? 'Modo Padrão' : 'Prioridade Máxima'}
          </button>
       </div>

       <div className={`grid grid-cols-1 ${simplifiedMode ? 'gap-4' : 'lg:grid-cols-2 gap-8'}`}>
          <ActionStep number="01" title="Socorro e Resgate" desc="Acionar imediatamente equipe médica e bombeiros. Foco total na preservação da vida e primeiros socorros." />
          <ActionStep number="02" title="Isolamento da Área" desc="Estabelecer perímetro de segurança rígido. Impedir entrada de curiosos e imprensa não autorizada." />
          <ActionStep number="03" title="Preservação de Evidências" desc="NÃO tocar nos destroços ou mover partes da aeronave, exceto se estritamente necessário para resgate." />
          <ActionStep number="04" title="Comunicação Oficial" desc="Notificar Comandante do BAvEx e órgão SIPAA superior. Manter sigilo absoluto das informações." />
          <ActionStep number="05" title="Listagem de Testemunhas" desc="Identificar e coletar dados de contato de todas as pessoas que presenciaram ou ouviram o ocorrido." />
          <ActionStep number="06" title="Registro Fotográfico" desc="Se as condições permitirem, registrar o local sem alterar a posição de nenhum fragmento ou componente." />
       </div>
    </div>
  );
}

function AbastecimentoSection({ onTabChange, abastecimentoFiles }: { onTabChange: (tab: SectionKey) => void, abastecimentoFiles: any[] }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Acervo de Abastecimento</h2>
          <p className="text-military-gold font-bold text-xs uppercase tracking-[0.2em] mt-1">
            Repositório de Documentos Oficiais 2º BAvEx
          </p>
        </div>
        
        <button 
          onClick={() => {
            const doc = generateAbastecimentoPDF();
            window.open(doc.output('bloburl'), '_blank');
          }}
          className="btn-military px-6 py-3 text-[10px] uppercase font-black tracking-widest flex items-center gap-2"
        >
          <BookOpen size={16} />
          Gerar Guia Padrão (Contingência)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {abastecimentoFiles.length === 0 ? (
          <div className="col-span-full card-military p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-white/10">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-500">
              <FileSearch size={32} />
            </div>
            <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">Nenhum documento dinâmico disponível no momento.</p>
          </div>
        ) : (
          abastecimentoFiles.map((file) => (
            <motion.div 
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-military flex flex-col group hover:border-military-gold transition-all"
            >
              <div className="p-5 flex-1 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="p-3 rounded-lg bg-military-gold/10 text-military-gold group-hover:bg-military-gold group-hover:text-military-black transition-all">
                    <FileText size={24} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-tighter">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-military-gold transition-colors line-clamp-2 uppercase tracking-tight leading-tight">
                    {file.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                     <span className="text-[8px] font-black text-military-gold bg-military-gold/10 px-2 py-0.5 rounded uppercase tracking-widest">PDF</span>
                     <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 border-t border-white/5 flex gap-2">
                <button 
                  onClick={() => window.open(file.url, '_blank')}
                  className="flex-1 px-4 py-2.5 bg-military-gold text-military-black font-black text-[9px] uppercase tracking-widest rounded hover:bg-military-gold-dark transition-all flex items-center justify-center gap-2"
                >
                  <Eye size={14} /> Visualizar
                </button>
                <a 
                  href={file.url}
                  download={file.name}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 px-4 py-2.5 bg-white/10 text-white font-black text-[9px] uppercase tracking-widest rounded hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Baixar
                </a>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="card-military p-4 border-blue-500/10 bg-blue-500/5 flex items-center gap-3">
        <AlertCircle className="text-blue-400 shrink-0" size={16} />
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">
          Atenção: Os documentos listados nesta seção são de caráter oficial e para uso exclusivo da aviação do exército.
        </p>
      </div>
    </div>
  );
}

function MeteoSection({ onTabChange }: { onTabChange: (tab: SectionKey) => void }) {
  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Memento Meteorológico</h2>
            <p className="text-slate-400 text-sm">Informações essenciais para tomada de decisão.</p>
          </div>
          <div className="flex items-center gap-3 p-3 bg-military-blue/20 rounded-lg border border-military-blue/30">
            <CloudSun className="text-military-gold" size={28} />
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">METAR SBTA</span>
               <span className="text-sm text-white font-mono font-bold leading-none mt-1">VMC • 26º C</span>
            </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MeteoCard icon={Wind} title="Vento" value="08 kts" label="Direção 210º" status="ESTÁVEL" />
          <MeteoCard icon={Navigation} title="Visibilidade" value="> 10.000m" label="Ceu Claro" status="VMC" />
          <MeteoCard icon={Droplets} title="Ajuste Altimétrico" value="1016 hPa" label="QNH Local" status="NORMAL" />
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="card-military">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Doutrina e Mínimos</h3>
            <div className="space-y-6">
               <div className="border-l-2 border-military-gold pl-4">
                  <h4 className="text-military-gold font-bold text-sm mb-1 uppercase tracking-tight">Condições VFR</h4>
                  <p className="text-xs text-slate-300 leading-relaxed italic">Distância vertical das nuvens 1000ft, Horizontal 1.5km. Não decolar se previsão de queda abaixo de mínimos.</p>
               </div>
               <div className="border-l-2 border-slate-700 pl-4">
                  <h4 className="text-slate-200 font-bold text-sm mb-1 uppercase tracking-tight">Trovoadas (CB)</h4>
                  <p className="text-xs text-slate-400 leading-relaxed italic">Manter distância mínima de 10NM de células de tempestade. Risco severo de granizo e turbulência.</p>
               </div>
            </div>
         </div>
         
         <div className="flex flex-col gap-4">
            <div className="bg-[#05070a] p-6 rounded-xl border border-slate-800 font-mono text-sm shadow-inner">
               <span className="text-military-gold text-xs block mb-3 font-bold uppercase tracking-widest border-b border-slate-800 pb-2">RAW DATA STRINGS</span>
               <p className="text-green-500/80 leading-relaxed">
                  METAR SBTA 161900Z 21008KT 9999 FEW030 26/18 Q1016 =<br/>
                  TAF SBTA 161200Z 1618/1718 21010KT 9999 SCT030 TX28/1618Z TN15/1709Z =
               </p>
            </div>
            <button className="btn-military py-3 uppercase tracking-widest text-xs">Consultar REDEMET Completo</button>
         </div>
       </div>
    </div>
  );
}

function FaunaSection({ onTabChange }: { onTabChange: (tab: SectionKey) => void }) {
  return (
    <div className="space-y-8">
       <div>
          <h2 className="text-2xl font-bold text-white mb-1">Risco de Fauna</h2>
          <p className="text-slate-400">Notifique avistamentos, atividades ou colisões.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
           <div className="lg:col-span-3 card-military">
              <h3 className="font-bold text-white mb-8 uppercase text-xs tracking-widest border-b border-slate-800 pb-3">Formulário de Reporte Sipaa</h3>
              <form className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Local da Ocorrência</label>
                      <input className="input-military" placeholder="Ex: Cabeceira 18 / Setor Alfa" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Espécie / Descrição</label>
                      <input className="input-military" placeholder="Ex: Urubu, Quero-quero, etc" />
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Data</label>
                      <input type="date" className="input-military" defaultValue="2026-04-16" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Horário Aproximado</label>
                      <input type="time" className="input-military" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Altura (Pés)</label>
                      <input type="number" className="input-military" placeholder="Ex: 500" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Descrição das Circunstâncias</label>
                    <textarea className="input-military h-32 resize-none" placeholder="Relate o comportamento das aves, quantidade aproximada e efeito na aeronave se houver..."></textarea>
                 </div>
                 <button type="button" className="btn-military w-full py-4 text-xs tracking-widest uppercase">
                   <Bird size={20} /> Registrar Reporte de Fauna
                 </button>
              </form>
           </div>

           <div className="lg:col-span-2 space-y-6">
              <div className="card-military">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Histórico de Incidentes</h3>
                 <div className="space-y-5">
                    <FaunaItem date="Hoje, 09:30" species="Bando de Quero-quero" local="Área de Manobra" />
                    <FaunaItem date="15 Abr, 16:20" species="Urubus (Forte Concentração)" local="Setor Final Aproximação" />
                    <FaunaItem date="14 Abr, 08:15" species="Lebrão / Fauna Terrestre" local="Pista de Pouso lateral" />
                    <FaunaItem date="12 Abr, 11:00" species="Aves não identificadas" local="Hangar Principal" />
                 </div>
              </div>
              <div className="card-military bg-military-gold/5 border-military-gold/20">
                 <p className="text-[11px] text-military-gold/80 italic leading-relaxed">
                    O reporte de fauna auxilia o Centro de Investigação e Prevenção de Acidentes Aeronáuticos (CENIPA) a mapear áreas críticas.
                 </p>
              </div>
           </div>
        </div>
    </div>
  );
}

function NormasSection({ onTabChange }: { onTabChange: (tab: SectionKey) => void }) {
  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Biblioteca Normativa CAvEx</h2>
            <p className="text-slate-400 text-sm">Acesso rápido a Portarias, Diretrizes e Manuais.</p>
          </div>
          <div className="relative group">
             <input className="bg-military-gray border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-sm outline-none focus:border-military-gold w-full md:w-80 group-hover:border-slate-500 transition-all" placeholder="Pesquisar por Título ou Código..." />
             <FileText className="absolute left-3 top-3.5 text-slate-500 group-hover:text-military-gold transition-colors" size={18} />
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NormaCard title="R-105: Regras do Ar" category="Doutrina" desc="Normas fundamentais de circulação aérea e padronização de tráfego em aeródromos militares." />
          <NormaCard title="DP-05: Emprego de NVG" category="Operações" desc="Diretrizes para planejamento e execução de missões noturnas com equipamentos de visão." />
          <NormaCard title="MD-32: Manutenção de Campanha" category="Logística" desc="Instruções para manutenção preventiva em áreas isoladas e bases de desdobramento." />
          <NormaCard title="SIPAA-01: Manual de Segurança" category="Prevenção" desc="A bíblia da segurança de voo no 2º BAvEx. Procedimentos, reportes e mitigação." />
          <NormaCard title="CAvEx-PORT: Limites de Vento" category="Técnico" desc="Tabela atualizada de limites de vento para cada modelo de aeronave da frota." />
          <NormaCard title="INS-14: Gerenciamento Tripulação" category="CRM" desc="Protocolos de comunicação e coordenação de cabine para missões multi-tripuladas." />
       </div>
    </div>
  );
}

function PlanejamentoSection({ onTabChange }: { onTabChange: (tab: SectionKey) => void }) {
  return (
    <div className="space-y-8">
       <div>
          <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-tight">Planejamento Operacional</h2>
          <p className="text-slate-400 text-sm italic">Briefing técnico para tripulantes.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 card-military space-y-8">
              <h3 className="font-bold text-white uppercase text-xs tracking-widest border-b border-slate-800 pb-3">Dados da Missão</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FgrField label="Trajeto Principal" placeholder="SBTA -> Setor Charlie -> SBTA" />
                 <FgrField label="Aeródromos de Alternativa" placeholder="SBSP, SBGR, SBJD" />
                 <FgrField label="Frequências de Coordenação" placeholder="122.50 / 123.45" />
                 <FgrField label="Altitude de Cruzeiro (MSL)" placeholder="4500ft" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Obstáculos e Áreas de Atenção Específicas</label>
                 <textarea className="input-military h-40 resize-none font-mono text-xs" placeholder="Descreva NOTAMs de obstáculos, cercas, torres novas ou áreas de conflito detectadas no estudo prévio..."></textarea>
              </div>
           </div>

           <div className="space-y-6">
              <div className="card-military border-military-gold/30 bg-military-gold/5 p-6 h-fit shadow-xl">
                 <h4 className="text-military-gold font-black text-xs mb-6 uppercase tracking-widest flex items-center gap-2">
                    <CheckSquare size={16} /> Checklist Pré-Voo
                 </h4>
                 <ul className="space-y-4">
                    <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                       <CheckSquare size={18} className="text-military-gold shrink-0" />
                       NOTAM local e rota OK
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                       <CheckSquare size={18} className="text-military-gold shrink-0" />
                       Consulta METAR/TAF realizada
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                       <CheckSquare size={18} className="text-military-gold shrink-0" />
                       FGR preenchido e assinado
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                       <CheckSquare size={18} className="text-military-gold shrink-0" />
                       Combustível para missão + Reserva
                    </li>
                    <li className="flex items-center gap-3 text-sm text-slate-200 group cursor-pointer hover:text-military-gold transition-colors">
                       <CheckSquare size={18} className="text-military-gold shrink-0" />
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

function AdminSection({ user, onTabChange, abastecimentoConfig, abastecimentoFiles, launches, setLaunches }: { 
  user: FirebaseUser | null, 
  onTabChange: (tab: SectionKey) => void, 
  abastecimentoConfig?: any, 
  abastecimentoFiles: any[], 
  launches: any[],
  setLaunches: (l: any[]) => void
}) {
  const [stats, setStats] = useState({ relprevs: 0, fgrs: 0, abortivas: 0 });
  const [relprevs, setRelprevs] = useState<any[]>([]);
  const [fgrs, setFgrs] = useState<any[]>([]);
  const [abortivas, setAbortivas] = useState<any[]>([]);
  const [selectedView, setSelectedView] = useState<'stats' | 'relprevs' | 'fgrs' | 'abortivas' | 'config' | 'pdv'>('stats');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteColl, setDeleteColl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<{id: string, name: string, count: number} | null>(null);
  const [dbStatus, setDbStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [lastError, setLastError] = useState<string | null>(null);
  const [editingLaunch, setEditingLaunch] = useState<any | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState("");

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
    setDbStatus('CONNECTING');
    setLastError(null);
    try {
      // Teste de conexão direto
      const testSnap = await getDocs(query(collection(db, 'fgrMissions'), limit(1)));
      console.log("Teste de conexão Firestore: OK", testSnap.size);
      setDbStatus('CONNECTED');
    } catch (err: any) {
      console.error("Erro no teste de conexão:", err);
      setLastError(err.message || String(err));
      setDbStatus('ERROR');
    }
  };

  useEffect(() => {
    // Nota: Removido 'if (!user) return' para permitir visualização em modo local/público
    setDbStatus('CONNECTING');
    const qRelprev = query(collection(db, 'relprevReports'), orderBy('createdAt', 'desc'));
    const qFgr = query(collection(db, 'fgrMissions'), orderBy('createdAt', 'desc'));
    const qAbortivas = query(collection(db, 'abortivas'), orderBy('createdAt', 'desc'));

    const unsubRelprev = onSnapshot(qRelprev, (snap) => {
      setStats(prev => ({ ...prev, relprevs: snap.size }));
      setRelprevs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDbStatus('CONNECTED');
    }, (err) => {
      console.error("Erro no listener de Relprev:", err);
      setLastError(err.message);
      setDbStatus('ERROR');
    });

    const unsubFgr = onSnapshot(qFgr, (snap) => {
      setStats(prev => ({ ...prev, fgrs: snap.size }));
      setFgrs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Erro no listener de FGR:", err);
      setLastError(err.message);
    });

    const unsubAbortivas = onSnapshot(qAbortivas, (snap) => {
      setStats(prev => ({ ...prev, abortivas: snap.size }));
      setAbortivas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Erro no listener de Abortivas:", err);
      setLastError(err.message);
    });

    return () => {
      unsubRelprev();
      unsubFgr();
      unsubAbortivas();
    };
  }, [user]);

  const [selectedRelprev, setSelectedRelprev] = useState<any>(null);
  const [showAnexos, setShowAnexos] = useState(false);

  const handleDeleteBatch = async () => {
    if (!batchDeleteTarget) return;
    const { id: batchIdToDelete } = batchDeleteTarget;
    
    console.log('Iniciando exclusão do lote:', batchIdToDelete);
    try {
      setIsUploading(true);
      const q = query(collection(db, 'Lancamentos'), where('batchId', '==', batchIdToDelete));
      const snap = await getDocs(q);
      
      console.log('Documentos encontrados:', snap.size);
      if (snap.empty) {
        alert('Nenhum registro encontrado para este arquivo no banco de dados.');
        setBatchDeleteTarget(null);
        return;
      }

      const batch = writeBatch(db);
      snap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
      console.log('Exclusão em lote concluída com sucesso');
      setBatchDeleteTarget(null);
      alert('Arquivo e lançamentos excluídos com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir lote:', error);
      alert('Falha ao excluir: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !deleteColl) return;
    
    try {
      await deleteDoc(doc(db, deleteColl, deleteId));
      setDeleteId(null);
      setDeleteColl(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir registro. Verifique a conexão.');
    }
  };

  const handleSaveManualLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const data = {
      num: formData.get('num') as string,
      anv: formData.get('anv') as string,
      p1: formData.get('p1') as string,
      p2: formData.get('p2') as string,
      mv: formData.get('mv') as string,
      missao: formData.get('missao') as string,
      dest: formData.get('dest') as string,
      eobt: formData.get('eobt') as string,
      dateLabel: formData.get('dateLabel') as string,
      createdAt: editingLaunch?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      manual: true
    };

    try {
      if (editingLaunch) {
        await updateDoc(doc(db, 'Lancamentos', editingLaunch.id), data);
        alert('Lançamento atualizado com sucesso.');
      } else {
        await addDoc(collection(db, 'Lancamentos'), {
          ...data,
          batchId: 'MANUAL',
          batchName: 'Lançamentos Manuais'
        });
        alert('Lançamento manual criado com sucesso.');
      }
      setIsManualModalOpen(false);
      setEditingLaunch(null);
    } catch (err: any) {
      alert('Erro ao salvar lançamento: ' + err.message);
    }
  };

  const handleDeleteAllAbortivas = async () => {
    if (abortivas.length === 0) return;
    if (!window.confirm(`ATENÇÃO: Você está prestes a apagar permanentEMENTE ${abortivas.length} registros de abortivas. Confirmar?`)) return;

    setDbStatus('CONNECTING');
    try {
      const batch = writeBatch(db);
      abortivas.forEach(a => {
        batch.delete(doc(db, 'abortivas', a.id));
      });
      await batch.commit();
      alert('Todas as abortivas foram excluídas com sucesso.');
    } catch (error: any) {
      console.error('Erro ao excluir todas as abortivas:', error);
      alert('Erro ao excluir: ' + (error.message || 'Erro de conexão'));
    } finally {
      setDbStatus('CONNECTED');
    }
  };

  const confirmDelete = (collectionName: string, id: string) => {
    setDeleteId(id);
    setDeleteColl(collectionName);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Por favor, selecione apenas arquivos PDF.');
        return;
      }
      await handleAbastecimentoUpload(file);
      // Reset input to allow re-selection of the same file
      e.target.value = '';
    }
  };

  const handleAbastecimentoUpload = async (fileToUpload: File) => {
    if (isUploading) return;
    setIsUploading(true);
    
    try {
      // 1. Upload to Storage
      const path = `config/abastecimento/guia_${Date.now()}_${fileToUpload.name.replace(/\D/g, '')}.pdf`;
      console.log('--- INICIANDO PROCESSO DE UPLOAD ---');
      console.log('Arquivo:', fileToUpload.name, 'Tamanho:', fileToUpload.size);
      console.log('User:', auth.currentUser?.email);
      console.log('Caminho no Storage:', path);
      
      const storageRef = ref(storage, path);
      let url = '';

      try {
        console.log('Passo 1: Chamando uploadBytes...');
        // O uploadBytes simples é mais estável em ambientes de iframe/proxy
        const snapshot = await uploadBytes(storageRef, fileToUpload, {
          contentType: 'application/pdf'
        });
        console.log('Passo 1 Concluído: Snapshot recebido', snapshot.metadata.fullPath);
        
        console.log('Passo 2: Obtendo URL de download...');
        url = await getDownloadURL(snapshot.ref);
        console.log('Passo 2 Concluído: URL obtida', url);
      } catch (err: any) {
        console.error('ERRO NO STORAGE:', err);
        throw new Error(`Erro ao enviar arquivo para o Google Storage: ${err.message || err.code}`);
      }
      
      // 2. Update Config
      try {
        console.log('Passo 3: Salvando configuração no Firestore...');
        await setDoc(doc(db, 'config', 'abastecimento'), {
          url,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser.email || auth.currentUser.uid || 'Admin',
          fileName: fileToUpload.name
        });
        console.log('Passo 3 Concluído.');
      } catch (err: any) {
        console.error('ERRO NO FIRESTORE (Config):', err);
        throw new Error(`Erro ao atualizar banco de dados (Config): ${err.message}`);
      }

      // 3. Add to Collection
      try {
        console.log('Passo 4: Adicionando ao acervo de arquivos (documentos_abastecimento)...');
        await addDoc(collection(db, 'documentos_abastecimento'), {
          name: fileToUpload.name,
          url,
          size: fileToUpload.size,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser.email || auth.currentUser.uid || 'Admin'
        });
        console.log('Passo 4 Concluído. Upload finalizado com sucesso!');
      } catch (err: any) {
        console.error('ERRO NO FIRESTORE (Coleção):', err);
        throw new Error(`Erro ao salvar no histórico do acervo: ${err.message}`);
      }
      
      alert('Arquivo enviado com sucesso!');
    } catch (error: any) {
      console.error('Erro total:', error);
      alert(error.message || 'Erro desconhecido durante o processo.');
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
               <h2 className="text-xl md:text-2xl font-black text-white leading-tight">Painel Administrativo</h2>
               <p className="text-military-gold text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5">SIPAA 2º BAvEx — Gestão Centralizada</p>
             </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 px-3 py-1.5 bg-military-black border border-border-theme rounded-sm">
               <div className="hidden sm:flex flex-col">
                 <span className="text-[7px] uppercase text-slate-500 font-bold">DB ID</span>
                 <span className="text-[9px] text-slate-400 font-mono">{(db as any)._databaseId?.database || 'default'}</span>
               </div>
               <div className="flex flex-col items-end">
                 <span className="text-[7px] uppercase text-slate-500 font-bold">Conexão</span>
                 <div className="flex items-center gap-1.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${
                     dbStatus === 'CONNECTED' ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 
                     dbStatus === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'
                   }`} />
                   <span className={`text-[9px] font-black uppercase ${
                     dbStatus === 'CONNECTED' ? 'text-green-500' : 
                     dbStatus === 'ERROR' ? 'text-red-500' : 'text-yellow-500'
                   }`}>{dbStatus}</span>
                 </div>
               </div>
               <button 
                 onClick={fetchManual}
                 className="p-1 px-2 hover:bg-white/5 rounded-sm text-military-gold transition-colors"
               >
                 <History size={12} className={dbStatus === 'CONNECTING' ? 'animate-spin' : ''} />
               </button>
            </div>
          </div>
       </div>

       <div className="flex gap-1 bg-military-black/50 p-1 rounded-lg border border-white/5 overflow-x-auto no-scrollbar mb-8">
              <button 
                onClick={() => setSelectedView('stats')}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === 'stats' ? 'bg-military-gold text-military-black' : 'text-slate-400 hover:text-white'}`}
              >
                Dashboard
              </button>
            <button 
              onClick={() => setSelectedView('relprevs')}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === 'relprevs' ? 'bg-military-gold text-military-black' : 'text-slate-400 hover:text-white'}`}
            >
              Relatos
            </button>
            <button 
              onClick={() => setSelectedView('fgrs')}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === 'fgrs' ? 'bg-military-gold text-military-black' : 'text-slate-400 hover:text-white'}`}
            >
              FGR
            </button>
            <button 
              onClick={() => setSelectedView('abortivas')}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === 'abortivas' ? 'bg-military-gold text-military-black' : 'text-slate-400 hover:text-white'}`}
            >
              Abortivas
            </button>
            <button 
              onClick={() => setSelectedView('config')}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === 'config' ? 'bg-military-gold text-military-black' : 'text-slate-400 hover:text-white'}`}
            >
              Configurações
            </button>
            <button 
              onClick={() => setSelectedView('pdv')}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${selectedView === 'pdv' ? 'bg-military-gold text-military-black' : 'text-slate-400 hover:text-white'}`}
            >
              Extrator PDV
            </button>
          </div>

       {lastError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-4 text-left">
          <AlertCircle className="text-red-500 shrink-0" />
          <div>
            <p className="text-xs font-black text-red-500 uppercase tracking-widest">Erro de Sincronização Detectado</p>
            <p className="text-[11px] text-red-200/70 font-mono mt-1">{lastError}</p>
            <button 
              onClick={() => { setLastError(null); fetchManual(); }}
              className="mt-2 text-[10px] font-bold text-red-400 underline uppercase"
            >
              Tentar Restaurar Conexão
            </button>
          </div>
        </div>
      )}

      {selectedView === 'stats' && (
         <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <AdminStat label="Relatos" value={stats.relprevs.toString()} trend="TOTAL" />
              <AdminStat label="Abortivas" value={stats.abortivas.toString()} trend="TOTAL" />
              <AdminStat label="FGR" value={stats.fgrs.toString()} trend="TOTAL" />
              <AdminStat label="Mapa" value="ATIVO" trend="ATUALIZADO" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
            <div className="lg:col-span-2 card-military p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-8 border-b border-slate-800 pb-4">
                  <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Ações Rápidas</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <AdminAction title="Relatórios de Frota" onClick={() => setSelectedView('relprevs')} desc="Visão geral de incidentes por modelo." icon={ShieldCheck} />
                  <AdminAction title="FGR" onClick={() => setSelectedView('fgrs')} desc="Auditoria de gerenciamento de risco." icon={FileText} />
                  <AdminAction title="Relatos de Abortiva" onClick={() => setSelectedView('abortivas')} desc="Auditoria de interrupções de voo." icon={Zap} />
                </div>
            </div>
            
            <div className="card-military bg-military-blue/10 border-military-blue/20 p-4 md:p-6">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Log de Atividades</h3>
                <div className="space-y-3 md:space-y-4">
                  <ActivityItem time="Agora" user="Admin" action="Acesso ao Painel SIPAA" />
                  <ActivityItem time="Recente" user="Sistema" action="Dados sincronizados" />
                </div>
            </div>
          </div>
         </div>
       )}

        {selectedView === 'relprevs' && (
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
                    {relprevs.map(r => (
                      <tr key={r.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3 font-mono">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-military-gold font-bold">{r.codigo}</td>
                        <td className="px-4 py-3 text-white truncate max-w-[200px]">{r.situacao}</td>
                        <td className="px-4 py-3 text-text-secondary">{r.relatorNome || 'Anônimo'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              onClick={() => {
                                const doc = generateRelprevPDF(r);
                                window.open(doc.output('bloburl'), '_blank');
                              }}
                              className="text-military-gold hover:text-white flex items-center gap-1.5 p-1"
                            >
                              <FileText size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">PDF</span>
                            </button>
                            <button 
                              onClick={() => { setSelectedRelprev(r); setShowAnexos(true); }} 
                              className="text-slate-400 hover:text-white flex items-center gap-1.5 p-1"
                            >
                              <Eye size={14} />
                              <span className="text-[10px] uppercase font-black">Anexos</span>
                            </button>
                            <button onClick={() => confirmDelete('relprevReports', r.id)} className="text-red-400 hover:text-red-300 p-1">
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
              {relprevs.map(r => (
                <div key={r.id} className="card-military p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-military-gold font-mono font-black text-xs leading-none">{r.codigo}</span>
                      <span className="text-[9px] text-text-secondary">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-white font-bold text-sm leading-tight mb-2 line-clamp-2">{r.situacao}</h4>
                    <div className="text-[9px] text-text-secondary uppercase font-bold tracking-widest truncate">
                      Rel: <span className="text-slate-300">{r.relatorNome || 'Anônimo'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                    <button 
                     onClick={() => {
                        const doc = generateRelprevPDF(r);
                        window.open(doc.output('bloburl'), '_blank');
                     }} 
                     className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-military-gold/10 text-military-gold text-[10px] font-black uppercase tracking-wider border border-military-gold/20"
                    >
                      <FileText size={14} /> PDF
                    </button>
                    <button 
                     onClick={() => { setSelectedRelprev(r); setShowAnexos(true); }} 
                     className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider border border-white/5"
                    >
                      <Eye size={14} /> Anexos
                    </button>
                    <button 
                     onClick={() => confirmDelete('relprevReports', r.id)} 
                     className="w-10 h-9 flex items-center justify-center rounded bg-red-500/10 text-red-500 border border-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {relprevs.length === 0 && (
              <div className="card-military py-12 text-center opacity-40 italic text-sm">Nenhum relato encontrado.</div>
            )}
          </div>
        )}

       {selectedView === 'fgrs' && (
         <div className="space-y-4">
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
                     <th className="px-4 py-3 text-right font-black tracking-widest text-military-gold">PDF / AÇÕES</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border-theme/30 text-[11px]">
                   {fgrs.map(f => (
                     <tr key={f.id} className="hover:bg-white/2 transition-colors">
                       <td className="px-4 py-3 font-mono">{new Date(f.createdAt).toLocaleDateString()}</td>
                       <td className="px-4 py-3 text-white font-bold">{f.missao}</td>
                       <td className="px-4 py-3 text-text-secondary uppercase">{f.aeronave} | {f.relatorName || 'Conv.'}</td>
                       <td className="px-4 py-3">
                         <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest ${
                           f.scores.riskMax > 100 ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'
                         }`}>
                           {f.scores.riskMax} pts
                         </span>
                       </td>
                       <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                         <button 
                           onClick={() => {
                             if (f.pdfUrl) {
                               window.open(f.pdfUrl, '_blank');
                             } else {
                               const docPdf = generateFgrPDF(f);
                               const fgrBlob = docPdf.output('blob');
                               const fgrUrl = URL.createObjectURL(fgrBlob);
                               window.open(fgrUrl, '_blank');
                             }
                           }}
                           className="text-military-gold hover:text-white flex items-center gap-1.5 p-1"
                         >
                           <Eye size={14} />
                           <span className="text-[10px] uppercase font-black">{f.pdfUrl ? 'Ver PDF' : 'Gerar'}</span>
                         </button>
                         <button 
                           onClick={() => {
                             const docPdf = generateFgrPDF(f);
                             docPdf.save(`FGR_${f.missao || 'Voo'}.pdf`);
                           }}
                           className="text-slate-200 hover:text-white flex items-center gap-1.5 p-1"
                           title="Baixar PDF Original"
                         >
                           <Download size={14} />
                           <span className="text-[10px] uppercase font-black">Baixar</span>
                         </button>
                         <button onClick={() => confirmDelete('fgrMissions', f.id)} className="text-red-400 hover:text-red-300 p-1">
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
             {fgrs.map(f => (
               <div key={f.id} className="card-military p-4 space-y-3 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-white font-black text-xs uppercase tracking-tight truncate">{f.missao}</span>
                     <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter shrink-0 ${
                       f.scores.riskMax > 100 ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'
                     }`}>
                       {f.scores.riskMax} PTS
                     </span>
                   </div>
                   <div className="text-[10px] text-text-secondary uppercase font-bold tracking-tight grid grid-cols-2 gap-2 mb-1">
                     <div className="truncate">Av: <span className="text-slate-300">{f.aeronave}</span></div>
                     <div className="text-right">{new Date(f.createdAt).toLocaleDateString()}</div>
                   </div>
                   <div className="text-[10px] text-text-secondary uppercase font-bold tracking-tight truncate">
                     Rel: <span className="text-slate-300">{f.relatorName || 'Conv.'}</span>
                   </div>
                 </div>
                 <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                   <button 
                     onClick={() => {
                       const doc = generateFgrPDF(f);
                       window.open(doc.output('bloburl'), '_blank');
                     }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-military-gold/10 text-military-gold text-[10px] font-black uppercase tracking-wider border border-military-gold/20"
                    >
                      <FileText size={14} /> PDF
                    </button>
                    <button 
                     onClick={() => confirmDelete('fgrMissions', f.id)} 
                     className="w-10 h-9 flex items-center justify-center rounded bg-red-500/10 text-red-500 border border-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {fgrs.length === 0 && (
              <div className="card-military py-12 text-center opacity-40 italic text-sm">Nenhuma missão encontrada.</div>
            )}
          </div>
        )}

       {selectedView === 'abortivas' && (
         <div className="space-y-4">
           {/* Header with Clear All Button */}
           <div className="flex justify-between items-center mb-2 px-2">
             <h3 className="text-xs font-black text-white uppercase tracking-widest">Acervo de Abortivas</h3>
             {abortivas.length > 0 && (
               <button 
                 onClick={handleDeleteAllAbortivas}
                 className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-tighter hover:bg-red-500 hover:text-white transition-all"
               >
                 <Trash2 size={12} /> Limpar Acervo ({abortivas.length})
               </button>
             )}
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
                     <th className="px-4 py-3 text-right font-black tracking-widest text-military-gold">AÇÕES</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border-theme/30 text-[11px]">
                   {abortivas.map(a => (
                     <tr key={a.id} className="hover:bg-white/2 transition-colors">
                       <td className="px-4 py-3 font-mono">{new Date(a.createdAt).toLocaleDateString()}</td>
                       <td className="px-4 py-3 text-white font-bold">{a.numLancamento}</td>
                       <td className="px-4 py-3 text-text-secondary uppercase">{a.modeloAnv} | {a.preenchidoPor}</td>
                       <td className="px-4 py-3">
                         <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest bg-orange-500/20 text-orange-500">
                           {a.motivo}
                         </span>
                       </td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                          <button 
                            onClick={() => {
                              if (a.pdfUrl) {
                                window.open(a.pdfUrl, '_blank');
                              } else {
                                const docPdf = generateAbortivaPDF(a);
                                const abBlobAdmin = docPdf.output('blob');
                                const abUrlAdmin = URL.createObjectURL(abBlobAdmin);
                                window.open(abUrlAdmin, '_blank');
                              }
                            }}
                            className="text-military-gold hover:text-white flex items-center gap-1.5 p-1"
                          >
                            <Eye size={14} />
                            <span className="text-[10px] uppercase font-black">{a.pdfUrl ? 'Ver PDF' : 'Gerar'}</span>
                          </button>
                          <button 
                            onClick={() => {
                              const docPdf = generateAbortivaPDF(a);
                              docPdf.save(`Abortiva_${a.numLancamento || 'Lanç'}.pdf`);
                            }}
                            className="text-slate-200 hover:text-white flex items-center gap-1.5 p-1"
                            title="Baixar PDF Original"
                          >
                            <Download size={14} />
                            <span className="text-[10px] uppercase font-black">Baixar</span>
                          </button>
                          <button onClick={() => confirmDelete('abortivas', a.id)} className="text-red-400 hover:text-red-300 p-1">
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
             {abortivas.map(a => (
               <div key={a.id} className="card-military p-4 space-y-3 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-white font-black text-xs uppercase tracking-tight truncate">Lç {a.numLancamento}</span>
                     <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter shrink-0 bg-orange-500/20 text-orange-500">
                       {a.motivo}
                     </span>
                   </div>
                   <div className="text-[10px] text-text-secondary uppercase font-bold tracking-tight grid grid-cols-2 gap-2 mb-1">
                     <div className="truncate">Mod: <span className="text-slate-300">{a.modeloAnv}</span></div>
                     <div className="text-right">{new Date(a.createdAt).toLocaleDateString()}</div>
                   </div>
                 </div>
                 <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                   <button 
                     onClick={() => {
                        if (a.pdfUrl) {
                          window.open(a.pdfUrl, '_blank');
                        } else {
                           const docPdf = generateAbortivaPDF(a);
                           const abBlobMob = docPdf.output('blob');
                           const abUrlMob = URL.createObjectURL(abBlobMob);
                           window.open(abUrlMob, '_blank');
                         }
                     }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-military-gold/10 text-military-gold text-[10px] font-black uppercase tracking-wider border border-military-gold/20"
                    >
                      <Eye size={14} /> {a.pdfUrl ? 'VER PDF' : 'VER'}
                    </button>
                    <button 
                     onClick={() => {
                       const docPdf = generateAbortivaPDF(a);
                       docPdf.save(`Abortiva_${a.numLancamento}.pdf`);
                     }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-white/5 text-slate-300 text-[10px] font-black uppercase tracking-wider border border-white/10"
                    >
                      <Download size={14} /> BAIXAR
                    </button>
                    <button 
                     onClick={() => confirmDelete('abortivas', a.id)} 
                     className="w-10 h-9 flex items-center justify-center rounded bg-red-500/10 text-red-500 border border-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
             ))}
           </div>

           {abortivas.length === 0 && (
             <div className="card-military py-12 text-center opacity-40 italic text-sm">Nenhum relato de abortiva encontrado.</div>
           )}
         </div>
       )}

        {selectedView === 'config' && (
          <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="card-military p-6">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="text-military-gold" size={20} />
                <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Configurações de Documentos</h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-military-gold/5 border border-military-gold/20 rounded-lg text-left">
                  <h4 className="text-xs font-bold text-military-gold uppercase mb-2 tracking-tight">Guia de Abastecimento</h4>
                  <p className="text-[10px] text-slate-400 mb-6 uppercase leading-relaxed">
                    Substitua o arquivo PDF padrão. Quando um arquivo for enviado aqui, ele terá prioridade e será aberto automaticamente quando o usuário clicar em "Abastecimento".
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden" 
                      id="abastecimento-upload" 
                      disabled={isUploading}
                    />
                    <label 
                      htmlFor="abastecimento-upload"
                      className={`btn-military py-3 px-8 text-[10px] cursor-pointer inline-flex items-center gap-3 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={16} className="text-military-gold animate-spin" />
                          <span className="animate-pulse">PROCESSANDO...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={16} className="text-military-gold" />
                          Escolher e Enviar PDF
                        </>
                      )}
                    </label>
                  </div>
                  
                  {abastecimentoConfig?.updatedAt && (
                    <div className="mt-6 pt-4 border-t border-military-gold/10">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                        Última atualização: <span className="text-slate-300 font-bold">{new Date(abastecimentoConfig.updatedAt).toLocaleString()}</span> {abastecimentoConfig.fileName && <>• <span className="text-white font-mono">{abastecimentoConfig.fileName}</span></>} por <span className="text-military-gold font-bold">{abastecimentoConfig.updatedBy || 'Mestre/SIPAA'}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-lg mt-4 text-left">
                  <h4 className="text-xs font-bold text-white uppercase mb-4 tracking-tight flex items-center gap-2">
                    <Droplets size={14} className="text-military-gold" />
                    Arquivos no Acervo ({abastecimentoFiles.length})
                  </h4>
                  
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {abastecimentoFiles.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic uppercase py-4">Nenhum arquivo no acervo.</p>
                    ) : (
                      abastecimentoFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-military-black/30 border border-white/5 rounded hover:border-military-gold/30 transition-all group">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText size={16} className="text-military-gold shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10px] text-white font-bold truncate uppercase">{file.name}</span>
                              <span className="text-[8px] text-slate-500 uppercase">
                                {new Date(file.createdAt).toLocaleDateString()} • {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => window.open(file.url, '_blank')}
                              className="p-1.5 text-slate-400 hover:text-military-gold transition-colors"
                              title="Visualizar"
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              onClick={() => confirmDelete('documentos_abastecimento', file.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-military p-6 border-blue-500/10 bg-blue-500/5 text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-400 shrink-0" size={18} />
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-relaxed">
                  Aviso: Certifique-se de que o arquivo está no formato PDF e não está corrompido antes do envio. O upload de arquivos grandes pode levar alguns segundos dependendo da conexão.
                </p>
              </div>
            </div>

            <div className="card-military p-6 text-left">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Zap className="text-military-gold" size={20} />
                  <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Abortivas Recebidas</h3>
                </div>
                <button 
                  onClick={() => setSelectedView('abortivas')}
                  className="text-[9px] font-black text-military-gold uppercase tracking-[0.2em] hover:text-white transition-colors"
                >
                  Ver Lista Completa →
                </button>
              </div>

              <div className="space-y-3">
                {abortivas.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-military-black/30 border border-white/5 rounded">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText size={16} className="text-military-gold shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-white font-bold truncate uppercase">{a.modeloAnv} | LÇ {a.numLancamento}</span>
                        <span className="text-[8px] text-slate-500 uppercase">{new Date(a.createdAt).toLocaleDateString()} • {a.motivo}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (a.pdfUrl) {
                          window.open(a.pdfUrl, '_blank');
                        } else {
                          const docPdf = generateAbortivaPDF(a);
                          docPdf.save(`Abortiva_${a.numLancamento}.pdf`);
                        }
                      }}
                      className="p-1.5 text-military-gold hover:text-white transition-colors"
                      title={a.pdfUrl ? "Abrir PDF Oficial" : "Baixar PDF"}
                    >
                      {a.pdfUrl ? <ExternalLink size={14} /> : <Download size={14} />}
                    </button>
                  </div>
                ))}
                {abortivas.length === 0 && (
                  <p className="text-[10px] text-slate-500 italic uppercase py-4">Nenhuma abortiva registrada.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedView === 'pdv' && (
          <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="card-military p-6 text-left">
              <div className="flex items-center gap-3 mb-6">
                <FileSearch className="text-military-gold" size={20} />
                <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Extrator de PDV para FGR</h3>
              </div>
              
              <div className="p-4 bg-military-gold/5 border border-military-gold/20 rounded-lg">
                <h4 className="text-xs font-bold text-military-gold uppercase mb-2 tracking-tight">Upload do Plano Diário de Voo</h4>
                <p className="text-[10px] text-slate-400 mb-6 uppercase leading-relaxed">
                  Carregue o PDF do PDV. O sistema extrairá os lançamentos e os tornará disponíveis para auto-preenchimento no formulário FGR.
                </p>
                
                <div className="flex items-center gap-4">
                  <input 
                    type="file" 
                    accept=".pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploading(true);
                      try {
                        const text = await extractTextFromPdf(file);
                        const days = parsePDV(text);
                        let count = 0;
                        const batchId = `PDV_${Date.now()}`;
                        for (const day of days) {
                          for (const launch of day.launches) {
                            await addDoc(collection(db, 'Lancamentos'), {
                              ...launch,
                              dateLabel: day.dateLabel,
                              createdAt: new Date().toISOString(),
                              batchId,
                              batchName: file.name
                            });
                            count++;
                          }
                        }
                        alert(`${count} lançamentos processados e salvos com sucesso.`);
                      } catch (err: any) {
                        alert("Erro ao processar PDV: " + err.message);
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                    className="hidden" 
                    id="pdv-upload" 
                    disabled={isUploading}
                  />
                  <label 
                    htmlFor="pdv-upload"
                    className={`btn-military py-3 px-8 text-[10px] cursor-pointer inline-flex items-center gap-3 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                  >
                    {isUploading ? <Loader2 size={16} className="text-military-gold animate-spin" /> : <Plus size={16} className="text-military-gold" />}
                    <span className={isUploading ? "animate-pulse" : ""}>{isUploading ? "PROCESSANDO..." : "CARREGAR PDV (PDF)"}</span>
                  </label>

                  <button 
                    onClick={() => {
                      setEditingLaunch(null);
                      setManualDate("");
                      setIsManualModalOpen(true);
                    }}
                    className="btn-military py-3 px-8 text-[10px] inline-flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus size={16} className="text-military-black" />
                    <span className="font-black text-military-black">LANÇAMENTO MANUAL</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="card-military p-6 text-left">
              <h4 className="text-xs font-bold text-white uppercase mb-4 tracking-tight flex items-center gap-2">
                <FileText size={14} className="text-military-gold" />
                Arquivos Processados
              </h4>
              <div className="space-y-3">
                {(() => {
                  const batches = Object.values(launches.reduce((acc: any, curr: any) => {
                    if (!curr.batchId) return acc;
                    if (!acc[curr.batchId]) {
                      acc[curr.batchId] = {
                        id: curr.batchId,
                        name: curr.batchName || 'Sem Nome',
                        count: 0,
                        date: curr.createdAt || new Date().toISOString()
                      };
                    }
                    acc[curr.batchId].count++;
                    return acc;
                  }, {}));

                  return batches.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic uppercase">Nenhum arquivo processado.</p>
                  ) : (
                    batches.sort((a: any, b: any) => b.date.localeCompare(a.date)).map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-military-black/30 border border-white/5 rounded hover:border-red-500/30 transition-all group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileSearch size={16} className="text-military-gold shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-white font-bold truncate uppercase">{b.name}</span>
                            <span className="text-[8px] text-slate-500 uppercase">
                              {b.count} lançamentos • {new Date(b.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setBatchDeleteTarget({ id: b.id, name: b.name, count: b.count })}
                          className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                          title="Excluir Lote"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  );
                })()}
              </div>
            </div>

            <div className="card-military p-6 text-left">
              <h4 className="text-xs font-bold text-white uppercase mb-4 tracking-tight flex items-center gap-2">
                <History size={14} className="text-military-gold" />
                Lançamentos Disponíveis ({launches.length})
              </h4>
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {launches.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic uppercase">Nenhum lançamento importado.</p>
                ) : (
                  Object.entries(launches.reduce((acc: any, curr: any) => {
                    const groupKey = curr.dateLabel || 'Sem Data';
                    if (!acc[groupKey]) acc[groupKey] = [];
                    acc[groupKey].push(curr);
                    return acc;
                  }, {})).sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]: [string, any]) => (
                    <div key={date} className="space-y-2">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-1">
                        <Calendar size={12} className="text-military-gold" />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">DATA: {date}</span>
                        <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-500 ml-auto">{items.length} LANÇAMENTOS</span>
                      </div>
                      <div className="grid gap-1.5">
                        {items.sort((a: any, b: any) => a.num.localeCompare(b.num)).map((l: any) => {
                          const launchDateISO = l.dateLabel ? l.dateLabel.split('/').reverse().join('-') : '';
                          const hasFgr = fgrs.some(f => f.data === launchDateISO && (f.missao?.includes(`LÇ ${l.num}`) || f.missao?.includes(`LANC ${l.num}`)));
                          const hasAbortiva = abortivas.some(a => a.dataVoo === launchDateISO && a.numLancamento === l.num);

                          return (
                            <div key={l.id} className="flex items-center justify-between p-2.5 bg-white/2 border border-white/5 rounded hover:border-military-gold/20 transition-all group overflow-hidden">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {hasFgr && (
                                    <span className="flex items-center gap-0.5 text-[8px] font-black bg-green-500/20 text-green-500 border border-green-500/30 px-1 py-0.5 rounded uppercase tracking-tighter">
                                      FGR
                                    </span>
                                  )}
                                  {hasAbortiva && (
                                    <span className="flex items-center gap-0.5 text-[8px] font-black bg-green-500/20 text-green-500 border border-green-500/30 px-1 py-0.5 rounded uppercase tracking-tighter">
                                      Abortiva
                                    </span>
                                  )}
                                  <span className="text-[10px] font-black text-accent-gold whitespace-nowrap uppercase tracking-tighter">Lç {l.num}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                                  <span className="text-[10px] text-white font-black whitespace-nowrap uppercase tracking-tighter">{l.anv}</span>
                                  <span className="text-[10px] text-slate-400 truncate uppercase tracking-tighter font-medium">
                                    {l.p1} - {l.p2} - {l.mv} - {l.dest} - {l.missao}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
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
                                    if (window.confirm('Excluir este lançamento?')) {
                                      deleteDoc(doc(db, 'Lancamentos', l.id));
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
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Excluir Lote Inteiro?</h3>
                  <div className="p-3 bg-red-500/5 rounded border border-red-500/10">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Arquivo Selecionado:</p>
                    <p className="text-xs text-military-gold font-black truncate">"{batchDeleteTarget.name}"</p>
                    <p className="text-[10px] text-slate-500 mt-2">Contém {batchDeleteTarget.count} lançamentos</p>
                  </div>
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest bg-red-500/10 py-2 rounded">Esta ação removerá tudo permanentemente</p>
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
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {isUploading ? 'EXCLUINDO...' : 'SIM, EXCLUIR'}
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
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Confirmar Exclusão</h3>
                  <p className="text-xs text-text-secondary">Deseja realmente apagar este registro? Esta ação não pode ser desfeita.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setDeleteId(null); setDeleteColl(null); }}
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
                    <span className="text-[10px] font-mono text-military-gold uppercase tracking-[0.2em]">RELPREV #{selectedRelprev.codigo}</span>
                    <h3 className="text-xl font-black text-white">Anexos do Relato</h3>
                  </div>
                  <button onClick={() => { setSelectedRelprev(null); setShowAnexos(false); }} className="text-text-secondary hover:text-white border border-white/10 rounded p-1">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  {((selectedRelprev.images && selectedRelprev.images.length > 0) || (selectedRelprev.extraFiles && selectedRelprev.extraFiles.length > 0)) ? (
                    <div className="space-y-6">
                      {selectedRelprev.images && selectedRelprev.images.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] uppercase font-black text-military-gold tracking-widest">Fotos Anexadas</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {selectedRelprev.images.map((img: string, i: number) => (
                              <button 
                                key={i} 
                                onClick={() => openBase64InNewTab(img)} 
                                className="block group relative overflow-hidden rounded border border-white/10 hover:border-accent-gold transition-colors aspect-square"
                              >
                                <img src={img} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Anexo" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Search size={18} className="text-white" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {selectedRelprev.extraFiles && selectedRelprev.extraFiles.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] uppercase font-black text-military-gold tracking-widest">Documentos Extras</span>
                          <div className="space-y-2">
                            {selectedRelprev.extraFiles.map((file: string, i: number) => (
                              <button 
                                key={i} 
                                onClick={() => openBase64InNewTab(file)}
                                className="w-full flex items-center gap-3 p-4 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-[10px] text-white font-bold uppercase text-left"
                              >
                                <FileText size={18} className="text-military-gold" />
                                <span>Download Arquivo Anexo {i + 1}</span>
                              </button>
                            ))}
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
                      window.open(doc.output('bloburl'), '_blank');
                    }}
                    className="flex-1 btn-military py-4 flex items-center justify-center gap-2"
                   >
                     <FileText size={16} /> VER DADOS COMPLETOS (PDF)
                   </button>
                   <button 
                    onClick={() => { setSelectedRelprev(null); setShowAnexos(false); }}
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
                     {editingLaunch ? 'Editar Lançamento' : 'Novo Lançamento Manual'}
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

               <form onSubmit={handleSaveManualLaunch} className="grid grid-cols-2 gap-4">
                 <div className="col-span-2 space-y-1.5">
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Data (DD/MM/AAAA)</label>
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
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Número Lançamento</label>
                   <input 
                     name="num" 
                     required
                     placeholder="Ex: 45"
                     defaultValue={editingLaunch?.num || ''}
                     className="input-military w-full h-11"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Aeronave (Prefixo)</label>
                   <input 
                     name="anv" 
                     required
                     placeholder="Ex: HM-1A 4022"
                     defaultValue={editingLaunch?.anv || ''}
                     className="input-military w-full h-11"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">1P</label>
                   <input 
                     name="p1" 
                     required
                     placeholder="Posto Nome"
                     defaultValue={editingLaunch?.p1 || ''}
                     className="input-military w-full h-11"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">2P</label>
                   <input 
                     name="p2" 
                     required
                     placeholder="Posto Nome"
                     defaultValue={editingLaunch?.p2 || ''}
                     className="input-military w-full h-11"
                   />
                 </div>

                 <div className="col-span-2 space-y-1.5">
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">MV (Mecânicos de Voo)</label>
                   <input 
                     name="mv" 
                     placeholder="Ex: SGT NOME / SGT NOME"
                     defaultValue={editingLaunch?.mv || '---'}
                     className="input-military w-full h-11"
                   />
                 </div>

                 <div className="col-span-2 space-y-1.5">
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Missão</label>
                   <input 
                     name="missao" 
                     placeholder="Ex: TREINAMENTO / TRANSPORTE"
                     defaultValue={editingLaunch?.missao || '---'}
                     className="input-military w-full h-11"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">Destino</label>
                   <input 
                     name="dest" 
                     placeholder="Ex: SBTA"
                     defaultValue={editingLaunch?.dest || '---'}
                     className="input-military w-full h-11"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-military-gold uppercase tracking-widest pl-1">EOBT (Hora Saída)</label>
                   <input 
                     name="eobt" 
                     placeholder="Ex: 09H30"
                     defaultValue={editingLaunch?.eobt || '---'}
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
                     {editingLaunch ? 'SALVAR ALTERAÇÕES' : 'CRIAR LANÇAMENTO'}
                   </button>
                 </div>
               </form>
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
    gold: 'bg-accent-gold/10 border-accent-gold/30 text-accent-gold',
    blue: 'bg-accent-blue/10 border-accent-blue/30 text-white',
    slate: 'bg-slate-800/50 border-border-theme text-text-secondary'
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
    danger: 'text-red-500 bg-red-500/10 border-red-500/20',
    warning: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
  };
  return (
    <div className={`p-3 rounded border text-sm ${colors[type]}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold uppercase tracking-tight text-[11px]">{title}</span>
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
          <span className="text-[9px] font-bold text-military-gold bg-military-gold/10 px-2 py-0.5 rounded uppercase">{date}</span>
          <h4 className="text-sm font-bold text-slate-200">{title}</h4>
        </div>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{text}</p>
     </div>
  );
}

function FgrField({ label, placeholder, type = "text", defaultValue }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-tight">{label}</label>
      <input type={type} defaultValue={defaultValue} className="input-military text-sm" placeholder={placeholder} />
    </div>
  );
}

function FgrRow({ title, items }: any) {
  return (
    <div className="card-military">
      <h4 className="text-xs font-bold text-white mb-4 uppercase">{title}</h4>
      <div className="space-y-2">
        {items.map((item: any) => (
          <label key={item.label} className="flex items-center justify-between p-3 bg-military-black border border-slate-800 rounded-lg cursor-pointer hover:border-slate-500 transition-colors">
            <div className="flex items-center gap-3">
              <input type="radio" name={title} className="accent-military-gold" />
              <span className="text-xs text-slate-300 font-medium">{item.label}</span>
            </div>
            <span className="text-military-gold font-mono font-bold">+{item.value}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function RiscoCard({ title, area, desc, mitig, type }: any) {
  const colors: any = {
    critical: 'border-red-500/40 border-t-4 border-t-red-500',
    warning: 'border-yellow-500/40 border-t-4 border-t-yellow-500',
    info: 'border-blue-500/40 border-t-4 border-t-blue-500'
  };
  return (
    <div className={`card-military h-full flex flex-col ${colors[type]}`}>
       <div className="mb-4">
          <span className="text-[10px] font-bold uppercase text-slate-500">{area}</span>
          <h3 className="text-lg font-bold text-white">{title}</h3>
       </div>
       <p className="text-xs text-slate-400 leading-relaxed mb-6 flex-1 italic">{desc}</p>
       <div className="mt-auto pt-4 border-t border-slate-800">
          <span className="text-[10px] font-bold uppercase text-military-gold block mb-1">Medida Mitigadora</span>
          <p className="text-[11px] text-slate-300 font-medium leading-tight">{mitig}</p>
       </div>
    </div>
  );
}

function ActionStep({ number, title, desc }: any) {
  return (
    <div className="card-military flex items-start gap-5 hover:bg-red-500/5 transition-colors border shadow-lg group">
       <span className="text-4xl font-black text-slate-700/50 group-hover:text-red-500/50 transition-colors italic leading-none">{number}</span>
       <div>
          <h4 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">{title}</h4>
          <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-200 transition-colors">{desc}</p>
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
       <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{title}</span>
       <span className="text-3xl font-black text-white my-1">{value}</span>
       <span className="text-xs text-slate-400 mb-3">{label}</span>
       <span className="px-3 py-1 rounded-full bg-slate-800 text-[10px] font-black text-military-gold tracking-widest border border-military-gold/20 italic">{status}</span>
    </div>
  );
}

function FaunaItem({ date, species, local }: any) {
  return (
    <div className="flex items-center gap-4 group">
       <div className="w-10 h-10 rounded-lg bg-military-black border border-slate-800 flex items-center justify-center shrink-0">
         <Bird size={18} className="text-slate-500 group-hover:text-military-gold transition-colors" />
       </div>
       <div className="flex-1 border-b border-slate-800 pb-2 group-last:border-0">
          <div className="flex justify-between items-center mb-0.5">
             <h4 className="text-sm font-bold text-slate-200">{species}</h4>
             <span className="text-[10px] text-slate-500 font-mono">{date}</span>
          </div>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{local}</p>
       </div>
    </div>
  );
}

function NormaCard({ title, category, desc }: any) {
   return (
    <div className="card-military h-full flex flex-col group hover:border-military-gold transition-all">
       <div className="mb-4">
          <span className="px-2 py-0.5 bg-military-blue text-white text-[9px] font-black uppercase tracking-widest rounded">{category}</span>
          <h3 className="text-lg font-black text-white mt-2 group-hover:text-military-gold transition-colors italic tracking-tight">{title}</h3>
       </div>
       <p className="text-xs text-slate-400 leading-relaxed mb-6 flex-1">{desc}</p>
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
         <p className="text-[10px] text-slate-400 font-medium italic">{action}</p>
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
          <h4 className="text-xs font-black text-white uppercase tracking-tight mb-1 group-hover:text-military-gold transition-colors">{title}</h4>
          <p className="text-[10px] text-slate-500 font-medium leading-tight">{desc}</p>
       </div>
    </div>
  );
}

function AdminStat({ label, value, trend }: any) {
  return (
    <div className="card-military bg-military-gray border-slate-700 hover:border-slate-500 transition-colors cursor-default">
       <span className="text-[9px] text-slate-500 uppercase font-black tracking-[0.15em]">{label}</span>
       <div className="text-2xl font-black text-white mt-1.5 italic tracking-tight">{value}</div>
       <div className="h-[1px] bg-slate-800 my-2" />
       <span className="text-[9px] text-military-gold font-bold uppercase tracking-widest">{trend}</span>
    </div>
  );
}

const sectionComponents: Record<string, FC<any>> = {
  Inicio: InicioSection,
  RELPREV: RelprevSection,
  FGR: FgrSection,
  Abortiva: AbortivaSection,
  'Mapa de Risco': MapaRiscoSection,
  'Portal Notificação': NotificacaoSection,
  'Ações Pós-Acidente': PosAcidenteSection,
  Abastecimento: AbastecimentoSection,
  'Memento Meteo': MeteoSection,
  'Reporte Fauna': FaunaSection,
  'Normas CAvEx': NormasSection,
  'Planeje seu Voo': PlanejamentoSection,
  Admin: AdminSection
};

