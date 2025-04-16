export const runtime = 'edge'; 

import { NextResponse } from 'next/server';
import { saveTravelPreference, saveItinerary } from '@/lib/db';
import crypto from 'crypto';
import { Readable } from 'stream';

interface TravelParams {
  location: string;        // 出发地点
  destination?: string;    // 目的地，可选
  days: string;            // 旅行天数，可能是范围如 "3-5"
  travelers?: string;      // 出行人数，可选，可能是范围如 "2-4"
  preference?: string;     // 其他偏好，可选
  budget?: string;         // 预算，可选
  user_id?: string;        // 用户ID，可选
}

// 行程数据接口定义
interface ItineraryActivity {
  time: string;
  activity: string;
  description: string;
  location: string;
}

interface ItineraryDay {
  day: number;
  date: string;
  activities: ItineraryActivity[];
}

interface Recommendations {
  accommodation: string[];
  transportation: string[];
  mustVisit: string[];
}

interface Itinerary {
  destination: string;
  startDate: string;
  endDate: string;
  summary: string;
  budget: string;
  dailyItinerary: ItineraryDay[];
  recommendations: Recommendations;
  title: string;       // 旅行推荐部分
  plan: string;        // 行程规划部分
  highlights: string;  // 旅行红黑榜部分
}

/**
 * 加密敏感数据
 * 用于确保符合GDPR要求
 */
function encryptData(data: any): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.warn('未设置加密密钥，数据未加密');
    return JSON.stringify(data);
  }

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // 存储IV、加密数据和认证标签
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex')
    });
  } catch (error) {
    console.error('加密数据时出错:', error);
    return JSON.stringify(data);
  }
}

/**
 * 生成旅行行程
 * 该API接收旅行参数并返回AI生成的行程建议
 */
export async function POST(request: Request) {
  try {
    // 解析请求体
    const body: TravelParams = await request.json();
    
    // 验证必填参数
    if (!body.location || !body.location.trim()) {
      return NextResponse.json(
        { error: '出发地点不能为空' },
        { status: 400 }
      );
    }
    
    if (!body.days || !body.days.trim()) {
      return NextResponse.json(
        { error: '旅行天数不能为空' },
        { status: 400 }
      );
    }
    
    // 记录请求参数
    console.log('接收到行程生成请求:', body);

    // 保存旅行偏好到数据库
    const encryptedData = encryptData({
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString()
    });

    let preferenceId = null;
    try {
      const savedPreference = await saveTravelPreference({
        location: body.location,
        destination: body.destination,
        days: body.days,
        travelers: body.travelers,
        preference: body.preference,
        budget: body.budget,
        user_id: body.user_id,
        encrypted_data: JSON.parse(encryptedData)
      });
      
      if (savedPreference) {
        preferenceId = savedPreference.id;
      }
    } catch (dbError) {
      console.error('保存旅行偏好时出错:', dbError);
      // 继续执行，即使数据库写入失败
    }

    // 调用Coze对话流API生成行程
    try {
      const itinerary = await generateCozeItinerary(body);
      
      // 如果有偏好ID，保存行程到数据库
      if (preferenceId) {
        try {
          await saveItinerary({
            preference_id: preferenceId,
            itinerary_data: itinerary,
            destination: itinerary.destination,
            start_date: itinerary.startDate,
            end_date: itinerary.endDate,
            summary: itinerary.summary,
            is_ai_generated: true,
            user_id: body.user_id,
            encrypted_data: JSON.parse(encryptedData),
            title: itinerary.title,
            plan: itinerary.plan,
            highlights: itinerary.highlights
          });
        } catch (dbError) {
          console.error('保存行程时出错:', dbError);
          // 继续执行，即使数据库写入失败
        }
      }
      
      // 返回生成的行程
      return NextResponse.json({
        success: true,
        data: itinerary
      });
      
    } catch (aiError) {
      console.error('AI生成行程时出错:', aiError);
      
      // 当AI API出错时，回退到使用模拟数据
      console.log('使用备用模拟数据');
      const mockItinerary = generateMockItinerary(body);
      
      // 如果有偏好ID，保存行程到数据库
      if (preferenceId) {
        try {
          await saveItinerary({
            preference_id: preferenceId,
            itinerary_data: mockItinerary,
            destination: mockItinerary.destination,
            start_date: mockItinerary.startDate,
            end_date: mockItinerary.endDate,
            summary: mockItinerary.summary,
            is_ai_generated: false,
            user_id: body.user_id,
            encrypted_data: JSON.parse(encryptedData),
            title: mockItinerary.title,
            plan: mockItinerary.plan,
            highlights: mockItinerary.highlights
          });
        } catch (dbError) {
          console.error('保存行程时出错:', dbError);
          // 继续执行，即使数据库写入失败
        }
      }
      
      return NextResponse.json({
        success: true,
        data: mockItinerary,
        fallback: true,
        message: '使用了备用数据，因为AI服务暂时不可用'
      });
    }
    
  } catch (error) {
    console.error('生成行程时出错:', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后再试' },
      { status: 500 }
    );
  }
}

