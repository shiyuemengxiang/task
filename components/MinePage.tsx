import React, { useState, useEffect } from 'react';
import { BellRing, Save, Send, ShieldAlert, Info, UserCircle2, LogOut, RefreshCw, Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';
import { sendWebhook } from '../services/notificationService';
import { getStorage, setStorage } from '../services/storageAdapter';
import { login, register, logout, getCurrentUser, User } from '../services/authService';

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
  const [authError, setAuthError] = useState('');
  
  // Settings State
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Check login status
    const user = getCurrentUser();
    setCurrentUser(user);

    // Load settings
    const url = getStorage('cyclic_webhook_url');
    if (url) setWebhookUrl(url);
  }, []);

  const handleSave = () => {
    setStorage('cyclic_webhook_url', webhookUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAuth = (e: React.FormEvent) => {
      e.preventDefault();
      if (!username || !password) {
          setAuthError('请输入用户名和密码');
          return;
      }
      
      setAuthError('');
      
      let result;
      if (isLoginMode) {
          result = login(username, password);
      } else {
          result = register(username, password);
      }

      if (result.success) {
          const user = getCurrentUser();
          setCurrentUser(user);
          // Clear form
          setUsername('');
          setPassword('');
          // Trigger data reload
          if (onUserChange) onUserChange();
      } else {
          setAuthError(result.message);
      }
  };

  const handleLogout = () => {
      if(window.confirm('确定要退出登录吗？')) {
          logout();
          setCurrentUser(null);
          if (onUserChange) onUserChange();
      }
  };

  const handleSync = () => {
      if (!currentUser) return;
      setSyncing(true);
      // Simulate network request
      setTimeout(() => {
          setSyncing(false);
          alert('同步成功！(模拟环境：数据已隔离保存至本地)');
      }, 1500);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    setTesting(true);
    try {
        const success = await sendWebhook(webhookUrl, "测试推送", "恭喜！配置成功，小程序(Web版)工作正常。");
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

                    {authError && (
                        <div className="text-red-500 text-xs font-medium text-center bg-red-50 py-2 rounded-lg">
                            {authError}
                        </div>
                    )}

                    <button 
                        type="submit"
                        className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 shadow-lg shadow-gray-200 transition-all active:scale-[0.98]"
                    >
                        {isLoginMode ? '立即登录' : '注册账号'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => {
                            setIsLoginMode(!isLoginMode);
                            setAuthError('');
                            setUsername('');
                            setPassword('');
                        }}
                        className="text-sm text-blue-600 font-bold hover:underline"
                    >
                        {isLoginMode ? '没有账号？去注册' : '已有账号？去登录'}
                    </button>
                </div>
                
                <div className="mt-12 text-center">
                   <p className="text-[10px] text-gray-300">
                       游客模式下数据存储在本地，登录后可隔离数据。
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
                <p className="text-xs text-gray-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span> 在线
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
                {syncing ? '同步中...' : '同步云端数据'}
            </button>
        </div>
      </div>

      {/* Settings Group */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-4 border-b border-gray-50 flex items-center gap-2">
            <BellRing size={18} className="text-blue-500" />
            <span className="font-bold text-sm text-gray-800">消息推送配置</span>
         </div>
         
         <div className="p-5 bg-gray-50/50">
            <div className="bg-blue-50 p-3 rounded-xl mb-4 border border-blue-100">
                <p className="text-[10px] text-blue-700/80 leading-relaxed">
                小程序环境限制：请使用 Webhook (如 Server酱/Bark) 接收提醒。配置对此设备上的该用户生效。
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
          <div className="p-2 bg-orange-50 text-orange-500 rounded-lg">
            <Info size={18} />
          </div>
          <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-800">关于 Cyclic</h3>
              <p className="text-[10px] text-gray-400">版本 v1.1.0 (Multi-User)</p>
          </div>
      </div>
    </div>
  );
};