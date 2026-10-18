import React, { useState } from 'react';
import {
  Save,
  Activity,
  Download,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ProviderConfig, ApiProtocol, AuthMethod } from '@shared/types';
import { PROVIDER_PRESETS } from '@shared/constants';
import { useProviderStore } from '../../store/useProviderStore';

const PRESET_RECOMMENDED_MODELS: Record<string, string[]> = {
  'Google Gemini': [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-thinking-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ],
  'OpenAI': ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
  'OpenRouter (1M+ Models)': [
    'openrouter/free',
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-coder-32b-instruct:free',
    'deepseek/deepseek-chat',
  ],
  'DeepSeek': ['deepseek-chat', 'deepseek-reasoner'],
  'Ollama (Local)': ['llama3:latest', 'mistral', 'qwen2.5:latest', 'deepseek-r1:latest'],
};

interface ProviderFormProps {
  initialConfig?: Partial<ProviderConfig>;
  onSaved: () => void;
  onCancel: () => void;
}

export const ProviderForm: React.FC<ProviderFormProps> = ({
  initialConfig,
  onSaved,
  onCancel,
}) => {
  const { saveProvider, testProvider, fetchModelsForProvider, isTesting, testResult } = useProviderStore();

  const [form, setForm] = useState<ProviderConfig>({
    id: initialConfig?.id || crypto.randomUUID(),
    name: initialConfig?.name || '',
    baseUrl: initialConfig?.baseUrl || 'https://api.openai.com/v1',
    chatEndpoint: initialConfig?.chatEndpoint || '/chat/completions',
    apiKey: initialConfig?.apiKey || '',
    modelListUrl: initialConfig?.modelListUrl || '/models',
    defaultModel: initialConfig?.defaultModel || '',
    protocol: initialConfig?.protocol || 'openai-chat',
    authMethod: initialConfig?.authMethod || 'bearer',
    customHeaders: initialConfig?.customHeaders || {},
    customBodyParams: initialConfig?.customBodyParams || {},
    requestTimeout: initialConfig?.requestTimeout || 60000,
    maxRetries: initialConfig?.maxRetries ?? 2,
    streamingEnabled: initialConfig?.streamingEnabled ?? true,
    organizationId: initialConfig?.organizationId || '',
    projectId: initialConfig?.projectId || '',
    tenantId: initialConfig?.tenantId || '',
    apiVersion: initialConfig?.apiVersion || '',
    fileUploadEndpoint: initialConfig?.fileUploadEndpoint || '',
    embeddingsEndpoint: initialConfig?.embeddingsEndpoint || '',
    customMapping: initialConfig?.customMapping || {
      roleMapping: { system: 'system', user: 'user', assistant: 'assistant' },
      modelField: 'model',
      messagesField: 'messages',
      streamField: 'stream',
      responsePath: 'choices[0].message.content',
      streamChunkPath: 'choices[0].delta.content',
    },
    createdAt: initialConfig?.createdAt || Date.now(),
    updatedAt: Date.now(),
  });

  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [headerKey, setHeaderKey] = useState('');
  const [headerVal, setHeaderVal] = useState('');
  const [bodyJson, setBodyJson] = useState(JSON.stringify(form.customBodyParams, null, 2));
  const [bodyJsonError, setBodyJsonError] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const applyPreset = (presetName: string) => {
    const preset = PROVIDER_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      name: preset.name || prev.name,
      baseUrl: preset.baseUrl || prev.baseUrl,
      chatEndpoint: preset.chatEndpoint || prev.chatEndpoint,
      modelListUrl: preset.modelListUrl || prev.modelListUrl,
      protocol: (preset.protocol as ApiProtocol) || prev.protocol,
      authMethod: (preset.authMethod as AuthMethod) || prev.authMethod,
      streamingEnabled: preset.streamingEnabled ?? prev.streamingEnabled,
      defaultModel: preset.defaultModel || prev.defaultModel,
      customMapping: preset.customMapping || prev.customMapping,
    }));
  };

  const handleAddHeader = () => {
    if (headerKey.trim()) {
      setForm((prev) => ({
        ...prev,
        customHeaders: { ...prev.customHeaders, [headerKey.trim()]: headerVal.trim() },
      }));
      setHeaderKey('');
      setHeaderVal('');
    }
  };

  const handleRemoveHeader = (key: string) => {
    const updated = { ...form.customHeaders };
    delete updated[key];
    setForm((prev) => ({ ...prev, customHeaders: updated }));
  };

  const handleBodyJsonChange = (val: string) => {
    setBodyJson(val);
    try {
      const parsed = JSON.parse(val);
      setForm((prev) => ({ ...prev, customBodyParams: parsed }));
      setBodyJsonError(null);
    } catch (e: any) {
      setBodyJsonError('Invalid JSON format');
    }
  };

  const handleTest = async () => {
    await testProvider(form);
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    try {
      const list = await fetchModelsForProvider(form);
      setDiscoveredModels(list.map((m) => m.id));
      if (list.length > 0 && !form.defaultModel) {
        setForm((prev) => ({ ...prev, defaultModel: list[0].id }));
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.baseUrl.trim() || !form.chatEndpoint.trim()) {
      alert('Please fill out Provider Name, Base URL, and Chat Endpoint.');
      return;
    }
    await saveProvider(form);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs text-foreground">
      {/* Top Presets Selector */}
      <div className="p-3 bg-secondary/40 rounded-lg border border-border flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-foreground" />
          <span className="font-semibold text-foreground text-xs">Load Preset:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PROVIDER_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p.name!)}
              className="px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium border border-border transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Basic Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Basic Configuration
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1.5 font-medium text-foreground">Provider Display Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. OpenAI / Groq / Local Ollama"
              className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block mb-1.5 font-medium text-foreground">API Protocol Format *</label>
            <select
              value={form.protocol}
              onChange={(e) => setForm({ ...form, protocol: e.target.value as ApiProtocol })}
              className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="openai-chat">OpenAI-compatible Chat Completions</option>
              <option value="openai-responses">OpenAI Responses API</option>
              <option value="custom-json">Custom JSON API (Configurable Mapping)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1.5 font-medium text-foreground">Base API URL *</label>
            <input
              type="text"
              required
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
              className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block mb-1.5 font-medium text-foreground">Chat Endpoint Path *</label>
            <input
              type="text"
              required
              value={form.chatEndpoint}
              onChange={(e) => setForm({ ...form, chatEndpoint: e.target.value })}
              placeholder="/chat/completions or full URL"
              className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono text-[11px]"
            />
          </div>
        </div>
      </div>

      {/* Authentication */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Authentication
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1.5 font-medium text-foreground">Auth Method</label>
            <select
              value={form.authMethod}
              onChange={(e) => setForm({ ...form, authMethod: e.target.value as AuthMethod })}
              className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="bearer">Bearer Token (Authorization: Bearer &lt;key&gt;)</option>
              <option value="api-key-header">API Key Header (api-key / x-api-key)</option>
              <option value="basic">Basic Auth</option>
              <option value="custom-header">Custom Header Only</option>
              <option value="none">None (Local Ollama / LM Studio without auth)</option>
            </select>
          </div>

          <div>
            <label className="block mb-1.5 font-medium text-foreground">API Key / Secret</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={form.baseUrl.includes('googleapis.com') ? 'AIzaSy...' : 'sk-...'}
                className="w-full bg-card border border-border rounded-md pl-3 pr-9 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle Password Visibility"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {form.baseUrl.includes('generativelanguage.googleapis.com') && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Enter your Gemini API key from <span className="text-foreground font-medium">Google AI Studio</span> (starts with AIzaSy...).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Model Discovery */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Model Discovery
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block mb-1.5 font-medium text-foreground">Model-List URL Endpoint</label>
            <input
              type="text"
              value={form.modelListUrl}
              onChange={(e) => setForm({ ...form, modelListUrl: e.target.value })}
              placeholder="/models or full URL"
              className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block mb-1.5 font-medium text-foreground">Default Model</label>
            <input
              type="text"
              value={form.defaultModel}
              onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
              placeholder="e.g. gemini-2.5-flash or gpt-4o"
              className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Quick Model Recommendations */}
        {(() => {
          const isGemini =
            form.name.toLowerCase().includes('gemini') ||
            form.baseUrl.includes('generativelanguage.googleapis.com');
          const matchedKey = Object.keys(PRESET_RECOMMENDED_MODELS).find(
            (k) =>
              (isGemini && k === 'Google Gemini') ||
              form.name.toLowerCase().includes(k.toLowerCase().split(' ')[0])
          );
          const quickList = matchedKey ? PRESET_RECOMMENDED_MODELS[matchedKey] : undefined;
          if (!quickList || quickList.length === 0) return null;

          return (
            <div className="p-2.5 bg-secondary/20 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground block mb-1.5 font-semibold uppercase tracking-wider">
                Recommended Models for {matchedKey}: Click to select
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickList.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({ ...form, defaultModel: m })}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                      form.defaultModel === m
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent border border-border'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Fetch Models & Test Connection actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleFetchModels}
            disabled={isFetchingModels}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground font-medium border border-border transition-colors text-xs"
          >
            {isFetchingModels ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Fetch Models</span>
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground font-medium border border-border transition-colors text-xs"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
            )}
            <span>Test Connection</span>
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${
              testResult.success
                ? 'bg-secondary/40 border-border text-foreground'
                : 'bg-destructive/10 border-destructive/20 text-destructive'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{testResult.message}</p>
              {testResult.latencyMs > 0 && (
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  Latency: {testResult.latencyMs}ms
                </p>
              )}
            </div>
          </div>
        )}

        {/* Discovered models quick chips */}
        {discoveredModels.length > 0 && (
          <div className="p-3 bg-secondary/30 rounded-lg border border-border">
            <span className="text-[10px] text-muted-foreground block mb-1.5 font-semibold uppercase tracking-wider">
              Discovered Models ({discoveredModels.length}): Click to select as default
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {discoveredModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, defaultModel: m })}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    form.defaultModel === m
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent border border-border'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Toggle */}
      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>Advanced Configuration (Headers, Body, Organization, Custom JSON Mapping)</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-3 border-l border-border animate-in fade-in duration-150">
            {/* Headers Editor */}
            <div>
              <label className="block mb-1.5 font-medium text-foreground">Custom HTTP Headers</label>
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  placeholder="Header Name (e.g. X-Custom-Auth)"
                  value={headerKey}
                  onChange={(e) => setHeaderKey(e.target.value)}
                  className="flex-1 bg-card border border-border rounded-md px-2.5 py-1 text-foreground font-mono text-[11px]"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={headerVal}
                  onChange={(e) => setHeaderVal(e.target.value)}
                  className="flex-1 bg-card border border-border rounded-md px-2.5 py-1 text-foreground font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="p-1.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground border border-border"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {Object.entries(form.customHeaders).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1 px-2.5 rounded-md bg-secondary/40 border border-border mb-1">
                  <span className="font-mono text-foreground">{k}: <span className="text-muted-foreground">{v}</span></span>
                  <button
                    type="button"
                    onClick={() => handleRemoveHeader(k)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Custom Request Body JSON */}
            <div>
              <label className="block mb-1.5 font-medium text-foreground">Custom Request Body (JSON)</label>
              <textarea
                rows={3}
                value={bodyJson}
                onChange={(e) => handleBodyJsonChange(e.target.value)}
                placeholder='{ "custom_param": "value" }'
                className="w-full bg-card border border-border rounded-md p-2.5 font-mono text-[11px] text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              {bodyJsonError && <p className="text-destructive text-[10px] mt-0.5">{bodyJsonError}</p>}
            </div>

            {/* Network tuning */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-foreground">Timeout (ms)</label>
                <input
                  type="number"
                  value={form.requestTimeout}
                  onChange={(e) => setForm({ ...form, requestTimeout: parseInt(e.target.value) || 60000 })}
                  className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block mb-1 text-foreground">Max Retries</label>
                <input
                  type="number"
                  value={form.maxRetries}
                  onChange={(e) => setForm({ ...form, maxRetries: parseInt(e.target.value) || 0 })}
                  className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block mb-1 text-foreground">Streaming Enabled</label>
                <select
                  value={form.streamingEnabled ? 'yes' : 'no'}
                  onChange={(e) => setForm({ ...form, streamingEnabled: e.target.value === 'yes' })}
                  className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-foreground"
                >
                  <option value="yes">Yes (Server-Sent Events)</option>
                  <option value="no">No (Non-streaming)</option>
                </select>
              </div>
            </div>

            {/* Organization / Project / API Version */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-foreground">Organization ID</label>
                <input
                  type="text"
                  value={form.organizationId || ''}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                  placeholder="org-..."
                  className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-foreground font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block mb-1 text-foreground">Project ID</label>
                <input
                  type="text"
                  value={form.projectId || ''}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  placeholder="proj_..."
                  className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-foreground font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block mb-1 text-foreground">API Version</label>
                <input
                  type="text"
                  value={form.apiVersion || ''}
                  onChange={(e) => setForm({ ...form, apiVersion: e.target.value })}
                  placeholder="2024-02-15-preview"
                  className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-foreground font-mono text-[11px]"
                />
              </div>
            </div>

            {/* Custom JSON Protocol Mapping */}
            {form.protocol === 'custom-json' && (
              <div className="p-3 bg-secondary/30 rounded-lg border border-border space-y-2">
                <span className="font-semibold text-foreground block">Custom JSON API Mapping</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted-foreground">Response Path</label>
                    <input
                      type="text"
                      value={form.customMapping?.responsePath || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          customMapping: { ...form.customMapping, responsePath: e.target.value },
                        })
                      }
                      placeholder="output.text or choices[0].message.content"
                      className="w-full bg-card border border-border rounded px-2 py-1 text-foreground font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground">Stream Chunk Path</label>
                    <input
                      type="text"
                      value={form.customMapping?.streamChunkPath || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          customMapping: { ...form.customMapping, streamChunkPath: e.target.value },
                        })
                      }
                      placeholder="delta.content or token"
                      className="w-full bg-card border border-border rounded px-2 py-1 text-foreground font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Submission Footer */}
      <div className="flex items-center justify-end space-x-2 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-secondary hover:bg-accent text-secondary-foreground font-medium text-xs border border-border transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center space-x-2 px-4 py-2 rounded-md bg-primary hover:opacity-90 text-primary-foreground font-medium text-xs shadow-sm transition-opacity"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Provider</span>
        </button>
      </div>
    </form>
  );
};
