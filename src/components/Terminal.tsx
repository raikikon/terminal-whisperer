import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

export function Terminal({ onInput, onResize }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      fitAddonRef.current.fit();
      onResize(terminalRef.current.cols, terminalRef.current.rows);
    }
  }, [onResize]);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.onData((data) => {
      onInput(data);
    });

    window.addEventListener('resize', handleResize);

    // Initial resize notification
    onResize(terminal.cols, terminal.rows);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [onInput, onResize, handleResize]);

  // Expose write method
  useEffect(() => {
    const handleWrite = (e: CustomEvent<string>) => {
      terminalRef.current?.write(e.detail);
    };

    window.addEventListener('terminal-write' as any, handleWrite);
    return () => window.removeEventListener('terminal-write' as any, handleWrite);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[400px] bg-[#0d1117] rounded-lg overflow-hidden"
    />
  );
}

// Helper function to write to terminal from outside
export function writeToTerminal(data: string) {
  window.dispatchEvent(new CustomEvent('terminal-write', { detail: data }));
}
