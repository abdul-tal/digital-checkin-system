import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../src/shared/utils/async-handler';

describe('Async Handler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should call async function and not call next on success', async () => {
    const asyncFn = jest.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(asyncFn);

    await handler(mockRequest as Request, mockResponse as Response, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next with error when async function throws', async () => {
    const error = new Error('Test error');
    const asyncFn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(asyncFn);

    await handler(mockRequest as Request, mockResponse as Response, mockNext);

    expect(asyncFn).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle Promise rejection', async () => {
    const error = new Error('Promise rejected');
    const asyncFn = async () => {
      throw error;
    };
    const handler = asyncHandler(asyncFn);

    await handler(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should work with async functions that return values', async () => {
    const asyncFn = async (_req: Request, res: Response) => {
      res.json({ success: true });
    };
    const handler = asyncHandler(asyncFn);

    await handler(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle multiple async handlers', async () => {
    const asyncFn1 = jest.fn().mockResolvedValue(undefined);
    const asyncFn2 = jest.fn().mockResolvedValue(undefined);

    const handler1 = asyncHandler(asyncFn1);
    const handler2 = asyncHandler(asyncFn2);

    await handler1(mockRequest as Request, mockResponse as Response, mockNext);
    await handler2(mockRequest as Request, mockResponse as Response, mockNext);

    expect(asyncFn1).toHaveBeenCalled();
    expect(asyncFn2).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });
});