/**
 * 调用Coze对话流API生成行程
 * 这是与Coze平台集成的函数
 */
async function generateCozeItinerary(params: TravelParams): Promise<Itinerary> {
  // 准备Coze API所需的参数
  const workflowId = process.env.COZE_WORKFLOW_ID;
  const apiKey = process.env.COZE_API_KEY;
  let endpoint = process.env.COZE_API_ENDPOINT;
  
  // 计数器和完整响应变量
  let deltaCount = 0;
  let completeResponse = '';

  // 确保endpoint是有效的URL
  if (endpoint && !endpoint.startsWith('http')) {
    endpoint = `https://${endpoint}`;
  }
  
  // 记录环境变量是否存在（不记录具体值，避免泄露敏感信息）
  console.log('Coze API配置检查:', {
    workflowId: !!workflowId,
    apiKey: !!apiKey && apiKey?.substring(0, 8) + '...',
    endpoint: endpoint || '未设置'
  });
  
  if (!workflowId || !apiKey || !endpoint) {
    throw new Error('未配置Coze API所需的参数');
  }

  // 构建发送给Coze的提示
  const prompt = `
    请帮我生成一个从${params.location}出发${params.destination ? `前往${params.destination}` : ''}的详细旅行计划。
    行程天数: ${params.days}
    ${params.travelers ? `出行人数: ${params.travelers}` : ''}
    ${params.preference ? `特殊偏好: ${params.preference}` : ''}
    ${params.budget ? `预算: ${params.budget}元人民币` : ''}
    
    请提供包括${params.destination ? params.destination : '目的地'}、每日活动安排（时间、活动描述、地点）、住宿推荐、交通方式和必去景点的详细行程规划。
    
    请按以下格式返回：
    
    旅行推荐：
    [简洁的目的地和旅行概述]
    
    行程规划：
    [详细的每日行程安排]
    
    旅行红黑榜：
    [值得体验的项目和需要避开的坑]
  `;

  // 构建Coze API请求体
  const requestData = {
    workflow_id: workflowId,
    additional_messages: [
      {
        role: "user",
        content: prompt,
        content_type: "text"
      }
    ],
    user: params.user_id || `user-${Date.now()}`, // 提供一个唯一的用户标识
    stream: true // 启用SSE流式响应
  };

  try {
    console.log('开始调用Coze API...');
    console.log('请求endpoint:', endpoint);
    console.log('请求数据:', JSON.stringify({
      ...requestData,
      workflow_id: '[已隐藏]', // 不记录实际ID
      // 其他保持不变
    }));
    
    // 调用Coze API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify(requestData)
    });

    console.log('API响应状态:', response.status, response.statusText);
    console.log('响应头:', JSON.stringify(Object.fromEntries([...response.headers.entries()])));

    if (!response.ok) {
      // 捕获非2xx响应
      let errorText = '';
      try {
        // 尝试读取响应体
        errorText = await response.text();
        console.error('Coze API HTTP错误响应体:', errorText.substring(0, 500) + (errorText.length > 500 ? '...' : ''));
        
        // 检测是否是HTML响应
        if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
          console.error('收到HTML错误页面而非预期的JSON响应，可能是网络问题或代理配置错误');
          throw new Error('API返回了HTML错误页面而非JSON响应');
        }
        
        // 尝试解析JSON错误
        try {
          const errorJson = JSON.parse(errorText);
          console.error('解析的错误JSON:', errorJson);
        } catch (jsonError: any) {
          console.error('响应不是有效的JSON:', jsonError.message);
        }
      } catch (textError) {
        console.error('读取错误响应体失败:', textError);
      }
      
      throw new Error(`Coze API响应错误: ${response.status} - ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    // 处理SSE流式响应
    const reader = response.body.getReader();
    let accumulatedResponse = '';
    let decoder = new TextDecoder();
    let buffer = '';
    let isFinished = false;

    try {
      while (!isFinished) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('流读取完成');
          break;
        }
        
        // 将新数据添加到缓冲区
        const newText = decoder.decode(value, { stream: true });
        buffer += newText;
        
        // 输出一些调试信息（但不打印全部内容）
        if (buffer.length < 200) {
          console.log('收到数据片段:', buffer);
        } else {
          console.log(`收到数据片段 (${buffer.length} 字节)`);
        }
        
        // 处理完整的事件块
        let boundaryIndex;
        while ((boundaryIndex = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.substring(0, boundaryIndex);
          buffer = buffer.substring(boundaryIndex + 2);
          
          if (chunk.trim() === '') continue;
          
          // 解析事件块
          let eventType = 'message'; // 默认事件类型
          let eventData = '';
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              eventData = line.substring(5).trim();
            }
            // 可以在这里添加对id等其他字段的处理
          }
          
          // 处理事件数据
          if (eventData) {
            try {
              const dataObj = JSON.parse(eventData);
              const eventLog = `收到${eventType}事件，类型: ${dataObj.type || '未知'}`;
              console.log(eventLog);
              
              // 记录完整的数据结构（仅限第一次接收到delta数据时）
              if ((eventType.includes('delta') || dataObj.type === 'answer') && accumulatedResponse.length === 0) {
                console.log('数据结构:', JSON.stringify(dataObj, null, 2).substring(0, 1000) + '...');
              }
              
              // 特别处理conversation.message.delta事件（Coze特有格式）
              if (eventType === 'conversation.message.delta' && dataObj.type === 'answer') {
                // 增加计数
                deltaCount++;
                console.log(`处理第 ${deltaCount} 个delta消息`);
                
                // 只处理第二个delta消息的内容
                if (deltaCount === 2) {
                  // 尝试提取完整内容
                  // 尝试在整个事件数据中寻找旅行推荐/行程规划/旅行红黑榜格式的文本
                  const travelPattern = /旅行推荐[：:]\s*[\s\S]*?行程规划[：:]\s*[\s\S]*?旅行红黑榜[：:]\s*[\s\S]*/;
                  const travelMatch = eventData.match(travelPattern);
                  if (travelMatch && travelMatch[0]) {
                    // 清理转义字符
                    const cleanedText = travelMatch[0]
                      .replace(/\\n/g, '\n')
                      .replace(/\\"/g, '"')
                      .replace(/\\\\/g, '\\');
                    
                    console.log(`找到完整旅行规划文本 (${cleanedText.length} 字节)`);
                    // 直接使用完整文本
                    completeResponse = cleanedText;
                    // 设置标志表示已找到完整响应
                    isFinished = true;
                  } else {
                    // 尝试直接从事件数据中提取内容
                    let extractedContent = '';
                    
                    // 从各种可能的位置提取内容
                    const contentMatch = eventData.match(/"content"\s*:\s*"([^"]+)"/);
                    if (contentMatch && contentMatch[1]) {
                      extractedContent = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    } else if (dataObj.object?.value) {
                      extractedContent = dataObj.object.value;
                    } else if (dataObj.message?.content) {
                      extractedContent = dataObj.message.content;
                    }
                    
                    if (extractedContent) {
                      console.log(`从第二个delta消息提取到内容 (${extractedContent.length} 字节)`);
                      completeResponse = extractedContent;
                      isFinished = true;
                    }
                  }
                }
              }
              
              // 常规处理不同类型的事件
              if (eventType === 'message' || eventType.includes('conversation.message.delta')) {
                const messageType = dataObj.type || 'message.delta';
                
                if (messageType === 'message.delta' || messageType === 'answer') {
                  // 处理增量内容 - 检查所有可能的位置
                  let deltaContent = '';
                  
                  // 检查常见的内容位置
                  if (dataObj.message?.content) {
                    deltaContent = dataObj.message.content;
                  } else if (dataObj.object?.value) {
                    deltaContent = dataObj.object.value;
                  } else if (dataObj.delta?.content) {
                    deltaContent = dataObj.delta.content;
                  } else if (dataObj.content) {
                    deltaContent = dataObj.content;
                  } else if (typeof dataObj.answer === 'string') {
                    deltaContent = dataObj.answer;
                  } else if (dataObj.text) {
                    deltaContent = dataObj.text;
                  }
                  
                  // 如果仍未找到内容，尝试递归搜索对象中的文本字段
                  if (!deltaContent) {
                    const findTextContent = (obj: any): string => {
                      if (!obj || typeof obj !== 'object') return '';
                      
                      // 检查常见的内容字段名
                      const contentKeys = ['content', 'text', 'value', 'answer', 'message'];
                      for (const key of contentKeys) {
                        if (typeof obj[key] === 'string' && obj[key].trim()) {
                          return obj[key];
                        }
                      }
                      
                      // 递归检查所有属性
                      for (const key in obj) {
                        if (typeof obj[key] === 'object') {
                          const found: string = findTextContent(obj[key]);
                          if (found) return found;
                        }
                      }
                      
                      return '';
                    };
                    
                    deltaContent = findTextContent(dataObj);
                  }
                  
                  if (deltaContent) {
                    accumulatedResponse += deltaContent;
                    // 输出调试信息，但避免打印过多内容
                    if (deltaContent.length < 50) {
                      console.log('增量内容:', deltaContent);
                    } else {
                      console.log(`收到${deltaContent.length}字节增量内容`);
                    }
                  } else if (eventType.includes('delta')) {
                    // 如果是delta事件但找不到内容，记录完整对象以便调试
                    console.warn('警告：找不到delta事件中的内容，完整对象:', JSON.stringify(dataObj));
                  }
                } else if (messageType === 'generate_answer_finish' || 
                          (dataObj.message && dataObj.message.is_finish === true) ||
                          eventType.includes('conversation.message.completed')) {
                  // 处理完成消息
                  console.log('生成回答完成');
                  isFinished = true;
                } else if (messageType === 'error') {
                  // 处理错误消息
                  console.error('Coze内部错误:', dataObj.error?.code, dataObj.error?.message);
                  throw new Error(`Coze错误: ${dataObj.error?.code} - ${dataObj.error?.message}`);
                } else {
                  // 处理其他类型消息
                  console.log('其他消息类型:', messageType);
                }
              } else if (eventType === 'error') {
                // 处理流错误
                console.error('流错误:', dataObj);
                throw new Error(`流错误: ${JSON.stringify(dataObj)}`);
              } else if (eventType === 'ping' || eventType === 'done' || 
                        eventType.includes('conversation.chat')) {
                // 处理不需要特殊处理的事件类型
                console.log(`收到${eventType}事件`);
                
                // 如果是done事件，表示流结束
                if (eventType === 'done') {
                  isFinished = true;
                }
              } else {
                // 处理其他事件类型
                console.log('其他事件类型:', eventType);
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.warn('JSON解析错误，可能是不完整的数据:', e, '数据:', eventData);
                // 继续处理，不中断流程
              } else {
                // 重新抛出非语法错误
                throw e;
              }
            }
          }
        }
      }
      
      console.log('流处理完成，最终响应长度:', completeResponse.length || accumulatedResponse.length);
      
      // 如果有completeResponse，优先使用它
      let finalResponse = completeResponse || accumulatedResponse;
      
      if (finalResponse.length === 0) {
        console.warn('警告：从Coze API获取的响应内容为空，尝试处理接收到的原始事件数据');
        
        // 检查是否有任何数据可以使用
        if (buffer.length > 0) {
          console.log('使用缓冲区中剩余的数据:', buffer.substring(0, 200) + (buffer.length > 200 ? '...' : ''));
          
          // 尝试提取JSON对象中的内容
          try {
            // 搜索JSON对象
            const jsonMatches = buffer.match(/\{[\s\S]*?\}/g);
            if (jsonMatches && jsonMatches.length > 0) {
              // 尝试解析找到的每个JSON对象
              for (const jsonStr of jsonMatches) {
                try {
                  const obj = JSON.parse(jsonStr);
                  console.log('从buffer提取到JSON对象:', Object.keys(obj));
                  
                  // 寻找可能包含文本内容的字段
                  const textFields = ['content', 'text', 'answer', 'value', 'message'];
                  for (const field of textFields) {
                    if (typeof obj[field] === 'string' && obj[field].trim()) {
                      console.log(`找到内容在字段 ${field}`);
                      finalResponse = obj[field];
                      break;
                    }
                  }
                  
                  // 递归查找可能嵌套的文本内容
                  if (!finalResponse && typeof obj === 'object') {
                    const findText = (o: any): string => {
                      if (!o || typeof o !== 'object') return '';
                      
                      for (const key in o) {
                        if (typeof o[key] === 'string' && o[key].trim().length > 20) {
                          return o[key];
                        } else if (typeof o[key] === 'object') {
                          const found = findText(o[key]);
                          if (found) return found;
                        }
                      }
                      return '';
                    };
                    
                    const text = findText(obj);
                    if (text) {
                      console.log('在嵌套对象中找到内容');
                      finalResponse = text;
                    }
                  }
                  
                  if (finalResponse) break; // 找到内容就退出循环
                } catch (e) {
                  // 忽略解析错误，继续尝试下一个
                }
              }
            }
          } catch (e) {
            console.warn('从buffer提取内容失败:', e);
          }
          
          // 如果还是没找到内容，使用整个buffer
          if (!finalResponse) {
            console.log('未能从buffer提取到结构化内容，使用原始buffer');
            // 尝试提取任何有意义的文本
            const textMatch = buffer.match(/旅行推荐[\s\S]*?行程规划[\s\S]*?旅行红黑榜[\s\S]*/);
            if (textMatch) {
              finalResponse = textMatch[0];
            } else {
              finalResponse = buffer;
            }
          }
        } else {
          // 如果实在没有数据，才抛出错误
          throw new Error('从Coze API获取的响应内容为空');
        }
      }
      
      // 将Coze的响应解析为标准化的行程格式
      console.log('最终响应文本（前200字符）:', finalResponse.substring(0, 200) + (finalResponse.length > 200 ? '...' : ''));
      return parseCozeResponseToItinerary(finalResponse, params);
    } finally {
      // 确保释放reader锁，避免资源泄漏
      reader.releaseLock();
    }
  } catch (error) {
    console.error('调用Coze API时出错:', error);
    throw error;
  }
}

/**
 * 将Coze的文本响应解析为标准化的行程格式
 */
function parseCozeResponseToItinerary(cozeText: string, params: TravelParams): Itinerary {
  // 解析天数，如果是范围则取最大值
  let days = 0;
  if (params.days.includes('-')) {
    const [_, maxDays] = params.days.split('-').map(d => parseInt(d));
    days = maxDays || 3;
  } else {
    days = parseInt(params.days) || 3;
  }
  
  // 提取三个主要部分
  let title = '';
  let plan = '';
  let highlights = '';
  
  console.log('开始提取三个主要部分...');
  
  // 提取旅行推荐部分 - 使用更精确的正则表达式
  const titleRegex = /旅行推荐[：:]\s*([\s\S]*?)(?=\s*行程规划[：:])/i;
  const titleMatch = cozeText.match(titleRegex);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
    console.log('成功提取旅行推荐部分，长度:', title.length);
  }
  
  // 提取行程规划部分 - 使用更精确的正则表达式
  const planRegex = /行程规划[：:]\s*([\s\S]*?)(?=\s*旅行红黑榜[：:])/i;
  const planMatch = cozeText.match(planRegex);
  if (planMatch && planMatch[1]) {
    plan = planMatch[1].trim();
    console.log('成功提取行程规划部分，长度:', plan.length);
  }
  
  // 提取旅行红黑榜部分 - 使用更精确的正则表达式
  const highlightsRegex = /旅行红黑榜[：:]\s*([\s\S]*?)$/i;
  const highlightsMatch = cozeText.match(highlightsRegex);
  if (highlightsMatch && highlightsMatch[1]) {
    highlights = highlightsMatch[1].trim();
    console.log('成功提取旅行红黑榜部分，长度:', highlights.length);
  }
  
  // 如果没有找到分段内容，记录原始文本并尝试其他提取方式
  if (!title && !plan && !highlights) {
    console.log('未找到标准格式内容，尝试备用提取方式');
    console.log('原始文本:', cozeText);
    
    // 尝试根据换行和段落结构提取内容
    const paragraphs = cozeText.split(/\n\s*\n/);
    
    if (paragraphs.length >= 3) {
      title = paragraphs[0];
      plan = paragraphs.slice(1, -1).join('\n\n');
      highlights = paragraphs[paragraphs.length - 1];
      console.log('使用段落分割提取内容');
    } else {
      // 如果分段不足，尝试使用第一行作为标题，剩余作为行程
      const lines = cozeText.split('\n');
      if (lines.length > 1) {
        title = lines[0];
        plan = lines.slice(1).join('\n');
        console.log('使用简单行分割提取内容');
      } else {
        // 实在无法分割时，使用整个文本作为plan
        plan = cozeText;
        title = "你的旅行计划";
        highlights = "根据AI生成";
        console.log('无法分割，使用整个文本作为计划');
      }
    }
  }
  
  // 尝试从响应中提取目的地（这是个简化示例）
  let destination = '未知目的地';
  const destinationMatch = cozeText.match(/目的地[:：]\s*([^\n,.，。]+)/i);
  if (destinationMatch && destinationMatch[1]) {
    destination = destinationMatch[1].trim();
  } else {
    // 如果没有明确的目的地标记，尝试从title中提取可能的地名
    const locationMatch = title.match(/([^，。,.]+(?:市|县|省|自治区|特别行政区))/);
    if (locationMatch) {
      destination = locationMatch[1];
    } else if (title.length > 0) {
      // 使用标题的前几个字作为目的地
      destination = title.substring(0, Math.min(10, title.length)).replace(/[，。,.]/g, '');
    }
  }
  
  // 提取摘要
  let summary = title || cozeText.substring(0, 200);
  if (summary.length >= 200) {
    summary += '...';
  }
  
  // 创建标准格式的行程对象
  const itinerary: Itinerary = {
    destination,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + days * 86400000).toISOString().split('T')[0],
    summary,
    budget: params.budget ? `预算约${params.budget}元人民币` : '预算不限',
    dailyItinerary: [],
    recommendations: {
      accommodation: [],
      transportation: [],
      mustVisit: []
    },
    title,
    plan,
    highlights
  };
  
  // 生成默认的每日行程（这部分实际上不会在UI上显示，但保留以防万一）
  for (let i = 1; i <= days; i++) {
    itinerary.dailyItinerary.push({
      day: i,
      date: new Date(Date.now() + (i - 1) * 86400000).toISOString().split('T')[0],
      activities: [{
        time: '09:00',
        activity: i === 1 ? `从${params.location}出发` : '自由行程',
        description: 'AI生成的旅行计划',
        location: i === 1 ? params.location : destination
      }]
    });
  }
  
  // 设置默认推荐（这部分实际上不会在UI上显示，但保留以防万一）
  itinerary.recommendations = {
    accommodation: [`${destination}酒店`, `${destination}民宿`],
    transportation: ['高铁', '飞机', '公共交通'],
    mustVisit: [`${destination}景点`, `${destination}特色景区`]
  };
  
  return itinerary;
}

/**
 * 生成模拟行程数据（备用方案，当AI API不可用时使用）
 */
function generateMockItinerary(params: TravelParams): Itinerary {
  // 解析天数，如果是范围则取最大值
  let days = 0;
  if (params.days.includes('-')) {
    const [_, maxDays] = params.days.split('-').map(d => parseInt(d));
    days = maxDays || 3; // 默认为3天
  } else {
    days = parseInt(params.days) || 3;
  }
  
  // 根据不同的出发地提供不同的目的地建议
  const destinations: {[key: string]: string} = {
    '北京': '西安',
    '上海': '杭州',
    '广州': '厦门',
    '深圳': '三亚',
  };
  
  // 如果用户指定了目的地，则使用用户指定的目的地，否则根据出发地推荐
  const destination = params.destination || destinations[params.location] || '杭州';
  
  // 结合用户偏好
  let preferenceText = '';
  if (params.preference) {
    preferenceText = `，特别关注${params.preference}相关的景点和活动`;
  }
  
  // 生成简单的行程安排
  const itinerary = {
    destination,
    startDate: new Date().toISOString().split('T')[0], // 今天作为开始日期
    endDate: new Date(Date.now() + days * 86400000).toISOString().split('T')[0],
    summary: `这是一个${days}天的${params.travelers ? `${params.travelers}人` : ''}行程，从${params.location}出发前往${destination}的旅行建议${preferenceText}。`,
    budget: params.budget ? `预算约${params.budget}元人民币` : '预算不限',
    dailyItinerary: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
      activities: [
        {
          time: '09:00',
          activity: i === 0 ? `从${params.location}出发前往${destination}` : `游览${destination}景区${['', '著名景点', '历史街区', '自然风景区'][i % 4]}`,
          description: i === 0 ? '准备前往目的地' : `欣赏${destination}美景，品尝当地小吃`,
          location: i === 0 ? params.location : `${destination}景区`
        },
        {
          time: '12:00',
          activity: '午餐',
          description: `品尝${destination}特色菜`,
          location: destination
        },
        {
          time: '14:00',
          activity: [`参观博物馆`, `游览古城区`, `探访文化街区`, `漫步在公园`][i % 4],
          description: `了解${destination}的历史文化`,
          location: destination
        },
        {
          time: '18:00',
          activity: '晚餐',
          description: '尝试当地特色餐厅',
          location: destination
        },
        {
          time: '20:00',
          activity: [`欣赏夜景`, `体验夜市`, `观看演出`, `休息`][i % 4],
          description: `体验${destination}夜生活`,
          location: destination
        }
      ]
    })),
    recommendations: {
      accommodation: [`${destination}豪华酒店`, `${destination}精品民宿`, `${destination}度假酒店`],
      transportation: ['高铁', '飞机', '长途汽车'],
      mustVisit: [`${destination}著名景点1`, `${destination}著名景点2`, `${destination}著名景点3`, `${destination}著名景点4`, `${destination}著名景点5`]
    },
    title: `${params.location}到${destination}的${days}天行程推荐`,
    plan: `这是一个从${params.location}到${destination}的${days}天行程规划。包含景点、餐饮和交通安排。`,
    highlights: `推荐体验：${destination}特色美食\n避坑指南：远离人群密集区，注意个人财物安全。`
  };
  
  return itinerary;
} 