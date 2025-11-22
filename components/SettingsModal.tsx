import React, { useState, useEffect } from 'react';
import { X, BellRing, Save, AlertCircle, Send } from 'lucide-react';
import { sendWebhook } from '../services/notificationService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (webhookUrl: string) => void;
  currentWebhookUrl: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentWebhookUrl }) => {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrl(currentWebhookUrl);
    }
  }, [isOpen, currentWebhookUrl]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(url);
    onClose();
  };

  const handleTest = async () => {
      if (!url) return;
      setTesting(true);
      try {
          const success = await sendWebhook(url, "测试推送", "恭喜！你的循环清单配置成功，可以正常接收通知。");
          if (success) {
              alert("发送成功！请检查你的微信或通知客户端。");
          } else {
              alert("发送失败。可能原因：\n1. URL 填写错误\n2. 目标服务器不支持跨域 (CORS) 请求\n3. 网络问题");
          }
      } catch (e) {
          alert("发送出错");
      } finally {
          setTesting(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BellRing className="text-blue-600" size={24} />
            推送配置
          </h2>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
            <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
              <AlertCircle size={14} /> 关于微信推送
            </h3>
            <p className="text-xs text-blue-700/80 leading-relaxed mb-2">
              应用支持通过 Webhook 发送任务提醒到微信。你需要配合第三方服务使用（如 <a href="https://sct.ftqq.com/" target="_blank" rel="noreferrer" className="underline font-bold">Server酱</a>, <a href="https://bark.day.app/" target="_blank" rel="noreferrer" className="underline font-bold">Bark</a> 等）。
            </p>
            <p className="text-xs text-orange-600 font-medium">
                注意：静态网页版（如 GitHub Pages）必须保持网页打开或每天访问一次才能触发检查和推送。
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Webhook 地址</label>
            <input 
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/send?key=..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all text-sm"
            />
            <div className="mt-2 text-[10px] text-gray-400 space-y-1">
              <p>支持变量替换：</p>
              <p><code className="bg-gray-100 px-1 rounded text-gray-600">{`{title}`}</code> - 任务标题</p>
              <p><code className="bg-gray-100 px-1 rounded text-gray-600">{`{body}`}</code> - 提醒内容</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
                type="button"
                onClick={handleTest}
                disabled={!url || testing}
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
                {testing ? '发送中...' : <><Send size={16} /> 测试</>}
            </button>
            <button 
                type="submit"
                className="flex-[2] py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
            >
                <Save size={18} />
                保存配置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};