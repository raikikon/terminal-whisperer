const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('node-pty');
const axios = require('axios');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Singleton terminal session manager
class TerminalSessionManager {
  constructor() {
    this.ptyProcess = null;
    this.lastCommand = '';
    this.lastOutput = '';
    this.outputBuffer = '';
    this.commandHistory = []; // Full chat history with commands and outputs
    this.currentCommand = null; // Track current executing command
    this.isProcessing = false;
  }

  initialize() {
    if (this.ptyProcess) {
      return; // Already initialized
    }

    console.log('\n' + '🚀 '.repeat(20));
    console.log('INITIALIZING TERMINAL SESSION');
    console.log('Platform:', os.platform());
    console.log('Shell:', os.platform() === 'win32' ? 'powershell.exe' : 'bash');
    console.log('🚀 '.repeat(20) + '\n');

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    
    this.ptyProcess = spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || process.cwd(),
      env: process.env
    });

    // Handle terminal output
    this.ptyProcess.onData((data) => {
      this.outputBuffer += data;
      this.lastOutput = this.outputBuffer;
      
      // Debug: Log raw data received
      console.log('\n' + '▼'.repeat(80));
      console.log('📨 TERMINAL OUTPUT RECEIVED');
      console.log('▼'.repeat(80));
      console.log('Data (text):', JSON.stringify(data));
      console.log('Data (hex):', Buffer.from(data).toString('hex'));
      console.log('Data length:', data.length);
      console.log('Contains newline:', data.includes('\n') ? 'YES' : 'NO');
      console.log('Contains carriage return:', data.includes('\r') ? 'YES' : 'NO');
      console.log('▼'.repeat(80) + '\n');
      
      // If we have a current command being executed, append to its output
      if (this.currentCommand) {
        this.currentCommand.output += data;
        
        // Check if command has completed (prompt returned)
        this.checkCommandCompletion(data);
      }
      
      // Broadcast to all connected clients
      io.emit('terminal-output', data);
    });

    this.ptyProcess.onExit((exitCode) => {
      console.log('Terminal process exited with code:', exitCode);
      this.ptyProcess = null;
      io.emit('terminal-closed', { exitCode });
    });

    console.log('Terminal session initialized');
  }

  executeCommand(command) {
    if (!this.ptyProcess) {
      this.initialize();
    }

    this.lastCommand = command;
    
    console.log('\n' + '-'.repeat(80));
    console.log('⚡ EXECUTING COMMAND');
    console.log('-'.repeat(80));
    console.log('Command:', command);
    console.log('Timestamp:', new Date().toISOString());
    console.log('-'.repeat(80) + '\n');
    
    // Create new command entry in history
    const commandEntry = {
      command,
      output: '',
      timestamp: new Date().toISOString(),
      completed: false
    };
    
    // Set as current command to capture output
    this.currentCommand = commandEntry;
    
    // Add to history
    this.commandHistory.push(commandEntry);
    
    // Reset output buffer for new command
    this.outputBuffer = '';

    // Write command to terminal
    this.ptyProcess.write(command + '\r');
    
    return {
      success: true,
      message: 'Command executed',
      command
    };
  }
  
  checkCommandCompletion(data) {
    if (!this.currentCommand || this.currentCommand.completed) {
      return;
    }
    
    // Function to strip ANSI escape codes
    const stripAnsi = (str) => {
      return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    };
    
    // Check if we've received a prompt indicator (command has finished)
    // Common prompt patterns: $, #, >, C:\>, PS>
    const promptPatterns = [
      /\$\s*$/,           // Unix/Linux: user@host:~$
      /#\s*$/,            // Unix/Linux root: root@host:~#
      />\s*$/,            // Windows CMD: C:\>
      /PS>\s*$/,          // PowerShell: PS C:\>
      /\]\$\s*$/,         // Alternative bash: [user@host]$
      /\]#\s*$/,          // Alternative bash root: [user@host]#
    ];
    
    // Check if the last line contains a prompt
    const lines = this.currentCommand.output.split('\n');
    const lastLine = lines[lines.length - 1] || '';
    const cleanLastLine = stripAnsi(lastLine);
    
    // Debug logging - Show everything
    console.log('\n' + '~'.repeat(80));
    console.log('🔍 CHECKING FOR PROMPT COMPLETION');
    console.log('~'.repeat(80));
    console.log('Raw data chunk:', JSON.stringify(data));
    console.log('Raw data hex:', Buffer.from(data).toString('hex'));
    console.log('---');
    console.log('Last line (raw):', JSON.stringify(lastLine));
    console.log('Last line (clean):', JSON.stringify(cleanLastLine));
    console.log('Last line length:', lastLine.length, '(raw)', cleanLastLine.length, '(clean)');
    console.log('Total lines in output:', lines.length);
    console.log('---');
    console.log('Last 5 lines of output:');
    lines.slice(-5).forEach((line, i) => {
      const cleanLine = stripAnsi(line);
      console.log(`  [${lines.length - 5 + i}] raw: ${JSON.stringify(line)}`);
      console.log(`  [${lines.length - 5 + i}] clean: ${JSON.stringify(cleanLine)}`);
    });
    console.log('---');
    console.log('Testing prompt patterns against CLEAN last line:');
    
    const hasPrompt = promptPatterns.some((pattern, index) => {
      const match = pattern.test(cleanLastLine);
      console.log(`  [${index}] ${pattern.toString().padEnd(20)} → ${match ? '✅ MATCHED!' : '❌ no match'}`);
      if (match) {
        console.log(`       ⮑ Matched on: "${cleanLastLine}"`);
      }
      return match;
    });
    
    console.log('---');
    console.log('Result:', hasPrompt ? '🎯 PROMPT DETECTED - COMMAND COMPLETE!' : '⏳ No prompt yet, waiting...');
    console.log('~'.repeat(80) + '\n');
    
    if (hasPrompt) {
      this.finalizeCommand();
    }
  }
  
  finalizeCommand() {
    if (!this.currentCommand || this.currentCommand.completed) {
      return;
    }
    
    const commandEntry = this.currentCommand;
    commandEntry.completed = true;
    
    console.log('\n' + '-'.repeat(80));
    console.log('✅ COMMAND COMPLETED');
    console.log('-'.repeat(80));
    console.log('Command:', commandEntry.command);
    console.log('Output Length:', commandEntry.output.length, 'characters');
    console.log('Total Commands in History:', this.commandHistory.length);
    console.log('-'.repeat(80) + '\n');
    
    // Send completion signal to all connected clients
    const completionSignal = '\n[COMMAND_END]\n';
    commandEntry.output += completionSignal;
    io.emit('terminal-output', completionSignal);
    io.emit('command-completed', {
      command: commandEntry.command,
      timestamp: commandEntry.timestamp,
      outputLength: commandEntry.output.length
    });
    
    this.currentCommand = null;
  }

  getLastCommand() {
    return this.lastCommand;
  }

  getLastOutput() {
    return this.lastOutput;
  }

  getCommandHistory() {
    return this.commandHistory;
  }

  clearHistory() {
    console.log('\n' + '🗑️  '.repeat(20));
    console.log('CLEARING COMMAND HISTORY');
    console.log('Previous history count:', this.commandHistory.length);
    console.log('🗑️  '.repeat(20) + '\n');
    
    this.commandHistory = [];
    this.lastCommand = '';
    this.lastOutput = '';
    this.outputBuffer = '';
    this.currentCommand = null;
    return {
      success: true,
      message: 'Command history cleared'
    };
  }

  resize(cols, rows) {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows);
    }
  }

  destroy() {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
  }
}

