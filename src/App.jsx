import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, RefreshCw, Copy, CheckCircle, Activity, 
  Eye, Terminal, Folder, Edit, Home, X, Settings, 
  Laptop, Video, Link, ChevronRight, History
} from 'lucide-react';

// --- DATI INIZIALI ---
const INITIAL_DEVICES = [
  { id: '192.168.1.104', alias: 'Workstation-Studio', os: 'Windows 11', status: 'online', ping: 2, netType: 'LAN' },
  { id: '87.14.210.99', alias: 'PC-Casa-Milano', os: 'Windows 11', status: 'online', ping: 24, netType: 'WAN_P2P' },
  { id: '151.48.92.14', alias: 'MacBook-Cliente', os: 'macOS', status: 'online', ping: 38, netType: 'WAN_P2P' },
  { id: '192.168.1.250', alias: 'Server-NAS', os: 'Ubuntu', status: 'online', ping: 1, netType: 'LAN' },
  { id: '93.41.118.202', alias: 'Ufficio-Napoli', os: 'Windows 10', status: 'offline', ping: null, netType: 'WAN_P2P' }
];

export default function App() {
  const [currentTab, setCurrentTab] = useState('home'); 
  const [myId] = useState('849 201 442');
  const [tempPass, setTempPass] = useState('k9#mP2$vL');
  const [showPass, setShowPass] = useState(false);
  const [inviteToken, setInviteToken] = useState('NX-994A-77B2-WIFI');
  const [remoteInput, setRemoteInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [devices, setDevices] = useState(INITIAL_DEVICES);
  
  // Stati Sessione Attiva / WebRTC
  const [activeSession, setActiveSession] = useState(null); 
  const [webrtcMode, setWebrtcMode] = useState(false);
  const [webrtcRole, setWebrtcRole] = useState(null); 
  const [realOfferToken, setRealOfferToken] = useState('');
  const [realAnswerToken, setRealAnswerToken] = useState('');
  const [isRealConnected, setIsRealConnected] = useState(false);
  const [isWhiteboardMode, setIsWhiteboardMode] = useState(false);
  const [sidePanel, setSidePanel] = useState(null); 
  
  const peerConnectionRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const [toast, setToast] = useState(null);

  const triggerToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const regeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 9; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    setTempPass(pass);
    triggerToast('Nuova password generata', 'success');
  };

  const copyToClipboard = (text, msg) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
      triggerToast(msg, 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const startConnection = (target) => {
    const raw = (typeof target === 'string' ? target : target.id).trim();
    if (!raw) return triggerToast('Inserisci un ID o Token', 'warning');
    if (raw.length > 50) return joinRealSession(raw);

    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      const deviceObj = devices.find(d => d.id === raw) || {
        id: raw, alias: `Peer (${raw})`, os: 'Remoto', status: 'online', netType: 'WAN_P2P'
      };
      setActiveSession(deviceObj);
      setCurrentTab('session');
    }, 1200);
  };

  const startRealHosting = async () => {
    try {
      triggerToast('Seleziona lo schermo da condividere...', 'info');
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate === null) {
          setRealOfferToken(btoa(JSON.stringify(pc.localDescription)));
          triggerToast('Token Generato! Invialo per la connessione diretta.', 'success');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      setWebrtcRole('host');
      setWebrtcMode(true);
      setCurrentTab('session');
    } catch (err) {
      triggerToast('Cattura schermo annullata.', 'error');
    }
  };

  const joinRealSession = async (tokenStr) => {
    try {
      const offer = JSON.parse(atob(tokenStr));
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected') {
          setIsRealConnected(true);
          triggerToast('Connessione P2P Stabilita!', 'success');
        }
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      pc.onicecandidate = (e) => {
        if (e.candidate === null) {
          setRealAnswerToken(btoa(JSON.stringify(pc.localDescription)));
          setWebrtcRole('guest');
          setWebrtcMode(true);
          setCurrentTab('session');
          triggerToast('Risposta pronta. Copia e invia il token.', 'success');
        }
      };
    } catch (err) {
      triggerToast('Token WebRTC non valido', 'error');
    }
  };

  const finalizeRealHosting = async () => {
    try {
      const answer = JSON.parse(atob(realAnswerToken.trim()));
      await peerConnectionRef.current.setRemoteDescription(answer);
      setIsRealConnected(true);
      triggerToast('Tunnel Stabilito!', 'success');
    } catch (err) {
      triggerToast('Token di risposta errato', 'error');
    }
  };

  const disconnectSession = () => {
    setActiveSession(null);
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    setWebrtcMode(false);
    setIsRealConnected(false);
    setWebrtcRole(null);
    setCurrentTab('home');
    triggerToast(`Disconnesso`, 'info');
  };

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] text-slate-200 flex flex-col font-sans overflow-hidden">
      
      {isConnecting && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#2d2d2d] border border-slate-700 rounded-lg p-8 text-center shadow-2xl">
            <RefreshCw className="w-10 h-10 animate-spin mx-auto text-blue-500 mb-4" />
            <h3 className="text-lg font-bold">Inizializzazione Tunnel P2P...</h3>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] bg-[#333333] border border-slate-600 text-white px-4 py-3 rounded shadow-2xl flex items-center gap-3 text-sm">
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400"/> : <Activity className="w-4 h-4 text-blue-400"/>}
          {toast.message}
        </div>
      )}

      {/* TOP TAB BAR */}
      <div className="h-10 bg-[#181818] border-b border-[#333] flex items-center px-2 select-none">
        <div className="flex gap-1 h-full pt-1">
          <button onClick={() => setCurrentTab('home')} className={`px-4 h-full flex items-center gap-2 rounded-t-lg border-t border-x ${currentTab === 'home' || currentTab === 'settings' ? 'bg-[#1e1e1e] border-[#333] text-white' : 'border-transparent text-slate-400 hover:bg-[#252525]'}`}>
            <Home className="w-4 h-4" /> <span className="text-xs font-semibold">NexusDesk</span>
          </button>
          
          {(activeSession || webrtcMode) && (
            <button onClick={() => setCurrentTab('session')} className={`px-4 h-full flex items-center gap-2 rounded-t-lg border-t border-x ${currentTab === 'session' ? 'bg-[#1e1e1e] border-[#333] text-white' : 'border-transparent text-slate-400 hover:bg-[#252525]'}`}>
              <Monitor className="w-4 h-4 text-blue-400" /> 
              <span className="text-xs font-semibold">{webrtcMode ? 'Condivisione Schermo' : activeSession?.alias}</span>
              <X className="w-3 h-3 ml-2 hover:text-red-400" onClick={(e) => { e.stopPropagation(); disconnectSession(); }}/>
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 px-2">
          <button onClick={() => setCurrentTab('settings')} className="p-1.5 text-slate-400 hover:text-white rounded"><Settings className="w-4 h-4"/></button>
        </div>
      </div>

      {/* MAIN VIEW */}
      {(currentTab === 'home' || currentTab === 'settings') && (
        <div className="flex-1 flex overflow-hidden">
          
          <div className="w-full md:w-80 lg:w-96 bg-[#252525] border-r border-[#333] flex flex-col p-6 overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Laptop className="w-4 h-4"/> Questo Dispositivo
            </h2>

            <div className="bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg p-5 mb-4 shadow-inner">
              <div className="text-xs text-slate-500 mb-1">ID (Indirizzo Nexus)</div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-light tracking-wide text-white">{myId}</div>
                <button onClick={() => copyToClipboard(myId, 'ID Copiato')} className="p-2 text-slate-400 hover:bg-[#333] rounded"><Copy className="w-5 h-5"/></button>
              </div>

              <div className="h-px bg-[#333] w-full my-4"></div>

              <div className="text-xs text-slate-500 mb-1">Password Temporanea</div>
              <div className="flex items-center justify-between">
                <div className="text-lg font-mono text-emerald-400">{showPass ? tempPass : '••••••••'}</div>
                <div className="flex gap-1">
                  <button onClick={() => setShowPass(!showPass)} className="p-1.5 text-slate-400 hover:bg-[#333] rounded"><Eye className="w-4 h-4"/></button>
                  <button onClick={regeneratePassword} className="p-1.5 text-slate-400 hover:bg-[#333] rounded"><RefreshCw className="w-4 h-4"/></button>
                  <button onClick={() => copyToClipboard(tempPass, 'Password Copiata')} className="p-1.5 text-slate-400 hover:bg-[#333] rounded"><Copy className="w-4 h-4"/></button>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1"><Video className="w-4 h-4"/> Condivisione Schermo P2P</h3>
              <p className="text-[11px] text-slate-400 mb-3">Trasmetti il tuo schermo a un affiliato usando WebRTC nativo, senza server intermedi.</p>
              <button onClick={startRealHosting} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded shadow">
                Inizia Condivisione
              </button>
            </div>
            
            <div className="mt-4 p-4 border border-[#3a3a3a] rounded-lg">
              <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1"><Link className="w-4 h-4"/> Link d'Invito Multi-Wi-Fi</h3>
              <div className="text-[10px] font-mono bg-[#1e1e1e] p-2 rounded text-slate-400 truncate mb-2">{inviteToken}</div>
              <button onClick={() => copyToClipboard(`https://nexusdesk.p2p/join#${inviteToken}`, 'Link Copiato')} className="w-full bg-[#333] hover:bg-[#444] text-white text-xs font-bold py-2 rounded">Copia Link</button>
            </div>
          </div>

          <div className="flex-1 bg-[#1e1e1e] flex flex-col p-8 overflow-y-auto">
            
            <div className="max-w-2xl w-full mx-auto">
              <h1 className="text-3xl font-light text-white mb-2">Controlla un Dispositivo Remoto</h1>
              <p className="text-sm text-slate-400 mb-8">Inserisci l'ID del partner, il Token WebRTC o seleziona un dispositivo recente.</p>

              <form onSubmit={e => {e.preventDefault(); startConnection(remoteInput);}} className="relative flex items-center mb-10">
                <input 
                  value={remoteInput} 
                  onChange={e => setRemoteInput(e.target.value)} 
                  placeholder="Inserisci l'ID Remoto o il Token..." 
                  className="w-full bg-[#252525] border-2 border-[#3a3a3a] focus:border-blue-500 rounded-xl py-4 pl-4 pr-32 text-lg text-white outline-none shadow-inner"
                />
                <button type="submit" className="absolute right-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors">
                  Connetti <ChevronRight className="w-5 h-5"/>
                </button>
              </form>

              <div className="flex items-center justify-between mb-4 border-b border-[#333] pb-2">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><History className="w-4 h-4"/> Sessioni Recenti & LAN</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {devices.map(d => (
                  <div key={d.id} onDoubleClick={() => startConnection(d.id)} className="bg-[#252525] border border-[#333] hover:border-blue-500/50 p-4 rounded-lg cursor-pointer group transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded bg-[#1e1e1e] flex items-center justify-center border border-[#333] group-hover:bg-blue-900/20">
                        <Monitor className="w-5 h-5 text-slate-400 group-hover:text-blue-400"/>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white truncate max-w-[120px]">{d.alias}</div>
                        <div className="text-xs text-slate-500">{d.id}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full ${d.status === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {d.status === 'online' ? `Online (${d.ping}ms)` : 'Offline'}
                      </span>
                      <span className="text-slate-500">{d.netType === 'LAN' ? 'LAN' : 'WAN'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SESSION VIEW */}
      {currentTab === 'session' && (activeSession || webrtcMode) && (
        <div className="flex-1 flex flex-col relative bg-black">
          
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center bg-[#252525]/95 backdrop-blur border border-[#444] px-2 py-1 rounded-lg shadow-2xl">
            <div className="flex items-center gap-2 pr-3 border-r border-[#444]">
              <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
              <div className="text-xs font-bold text-white hidden sm:block">{webrtcMode ? 'P2P Diretto' : activeSession?.alias}</div>
            </div>

            <div className="flex px-2 space-x-1">
              <button className="p-1.5 hover:bg-[#333] rounded text-slate-300" title="Monitor 1/2"><Monitor className="w-4 h-4"/></button>
              <button className="p-1.5 hover:bg-[#333] rounded text-slate-300" title="Terminale/Chat" onClick={() => setSidePanel('chat')}><Terminal className="w-4 h-4"/></button>
              <button className="p-1.5 hover:bg-[#333] rounded text-slate-300" title="Trasferimento File" onClick={() => setSidePanel('files')}><Folder className="w-4 h-4"/></button>
              <button className="p-1.5 hover:bg-[#333] rounded text-slate-300" title="Modalità Lavagna" onClick={() => setIsWhiteboardMode(!isWhiteboardMode)}><Edit className="w-4 h-4"/></button>
            </div>

            <div className="h-5 w-px bg-[#444] mx-1" />
            <button onClick={disconnectSession} className="bg-red-600/80 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold ml-2">Chiudi</button>
          </div>

          {webrtcMode ? (
            <div className="flex-1 flex items-center justify-center relative p-8">
              {!isRealConnected && webrtcRole === 'host' && (
                <div className="bg-[#252525] border border-[#444] p-6 rounded-lg max-w-lg text-center">
                  <Activity className="w-10 h-10 text-blue-400 mx-auto mb-4 animate-pulse" />
                  <h3 className="text-lg font-bold mb-2">In Attesa...</h3>
                  <p className="text-xs text-slate-400 mb-4">Invia questo Token all'affiliato per far partire il video.</p>
                  <textarea readOnly value={realOfferToken} className="w-full h-20 bg-[#1e1e1e] text-[10px] font-mono text-emerald-400 p-2 rounded border border-[#333] mb-2"></textarea>
                  <button onClick={() => copyToClipboard(realOfferToken, 'Token Host Copiato')} className="w-full bg-blue-600 py-2 rounded font-bold text-xs mb-4">Copia Token</button>
                  <p className="text-xs text-slate-400 mb-2">Incolla qui la Risposta:</p>
                  <textarea value={realAnswerToken} onChange={e => setRealAnswerToken(e.target.value)} className="w-full h-12 bg-[#1e1e1e] text-[10px] font-mono text-blue-300 p-2 rounded border border-[#333] mb-2"></textarea>
                  <button onClick={finalizeRealHosting} className="w-full bg-emerald-600 hover:bg-emerald-500 py-2 rounded font-bold text-xs">Conferma & Avvia</button>
                </div>
              )}

              {!isRealConnected && webrtcRole === 'guest' && (
                <div className="bg-[#252525] border border-[#444] p-6 rounded-lg max-w-lg text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-lg font-bold mb-2">Risposta Pronta!</h3>
                  <textarea readOnly value={realAnswerToken} className="w-full h-20 bg-[#1e1e1e] text-[10px] font-mono text-blue-300 p-2 rounded border border-[#333] mb-2"></textarea>
                  <button onClick={() => copyToClipboard(realAnswerToken, 'Risposta Copiata')} className="w-full bg-emerald-600 py-2 rounded font-bold text-xs mb-2">Copia Risposta</button>
                  <p className="text-[10px] text-slate-500">In attesa dell'Host...</p>
                </div>
              )}

              {webrtcRole === 'guest' && <video ref={remoteVideoRef} autoPlay playsInline controls={false} className={`w-full h-full object-contain ${!isRealConnected ? 'hidden' : ''}`} />}
              {webrtcRole === 'host' && isRealConnected && (
                <div className="text-center"><Video className="w-16 h-16 text-emerald-400 animate-pulse mx-auto mb-4" /><h2 className="text-xl font-bold">Stai trasmettendo lo schermo.</h2></div>
              )}
            </div>
          ) : (
            <div className={`flex-1 relative bg-gradient-to-br from-[#1a1c23] to-[#121318] ${isWhiteboardMode ? 'cursor-crosshair' : 'cursor-default'}`}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
              <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-bold text-4xl opacity-20 select-none">Desktop Remoto</div>
            </div>
          )}

          {sidePanel && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#252525] border-l border-[#444] flex flex-col z-40 shadow-2xl">
              <div className="p-3 bg-[#1e1e1e] flex justify-between border-b border-[#444]">
                <span className="text-sm font-bold">{sidePanel === 'files' ? 'Trasferimento File' : 'Chat & Log'}</span>
                <button onClick={() => setSidePanel(null)}><X className="w-4 h-4 text-slate-400 hover:text-white"/></button>
              </div>
              <div className="flex-1 p-4 overflow-auto text-xs text-slate-400 flex items-center justify-center">
                Pannello {sidePanel} P2P attivo.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}