import axios from 'axios';

// Proxy를 타지 않고 105번 서버로 직접 요청합니다.
const SCOUTER_SERVER_URL = import.meta.env.VITE_SCOUTER_SERVER_URL || 'http://localhost:6180/scouter/v1';
const xlogOffsets: Record<string, { offset1: number; offset2: number }> = {};

const api = axios.create({
  baseURL: SCOUTER_SERVER_URL,
  timeout: 5000,
});

export const scouterApi = {
  getAgents: async () => {
    try {
      const response = await api.get('/object');
      return response.data?.result ?? [];
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      return null;
    }
  },
  getCpuUsage: async (objHash: string) => {
    try {
      const response = await api.get('/counter/realTime/Cpu', { params: { objHashes: objHash } });
      return response.data?.result?.[0] ?? null;
    } catch (error) {
      console.error(`Failed to fetch CPU for ${objHash}:`, error);
      return null;
    }
  },
  getGcCount: async (objHash: string) => {
    try {
      const response = await api.get('/counter/realTime/GcCount', { params: { objHashes: objHash } });
      return response.data?.result ?? [];
    } catch (error) {
      console.error(`Failed to fetch GC for ${objHash}:`, error);
      return null;
    }
  },
  getHeapUsed: async (objHash: string) => {
    try {
      const response = await api.get('/counter/realTime/HeapUsed', { params: { objHashes: objHash } });
      return response.data?.result ?? [];
    } catch (error) {
      console.error(`Failed to fetch HeapUsed for ${objHash}:`, error);
      return null;
    }
  },
getXLog: async (objHash: string) => {
    try {
      const offsets = xlogOffsets[objHash] || { offset1: 0, offset2: 0 };
      const response = await api.get(
        `/xlog-data/realTime/${offsets.offset1}/${offsets.offset2}`,
        { params: { objHashes: objHash } }
      );
      const result = response.data?.result;
      if (result?.offset1 !== undefined && result?.offset2 !== undefined) {
        xlogOffsets[objHash] = { offset1: result.offset1, offset2: result.offset2 };
      }
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch XLog for ${objHash}:`, error);
      return null;
    }
  },
  getProfile: async (yyyymmdd: string, txid: string) => {
    try {
      const response = await api.get(`/profile-data/${yyyymmdd}/${txid}`);
      return response.data?.result ?? null;
    } catch (error) {
      console.error(`Failed to fetch profile for ${txid}:`, error);
      return null;
    }
  },
  getTopology: async (objHashes: string) => {
    try {
      const response = await api.get('/interactionCounter/realTime', { params: { objHashes } });
      return response.data?.result ?? [];
    } catch (error) {
      console.error('Failed to fetch topology:', error);
      return [];
    }
  },
  searchXlog: async (yyyymmdd: string, startTimeMillis: number, endTimeMillis: number, objHash: string) => {
    try {
      const response = await api.get(`/xlog-data/search/${yyyymmdd}`, {
        params: { startTimeMillis, endTimeMillis, objHash },
      });
      return response.data?.result ?? null;
    } catch (error) {
      console.error(`Failed to search xlog for ${yyyymmdd}:`, error);
      return null;
    }
  }
};
