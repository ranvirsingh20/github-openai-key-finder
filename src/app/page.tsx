'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface KeyTestResult {
  key: string;
  status: 'testing' | 'valid' | 'invalid';
  error?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [workingApiKey, setWorkingApiKey] = useState('');
  const [apiKeysInput, setApiKeysInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingKeys, setIsTestingKeys] = useState(false);
  const [keyTestResults, setKeyTestResults] = useState<KeyTestResult[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai-api-key');
    if (savedApiKey) {
      setWorkingApiKey(savedApiKey);
      setShowApiKeyInput(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const parseApiKeys = (input: string): string[] => {
    return input
      .split(/[\n,]+/)
      .map(key => key.trim())
      .filter(key => key.startsWith('sk-') && key.length > 10);
  };

  const testApiKey = async (apiKey: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();
      return data.valid;
    } catch (error) {
      return false;
    }
  };

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeysInput.trim()) return;

    const keys = parseApiKeys(apiKeysInput);
    if (keys.length === 0) {
      alert('Please enter valid API keys (starting with "sk-")');
      return;
    }

    setIsTestingKeys(true);
    setKeyTestResults(keys.map(key => ({ key, status: 'testing' })));

    let foundWorkingKey = false;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      
      // Update status to testing
      setKeyTestResults(prev => 
        prev.map((result, index) => 
          index === i ? { ...result, status: 'testing' } : result
        )
      );

      const isValid = await testApiKey(key);

      if (isValid) {
        // Found a working key
        setKeyTestResults(prev => 
          prev.map((result, index) => 
            index === i ? { ...result, status: 'valid' } : result
          )
        );
        
        localStorage.setItem('openai-api-key', key);
        setWorkingApiKey(key);
        foundWorkingKey = true;
        
        // Wait a bit to show the success state
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setShowApiKeyInput(false);
        setKeyTestResults([]);
        break;
      } else {
        // Invalid key
        setKeyTestResults(prev => 
          prev.map((result, index) => 
            index === i ? { ...result, status: 'invalid' } : result
          )
        );
      }
    }

    if (!foundWorkingKey) {
      alert('No valid API keys found. Please check your keys and try again.');
    }

    setIsTestingKeys(false);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('openai-api-key');
    setWorkingApiKey('');
    setApiKeysInput('');
    setShowApiKeyInput(true);
    setMessages([]);
    setKeyTestResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !workingApiKey) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(({ role, content }) => ({
            role,
            content,
          })),
          apiKey: workingApiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold">ChatGPT Clone</h1>
          {!showApiKeyInput && (
            <button
              onClick={handleClearApiKey}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Change API Keys
            </button>
          )}
        </div>
      </header>

      {showApiKeyInput ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <form onSubmit={handleApiKeySubmit} className="space-y-4">
              <div>
                <label htmlFor="apiKeys" className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI API Keys
                </label>
                <textarea
                  id="apiKeys"
                  value={apiKeysInput}
                  onChange={(e) => setApiKeysInput(e.target.value)}
                  placeholder="Enter API keys (one per line or comma-separated):&#10;sk-proj-abc123...&#10;sk-proj-def456...&#10;sk-proj-ghi789..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 font-mono text-sm"
                  required
                  disabled={isTestingKeys}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Enter multiple API keys. The app will test each one and use the first working key.
                </p>
              </div>

              {keyTestResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Testing keys:</p>
                  {keyTestResults.map((result, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <span className="font-mono">{maskApiKey(result.key)}</span>
                      {result.status === 'testing' && (
                        <span className="text-blue-600">Testing...</span>
                      )}
                      {result.status === 'valid' && (
                        <span className="text-green-600">✓ Valid</span>
                      )}
                      {result.status === 'invalid' && (
                        <span className="text-red-600">✗ Invalid</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={isTestingKeys}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTestingKeys ? 'Testing Keys...' : 'Find Working Key & Start Chatting'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-32">
                  <p className="text-lg">Start a conversation</p>
                  <p className="text-sm mt-2">Type your message below to begin</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] p-4 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 p-4 rounded-lg">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          <div className="border-t bg-white p-4">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}