// Create singleton instance
const terminalManager = new TerminalSessionManager();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Initialize terminal session when first client connects
  terminalManager.initialize();

  // Send connection confirmation
  socket.emit('connected', { 
    message: 'Connected to terminal session',
    sessionId: socket.id 
  });

  // Handle terminal resize
  socket.on('resize', (data) => {
    const { cols, rows } = data;
    terminalManager.resize(cols, rows);
  });

  // Handle terminal input from client
  socket.on('terminal-input', (data) => {
    if (terminalManager.ptyProcess) {
      terminalManager.ptyProcess.write(data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// REST API Routes

// Execute command endpoint
app.post('/api/execute', (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ 
        error: 'Command is required' 
      });
    }

    const result = terminalManager.executeCommand(command);
    
    res.json(result);
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ 
      error: 'Failed to execute command',
      details: error.message 
    });
  }
});

// Get models from any OpenAI-compatible API endpoint
app.post('/api/models', async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.body;

    if (!baseUrl) {
      return res.status(400).json({ 
        error: 'Base URL is required',
        example: 'https://api.openai.com/v1 or https://api.deepseek.com/v1'
      });
    }

    if (!apiKey) {
      return res.status(400).json({ 
        error: 'API key is required',
        example: 'sk-... (most providers require authentication to list models)'
      });
    }

    console.log('\n' + '🔍 '.repeat(20));
    console.log('FETCHING MODELS FROM API');
    console.log('Base URL:', baseUrl);
    console.log('API Key:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));
    console.log('🔍 '.repeat(20) + '\n');

    // Ensure URL ends with /v1 if not present
    let apiBaseUrl = baseUrl.trim();
    if (!apiBaseUrl.endsWith('/v1')) {
      apiBaseUrl = apiBaseUrl.replace(/\/$/, '') + '/v1';
    }

    const modelsEndpoint = `${apiBaseUrl}/models`;
    
    console.log('Models endpoint:', modelsEndpoint);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const response = await axios.get(modelsEndpoint, { headers });

    console.log('Response status:', response.status);
    console.log('Models found:', response.data.data?.length || response.data?.length || 0);

    // Handle different response formats
    let models = [];
    
    if (response.data.data && Array.isArray(response.data.data)) {
      // Standard OpenAI format
      models = response.data.data.map(model => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description || '',
        context_length: model.context_length || model.max_tokens || 'N/A',
        created: model.created || null
      }));
    } else if (Array.isArray(response.data)) {
      // Some APIs return array directly
      models = response.data.map(model => ({
        id: model.id || model.name,
        name: model.name || model.id,
        description: model.description || '',
        context_length: model.context_length || model.max_tokens || 'N/A',
        created: model.created || null
      }));
    }

    console.log('\n✅ Successfully fetched models');
    console.log('Models list:');
    models.slice(0, 5).forEach((model, i) => {
      console.log(`  ${i + 1}. ${model.id} - ${model.name}`);
    });
    if (models.length > 5) {
      console.log(`  ... and ${models.length - 5} more models`);
    }
    console.log('');

    res.json({
      success: true,
      baseUrl: apiBaseUrl,
      models: models,
      count: models.length
    });

  } catch (error) {
    console.error('\n❌ Error fetching models:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.error?.message || error.message);
    console.error('');
    
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch models',
      details: error.response?.data?.error?.message || error.message,
      statusCode: error.response?.status,
      suggestion: error.response?.status === 401 
        ? 'Invalid API key. Please check your API key and try again.'
        : error.response?.status === 403
        ? 'Access forbidden. Your API key may not have permission to list models.'
        : 'Make sure the base URL is correct and the API key is valid.'
    });
  }
});

