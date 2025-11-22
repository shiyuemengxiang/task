import React, { useState, useEffect } from 'react';
import { BellRing, Save, Send, ShieldAlert, Info, UserCircle2 } from 'lucide-react';
import { sendWebhook } from '../services/notificationService';
import { getStorage, setStorage } from '../services/storageAdapter';

export const MinePage: React.FC = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const url = getStorage('cyclic_webhook_url');
    if (url) setWebhookUrl(url);
  }, []);

  const handleSave = () => {
    setStorage('cyclic_webhook_url', webhookUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
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

  return (
    <div className="px-5 pt-4 pb-24 animate-in slide-in-from-right-4 duration-300">
      {/* User Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
            <UserCircle2 size={40} />
        </div>
        <div>
            <h2 className="text-lg font-bold text-gray-800">微信用户</h2>
            <p className="text-xs text-gray-400">让每一天都有迹可循</p>
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
                小程序环境限制：请使用 Webhook (如 Server酱/Bark) 接收提醒。
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
                        onClick={handleTest}
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
              <p className="text-[10px] text-gray-400">版本 v1.0.2 (WeChat Adapter)</p>
          </div>
      </div>
    </div>
  );
};
