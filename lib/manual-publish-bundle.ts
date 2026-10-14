type JsonObject = Record<string, unknown>;

export type ManualPublishBatchCounts = {
  schools: number;
  available: number;
  noMeal: number;
  notPublished: number;
};

export function validateManualPublishBatchCounts(
  summary: JsonObject,
  resultsLength: number,
  recordsLength: number,
): ManualPublishBatchCounts {
  const schools = integerValue(summary.schools, "summary.schools");
  const available = integerValue(summary.available, "summary.available");
  const noMeal = integerValue(summary.noMeal, "summary.noMeal");
  const notPublished = integerValue(
    summary.notPublished,
    "summary.notPublished",
  );
  const failed = integerValue(summary.failed, "summary.failed");

  if (failed !== 0) {
    throw new Error("發佈包不得包含抓取失敗的學校");
  }
  if (
    schools < 1
    || schools !== resultsLength
    || available + noMeal + notPublished !== resultsLength
    || recordsLength !== available + noMeal
  ) {
    throw new Error("發佈包的批次摘要、學校結果與 reviewed 紀錄數量不一致");
  }

  return { schools, available, noMeal, notPublished };
}

function integerValue(value: unknown, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${label} 必須是非負整數`);
  }
  return result;
}
