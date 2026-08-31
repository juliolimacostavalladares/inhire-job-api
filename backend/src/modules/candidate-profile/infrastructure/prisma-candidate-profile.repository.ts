import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CandidateProfileRepository } from '../application/ports/candidate-profile.repository';
import { CandidateProfile, ProfileStatus, LocationInfo, ExperienceInfo, EducationInfo } from '../domain/candidate-profile.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaCandidateProfileRepository implements CandidateProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<CandidateProfile | null> {
    const record = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!record) return null;
    return new CandidateProfile({
      id: record.id,
      userId: record.userId,
      status: record.status as ProfileStatus,
      version: record.version,
      fullName: record.fullName,
      headline: record.headline,
      email: record.email,
      phone: record.phone,
      location: record.location as LocationInfo | null,
      experiences: record.experiences as unknown as ExperienceInfo[] | null,
      education: record.education as unknown as EducationInfo[] | null,
      skills: record.skills,
      rawResumeArtifactId: record.rawResumeArtifactId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async save(profile: CandidateProfile): Promise<CandidateProfile> {
    const record = await this.prisma.candidateProfile.upsert({
      where: { userId: profile.userId },
      create: {
        id: profile.id,
        userId: profile.userId,
        status: profile.status,
        version: profile.version,
        fullName: profile.fullName,
        headline: profile.headline,
        email: profile.email,
        phone: profile.phone,
        location: profile.location ? (profile.location as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        experiences: profile.experiences ? (profile.experiences as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        education: profile.education ? (profile.education as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        skills: profile.skills,
        rawResumeArtifactId: profile.rawResumeArtifactId,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
      update: {
        status: profile.status,
        version: profile.version,
        fullName: profile.fullName,
        headline: profile.headline,
        email: profile.email,
        phone: profile.phone,
        location: profile.location ? (profile.location as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        experiences: profile.experiences ? (profile.experiences as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        education: profile.education ? (profile.education as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        skills: profile.skills,
        rawResumeArtifactId: profile.rawResumeArtifactId,
        updatedAt: profile.updatedAt,
      },
    });

    return new CandidateProfile({
      id: record.id,
      userId: record.userId,
      status: record.status as ProfileStatus,
      version: record.version,
      fullName: record.fullName,
      headline: record.headline,
      email: record.email,
      phone: record.phone,
      location: record.location as LocationInfo | null,
      experiences: record.experiences as unknown as ExperienceInfo[] | null,
      education: record.education as unknown as EducationInfo[] | null,
      skills: record.skills,
      rawResumeArtifactId: record.rawResumeArtifactId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
