import { createClient } from '@supabase/supabase-js';

// 定义数据模型接口
export interface TravelPreference {
  id?: string;
  created_at?: string;
  location: string;
  destination?: string;  // 目的地字段，可选
  days: string;
  travelers?: string;
  preference?: string;   // 其他偏好字段，可选
  budget?: string;
  user_id?: string;
  encrypted_data?: any; // 加密的敏感数据
}

export interface StoredItinerary {
  id?: string;
  created_at?: string;
  preference_id: string;
  itinerary_data: any; // 存储生成的完整行程数据
  destination: string;
  start_date: string;
  end_date: string;
  summary: string;
  is_ai_generated: boolean;
  user_id?: string;
  encrypted_data?: any; // 加密的敏感数据
  title?: string;        // 旅行推荐部分
  plan?: string;         // 行程规划部分
  highlights?: string;   // 旅行红黑榜部分
}

// 创建Supabase客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL或Key未配置，数据库功能将不可用');
  console.log('环境变量检查:', {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasNextPublicSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_KEY && process.env.SUPABASE_KEY.substring(0, 10) + '...',
    hasNextPublicSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_KEY,
    hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 保存用户的旅行偏好到数据库
 */
export async function saveTravelPreference(preference: TravelPreference): Promise<TravelPreference | null> {
  try {
    const { data, error } = await supabase
      .from('travel_preferences')
      .insert(preference)
      .select()
      .single();
    
    if (error) {
      console.error('保存旅行偏好时出错:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('数据库操作出错:', err);
    return null;
  }
}

/**
 * 保存生成的行程到数据库
 */
export async function saveItinerary(itinerary: StoredItinerary): Promise<StoredItinerary | null> {
  try {
    const { data, error } = await supabase
      .from('itineraries')
      .insert(itinerary)
      .select()
      .single();
    
    if (error) {
      console.error('保存行程时出错:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('数据库操作出错:', err);
    return null;
  }
}

/**
 * 获取用户的所有行程
 */
export async function getUserItineraries(userId: string): Promise<StoredItinerary[]> {
  try {
    const { data, error } = await supabase
      .from('itineraries')
      .select(`
        *,
        travel_preferences(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('获取用户行程时出错:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('数据库操作出错:', err);
    return [];
  }
}

/**
 * 获取特定行程的详情
 */
export async function getItineraryById(itineraryId: string): Promise<StoredItinerary | null> {
  try {
    const { data, error } = await supabase
      .from('itineraries')
      .select(`
        *,
        travel_preferences(*)
      `)
      .eq('id', itineraryId)
      .single();
    
    if (error) {
      console.error('获取行程详情时出错:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('数据库操作出错:', err);
    return null;
  }
}

/**
 * 更新现有行程
 */
export async function updateItinerary(itineraryId: string, updates: Partial<StoredItinerary>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('itineraries')
      .update(updates)
      .eq('id', itineraryId);
    
    if (error) {
      console.error('更新行程时出错:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('数据库操作出错:', err);
    return false;
  }
}

export default supabase; 