import { CrawlRun, CrawlItemProps } from '../../domain/crawl-run.entity';

export interface CrawlRunsRepository {
  findById(id: string): Promise<CrawlRun | null>;
  findAll(filter?: { type?: string; status?: string; page?: number; limit?: number }): Promise<{ items: CrawlRun[]; total: number }>;
  save(run: CrawlRun): Promise<CrawlRun>;
  addItem(item: CrawlItemProps): Promise<void>;
}

export const CRAWL_RUNS_REPOSITORY = Symbol('CrawlRunsRepository');
