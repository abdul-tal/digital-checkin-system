import { Response } from 'express';
import { sendSuccess, sendError } from '../../../src/shared/utils/response-formatter';

describe('Response Formatter', () => {
  let mockResponse: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('sendSuccess', () => {
    it('should send success response with data', () => {
      const data = { id: '123', name: 'Test' };

      sendSuccess(mockResponse as Response, data);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ data });
    });

    it('should send success response with custom status code', () => {
      const data = { created: true };

      sendSuccess(mockResponse as Response, data, 201);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ data });
    });

    it('should include meta data when provided', () => {
      const data = { id: '123' };
      const meta = { page: 1, total: 100 };

      sendSuccess(mockResponse as Response, data, 200, meta);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ data, meta });
    });

    it('should not include meta when not provided', () => {
      const data = { id: '123' };

      sendSuccess(mockResponse as Response, data);

      expect(jsonMock).toHaveBeenCalledWith({ data });
    });

    it('should handle null data', () => {
      sendSuccess(mockResponse as Response, null);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ data: null });
    });

    it('should handle array data', () => {
      const data = [{ id: '1' }, { id: '2' }];

      sendSuccess(mockResponse as Response, data);

      expect(jsonMock).toHaveBeenCalledWith({ data });
    });
  });

  describe('sendError', () => {
    it('should send error response with code and message', () => {
      sendError(mockResponse as Response, 'TEST_ERROR', 'Test error message');

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
        },
      });
    });

    it('should send error with custom status code', () => {
      sendError(mockResponse as Response, 'NOT_FOUND', 'Resource not found', 404);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
    });

    it('should include details when provided', () => {
      const details = { field: 'email', reason: 'invalid format' };

      sendError(mockResponse as Response, 'VALIDATION_ERROR', 'Validation failed', 400, details);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
      });
    });

    it('should not include details when not provided', () => {
      sendError(mockResponse as Response, 'ERROR', 'Error occurred', 500);

      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'ERROR',
          message: 'Error occurred',
        },
      });
    });

    it('should handle different HTTP status codes', () => {
      const testCases = [
        { code: 'BAD_REQUEST', message: 'Bad request', status: 400 },
        { code: 'UNAUTHORIZED', message: 'Unauthorized', status: 401 },
        { code: 'FORBIDDEN', message: 'Forbidden', status: 403 },
        { code: 'NOT_FOUND', message: 'Not found', status: 404 },
        { code: 'INTERNAL_ERROR', message: 'Internal error', status: 500 },
      ];

      testCases.forEach(({ code, message, status }) => {
        sendError(mockResponse as Response, code, message, status);
        expect(statusMock).toHaveBeenCalledWith(status);
      });
    });
  });
});
