import React, { useState, useEffect, useRef } from 'react';

const DebugConsole = () => {
  const [logs, setLogs] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type, args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev.slice(-100), { 
        id: Date.now() + Math.random(),
        type, 
        message, 
        time: new Date().toLocaleTimeString() 
      }]);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', args);
    };

    window.onerror = (message, source, lineno, colno, error) => {
      addLog('error', [`Global Error: ${message} at ${source}:${lineno}:${colno}`]);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Toggle console with a secret gesture: triple tap on a specific area is hard.
  // We'll add a tiny button for now or just export the toggle.
  
  if (!isVisible) {
    return (
      <div 
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '30px',
          height: '30px',
          zIndex: 9999,
          background: 'rgba(0,0,0,0.1)',
          cursor: 'pointer'
        }}
        title="Open Debug Console"
      />
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.9)',
      color: '#00ff00',
      zIndex: 10000,
      fontFamily: 'monospace',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      fontSize: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Debug Console</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setLogs([])} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '5px 10px' }}>Clear</button>
          <button onClick={() => setIsVisible(false)} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '5px 10px' }}>Close</button>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-all' 
        }}
      >
        {logs.map(log => (
          <div key={log.id} style={{ 
            marginBottom: '8px', 
            color: log.type === 'error' ? '#ff5555' : (log.type === 'warn' ? '#ffff55' : '#00ff00'),
            borderBottom: '1px solid #222',
            paddingBottom: '4px'
          }}>
            <span style={{ opacity: 0.5, marginRight: '8px' }}>[{log.time}]</span>
            <span>{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && <div style={{ opacity: 0.5 }}>No logs yet...</div>}
      </div>
    </div>
  );
};

export default DebugConsole;
