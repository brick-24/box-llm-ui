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
    <form onSubmit={handleSubmit} className="space-y-6 text-xs text-zinc-300">
      {/* Top Presets Selector */}
      <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-zinc-200">Load Preset Template:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PROVIDER_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p.name!)}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Basic Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
          Basic Configuration
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 font-medium text-zinc-300">Provider Display Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. OpenAI / Groq / Local Ollama"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium text-zinc-300">API Protocol Format *</label>
            <select
              value={form.protocol}
              onChange={(e) => setForm({ ...form, protocol: e.target.value as ApiProtocol })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            >
              <option value="openai-chat">OpenAI-compatible Chat Completions</option>
              <option value="openai-responses">OpenAI Responses API</option>
              <option value="custom-json">Custom JSON API (Configurable Mapping)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 font-medium text-zinc-300">Base API URL *</label>
            <input
              type="text"
              required
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 outline-none focus:border-violet-500 font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium text-zinc-300">Chat Endpoint Path *</label>
            <input
              type="text"
              required
              value={form.chatEndpoint}
              onChange={(e) => setForm({ ...form, chatEndpoint: e.target.value })}
              placeholder="/chat/completions or full URL"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 outline-none focus:border-violet-500 font-mono text-[11px]"
            />
          </div>
        </div>
      </div>

      {/* Authentication */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
          Authentication
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 font-medium text-zinc-300">Auth Method</label>
            <select
              value={form.authMethod}
              onChange={(e) => setForm({ ...form, authMethod: e.target.value as AuthMethod })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            >
              <option value="bearer">Bearer Token (Authorization: Bearer &lt;key&gt;)</option>
              <option value="api-key-header">API Key Header (api-key / x-api-key)</option>
              <option value="basic">Basic Auth</option>
              <option value="custom-header">Custom Header Only</option>
              <option value="none">None (Local Ollama / LM Studio without auth)</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium text-zinc-300">API Key / Secret</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-3 pr-9 py-2 text-zinc-100 outline-none focus:border-violet-500 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Model Discovery */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
          Model Discovery
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block mb-1 font-medium text-zinc-300">Model-List URL Endpoint</label>
            <input
              type="text"
              value={form.modelListUrl}
              onChange={(e) => setForm({ ...form, modelListUrl: e.target.value })}
              placeholder="/models or full URL"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 outline-none focus:border-violet-500 font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium text-zinc-300">Default Model</label>
            <input
              type="text"
              value={form.defaultModel}
              onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
              placeholder="e.g. gpt-4o or llama3"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 outline-none focus:border-violet-500 font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Fetch Models & Test Connection actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleFetchModels}
            disabled={isFetchingModels}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
          >
            {isFetchingModels ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-violet-400" />
            )}
            <span>Fetch Models</span>
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Test Connection</span>
          </button>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start space-x-2.5 ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{testResult.message}</p>
              {testResult.latencyMs > 0 && (
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  Latency: {testResult.latencyMs}ms
                </p>
              )}
            </div>
          </div>
        )}

        {/* Discovered models quick chips */}
        {discoveredModels.length > 0 && (
          <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block mb-1.5 font-semibold">
              Discovered Models ({discoveredModels.length}): Click to select as default
            </span>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
              {discoveredModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, defaultModel: m })}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    form.defaultModel === m
                      ? 'bg-violet-600 text-white font-semibold'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
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
      <div className="pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-semibold"
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>Advanced Configuration (Headers, Body, Organization, Custom JSON Mapping)</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-2 border-l-2 border-zinc-800 animate-in fade-in duration-200">
            {/* Headers Editor */}
            <div>
              <label className="block mb-1 font-semibold text-zinc-300">Custom HTTP Headers</label>
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  placeholder="Header Name (e.g. X-Custom-Auth)"
                  value={headerKey}
                  onChange={(e) => setHeaderKey(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-[11px]"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={headerVal}
                  onChange={(e) => setHeaderVal(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {Object.entries(form.customHeaders).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1 px-2 rounded bg-zinc-900/60 mb-1">
                  <span className="font-mono text-violet-400">{k}: <span className="text-zinc-300">{v}</span></span>
                  <button
                    type="button"
                    onClick={() => handleRemoveHeader(k)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Custom Request Body JSON */}
            <div>
              <label className="block mb-1 font-semibold text-zinc-300">Custom Request Body (JSON)</label>
              <textarea
                rows={3}
                value={bodyJson}
                onChange={(e) => handleBodyJsonChange(e.target.value)}
                placeholder='{ "custom_param": "value" }'
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-2.5 font-mono text-[11px] text-zinc-200 outline-none"
              />
              {bodyJsonError && <p className="text-red-400 text-[10px] mt-0.5">{bodyJsonError}</p>}
            </div>

            {/* Network tuning */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-zinc-300">Timeout (ms)</label>
                <input
                  type="number"
                  value={form.requestTimeout}
                  onChange={(e) => setForm({ ...form, requestTimeout: parseInt(e.target.value) || 60000 })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100"
                />
              </div>

              <div>
                <label className="block mb-1 text-zinc-300">Max Retries</label>
                <input
                  type="number"
                  value={form.maxRetries}
                  onChange={(e) => setForm({ ...form, maxRetries: parseInt(e.target.value) || 0 })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100"
                />
              </div>

              <div>
                <label className="block mb-1 text-zinc-300">Streaming Enabled</label>
                <select
                  value={form.streamingEnabled ? 'yes' : 'no'}
                  onChange={(e) => setForm({ ...form, streamingEnabled: e.target.value === 'yes' })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100"
                >
                  <option value="yes">Yes (Server-Sent Events)</option>
                  <option value="no">No (Non-streaming)</option>
                </select>
              </div>
            </div>

            {/* Organization / Project / API Version */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-zinc-300">Organization ID</label>
                <input
                  type="text"
                  value={form.organizationId || ''}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                  placeholder="org-..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block mb-1 text-zinc-300">Project ID</label>
                <input
                  type="text"
                  value={form.projectId || ''}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  placeholder="proj_..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block mb-1 text-zinc-300">API Version</label>
                <input
                  type="text"
                  value={form.apiVersion || ''}
                  onChange={(e) => setForm({ ...form, apiVersion: e.target.value })}
                  placeholder="2024-02-15-preview"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-[11px]"
                />
              </div>
            </div>

            {/* Custom JSON Protocol Mapping */}
            {form.protocol === 'custom-json' && (
              <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
                <span className="font-semibold text-violet-300 block">Custom JSON API Mapping</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400">Response Path</label>
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
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-100 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400">Stream Chunk Path</label>
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
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-100 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Submission Footer */}
      <div className="flex items-center justify-end space-x-2 pt-4 border-t border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md shadow-violet-600/30 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Save Provider</span>
        </button>
      </div>
    </form>
  );
};
