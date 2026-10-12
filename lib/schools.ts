import registry from "@/data/reference/taichung-active-elementary-schools.json";
import refreshGroups from "@/data/reference/taichung-school-refresh-groups.json";

export type School = {
  city: string;
  district: string;
  level: string;
  name: string;
  fullName: string;
  fatraceSchoolId: number;
};

const schools = registry.schools as School[];

export function allSchools(): School[] {
  return schools.map((school) => ({ ...school }));
}

export function findSchool(schoolId: number): School | null {
  return schools.find((school) => school.fatraceSchoolId === schoolId) ?? null;
}

export function schoolsForGroup(groupId: number): School[] {
  const group = refreshGroups.groups.find((item) => item.id === groupId);
  if (!group) throw new Error(`不支援的抓取批次：${groupId}`);
  const districts = new Set(group.districts);
  const selected = schools.filter((school) => districts.has(school.district));
  if (selected.length !== group.expectedSchoolCount) {
    throw new Error(
      `第 ${groupId} 批應有 ${group.expectedSchoolCount} 間，實際為 ${selected.length} 間`,
    );
  }
  return selected.map((school) => ({ ...school }));
}

export function publicSchoolDirectory() {
  return schools.map((school) => ({
    ...school,
    sourceUrl: "https://fatraceschool.k12ea.gov.tw/frontend/search.html",
    experience: school.fatraceSchoolId === 193609 ? "complete" : "official_daily",
  }));
}
