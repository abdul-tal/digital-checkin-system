import { Request, Response, NextFunction } from 'express';
import { MockWeightService } from '../services/mock-weight.service';
import { ValidationError } from '../../shared/errors/app-error';

export class WeightController {
  constructor(private weightService: MockWeightService) {}

  weighBag = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bagId, weight } = req.body;

      if (!bagId) {
        throw new ValidationError('bagId is required');
      }

      const result = weight
        ? await this.weightService.weighBagWithWeight(bagId, weight)
        : await this.weightService.weighBag({ bagId });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
