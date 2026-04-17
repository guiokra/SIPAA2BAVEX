import React, { FC, useState, useEffect } from 'react';
import { 
  Home, 
  FileText, 
  Scale, 
  Map as MapIcon, 
  Bell, 
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
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type SectionKey = 'Inicio' | 'RELPREV' | 'FGR' | 'Mapa de Risco' | 'Portal Notificação' | 'Ações Pós-Acidente' | 'Abastecimento' | 'Memento Meteo' | 'Reporte Fauna' | 'Normas CAvEx' | 'Planeje seu Voo' | 'Admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<SectionKey>('Inicio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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
    setActiveTab(tab);
    if (isMobile) setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-military-black overflow-hidden relative selection:bg-military-gold selection:text-military-black">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? '280px' : '300px') : '0px',
          x: isSidebarOpen ? 0 : (isMobile ? -300 : -300)
        }}
        className={`fixed lg:relative z-50 bg-[#0d1117] border-r border-slate-800 flex flex-col h-full shadow-2xl transition-all duration-300 ease-in-out`}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-military-gold rounded flex items-center justify-center shadow-lg shadow-military-gold/20">
              <ShieldCheck className="text-military-black w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">SIPAA</span>
              <span className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-widest">2º BAvEx</span>
            </div>
          </div>
          {isMobile && (
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          )}
        </div>

        {/* Scrollable Menu Area */}
        <div className="flex-1 overflow-y-auto px-3 py-6 custom-scrollbar">
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group relative ${
                    isActive 
                      ? 'bg-military-blue/30 text-military-gold border-l-2 border-military-gold' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-military-gold' : 'group-hover:text-slate-200'} />
                  <span className="text-sm font-medium tracking-wide">{item.name}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute right-3 w-1.5 h-1.5 rounded-full bg-military-gold shadow-[0_0_8px_rgba(212,175,55,0.8)]"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Admin Section at Bottom */}
        <div className="p-4 bg-military-black/30 border-t border-slate-800">
           <button
            onClick={() => handleTabChange('Admin')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 ${
              activeTab === 'Admin'
                ? 'bg-military-gold text-military-black border-military-gold font-bold shadow-lg shadow-military-gold/10'
                : 'border-slate-800 text-military-gold hover:bg-military-gold/10'
            }`}
          >
            <Lock size={18} />
            <span className="text-sm font-bold uppercase tracking-wider">Admin</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-military-black relative overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-[#0d1117] flex items-center justify-between px-6 z-30 shadow-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="flex flex-col">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-widest leading-none">
                {activeTab === 'Inicio' ? 'Painel Operacional' : activeTab}
              </h1>
              <span className="text-[10px] text-military-gold/80 font-mono mt-0.5 tracking-tighter">
                SISTEMA INTEGRADO DE PREVENÇÃO DE ACIDENTES AERONÁUTICOS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <div className="flex flex-col items-end mr-2 hidden sm:flex">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Status do Dia</span>
              <span className="text-xs text-green-500 flex items-center gap-1 font-bold">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                OPERACIONAL
              </span>
            </div>
            <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
            <div className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0d1117]" />
            </div>
            <div className="p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
              <Settings size={18} />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto w-full pb-20"
            >
              {React.createElement(sectionComponents[activeTab])}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- SECTIONS ---

function InicioSection() {
  return (
    <div className="space-y-8">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-military-blue to-military-black border border-slate-700 p-8 lg:p-12 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight"
          >
            Segurança em Primeiro Lugar, <br/>
            <span className="text-military-gold italic">Missão Cumprida.</span>
          </motion.h2>
          <p className="text-slate-300 text-lg mb-8 leading-relaxed max-w-xl">
            Bem-vindo ao Portal de Segurança de Voo do 2º BAvEx. Utilize as ferramentas abaixo para garantir uma operação segura e eficiente.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="btn-military shadow-lg shadow-military-gold/20">
              <AlertTriangle size={18} />
              Reportar Emergência
            </button>
            <button className="px-6 py-2 border border-slate-600 rounded text-slate-200 hover:bg-slate-800 hover:border-slate-500 transition-all font-semibold">
              Ver Notificações
            </button>
          </div>
        </div>
        
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 h-full w-1/3 opacity-10 pointer-events-none">
          <ShieldCheck className="w-full h-full text-military-gold" />
        </div>
      </div>

      {/* Grid Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <QuickCard 
          icon={FileSearch} 
          title="Novo RELPREV" 
          desc="Registre um relato de prevenção agora mesmo." 
          color="gold"
        />
        <QuickCard 
          icon={ShieldCheck} 
          title="FGR" 
          desc="Gerencie o risco da sua próxima missão." 
          color="blue"
        />
        <QuickCard 
          icon={Navigation} 
          title="Planejamento" 
          desc="Consulte áreas de atenção e meteorologia." 
          color="slate"
        />
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Avisos */}
        <div className="card-military border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="text-red-500" size={20} />
            <h3 className="text-lg font-bold uppercase tracking-wider text-white">Avisos Críticos</h3>
          </div>
          <div className="space-y-4">
            <AvisoItem 
              type="danger" 
              title="Restrição de Voo - Área Delta" 
              time="2h atrás" 
              text="Atividades de tiro real no polígono sul. Voo proibido abaixo de 5000ft."
            />
            <AvisoItem 
              type="warning" 
              title="Manutenção de Pista" 
              time="5h atrás" 
              text="Pista 18/36 com obras de sinalização no período noturno de 20 a 22 de Abril."
            />
          </div>
        </div>

        {/* Notícias / Operacional */}
        <div className="card-military">
          <div className="flex items-center gap-2 mb-6 text-military-gold">
            <Zap size={20} />
            <h3 className="text-lg font-bold uppercase tracking-wider text-white">Atualizações Operacionais</h3>
          </div>
          <div className="space-y-4">
            <NewsItem 
              title="Simulado de Emergência" 
              date="14 Out" 
              text="Realizado com sucesso o treinamento de evacuação e resgate no setor Bravo." 
            />
            <NewsItem 
              title="Novas Normas CAvEx" 
              date="12 Out" 
              text="Publicada a nova diretriz para operações com visão noturna (NVG)." 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RelprevSection() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">RELPREV</h2>
          <p className="text-slate-400">Relato de Prevenção - Contribua para a segurança de voo.</p>
        </div>
        <button className="btn-military whitespace-nowrap">
          <FileSearch size={18} />
          Novo RELPREV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase text-slate-500 tracking-widest">Registros Recentes</h3>
            <div className="flex gap-2">
              <input type="text" placeholder="Filtrar..." className="bg-military-gray border border-slate-700 rounded px-3 py-1 text-xs outline-none focus:border-military-gold" />
            </div>
          </div>
          
          <div className="space-y-3">
             {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card-military hover:border-military-gold/50 cursor-pointer transition-colors group">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-military-gold uppercase tracking-tighter">RELPREV #2026-00{i}</span>
                      <h4 className="font-bold text-slate-100 group-hover:text-military-gold transition-colors">Observação de falha técnica em motor de partida</h4>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-1">Identificado durante checklist de pré-voo na aeronave HM-1 Pantera...</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">EM ANÁLISE</span>
                      <span className="text-[10px] text-slate-500 font-mono">16/04/2026</span>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        </div>

        {/* Sidebar/Form Info */}
        <div className="space-y-6">
          <div className="card-military bg-military-gold/5 border-military-gold/20">
            <h3 className="font-bold text-military-gold mb-3 flex items-center gap-2">
              <AlertTriangle size={16} />
              Importante
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              O RELPREV é uma ferramenta preventiva. O foco é identificar riscos antes que ocorram acidentes. Sua identidade pode ser preservada.
            </p>
          </div>
          
          <div className="card-military">
            <h3 className="text-sm font-bold uppercase text-white mb-4">Estatísticas Mês</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total de Relatos</span>
                <span className="text-white font-bold">12</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-military-gold h-full" style={{ width: '65%' }} />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Finalizados</span>
                <span className="text-green-500 font-bold">8</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FgrSection() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">FGR</h2>
          <p className="text-slate-400">Gerenciamento de Risco Operacional</p>
        </div>
        <div className="flex gap-3">
           <button className="px-4 py-2 border border-slate-700 bg-slate-800 text-white rounded hover:bg-slate-700 font-semibold text-sm">
             Carregar Modelo
           </button>
           <button className="btn-military whitespace-nowrap text-sm">
            <CheckSquare size={16} />
            Finalizar FGR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Header Form */}
        <div className="lg:col-span-4 card-military grid grid-cols-1 md:grid-cols-4 gap-4">
          <FgrField label="Missão" placeholder="Treinamento Tático" />
          <FgrField label="Aeronave" placeholder="HA-1 Fennec" />
          <FgrField label="Local" placeholder="Taubaté - SP" />
          <FgrField label="Data" type="date" defaultValue="2026-04-16" />
        </div>

        {/* Risk Categories */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-sm font-bold border-l-2 border-military-gold pl-3 uppercase tracking-widest text-slate-400">Fatores de Risco</h3>
          
          <FgrRow title="Experiência da Tripulação" items={[
            { label: "Instrutor qualificado", value: 1 },
            { label: "Piloto em formação", value: 3 },
            { label: "Tripulação reduzida", value: 5 },
          ]} />
          
          <FgrRow title="Condições Meteorológicas" items={[
            { label: "VMC Ceu claro", value: 1 },
            { label: "VMC com restrições", value: 3 },
            { label: "Próximo a mínimos", value: 6 },
          ]} />

          <FgrRow title="Terreno e Objetivo" items={[
            { label: "Área conhecida", value: 1 },
            { label: "Área restrita/Selva", value: 4 },
            { label: "Área hostil/Novo", value: 7 },
          ]} />
        </div>

        {/* Score Board */}
        <div className="space-y-6">
          <div className="card-military flex flex-col items-center justify-center p-8 text-center bg-military-blue/20 border-military-blue border-2">
            <span className="text-sm text-slate-400 uppercase font-bold mb-2">Índice Total</span>
            <span className="text-6xl font-black text-white">12</span>
            <span className="mt-4 px-4 py-1 rounded bg-green-500 text-black text-xs font-bold uppercase">Risco Baixo</span>
          </div>

          <div className="card-military">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-tighter">Classificação</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/20 text-[10px] text-green-500 font-bold">
                <span>0 - 15</span>
                <span>BAIXO</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-500 font-bold">
                <span>16 - 25</span>
                <span>MÉDIO</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-500 font-bold">
                <span>26+</span>
                <span>ELEVADO</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapaRiscoSection() {
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

function NotificacaoSection() {
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

function PosAcidenteSection() {
  const [simplifiedMode, setSimplifiedMode] = useState(false);
  
  return (
    <div className={`space-y-8 transition-all duration-500 ${simplifiedMode ? 'max-w-4xl mx-auto' : ''}`}>
       <div className="flex items-center justify-between bg-red-600/10 p-4 border border-red-600/20 rounded-lg">
          <div>
            <h2 className="text-2xl font-extrabold text-red-500 mb-1 leading-none uppercase tracking-tighter">Plano de Emergência</h2>
            <p className="text-slate-400 text-sm">Protocolos imediatos para resposta a acidentes.</p>
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

function AbastecimentoSection() {
  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Segurança no Abastecimento</h2>
            <p className="text-slate-400 italic">"Combustível é vida, mas vapor é perigo."</p>
          </div>
          <div className="flex gap-2">
             <div className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded text-[10px] text-green-500 font-bold uppercase tracking-widest">Posto Ativo</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              <div className="card-military">
                <h3 className="font-bold text-white mb-6 border-b border-slate-800 pb-2 uppercase text-xs tracking-widest">Protocolo de Segurança</h3>
                <ul className="space-y-4">
                  <CheckItem text="Verificar aterramento obrigatório da aeronave e do veículo de abastecimento" />
                  <CheckItem text="Distância de segurança de 15m para qualquer fonte de calor ou ignição" />
                  <CheckItem text="Verificar estanqueidade de todas as mangueiras e conexões de abastecimento" />
                  <CheckItem text="Equipamento de combate a incêndio (Extintores) posicionado e tripulado" />
                  <CheckItem text="Motores e aviônicos essenciais desligados durante a operação padrão" />
                </ul>
              </div>

              <div className="card-military bg-red-950/20 border-red-500/30">
                <h3 className="font-bold text-red-500 mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
                   <AlertTriangle size={18} />
                   Pontos de Atenção Crítica
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                   <div className="p-4 bg-military-black rounded border border-red-500/20 text-slate-300">
                     <span className="font-bold text-red-400 block mb-2 uppercase text-[10px]">Descarga Estática</span>
                     O fluxo de combustível gera eletricidade estática. O aterramento é a única barreira contra explosão.
                   </div>
                   <div className="p-4 bg-military-black rounded border border-red-500/20 text-slate-300">
                     <span className="font-bold text-red-400 block mb-2 uppercase text-[10px]">Qualidade (Drenagem)</span>
                     Drenar sempre antes do primeiro voo do dia para checar presença de água ou sedimentos.
                   </div>
                </div>
              </div>
           </div>

           <div className="space-y-6">
              <div className="card-military">
                 <h3 className="font-bold text-military-gold mb-4 uppercase text-[10px] tracking-widest">Suporte e Material</h3>
                 <div className="space-y-3">
                    <button className="w-full btn-military text-xs py-3 font-bold uppercase tracking-wider">
                      <FileText size={16} /> Checklist Completo
                    </button>
                    <button className="w-full px-4 py-3 border border-slate-700 bg-slate-800 text-slate-200 rounded text-xs font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors">Solicitar Amostragem</button>
                 </div>
              </div>
              
              <div className="card-military border-military-blue/30 bg-military-blue/5">
                 <h4 className="text-[10px] font-black text-military-blue-300 uppercase mb-2">Último Teste Lote</h4>
                 <div className="flex justify-between items-center bg-military-black p-3 rounded">
                    <span className="text-xs text-slate-300">Lote #JET-4589</span>
                    <span className="text-green-500 font-bold text-xs uppercase">Conforme</span>
                 </div>
              </div>
           </div>
        </div>
    </div>
  );
}

function MeteoSection() {
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

function FaunaSection() {
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

function NormasSection() {
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

function PlanejamentoSection() {
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

function AdminSection() {
  const [isLogged, setIsLogged] = useState(false);
  
  if (!isLogged) {
    return (
      <div className="max-w-md mx-auto pt-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-military p-10 text-center space-y-8 border-military-gold/20 shadow-2xl relative overflow-hidden"
        >
           {/* Abstract Keyhole */}
           <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
             <Lock size={150} />
           </div>

           <div className="mx-auto w-20 h-20 bg-military-gold rounded-2xl flex items-center justify-center mb-4 rotate-3 shadow-xl">
             <Lock className="text-military-black" size={40} />
           </div>
           <div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter">ACESSO SIPAA</h2>
              <p className="text-slate-400 text-sm mt-1 uppercase font-bold tracking-widest border-t border-slate-800 pt-2 inline-block">Área Restrita 2º BAvEx</p>
           </div>
           <div className="space-y-4">
              <input className="input-military py-3.5" type="text" placeholder="Identidade Militar" />
              <input className="input-military py-3.5" type="password" placeholder="Senha Operacional" />
              <button onClick={() => setIsLogged(true)} className="btn-military w-full py-4 uppercase font-black tracking-widest shadow-lg shadow-military-gold/10 mt-4">AUTENTICAR</button>
           </div>
           <p className="text-[10px] text-slate-600 font-mono">Toda atividade neste painel é monitorada e registrada.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-military-gold/20 border border-military-gold flex items-center justify-center">
                <User size={24} className="text-military-gold" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-white leading-none">Painel Administrativo</h2>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Bem-vindo, Maj Cavalcanti (SIPAA)</p>
             </div>
          </div>
          <button onClick={() => setIsLogged(false)} className="px-6 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg text-xs font-black uppercase tracking-widest transition-all">
            <LogOut size={16} className="inline mr-2" /> Encerrar Sessão
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AdminStat label="Relatos Pendentes" value="03" trend="MÉDIA BAIXA" />
          <AdminStat label="Última Inspeção" value="ONTEM" trend="SEM NÃO CONFORMIDADES" />
          <AdminStat label="Mapa de Riscos" value="ATIVO" trend="ATUALIZADO ÀS 07:00" />
          <AdminStat label="Alertas de Fauna" value="15" trend="+2 NAS ÚLTIMAS 24H" />
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
         <div className="lg:col-span-2 card-military">
            <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
               <h3 className="font-black text-white uppercase text-[10px] tracking-widest">Controle de Módulos Operacionais</h3>
               <button className="text-[10px] text-military-gold font-bold hover:underline">Ver Todos</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <AdminAction title="Gestão de Normatização" desc="Publicar ou remover itens da biblioteca CAvEx." icon={BookOpen} />
               <AdminAction title="Editores do Mapa" desc="Incluir ameaças e perigos temporários no setor." icon={MapIcon} />
               <AdminAction title="Relatórios de Frota" desc="Visão geral de incidentes por modelo de aeronave." icon={ShieldCheck} />
               <AdminAction title="Configuração Geral" desc="Limites de acesso e permissões de usuários." icon={Settings} />
            </div>
         </div>
         
         <div className="card-military bg-military-blue/10 border-military-blue/20">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Log de Atividades</h3>
            <div className="space-y-4">
               <ActivityItem time="12:45" user="Maj Silva" action="Aprovou RELPREV #89" />
               <ActivityItem time="10:20" user="Sgt Rocha" action="Atualizou Mapa de Risco" />
               <ActivityItem time="09:15" user="Cap Menezes" action="Nova Notificação Crítica" />
               <ActivityItem time="08:00" user="SYSTEM" action="Backup Diário Concluído" />
            </div>
         </div>
       </div>
    </div>
  );
}

// --- SUB-HELPER COMPONENTS ---

function QuickCard({ icon: Icon, title, desc, color }: any) {
  const colorMap: any = {
    gold: 'bg-military-gold/10 border-military-gold/30 text-military-gold',
    blue: 'bg-military-blue/10 border-military-blue/30 text-blue-400',
    slate: 'bg-slate-800/50 border-slate-700 text-slate-300'
  };
  
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`card-military p-6 cursor-pointer group transition-all ${colorMap[color]}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-lg ${color === 'gold' ? 'bg-military-gold text-military-black' : 'bg-slate-800 text-white'}`}>
          <Icon size={24} />
        </div>
        <h3 className="font-bold text-lg group-hover:scale-105 transition-transform">{title}</h3>
      </div>
      <p className="text-sm opacity-70 leading-relaxed font-medium">{desc}</p>
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

function AdminAction({ title, desc, icon: Icon }: any) {
  return (
    <div className="p-5 rounded-xl bg-military-black border border-slate-800 hover:border-military-gold cursor-pointer transition-all group flex gap-4">
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

const sectionComponents: Record<string, FC> = {
  Inicio: InicioSection,
  RELPREV: RelprevSection,
  FGR: FgrSection,
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

