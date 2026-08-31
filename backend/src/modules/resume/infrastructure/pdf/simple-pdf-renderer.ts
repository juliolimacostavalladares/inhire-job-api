import { Injectable } from '@nestjs/common';
import { PdfRenderer } from '../../application/ports/pdf-renderer.port';
import { CandidateProfile } from '../../../candidate-profile/domain/candidate-profile.entity';
import { TailoredContentResult } from '../../application/ports/ai-provider.port';

@Injectable()
export class SimplePdfRenderer implements PdfRenderer {
  async renderToPdf(profile: CandidateProfile, content: TailoredContentResult): Promise<Buffer> {
    // Generate valid standard PDF structure with metadata
    const lines = [
      '%PDF-1.4',
      '%âãÏÓ',
      '1 0 obj',
      '<< /Type /Catalog /Pages 2 0 R >>',
      'endobj',
      '2 0 obj',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      'endobj',
      '3 0 obj',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      'endobj',
      '4 0 obj',
      '<< /Length 200 >>',
      'stream',
      'BT',
      '/F1 16 Tf',
      '50 720 Td',
      `(${this.escapePdfText(profile.fullName || 'Candidato')}) Tj`,
      '/F1 12 Tf',
      '0 -25 Td',
      `(${this.escapePdfText(content.tailoredHeadline)}) Tj`,
      '0 -20 Td',
      `(${this.escapePdfText(content.matchSummary)}) Tj`,
      'ET',
      'endstream',
      'endobj',
      '5 0 obj',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      'endobj',
      'xref',
      '0 6',
      '0000000000 65535 f ',
      '0000000015 00000 n ',
      '0000000068 00000 n ',
      '0000000125 00000 n ',
      '0000000247 00000 n ',
      '0000000497 00000 n ',
      'trailer',
      '<< /Size 6 /Root 1 0 R >>',
      'startxref',
      '570',
      '%%EOF',
    ];

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  private escapePdfText(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}
