import { GoogleGenAI, Type } from "@google/genai";
import { CreateTaskPayload, Frequency, TaskType, LimitPeriod } from '../types';

declare const process: any;

// NOTE: In a real app, this should be proxied through a backend to hide the key.
const apiKey = process.env.API_KEY || '';

export const isAiAvailable = () => !!apiKey;

export const parseTaskWithGemini = async (input: string): Promise<CreateTaskPayload | null> => {
  if (!apiKey) {
    console.error("API Key missing");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    从以下中文用户输入中提取定期任务或目标: "${input}".
    
    规则:
    - Group (分组): 提取任务类别 (例如 "生活", "财务", "健康", "工作"). 默认为 "默认".
    - Frequency (频率): DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM.
    - CustomInterval: 如果是 CUSTOM, 提取天数.
    - Type (类型): NUMERIC (含数字目标) 或 BOOLEAN (完成/未完成).
    - TargetValue: 数字.
    - Unit: 单位 (次, 元, 天, km).
    - LimitConfig (限制频率): 
      - 如果任务提到 "每月打卡10天" 或 "每月消费10次" 且隐含这是一种 "打卡" 行为，通常意味着每天只能算1次 -> LimitPeriod: DAILY, count: 1.
      - "每年X次，每月一次" -> LimitPeriod: MONTHLY, count: 1.
      - 如果没有明确限制，为空.
    - Deadline (截止):
      - WEEKLY: 周一=1...周日=7.
      - MONTHLY: 日期 1-31.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            group: { type: Type.STRING },
            frequency: { type: Type.STRING, enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'] },
            customInterval: { type: Type.INTEGER, nullable: true },
            type: { type: Type.STRING, enum: ['BOOLEAN', 'NUMERIC'] },
            targetValue: { type: Type.NUMBER },
            unit: { type: Type.STRING, nullable: true },
            deadlineDay: { type: Type.INTEGER, nullable: true },
            deadlineMonth: { type: Type.INTEGER, nullable: true },
            limitPeriod: { type: Type.STRING, enum: ['DAILY', 'WEEKLY', 'MONTHLY'], nullable: true },
            limitCount: { type: Type.INTEGER, nullable: true }
          },
          required: ['title', 'frequency', 'type', 'targetValue']
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      
      const mapFreq: Record<string, Frequency> = {
        'DAILY': Frequency.DAILY,
        'WEEKLY': Frequency.WEEKLY,
        'MONTHLY': Frequency.MONTHLY,
        'QUARTERLY': Frequency.QUARTERLY,
        'YEARLY': Frequency.YEARLY,
        'CUSTOM': Frequency.CUSTOM
      };
      
      const mapType: Record<string, TaskType> = {
        'BOOLEAN': TaskType.BOOLEAN,
        'NUMERIC': TaskType.NUMERIC
      };

      const mapLimitPeriod: Record<string, LimitPeriod> = {
        'DAILY': LimitPeriod.DAILY,
        'WEEKLY': LimitPeriod.WEEKLY,
        'MONTHLY': LimitPeriod.MONTHLY
      };

      return {
        title: data.title,
        description: data.description,
        group: data.group || '默认',
        frequency: mapFreq[data.frequency] || Frequency.MONTHLY,
        customInterval: data.customInterval,
        type: mapType[data.type] || TaskType.BOOLEAN,
        targetValue: data.targetValue,
        unit: data.unit || '',
        deadlineDay: data.deadlineDay || undefined,
        deadlineMonth: data.deadlineMonth || undefined,
        limitConfig: (data.limitPeriod && data.limitCount) ? {
            period: mapLimitPeriod[data.limitPeriod],
            count: data.limitCount
        } : undefined
      };
    }
    return null;

  } catch (error) {
    console.error("Gemini parsing failed:", error);
    return null;
  }
};