// Legacy endpoint for backward compatibility (OpenRouter free models)
app.get('/api/models/free', async (req, res) => {
  try {
    const response = await axios.get('https://openrouter.ai/api/v1/models');
    
    // Filter for free models
    const freeModels = response.data.data.filter(model => {
      return model.pricing && 
             (parseFloat(model.pricing.prompt) === 0 || 
              parseFloat(model.pricing.completion) === 0);
    });

    const modelList = freeModels.map(model => ({
      id: model.id,
      name: model.name,
      description: model.description,
      context_length: model.context_length,
      pricing: model.pricing
    }));

    res.json({
      success: true,
      models: modelList,
      count: modelList.length
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch models',
      details: error.message 
    });
  }
});

// LLM query endpoint for penetration testing suggestions
app.post('/api/llm/suggest', async (req, res) => {
  try {
    const { apiKey, modelName, baseUrl } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!modelName) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    if (!baseUrl) {
      return res.status(400).json({ 
        error: 'Base URL is required',
        example: 'https://api.openai.com/v1 or https://api.deepseek.com/v1'
      });
    }

    const commandHistory = terminalManager.getCommandHistory();

    if (commandHistory.length === 0) {
      return res.status(400).json({ 
        error: 'No command history available. Execute a command first.' 
      });
    }

    // Build conversation history for better context
    let conversationHistory = '';
    commandHistory.forEach((entry, index) => {
      conversationHistory += `\n--- Command ${index + 1} (${entry.timestamp}) ---\n`;
      conversationHistory += `Command: ${entry.command}\n`;
      conversationHistory += `Output:\n${entry.output}\n`; // Send full output, no truncation
    });

    // Construct the prompt for penetration testing with full history
    const prompt = `You are a penetration testing assistant. Based on the following command execution history, suggest ONLY the next penetration testing command to execute. Respond with ONLY the command, no explanations or formatting.

Command History:
${conversationHistory}

Based on this progression of commands and their outputs, provide only the next logical penetration testing command to execute:`;

    console.log('\n' + '='.repeat(80));
    console.log('📤 SENDING TO LLM API');
    console.log('='.repeat(80));
    console.log('Base URL:', baseUrl);
    console.log('Model:', modelName);
    console.log('History Count:', commandHistory.length);
    console.log('\n--- FULL PROMPT ---');
    console.log(prompt);
    console.log('='.repeat(80) + '\n');

    // Ensure URL ends with /v1 if not present
    let apiBaseUrl = baseUrl.trim();
    if (!apiBaseUrl.endsWith('/v1')) {
      apiBaseUrl = apiBaseUrl.replace(/\/$/, '') + '/v1';
    }

    const completionEndpoint = `${apiBaseUrl}/chat/completions`;
    
    console.log('Completion endpoint:', completionEndpoint);

    // Call LLM API with custom base URL
    const response = await axios.post(
      completionEndpoint,
      {
        model: modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const suggestedCommand = response.data.choices[0].message.content.trim();

    console.log('\n' + '='.repeat(80));
    console.log('📥 RECEIVED FROM LLM API');
    console.log('='.repeat(80));
    console.log('Base URL:', baseUrl);
    console.log('Model:', modelName);
    console.log('Suggested Command:', suggestedCommand);
    console.log('='.repeat(80) + '\n');

    res.json({
      success: true,
      historyCount: commandHistory.length,
      lastCommand: commandHistory[commandHistory.length - 1].command,
      suggestedCommand,
      model: modelName,
      baseUrl: apiBaseUrl
    });

  } catch (error) {
    console.error('LLM suggestion error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get LLM suggestion',
      details: error.response?.data?.error?.message || error.message 
    });
  }
});

// Get command history
app.get('/api/history', (req, res) => {
  const history = terminalManager.getCommandHistory();
  res.json({
    success: true,
    count: history.length,
    history: history
  });
});

// Get last command and output (backward compatibility)
app.get('/api/history/last', (req, res) => {
  const history = terminalManager.getCommandHistory();
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  
  res.json({
    lastCommand: lastEntry ? lastEntry.command : '',
    lastOutput: lastEntry ? lastEntry.output : '',
    timestamp: lastEntry ? lastEntry.timestamp : null
  });
});

// Clear command history - Start new session
app.post('/api/history/clear', (req, res) => {
  const result = terminalManager.clearHistory();
  res.json(result);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    terminalActive: !!terminalManager.ptyProcess,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO ready for connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing terminal session...');
  terminalManager.destroy();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing terminal session...');
  terminalManager.destroy();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
