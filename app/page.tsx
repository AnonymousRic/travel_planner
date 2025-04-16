"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import { Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

export default function Home() {
  const router = useRouter();

  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');  // 依然保留目的地字段
  const [days, setDays] = useState('');
  const [travelers, setTravelers] = useState('');
  const [preference, setPreference] = useState('');  // 其他偏好字段
  const [budget, setBudget] = useState<number>(2000);
  const [unlimitedBudget, setUnlimitedBudget] = useState(false);
  const [unknownDestination, setUnknownDestination] = useState(true); // 新增字段，默认不知道去哪儿
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 检验是否为有效的数字或数字范围
  const isValidNumberOrRange = (value: string): boolean => {
    // 单个数字
    if (/^\d+$/.test(value)) {
      return parseInt(value) > 0;
    }
    // 数字范围 (如 "2-5")
    if (/^\d+-\d+$/.test(value)) {
      const [min, max] = value.split('-').map(num => parseInt(num));
      return min > 0 && max > 0 && min <= max;
    }
    return false;
  };

  // 处理不限预算复选框变更
  const handleUnlimitedBudgetChange = (checked: boolean) => {
    setUnlimitedBudget(checked);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    let formIsValid = true;
    const newErrors: { [key: string]: string } = {};

    if (!departure.trim()) {
      newErrors.departure = "出发地点不能为空";
      formIsValid = false;
    }

    if (!days.trim()) {
      newErrors.days = "旅行天数不能为空";
      formIsValid = false;
    } else if (!isValidNumberOrRange(days)) {
      newErrors.days = "请输入有效的旅行天数或天数范围 (例如: 3 或 3-5)";
      formIsValid = false;
    }

    if (travelers.trim() && !isValidNumberOrRange(travelers)) {
      newErrors.travelers = "请输入有效的人数或人数范围 (例如: 2 或 2-4)";
      formIsValid = false;
    }
    
    // 如果用户选择了"知道去哪儿"但没有输入目的地
    if (!unknownDestination && !destination.trim()) {
      newErrors.destination = "请输入目的地";
      formIsValid = false;
    }

    if (formIsValid) {
      setIsSubmitting(true);
      
      try {
        console.log("表单验证通过，准备提交:", { 
          location: departure, 
          destination: unknownDestination ? undefined : destination, // 根据勾选状态决定是否提交目的地
          days, 
          travelers, 
          preference: preference || undefined, 
          budget: unlimitedBudget ? "不限" : budget.toString() 
        });

        // 将旅行参数存储到会话存储中，以便结果页面使用
        const travelParams = { 
          location: departure, 
          destination: unknownDestination ? undefined : (destination || undefined),  // 如果选择了"不知道去哪儿"，则不包含此字段
          days, 
          travelers: travelers || undefined,
          preference: preference || undefined,
          budget: unlimitedBudget ? "不限" : budget.toString()
        };
        sessionStorage.setItem('travelParams', JSON.stringify(travelParams));
        
        // 导航到结果页面
        router.push('/results');
      } catch (error) {
        console.error("提交表单时出错:", error);
        setIsSubmitting(false);
      }
    } else {
      setErrors(newErrors);
      console.log("表单验证失败:", newErrors);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4">
      <div className="w-full max-w-4xl text-center mb-5">
        <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">不知道去哪儿旅行规划</h1>
        <p className="text-slate-600 mb-3">智能生成您的专属旅行方案</p>
        
        {/* 添加渐变色短线 */}
        <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full"></div>
      </div>
      
      <Card className="w-full max-w-lg shadow-lg bg-white">
        <CardContent className="pt-2">
          {/* 添加"不知道去哪儿"勾选框和目的地输入框 */}
          <div className="flex items-center mb-3">
            <div className="flex items-center mr-3">
              <Checkbox 
                id="unknown-destination" 
                checked={unknownDestination}
                onCheckedChange={(checked) => setUnknownDestination(checked as boolean)}
                disabled={isSubmitting}
                className="h-4 w-4 border-indigo-400 focus:ring-0 focus:ring-offset-0 focus:outline-none data-[state=checked]:ring-0"
              />
              <label 
                htmlFor="unknown-destination" 
                className="text-md cursor-pointer ml-2 font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600"
              >
                {unknownDestination ? "不知道去哪儿" : "知道去哪儿："}
              </label>
            </div>
            <div className="flex-1">
              <Input
                id="destination"
                placeholder={unknownDestination ? "AI将为您推荐目的地" : "请输入目的地"}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={isSubmitting || unknownDestination}
                className={`border-slate-300 placeholder:text-slate-300 w-full ${unknownDestination ? 'bg-slate-50 text-slate-400' : ''}`}
              />
            </div>
          </div>
        
          <h2 className="text-xl font-semibold text-slate-800 mb-2">旅行偏好设置</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-3">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="departure" className="text-slate-700">出发地点 <span className="text-indigo-500">(必填)</span></Label>
                <Input
                  id="departure"
                  placeholder="输入出发地"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  className={`border-slate-300 placeholder:text-slate-300 ${errors.departure ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.departure && <p className="text-sm text-red-600">{errors.departure}</p>}
              </div>
              
              <div className="flex flex-col space-y-2">
                <Label htmlFor="days" className="text-slate-700">旅行天数 <span className="text-indigo-500">(必填)</span></Label>
                <Input
                  id="days"
                  type="text"
                  placeholder="例如：7 或 5-7"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className={`border-slate-300 placeholder:text-slate-300 ${errors.days ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.days && <p className="text-sm text-red-600">{errors.days}</p>}
                <p className="text-xs text-slate-500">您可以输入单个数字或范围（如"5-7"表示5到7天）</p>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Label htmlFor="travelers" className="text-slate-700">出行人数 <span className="text-indigo-500">(可选)</span></Label>
                <Input
                  id="travelers"
                  type="text"
                  placeholder="例如：2 或 2-4"
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  className={`border-slate-300 placeholder:text-slate-300 ${errors.travelers ? 'border-red-500' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.travelers && <p className="text-sm text-red-600">{errors.travelers}</p>}
                <p className="text-xs text-slate-500">您可以输入单个数字或范围（如"2-4"表示2到4人）</p>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Label htmlFor="preference" className="text-slate-700">其他偏好 <span className="text-indigo-500">(可选)</span></Label>
                <Input
                  id="preference"
                  type="text"
                  placeholder="例如：海边"
                  value={preference}
                  onChange={(e) => setPreference(e.target.value)}
                  className="border-slate-300 placeholder:text-slate-300"
                  disabled={isSubmitting}
                />
        </div>
              
              <div className="flex flex-col space-y-1 mt-0 mb-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="budget" className="text-slate-700">预算范围（人均）</Label>
                    
                    {/* 将"不限"复选框放在标题旁边 */}
                    <div className="flex items-center space-x-1 ml-2">
                      <Checkbox 
                        id="unlimited-budget" 
                        checked={unlimitedBudget}
                        onCheckedChange={handleUnlimitedBudgetChange}
                        disabled={isSubmitting}
                      />
                      <label 
                        htmlFor="unlimited-budget" 
                        className="text-sm text-slate-600 cursor-pointer"
                      >
                        不限
                      </label>
                    </div>
                  </div>
                  
                  <span className="text-indigo-600 font-medium">
                    {unlimitedBudget ? "不限" : `${budget} 元`}
                  </span>
                </div>

                <div className="px-1 mt-1">
                  <Slider
                    id="budget"
                    min={0}
                    max={20000}
                    step={500}
                    defaultValue={[budget]}
                    onValueChange={(value: number[]) => setBudget(value[0])}
                    disabled={isSubmitting || unlimitedBudget} // 当选择"不限"时禁用滑块
                    className={`py-3 ${unlimitedBudget ? 'opacity-50' : ''}`} // 当选择"不限"时降低滑块不透明度
                  />
                </div>
              </div>
              
              <div className="flex justify-center mt-2">
                <Button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white w-full py-4 text-lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      生成行程...
                    </>
                  ) : "生成行程"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
