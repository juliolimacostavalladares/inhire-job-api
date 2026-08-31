import { CandidateProfile } from '../../../candidate-profile/domain/candidate-profile.entity';
import { TailoredContentResult } from './ai-provider.port';

export interface PdfRenderer {
  renderToPdf(profile: CandidateProfile, content: TailoredContentResult): Promise<Buffer>;
}

export const PDF_RENDERER = Symbol('PdfRenderer');
