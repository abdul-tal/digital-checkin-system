import axios from 'axios';
import { HttpClient } from '../../../src/shared/utils/http-client';

jest.mock('axios');

describe('HttpClient', () => {
  let client: HttpClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    client = new HttpClient('http://localhost:3000', 5000);
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3000',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should register request interceptor', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should register response interceptor', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should make GET request and return data', async () => {
      const mockData = { id: '123', name: 'Test' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.get('/api/resource');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/resource', undefined);
      expect(result).toEqual(mockData);
    });

    it('should pass config to GET request', async () => {
      const mockData = { id: '123' };
      const config = { headers: { 'X-Custom': 'value' } };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      await client.get('/api/resource', config);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/resource', config);
    });
  });

  describe('post', () => {
    it('should make POST request and return data', async () => {
      const mockData = { id: '123', created: true };
      const postData = { name: 'New Item' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockData });

      const result = await client.post('/api/resource', postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/resource', postData, undefined);
      expect(result).toEqual(mockData);
    });

    it('should pass config to POST request', async () => {
      const mockData = { id: '123' };
      const postData = { name: 'Test' };
      const config = { headers: { 'X-Custom': 'value' } };
      mockAxiosInstance.post.mockResolvedValue({ data: mockData });

      await client.post('/api/resource', postData, config);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/resource', postData, config);
    });
  });

  describe('put', () => {
    it('should make PUT request and return data', async () => {
      const mockData = { id: '123', updated: true };
      const putData = { name: 'Updated Item' };
      mockAxiosInstance.put.mockResolvedValue({ data: mockData });

      const result = await client.put('/api/resource/123', putData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/resource/123', putData, undefined);
      expect(result).toEqual(mockData);
    });
  });

  describe('delete', () => {
    it('should make DELETE request and return data', async () => {
      const mockData = { deleted: true };
      mockAxiosInstance.delete.mockResolvedValue({ data: mockData });

      const result = await client.delete('/api/resource/123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/resource/123', undefined);
      expect(result).toEqual(mockData);
    });
  });

  describe('error handling', () => {
    it('should propagate request errors', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(client.get('/api/resource')).rejects.toThrow('Network error');
    });

    it('should propagate post errors', async () => {
      const error = new Error('Server error');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(client.post('/api/resource', {})).rejects.toThrow('Server error');
    });
  });
});
