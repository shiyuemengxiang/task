import React, { useState, useEffect } from 'react';
import { BellRing, Save, Send, Info, LogOut, RefreshCw, Eye, EyeOff, Lock, User as UserIcon, CalendarCheck, Download, Database, AlertTriangle, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { sendWebhook } from '../services/notificationService';
import { getStorage } from '../services/storageAdapter';
import { login, register, logout, getCurrentUser, User, AuthResult } from '../services/authService';
import { loadTasks, saveSettings } from '../services/taskManager';
import { downloadCalendarFile } from '../services/calendarService';

interface MinePageProps {
    onUserChange?: () => void; // Callback to reload tasks in parent
}

export const MinePage: React.FC<MinePageProps> = ({ onUserChange }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Auth Form State
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<AuthResult | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isDbInitLoading, setIsDbInitLoading] = useState(false);
  
  // Health Check State
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{status: string, message?: string, tablesExist?: boolean} | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  
  // Settings State
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    const url = getStorage('cyclic_webhook_url');
    if (url) setWebhookUrl(url);
  }, []);

  const handleSave = async () => {
    // Save to local and cloud
    await saveSettings(webhookUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!username || !password) {
          setAuthError({ success: false, message: '请输入用户名和密码', errorType: 'UNKNOWN' });
          return;
      }
      
      setAuthError(null);
      setAuthLoading(true);
      setShowDiagnostics(false);
      
      try {
        let result: AuthResult;
        if (isLoginMode) {
            result = await login(username, password);
        } else {
            result = await register(username, password);
        }

        if (result.success) {
            const user = getCurrentUser();
            setCurrentUser(user);
            setUsername('');
            setPassword('');
            if (onUserChange) onUserChange();
        } else {
            setAuthError(result);
            // If it's a network error or DB error, automatically show diagnostics option
            if (result.errorType === 'NETWORK_ERROR' || result.errorType === 'DB_NOT_INIT') {
                setShowDiagnostics(true);
            }
        }
      } finally {
        setAuthLoading(false);
      }
  };

  const checkHealth = async () => {
      setHealthLoading(true);
      try {
          const res = await fetch('/api/health');
          const data = await res.json();
          setHealthStatus(data);
          
          if (data.status === 'ok' && !data.tablesExist) {
              setAuthError({ 
                  success: false, 
                  message: '数据库连接正常，但表未创建', 
                  errorType: 'DB_NOT_INIT' 
              });
          }
      } catch (e) {
          setHealthStatus({ status: 'error', message: '无法连接到服务器 API' });
      } finally {
          setHealthLoading(false);
      }
  };

  const handleInitDb = async () => {
      setIsDbInitLoading(true);
      try {
          const res = await fetch('/api/create-table');
          const data = await res.json();
          if (res.ok) {
              alert('数据库初始化成功！请重新尝试登录或注册。');
              setAuthError(null);
              setHealthStatus(prev => prev ? { ...prev, tablesExist: true } : null);
              setShowDiagnostics(false);
          } else {
              alert(`初始化失败: ${JSON.stringify(data)}`);
          }
      } catch (e) {
          alert('初始化请求失败，请检查网络');
      } finally {
          setIsDbInitLoading(false);
      }
  };

  const handleLogout = () => {
      if(window.confirm('确定要退出登录吗？')) {
          logout();
          setCurrentUser(null);
          if (onUserChange) onUserChange();
      }
  };

  const handleSync = async () => {
      if (!currentUser) return;
      setSyncing(true);
      try {
          if (onUserChange) {
            await onUserChange();
            alert('同步完成！');
          }
      } catch (e) {
          alert('同步失败');
      } finally {
          setSyncing(false);
      }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    setTesting(true);
    try {
        const success = await sendWebhook(webhookUrl, "测试推送", "恭喜！配置成功，Vercel 后台调度服务将使用此地址进行推送。");
        if (success) {
            alert("发送成功！");
        } else {
            alert("发送失败，请检查 URL 或跨域设置。");
        }
    } catch (e) {
        alert("发送出错");
    } finally {
        setTesting(false);
    }
  };

  // --- Render: Login / Register Form ---
  if (!currentUser) {
      return (
        <div className="px-5 pt-12 pb-24 animate-in slide-in-from-bottom-4 duration-300 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-xs">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-4 rotate-3">
                        <UserIcon size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">{isLoginMode ? '欢迎回来' : '创建账号'}</h2>
                    <p className="text-gray-400 text-sm mt-1">
                        {isLoginMode ? '登录以同步您的任务进度' : '注册账号开始您的自律之旅'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input 
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="用户名"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input 
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="密码"
                            className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {/* Error Display Area */}
                    {authError && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 animate-in fade-in">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={14} />
                                <div className="text-xs text-red-600 font-medium break-all">
                                    {authError.message}
                                </div>
                            </div>
                            
                            {/* Initialize DB Button if specific error detected */}
                            {authError.errorType === 'DB_NOT_INIT' && (
                                <button 
                                    type="button"
                                    onClick={handleInitDb}
                                    disabled={isDbInitLoading}
                                    className="mt-2 w-full py-2 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isDbInitLoading ? <RefreshCw className="animate-spin" size={12} /> : <Database size={12} />}
                                    点击初始化数据库
                                </button>
                            )}

                             {/* Helper for missing config */}
                             {authError.errorType === 'DB_CONFIG_MISSING' && (
                                <div className="mt-2 text-[10px] text-red-500 pl-6">
                                    请前往 Vercel 控制台 -&gt; Storage -&gt; Connect 绑定 Postgres 数据库并重新部署。
                                </div>
                            )}
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 shadow-lg shadow-gray-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center gap-2 items-center"
                    >
                        {authLoading && <RefreshCw className="animate-spin" size={18} />}
                        {authLoading ? '处理中...' : (isLoginMode ? '立即登录' : '注册账号')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => {
                            setIsLoginMode(!isLoginMode);
                            setAuthError(null);
                            setShowDiagnostics(false);
                            setUsername('');
                            setPassword('');
                        }}
                        className="text-sm text-blue-600 font-bold hover:underline"
                    >
                        {isLoginMode ? '没有账号？去注册' : '已有账号？去登录'}
                    </button>
                </div>

                {/* Diagnostics Section */}
                {showDiagnostics && (
                    <div className="mt-6 border-t border-gray-100 pt-4 animate-in fade-in">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                 <Activity size={12} />
                                 连接诊断
                             </h3>
                             <button 
                                onClick={checkHealth}
                                disabled={healthLoading}
                                className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                             >
                                 {healthLoading ? '检测中...' : '重新检测'}
                             </button>
                        </div>
                        
                        {!healthStatus ? (
                            <p className="text-[10px] text-gray-400">
                                如果一直显示超时，请点击检测以查看数据库连接状态。
                            </p>
                        ) : (
                            <div className="bg-gray-50 p-2 rounded-lg text-[10px] space-y-1">
                                <div className="flex items-center justify-between">
                                    <span>API状态:</span>
                                    {healthStatus.status === 'ok' 
                                        ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={10} /> 正常</span> 
                                        : <span className="text-red-600 flex items-center gap-1"><XCircle size={10} /> 异常</span>
                                    }
                                </div>
                                {healthStatus.status === 'ok' && (
                                    <div className="flex items-center justify-between">
                                        <span>数据库表:</span>
                                        {healthStatus.tablesExist 
                                            ? <span className="text-green-600">已就绪</span> 
                                            : <span className="text-orange-500 font-bold">未初始化</span>
                                        }
                                    </div>
                                )}
                                {healthStatus.message && (
                                    <div className="text-red-500 pt-1 border-t border-gray-100 mt-1">
                                        {healthStatus.message}
                                    </div>
                                )}
                                
                                {/* Fallback Initialization Button inside Diagnostics */}
                                {healthStatus.status === 'ok' && !healthStatus.tablesExist && !authError?.errorType && (
                                     <button 
                                        type="button"
                                        onClick={handleInitDb}
                                        disabled={isDbInitLoading}
                                        className="w-full mt-2 py-1.5 bg-blue-100 text-blue-700 font-bold rounded hover:bg-blue-200 transition-colors"
                                    >
                                        立即初始化数据库
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="mt-12 text-center">
                   <p className="text-[10px] text-gray-300">
                       登录后数据将同步至云端数据库。未登录数据仅保存在本地。
                   </p>
                </div>
            </div>
        </div>
      );
  }

  // --- Render: Logged In View ---
  return (
    <div className="px-5 pt-4 pb-24 animate-in slide-in-from-right-4 duration-300">
      {/* User Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-50">
            <div className="w-24 h-24 bg-blue-50 rounded-full -mr-10 -mt-10"></div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <span className="text-2xl font-bold">{currentUser.username.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-800">{currentUser.username}</h2>
                <p className="text-xs text-green-500 flex items-center gap-1 font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> 云端同步已开启
                </p>
            </div>
            <button 
                onClick={handleLogout}
                className="p-2 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="退出登录"
            >
                <LogOut size={20} />
            </button>
        </div>

        <div className="mt-4 flex gap-3">
            <button 
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
            >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? '同步中...' : '手动刷新数据'}
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
         <div className="p-4 border-b border-gray-50 flex items-center gap-2">
            <BellRing size={18} className="text-blue-500" />
            <span className="font-bold text-sm text-gray-800">云端推送配置</span>
         </div>
         
         <div className="p-5 bg-gray-50/50">
            <div className="bg-blue-50 p-3 rounded-xl mb-4 border border-blue-100">
                <p className="text-[10px] text-blue-700/80 leading-relaxed">
                    <b>升级提示：</b> 您的任务现在由 Vercel 服务器每日自动检查。即使不打开网页，微信提醒也会准时送达。
                </p>
            </div>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Webhook 地址</label>
                    <input 
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                </div>
                
                <div className="flex gap-2 pt-2">
                    <button 
                        onClick={handleTestWebhook}
                        disabled={!webhookUrl || testing}
                        className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg active:bg-gray-50 flex items-center justify-center gap-1"
                    >
                        {testing ? '...' : <><Send size={12} /> 测试</>}
                    </button>
                    <button 
                        onClick={handleSave}
                        className={`flex-1 py-2.5 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm
                            ${saved ? 'bg-green-500' : 'bg-gray-900 active:bg-gray-800'}
                        `}
                    >
                        <Save size={12} />
                        {saved ? '已保存' : '保存配置'}
                    </button>
                </div>
            </div>
         </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="p-2 bg-gray-100 text-gray-500 rounded-lg">
            <Info size={18} />
          </div>
          <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-800">关于 Cyclic Pro</h3>
              <p className="text-[10px] text-gray-400">版本 v2.0 (Vercel Serverless Edition)</p>
          </div>
      </div>
    </div>
  );
};