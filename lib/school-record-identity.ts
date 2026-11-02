export const SCHOOL_RECORD_IDENTITY_KEYS = [
  "city",
  "district",
  "level",
  "name",
  "fullName",
  "fatraceSchoolId",
] as const;

type SchoolRecordIdentity = {
  city: string;
  district: string;
  level: string;
  name: string;
  fullName: string;
  fatraceSchoolId: number;
};

export function findSchoolIdentityMismatch(
  recordSchool: Record<string, unknown>,
  expectedSchool: SchoolRecordIdentity,
) {
  return SCHOOL_RECORD_IDENTITY_KEYS.find(
    (key) => recordSchool[key] !== expectedSchool[key],
  ) ?? null;
}
