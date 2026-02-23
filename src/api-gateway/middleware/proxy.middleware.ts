import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('proxy-middleware');

export const proxyRequest = (targetServiceUrl: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = `${targetServiceUrl}${req.originalUrl}`;

      logger.debug('Proxying request', {
        method: req.method,
        targetUrl: url,
        originalUrl: req.originalUrl,
        requestId: req.headers['x-request-id'],
      });

      const forwardHeaders: Record<string, any> = {};
      const headersToForward = ['authorization', 'content-type', 'x-request-id'];
      
      for (const header of headersToForward) {
        if (req.headers[header]) {
          forwardHeaders[header] = req.headers[header];
        }
      }

      const response = await axios({
        method: req.method,
        url,
        data: req.body,
        params: req.query,
        headers: forwardHeaders,
        timeout: 30000,
      });

      res.status(response.status).json(response.data);
    } catch (error: any) {
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        logger.error('Proxy error', { error: error.message });
        next(error);
      }
    }
  };
};
