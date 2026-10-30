import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Copy, Check, Play, Settings, X, MousePointer2, MessageSquare, Maximize } from 'lucide-react';
import Peer from 'peerjs';

export default function App() {
  const [myId, setMyId] = useState('');
  const [peerInstance, setPeerInstance] = useState(null);
  
  // Stati di Connessione
  const [remoteId, setRemoteId] = useState('');
  const [sessionState, setSessionState] = useState('idle'); // idle, connecting, connected, sharing
  
  // Dati Remoti
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  
  // Refs
  const videoRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [remoteCursor, setRemoteCursor] = useState(null); // Per mostrare i click ricevuti

  // 1. Inizializzazione PeerJS
  useEffect(() => {
    // Genera un ID di 9 cifre (stile RustDesk)
    const storedId = localStorage.getItem('nexus_id');
    const id = storedId || Math.floor(100000000 + Math.random() * 900000000).toString();
    if (!storedId) localStorage.setItem('nexus_id', id);
    
    setMyId(id);

    // Inizializza PeerJS collegandosi al server pubblico gratuito
    const peer = new Peer(id, {
      debug: 1,
      config: {
        'iceServers': [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
      setPeerInstance(peer);
    });

    // 2. L'OSPITE riceve una richiesta di connessione (Canale Dati)
    peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        if (data.type === 'request-control') {
          // Mostra il popup di accettazione all'ospite
          setIncomingRequest({ callerId: data.from, connection: conn });
        }
        if (data.type === 'remote-click') {
          // Mostra un feedback visivo del click del controller
          setRemoteCursor({ x: data.x, y: data.y });
          setTimeout(() => setRemoteCursor(null), 1000);
        }
      });
    });

    // 3. L'HOST riceve la chiamata video dopo che l'ospite ha accettato
    peer.on('call', (call) => {
      // Rispondi automaticamente alla chiamata ricevuta
      call.answer();
      
      call.on('stream', (stream) => {
        console.log('Stream ricevuto!');
        setRemoteStream(stream);
        setSessionState('connected'); // Nasconde la rotellina e mostra il video
      });

      call.on('close', () => {
        endSession();
      });
    });

    return () => peer.destroy();
  }, []);

  // Aggiorna il player video appena lo stream è disponibile
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(e => console.error("Autoplay bloccato:", e));
    }
  }, [remoteStream, sessionState]);

  const copyId = () => {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- AZIONI DELL'HOST (Chi controlla) ---
  const startConnection = () => {
    if (!remoteId || remoteId === myId || !peerInstance) return;
    
    setSessionState('connecting');
    
    // Apri canale dati verso l'ospite per chiedere il permesso
    const conn = peerInstance.connect(remoteId);
    
    conn.on('open', () => {
      conn.send({ type: 'request-control', from: myId });
      setDataChannel(conn);
    });

    conn.on('data', (data) => {
      if (data.type === 'rejected') {
        alert("L'ospite ha rifiutato la connessione.");
        endSession();
      }
    });

    conn.on('close', () => endSession());
  };

  const handleVideoClick = (e) => {
    if (!dataChannel || sessionState !== 'connected') return;
    // Calcola le coordinate relative al video
    const rect = videoRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Invia il click all'ospite tramite DataChannel
    dataChannel.send({ type: 'remote-click', x, y });
  };

  // --- AZIONI DELL'OSPITE (Chi viene controllato) ---
  const acceptRequest = async () => {
    try {
      // 1. Chiedi al browser di catturare lo schermo (nativo)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      
      // 2. Chiama l'host passandogli lo stream
      const call = peerInstance.call(incomingRequest.callerId, stream);
      
      // 3. Salva la connessione dati aperta dall'host
      setDataChannel(incomingRequest.connection);
      
      setSessionState('sharing');
      setIncomingRequest(null);
      
      // Se l'ospite ferma la condivisione dal browser, chiudi tutto
      stream.getVideoTracks()[0].onended = () => {
        call.close();
        endSession();
      };
      
    } catch (err) {
      console.error("Condivisione annullata o fallita", err);
      if (incomingRequest.connection) {
        incomingRequest.connection.send({ type: 'rejected' });
      }
      setIncomingRequest(null);
    }
  };

  const rejectRequest = () => {
    if (incomingRequest.connection) {
      incomingRequest.connection.send({ type: 'rejected' });
    }
    setIncomingRequest(null);
  };

  const endSession = () => {
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    setRemoteStream(null);
    setSessionState('idle');
    setDataChannel(null);
  };

  // --- RENDERING ---

  // Se l'Host sta guardando lo schermo
  if (sessionState === 'connected' || sessionState === 'connecting') {
    return (
      <div className="flex flex-col h-screen bg-[#111111] text-white font-sans">
        {/* Top Bar stile AnyDesk (Tab di Sessione) */}
        <div className="bg-[#1e1e1e] border-b border-gray-800 flex items-center px-4 py-2">
          <div className="flex items-center space-x-2 bg-[#2d2d2d] px-4 py-2 rounded-t-lg border-t-2 border-blue-500">
            <Monitor size={16} className="text-blue-400" />
            <span className="font-semibold text-sm">Sessione: {remoteId}</span>
            <button onClick={endSession} className="ml-4 hover:bg-red-500 rounded-full p-1"><X size={14} /></button>
          </div>
        </div>

        {/* Area Video Principale */}
        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
          {sessionState === 'connecting' ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-400">In attesa che l'ospite ({remoteId}) accetti la condivisione...</p>
              <button onClick={endSession} className="mt-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm">Annulla</button>
            </div>
          ) : (
            <>
              {/* Toolbar Fluttuante in alto */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#2d2d2d] rounded-lg shadow-xl px-4 py-2 flex space-x-4 border border-gray-700 z-10 opacity-75 hover:opacity-100 transition-opacity">
                <button className="flex items-center text-xs hover:text-blue-400"><MousePointer2 size={16} className="mr-2" /> Controllo</button>
                <button className="flex items-center text-xs hover:text-blue-400"><MessageSquare size={16} className="mr-2" /> Chat</button>
                <button className="flex items-center text-xs hover:text-blue-400"><Maximize size={16} className="mr-2" /> Fullscreen</button>
                <div className="w-px bg-gray-600 h-4 my-auto"></div>
                <button onClick={endSession} className="flex items-center text-xs text-red-400 hover:text-red-300">Disconnetti</button>
              </div>
              
              {/* Elemento Video */}
              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                onClick={handleVideoClick}
                className="max-w-full max-h-full object-contain cursor-crosshair"
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // Se l'Ospite sta condividendo lo schermo
  if (sessionState === 'sharing') {
    return (
      <div className="flex flex-col h-screen bg-[#111111] text-white items-center justify-center">
        <Monitor size={64} className="text-green-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-bold mb-2">Stai condividendo il tuo schermo</h2>
        <p className="text-gray-400 mb-8">L'host è collegato al tuo dispositivo.</p>
        <button onClick={endSession} className="px-6 py-3 bg-red-600 hover:bg-red-700 font-bold rounded-lg flex items-center">
          <X className="mr-2" /> Termina Condivisione
        </button>

        {/* Pallino Rosso quando l'Host clicca */}
        {remoteCursor && (
          <div 
            className="fixed w-8 h-8 rounded-full border-4 border-red-500 bg-red-500/30 shadow-[0_0_15px_red] pointer-events-none z-50 animate-ping"
            style={{ 
              left: `${remoteCursor.x * 100}vw`, 
              top: `${remoteCursor.y * 100}vh`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}
      </div>
    );
  }

  // Schermata Principale (Home - Split Pane)
  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white font-sans overflow-hidden">
      
      {/* Header Tabs */}
      <div className="bg-[#181818] border-b border-black flex items-center px-2 py-1">
        <div className="flex items-center space-x-2 bg-[#2d2d2d] px-4 py-2 rounded-t-md shadow-inner border-t-2 border-blue-500 text-sm">
          <Monitor size={16} />
          <span className="font-semibold">Nuova Connessione</span>
        </div>
        <div className="flex-1"></div>
        <Settings size={18} className="text-gray-400 hover:text-white cursor-pointer mr-4" />
      </div>

      {/* Main Split Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Pane: Questo Dispositivo */}
        <div className="w-1/2 p-10 bg-[#252525] flex flex-col shadow-2xl z-10">
          <h2 className="text-xl font-bold text-gray-200 mb-8">Questo Dispositivo</h2>
          
          <div className="bg-[#1e1e1e] p-6 rounded-lg border border-gray-700 shadow-inner">
            <div className="mb-4">
              <label className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2 block">Il tuo ID (Condividi questo codice)</label>
              <div className="flex items-center justify-between bg-black p-4 rounded text-3xl font-mono tracking-widest text-blue-400">
                <span>{myId ? `${myId.slice(0,3)} ${myId.slice(3,6)} ${myId.slice(6,9)}` : '...'}</span>
                <button onClick={copyId} className="text-gray-500 hover:text-white p-2">
                  {copied ? <Check size={24} className="text-green-500" /> : <Copy size={24} />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2 block">Password</label>
              <div className="text-gray-300 text-lg font-mono">********</div>
              <p className="text-xs text-gray-500 mt-2">La password è fissa per l'accesso non presidiato.</p>
            </div>
          </div>
        </div>

        {/* Right Pane: Controlla Remoto */}
        <div className="w-1/2 p-10 bg-[#1e1e1e] flex flex-col">
          <h2 className="text-xl font-bold text-gray-200 mb-8">Controlla Dispositivo Remoto</h2>
          
          <div className="bg-[#2d2d2d] p-6 rounded-lg border border-gray-700">
            <label className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2 block">Inserisci ID partner</label>
            <div className="flex space-x-4">
              <input 
                type="text" 
                value={remoteId}
                onChange={(e) => setRemoteId(e.target.value.replace(/\s/g, ''))}
                placeholder="Es. 123456789"
                className="flex-1 bg-black text-white text-2xl font-mono p-4 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <button 
                onClick={startConnection}
                disabled={!remoteId || remoteId === myId || !peerInstance}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold px-8 rounded flex items-center shadow-lg transition-colors"
              >
                <Play size={20} className="mr-2" /> Connetti
              </button>
            </div>
          </div>
          
          <div className="mt-12 flex-1">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Sessioni Recenti</h3>
            <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-700 rounded-lg text-gray-600">
              Nessuna sessione recente.
            </div>
          </div>
        </div>
      </div>

      {/* Popup di Richiesta Connessione in Arrivo */}
      {incomingRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#252525] p-6 rounded-lg border border-gray-700 max-w-sm w-full shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-500/20 p-4 rounded-full text-blue-400">
                <Monitor size={32} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-center mb-2">Richiesta di Controllo</h3>
            <p className="text-center text-gray-400 mb-6">
              L'utente con ID <strong className="text-white">{incomingRequest.callerId}</strong> vuole vedere e controllare il tuo schermo.
            </p>
            <div className="flex space-x-3">
              <button onClick={rejectRequest} className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded font-bold transition-colors">
                Rifiuta
              </button>
              <button onClick={acceptRequest} className="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded font-bold flex items-center justify-center transition-colors">
                <Check size={18} className="mr-2" /> Accetta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
