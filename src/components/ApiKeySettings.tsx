import React, { useState } from 'react';
import { Shield, Key, Cpu, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { AiProvider, AiModelConfig } from '../types';

interface ApiKeySettingsProps {
  config: AiModelConfig;
  onChange: (newConfig: AiModelConfig) => void;
}

export default function ApiKeySettings({ config, onChange }: ApiKeySettingsProps) {
  const [showKey, setShowKey] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Supported models map with IDs and human labels
  const modelsMap: Record<AiProvider, { label: string; id: string }[]> = {
    gemini: [
      { label: 'Gemini 3.5 Flash', id: 'gemini-3.5-flash' },
      { label: 'Gemini 3.1 Pro Preview', id: 'gemini-3.1-pro-preview' },
      { label: 'Gemini 3.1 Flash Lite', id: 'gemini-3.1-flash-lite' },
      { label: 'Gemini 3.0 Flash', id: 'gemini-3.0-flash' },
    ],
    openai: [
      { label: 'GPT-5.5 (Flagship)', id: 'gpt-5.5' },
      { label: 'GPT-5.4 Mini', id: 'gpt-5.4-mini' },
      { label: 'GPT-4o', id: 'gpt-4o' },
    ],
    anthropic: [
      { label: 'Claude 4.8 Opus', id: 'claude-4.8-opus' },
      { label: 'Claude 4.6 Sonnet', id: 'claude-4.6-sonnet' },
      { label: 'Claude 4.5 Haiku', id: 'claude-4.5-haiku' },
      { label: 'Claude 3.5 Sonnet', id: 'claude-3-5-sonnet-latest' },
    ],
    grok: [
      { label: 'Grok 4.3 Agentic', id: 'grok-4.3' },
      { label: 'Grok 4.20 Flagship', id: 'grok-4.20' },
      { label: 'Grok 2 Vision', id: 'grok-2-vision-1212' },
    ]
  };

  // Suggested model names based on selected provider
  const placeholderModels: Record<AiProvider, string> = {
    gemini: 'gemini-3.5-flash',
    openai: 'gpt-5.5',
    anthropic: 'claude-4.8-opus',
    grok: 'grok-4.3'
  };

  const handleProviderChange = (provider: AiProvider) => {
    onChange({
      provider,
      modelName: placeholderModels[provider],
      customKey: ''
    });
  };

  const handleModelNameChange = (modelName: string) => {
    onChange({ ...config, modelName });
  };

  const handleKeyChange = (customKey: string) => {
    onChange({ ...config, customKey });
  };

  return (
    <div className="bg-white dark:bg-tokyo-panel border border-slate-200 dark:border-tokyo-border rounded-lg p-5 text-slate-700 dark:text-tokyo-text shadow-sm transition-colors duration-150" id="api-keys-container">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-tokyo-border pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-blue-600 dark:text-tokyo-blue" />
          <h3 className="font-display font-semibold text-sm tracking-wide text-slate-900 dark:text-tokyo-text uppercase">
            AI Reviewer Engine
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-slate-400 dark:text-tokyo-muted hover:text-blue-600 dark:hover:text-tokyo-blue transition-colors"
          title="Engine Specifications info"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      {showHelp && (
        <div className="text-xs text-slate-500 dark:text-tokyo-muted mb-4 bg-slate-50 dark:bg-tokyo-input p-3 rounded border border-slate-200 dark:border-tokyo-border leading-relaxed font-sans transition-colors duration-150">
          <p className="mb-2">
            <strong>StructureSight Direct Node Tunneling:</strong> By default, calls are routed securely server-side through Google Gemini 3.5 Flash without any configuration.
          </p>
          <p>
            To use advanced reasoning models, configure your own private key below. Keys are strictly held in the active tab session and never saved on disk.
          </p>
        </div>
      )}

      {/* Provider Selector */}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 dark:text-tokyo-comment uppercase tracking-wider mb-2">
            AI Service Provider
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['gemini', 'openai', 'anthropic', 'grok'] as AiProvider[]).map((p) => {
              const isSelected = config.provider === p;
              return (
                <button
                  key={p}
                  type="button"
                  id={`provider-btn-${p}`}
                  onClick={() => handleProviderChange(p)}
                  className={`py-2 px-3 text-xs rounded font-medium border text-center transition-all duration-150 capitalize cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-tokyo-blue/10 border-blue-500 dark:border-tokyo-blue text-blue-700 dark:text-tokyo-blue shadow-sm font-semibold'
                      : 'bg-slate-50 dark:bg-tokyo-input border-slate-200 dark:border-tokyo-border hover:bg-slate-100 dark:hover:bg-tokyo-card text-slate-600 dark:text-tokyo-muted'
                  }`}
                >
                  {p === 'gemini' ? 'Gemini' : p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Input */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 dark:text-tokyo-comment uppercase tracking-wider mb-1.5" htmlFor="model-name-select">
            Model Specifier
          </label>
          <select
            id="model-name-select"
            className="w-full bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border rounded px-3 py-2 text-xs font-mono text-slate-800 dark:text-tokyo-text outline-none focus:border-blue-500 dark:focus:border-tokyo-blue focus:ring-1 focus:ring-blue-500 dark:focus:ring-tokyo-blue transition-all cursor-pointer"
            value={config.modelName}
            onChange={(e) => handleModelNameChange(e.target.value)}
          >
            {modelsMap[config.provider].map((m) => (
              <option key={m.id} value={m.id} className="bg-white dark:bg-tokyo-panel text-slate-800 dark:text-tokyo-text">
                {m.label} ({m.id})
              </option>
            ))}
          </select>
        </div>

        {/* Config / Custom API Key Input if needed */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] font-bold text-slate-400 dark:text-tokyo-comment uppercase tracking-wider" htmlFor="api-key-input">
              {config.provider === 'gemini' ? 'Custom Gemini API Key (Optional)' : `${config.provider.toUpperCase()} Private API Key`}
            </label>
            <span className="text-[10px] text-emerald-600 dark:text-tokyo-green font-mono flex items-center gap-1">
              <Shield className="h-3 w-3" /> Secure Link
            </span>
          </div>
          
          <div className="relative">
            <input
              id="api-key-input"
              type={showKey ? 'text' : 'password'}
              className="w-full bg-slate-50 dark:bg-tokyo-input border border-slate-200 dark:border-tokyo-border rounded pl-8 pr-10 py-2 text-xs font-mono text-slate-800 dark:text-tokyo-text outline-none focus:border-blue-500 dark:focus:border-tokyo-blue focus:ring-1 focus:ring-blue-500 dark:focus:ring-tokyo-blue transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={config.customKey || ''}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={
                config.provider === 'gemini' 
                  ? 'Leave blank to use pre-configured server key' 
                  : `Enter private ${config.provider} api key`
              }
            />
            <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-tokyo-muted" />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 px-1 top-2 hover:text-blue-600 dark:hover:text-tokyo-blue text-slate-400 dark:text-tokyo-muted transition-colors focus:outline-none"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {config.provider !== 'gemini' && !config.customKey && (
            <div className="text-[9px] text-amber-700 dark:text-tokyo-yellow bg-amber-50 dark:bg-tokyo-yellow/10 border border-amber-200/60 dark:border-tokyo-yellow/20 rounded p-1.5 mt-1.5 leading-snug font-mono">
              ⚠️ Custom provider requires a private API key to initiate request tunneling.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
