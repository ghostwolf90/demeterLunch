import registry from "@/data/reference/active-elementary-schools.json";
import refreshGroups from "@/data/reference/school-refresh-groups.json";

export type School = {
  city: string;
  district: string;
  level: string;
  name: string;
  fullName: string;
  fatraceSchoolId: number;
};

const schools = registry.schools as School[];

type RefreshGroup = {
  id: number;
  city: string;
  districts: string[];
  expectedSchoolCount: number;
};

const groups = refreshGroups.groups as RefreshGroup[];

export function allSchools(): School[] {
  return schools.map((school) => ({ ...school }));
}

export function findSchool(schoolId: number): School | null {
  return schools.find((school) => school.fatraceSchoolId === schoolId) ?? null;
}

export function schoolsForGroup(groupId: number): School[] {
  const group = groups.find((item) => item.id === groupId);
  if (!group) throw new Error(`不支援的抓取批次：${groupId}`);
  const districts = new Set(group.districts);
  const selected = schools.filter(
    (school) => school.city === group.city && districts.has(school.district),
  );
  if (selected.length !== group.expectedSchoolCount) {
    throw new Error(
      `第 ${groupId} 批應有 ${group.expectedSchoolCount} 間，實際為 ${selected.length} 間`,
    );
  }
  return selected.map((school) => ({ ...school }));
}

export function refreshGroupIds(): number[] {
  return groups.map((group) => group.id);
}

export function refreshGroupLabel(groupId: number): string {
  const group = groups.find((item) => item.id === groupId);
  if (!group) return `第 ${groupId} 批`;
  return `第 ${group.id} 批（${group.city}，${group.expectedSchoolCount} 校）`;
}

export function publicSchoolDirectory() {
  return schools.map((school) => ({
    ...school,
    sourceUrl: "https://fatraceschool.k12ea.gov.tw/frontend/search.html",
    experience: [193609, 64754668].includes(school.fatraceSchoolId) ? "complete" : "official_daily",
  }));
}
