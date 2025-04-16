// app/results/page.tsx
"use client"; // 标记为客户端组件

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button"; 
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertCircle, 
  MapPin, 
  Calendar, 
  Users, 
  Banknote, 
  Loader2, 
  Navigation,
  MapIcon,
  Route,
  ThumbsUp,
  ThumbsDown,
  Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// 导入Markdown相关包
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

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
  title?: string;        // 旅行推荐部分
  plan?: string;         // 行程规划部分
  highlights?: string;   // 旅行红黑榜部分
}

interface TravelParams {
  location: string;
  destination?: string;  // 目的地字段，可选
  days: string;
  travelers?: string;
  preference?: string;  // 新增偏好字段，可选
  budget?: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<TravelParams | null>(null);

  // 从会话存储获取参数
  useEffect(() => {
    // 尝试从sessionStorage获取旅行参数
    try {
      if (typeof window !== 'undefined') {
        const savedParams = sessionStorage.getItem('travelParams');
        if (savedParams) {
          const parsedParams = JSON.parse(savedParams) as TravelParams;
          setParams(parsedParams);
          generateItinerary(parsedParams);
        } else {
          // 如果没有参数，使用默认值或重定向回输入页面
          setError("未找到旅行参数，请重新填写表单");
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('获取旅行参数时出错:', err);
      setError('读取旅行参数时出错');
      setLoading(false);
    }
  }, []);

  // 添加刷新确认提示
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 标准方式来触发确认对话框
      event.preventDefault(); 
      // 某些浏览器需要设置 returnValue
      event.returnValue = '刷新页面会丢失当前方案并重新生成，确定要刷新吗？'; 
      // 大多数浏览器也支持直接返回字符串
      return '刷新页面会丢失当前方案并重新生成，确定要刷新吗？'; 
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 组件卸载时移除监听器
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // 空依赖数组确保只在挂载和卸载时运行

  // 生成行程的函数
  const generateItinerary = async (travelParams: TravelParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(travelParams),
      });
      
      // 读取响应内容
      const responseText = await response.text();
      
      // 尝试解析JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('解析响应JSON失败:', jsonError);
        // 检查是否是HTML内容
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          throw new Error('服务器返回了HTML错误页面，可能是网络问题或API配置错误');
        } else {
          throw new Error('无法解析服务器响应');
        }
      }
      
      if (!response.ok) {
        throw new Error(responseData.error || '生成行程失败');
      }
      
      if (responseData.fallback) {
        console.warn('使用了备用数据:', responseData.message);
        // 可以在UI中显示使用了备用数据的提示
      }
      
      setItinerary(responseData.data);
    } catch (err) {
      console.error('生成行程时出错:', err);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 重新生成行程
  const handleRegenerate = () => {
    if (params) {
      generateItinerary(params);
    }
  };

  // 返回输入页面
  const handleBack = () => {
    router.push('/');  // 修改为返回首页，因为输入表单已经合并到首页
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4 md:p-8">
      <main className="w-full max-w-6xl">
        <div className="w-full text-center mb-5">
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
            {!loading && itinerary && itinerary.title 
              ? `方案推荐：${itinerary.title.split('\n')[0]}` 
              : "方案生成中..."}
          </h1>
          
          {/* 添加渐变色短线 */}
          <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full"></div>
        </div>
        
        {/* 参数摘要 */}
        {params && (
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            {params.location && (
              <div className="flex items-center gap-1 text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                <MapPin size={16} className="text-slate-500" />
                <span>出发地: {params.location}</span>
              </div>
            )}
            {params.destination && (
              <div className="flex items-center gap-1 text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                <Navigation size={16} className="text-slate-500" />
                <span>目的地: {params.destination}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-sm bg-white px-3 py-1 rounded-full shadow-sm">
              <Calendar size={16} className="text-slate-500" />
              <span>天数: {params.days}</span>
            </div>
            {params.travelers && (
              <div className="flex items-center gap-1 text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                <Users size={16} className="text-slate-500" />
                <span>人数: {params.travelers}</span>
              </div>
            )}
            {params.preference && (
              <div className="flex items-center gap-1 text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                <Star size={16} className="text-slate-500" />
                <span>偏好: {params.preference}</span>
              </div>
            )}
            {params.budget && (
              <div className="flex items-center gap-1 text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                <Banknote size={16} className="text-slate-500" />
                <span>预算: {params.budget === "不限" ? "不限" : `${params.budget}元`}</span>
              </div>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>生成失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6 text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
            <p className="text-slate-600">AI正在努力为你生成行程，这可能需要一分钟左右，请您耐心等待...</p>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        )}

        {/* 行程内容 - 仅显示两个主要部分，移除旅行推荐部分 */}
        {!loading && itinerary && (
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* 行程规划 */}
            {itinerary.plan && (
              <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl md:w-1/2 border border-slate-100 overflow-hidden">
                <CardHeader className="py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-slate-50 flex items-center space-x-2">
                  <Route className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-xl text-slate-800">详细行程规划</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto pt-4 px-5">
                  <div className="prose prose-slate max-w-none prose-headings:text-indigo-700 prose-a:text-indigo-600 whitespace-pre-line">
                    <ReactMarkdown 
                      rehypePlugins={[rehypeRaw]}
                      remarkPlugins={[remarkGfm]}
                    >
                      {itinerary.plan}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* 旅行红黑榜 */}
            {itinerary.highlights && (
              <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl md:w-1/2 border border-slate-100 overflow-hidden">
                <CardHeader className="py-3 border-b border-slate-200 bg-gradient-to-r from-rose-50 to-slate-50 flex items-center space-x-2">
                  <Star className="h-5 w-5 text-rose-500" />
                  <CardTitle className="text-xl text-slate-800">小红书旅行评价参考</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto pt-4 px-5 custom-scrollbar">
                  <div className="max-w-none whitespace-pre-line [&>p]:mb-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ul_>li]:mb-1 [&>ul]:my-1">
                    <ReactMarkdown 
                      rehypePlugins={[rehypeRaw]}
                      remarkPlugins={[remarkGfm]}
                      children={itinerary.highlights}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 按钮区域 */}
        {!error && ( // 仅在没有错误时显示按钮
          <div className="flex justify-center gap-4 mt-8 mb-4">
            <Button 
              onClick={handleBack} 
              variant="outline"
              className="bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-50"
              disabled={loading}
            >
              返回修改
            </Button>
            <Button 
              onClick={handleRegenerate} 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : "重新生成"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
} 