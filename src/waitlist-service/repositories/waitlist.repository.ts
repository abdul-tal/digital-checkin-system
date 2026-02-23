import { Waitlist, IWaitlist } from '../../shared/models/waitlist.model';
import { FilterQuery, ClientSession } from 'mongoose';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('waitlist-repository');

export class WaitlistRepository {
  async create(data: Partial<IWaitlist>): Promise<IWaitlist> {
    const waitlist = new Waitlist(data);
    await waitlist.save();
    logger.debug('Waitlist entry created', { waitlistId: waitlist.waitlistId });
    return waitlist;
  }

  async findOne(
    filter: FilterQuery<IWaitlist>,
    options?: { sort?: any; session?: ClientSession }
  ): Promise<IWaitlist | null> {
    let query = Waitlist.findOne(filter);

    if (options?.sort) query = query.sort(options.sort);
    if (options?.session) query = query.session(options.session);

    return query.exec();
  }

  async find(filter: FilterQuery<IWaitlist>): Promise<IWaitlist[]> {
    return Waitlist.find(filter);
  }

  async deleteOne(
    filter: FilterQuery<IWaitlist>,
    session?: ClientSession
  ): Promise<void> {
    await Waitlist.deleteOne(filter).session(session || null);
    logger.debug('Waitlist entry deleted', { filter });
  }

  async countDocuments(filter: FilterQuery<IWaitlist>): Promise<number> {
    return Waitlist.countDocuments(filter);
  }

  async deleteExpired(): Promise<number> {
    const result = await Waitlist.deleteMany({
      expiresAt: { $lte: new Date() },
    });
    return result.deletedCount;
  }
}
