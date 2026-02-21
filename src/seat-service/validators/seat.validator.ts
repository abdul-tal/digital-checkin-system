import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../shared/errors/app-error';

const holdSeatSchema = Joi.object({
  flightId: Joi.string()
    .pattern(/^[A-Z]{2}[0-9]{1,4}$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid flight ID format (e.g., SK123)' }),
  seatId: Joi.string()
    .pattern(/^[0-9]{1,2}[A-F]$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid seat ID format (e.g., 12A)' }),
  passengerId: Joi.string().min(5).max(50).required(),
});

export const validateHoldRequest = (req: Request, _res: Response, next: NextFunction) => {
  const { error } = holdSeatSchema.validate(req.body);

  if (error) {
    return next(new ValidationError(error.details[0].message));
  }

  next();
};

const releaseSeatSchema = Joi.object({
  seatId: Joi.string().pattern(/^[0-9]{1,2}[A-F]$/).required(),
  flightId: Joi.string().pattern(/^[A-Z]{2}[0-9]{1,4}$/).required(),
});

export const validateReleaseRequest = (req: Request, _res: Response, next: NextFunction) => {
  const { error } = releaseSeatSchema.validate(req.body);

  if (error) {
    return next(new ValidationError(error.details[0].message));
  }

  next();
};
